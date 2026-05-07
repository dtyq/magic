package docparser

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"

	document "magic/internal/domain/knowledge/document/metadata"
)

// XlsxParser Excel 解析器
type XlsxParser struct {
	ocrClient     document.OCRClient
	maxOCRPerFile int
	limits        document.ResourceLimits
}

// NewXlsxParser 创建 Excel 解析器
func NewXlsxParser() *XlsxParser {
	return NewXlsxParserWithOCR(nil, document.DefaultEmbeddedImageOCRLimit())
}

// NewXlsxParserWithOCR 创建带图片 OCR 能力的 Excel 解析器。
func NewXlsxParserWithOCR(ocrClient document.OCRClient, maxOCRPerFile int) *XlsxParser {
	return NewXlsxParserWithOCRAndLimits(ocrClient, maxOCRPerFile, document.DefaultResourceLimits())
}

// NewXlsxParserWithOCRAndLimits 创建带图片 OCR 和资源限制的 Excel 解析器。
func NewXlsxParserWithOCRAndLimits(
	ocrClient document.OCRClient,
	maxOCRPerFile int,
	limits document.ResourceLimits,
) *XlsxParser {
	return &XlsxParser{
		ocrClient:     ocrClient,
		maxOCRPerFile: document.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
		limits:        document.NormalizeResourceLimits(limits),
	}
}

// Parse 解析 Excel 文件
func (p *XlsxParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 Excel 文件。
func (p *XlsxParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 Excel 文件并返回结构化结果。
func (p *XlsxParser) ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*document.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, document.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 Excel 文件并返回结构化结果。
func (p *XlsxParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options document.ParseOptions,
) (*document.ParsedDocument, error) {
	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, fmt.Errorf("open xlsx failed: %w", err)
	}
	defer func() { _ = f.Close() }()

	if !options.TableExtraction {
		return buildPlainTextSpreadsheetDocument(f, fileType, p.limits)
	}

	var ocrHelper *embeddedImageOCRHelper
	if options.ImageExtraction && options.ImageOCR {
		ocrHelper = newEmbeddedImageOCRHelper(p.ocrClient, p.maxOCRPerFile)
	}
	tables := make([]tabularTable, 0)
	var totalRows int64
	var totalCells int64
	for _, sheet := range f.GetSheetList() {
		rows, err := f.GetRows(sheet)
		if err != nil {
			return nil, fmt.Errorf("get rows failed for sheet %s: %w", sheet, err)
		}
		sheetRows, sheetCells := countRawTabularRowsCells(rows)
		totalRows += sheetRows
		totalCells += sheetCells
		if err := document.CheckTabularSize(totalRows, totalCells, p.limits, "parse_xlsx_rows"); err != nil {
			return nil, fmt.Errorf("check xlsx table size: %w", err)
		}
		visible, visibleErr := f.GetSheetVisible(sheet)
		if visibleErr != nil {
			visible = true
		}
		matrix, matrixErr := buildExcelMatrix(f, sheet, rows)
		if matrixErr != nil {
			return nil, fmt.Errorf("build excel matrix for sheet %s failed: %w", sheet, matrixErr)
		}
		applySheetImageOCRToMatrix(ctx, f, sheet, matrix, ocrHelper)
		sheetTables := buildTablesFromMatrix(resolveTabularFileName(fileURL), strings.ToLower(fileType), sheet, !visible, matrix)
		tables = append(tables, sheetTables...)
	}
	if len(tables) == 0 {
		parsed := document.NewPlainTextParsedDocument(fileType, "")
		ocrHelper.apply(parsed)
		return parsed, nil
	}
	parsed := buildTabularParsedDocument(strings.ToLower(fileType), tables)
	ocrHelper.apply(parsed)
	return parsed, nil
}

// Supports 检查是否支持该文件类型
func (p *XlsxParser) Supports(fileType string) bool {
	t := strings.ToLower(fileType)
	return t == "xlsx" || t == "xlsm"
}

// NeedsResolvedURL Xlsx 解析只依赖文件流。
func (p *XlsxParser) NeedsResolvedURL() bool {
	return false
}

func buildPlainTextSpreadsheetDocument(
	f *excelize.File,
	fileType string,
	limits document.ResourceLimits,
) (*document.ParsedDocument, error) {
	if f == nil {
		return document.NewPlainTextParsedDocument(fileType, ""), nil
	}

	sections := make([]string, 0, len(f.GetSheetList()))
	var totalRows int64
	var totalCells int64
	for _, sheet := range f.GetSheetList() {
		rows, err := f.GetRows(sheet)
		if err != nil {
			continue
		}
		sheetRows, sheetCells := countRawTabularRowsCells(rows)
		totalRows += sheetRows
		totalCells += sheetCells
		if err := document.CheckTabularSize(totalRows, totalCells, limits, "parse_xlsx_rows"); err != nil {
			return nil, fmt.Errorf("check xlsx table size: %w", err)
		}
		lines := make([]string, 0, len(rows)+1)
		lines = append(lines, "Sheet: "+sheet)
		for _, row := range rows {
			cells := make([]string, 0, len(row))
			for _, value := range row {
				trimmed := strings.TrimSpace(value)
				if trimmed == "" {
					continue
				}
				cells = append(cells, trimmed)
			}
			if len(cells) == 0 {
				continue
			}
			lines = append(lines, strings.Join(cells, "\t"))
		}
		if len(lines) == 1 {
			continue
		}
		sections = append(sections, strings.Join(lines, "\n"))
	}
	return document.NewPlainTextParsedDocument(fileType, strings.Join(sections, "\n\n")), nil
}

func buildExcelMatrix(f *excelize.File, sheet string, rows [][]string) ([][]tabularCell, error) {
	mergeCells, err := f.GetMergeCells(sheet, true)
	if err != nil {
		return nil, fmt.Errorf("get merge cells failed: %w", err)
	}
	maxCols, err := resolveExcelMatrixMaxCols(rows, mergeCells)
	if err != nil {
		return nil, err
	}
	matrix, err := initializeExcelMatrix(f, sheet, rows, maxCols)
	if err != nil {
		return nil, err
	}
	if err := applyExcelMergeCells(matrix, mergeCells); err != nil {
		return nil, err
	}
	return matrix, nil
}

func resolveExcelMatrixMaxCols(rows [][]string, mergeCells []excelize.MergeCell) (int, error) {
	maxCols := 0
	for _, row := range rows {
		maxCols = max(maxCols, len(row))
	}
	for _, mergeCell := range mergeCells {
		startCol, _, err := axisToCoordinates(mergeCell.GetStartAxis())
		if err != nil {
			return 0, err
		}
		endCol, _, err := axisToCoordinates(mergeCell.GetEndAxis())
		if err != nil {
			return 0, err
		}
		maxCols = max(maxCols, startCol, endCol)
	}
	return maxCols, nil
}

func initializeExcelMatrix(f *excelize.File, sheet string, rows [][]string, maxCols int) ([][]tabularCell, error) {
	matrix := make([][]tabularCell, len(rows))
	for rowIndex, row := range rows {
		rowCells, err := buildExcelRowCells(f, sheet, row, rowIndex, maxCols)
		if err != nil {
			return nil, err
		}
		matrix[rowIndex] = rowCells
	}
	return matrix, nil
}

func buildExcelRowCells(
	f *excelize.File,
	sheet string,
	row []string,
	rowIndex int,
	maxCols int,
) ([]tabularCell, error) {
	cells := make([]tabularCell, maxCols)
	for colIndex := range maxCols {
		cellRef, err := excelize.CoordinatesToCellName(colIndex+1, rowIndex+1)
		if err != nil {
			return nil, fmt.Errorf("build cell ref failed: %w", err)
		}
		if colIndex < len(row) {
			cells[colIndex].Value = strings.TrimSpace(row[colIndex])
		}
		cells[colIndex].CellRef = cellRef
		formula, formulaErr := f.GetCellFormula(sheet, cellRef)
		if formulaErr == nil && strings.TrimSpace(formula) != "" {
			cells[colIndex].HasFormula = true
		}
	}
	return cells, nil
}

func applyExcelMergeCells(matrix [][]tabularCell, mergeCells []excelize.MergeCell) error {
	for _, mergeCell := range mergeCells {
		bounds, err := resolveMergeCellBounds(mergeCell)
		if err != nil {
			return err
		}
		if !bounds.valid() {
			continue
		}
		mergeValue, hasFormula := resolveMergeCellPayload(matrix, bounds, strings.TrimSpace(mergeCell.GetCellValue()))
		for rowIndex := bounds.startRow - 1; rowIndex < min(bounds.endRow, len(matrix)); rowIndex++ {
			for colIndex := bounds.startCol - 1; colIndex < min(bounds.endCol, len(matrix[rowIndex])); colIndex++ {
				if matrix[rowIndex][colIndex].Value == "" {
					matrix[rowIndex][colIndex].Value = mergeValue
				}
				matrix[rowIndex][colIndex].HasFormula = matrix[rowIndex][colIndex].HasFormula || hasFormula
			}
		}
	}
	return nil
}

type mergeCellBounds struct {
	startCol int
	startRow int
	endCol   int
	endRow   int
}

func (b mergeCellBounds) valid() bool {
	return b.startCol > 0 && b.startRow > 0 && b.endCol > 0 && b.endRow > 0
}

func resolveMergeCellBounds(mergeCell excelize.MergeCell) (mergeCellBounds, error) {
	startCol, startRow, err := axisToCoordinates(mergeCell.GetStartAxis())
	if err != nil {
		return mergeCellBounds{}, err
	}
	endCol, endRow, err := axisToCoordinates(mergeCell.GetEndAxis())
	if err != nil {
		return mergeCellBounds{}, err
	}
	return mergeCellBounds{
		startCol: startCol,
		startRow: startRow,
		endCol:   endCol,
		endRow:   endRow,
	}, nil
}

func resolveMergeCellPayload(matrix [][]tabularCell, bounds mergeCellBounds, fallbackValue string) (string, bool) {
	value := fallbackValue
	hasFormula := false
	if bounds.startRow-1 < len(matrix) && bounds.startCol-1 < len(matrix[bounds.startRow-1]) {
		cell := matrix[bounds.startRow-1][bounds.startCol-1]
		if value == "" {
			value = cell.Value
		}
		hasFormula = cell.HasFormula
	}
	return value, hasFormula
}

func axisToCoordinates(axis string) (int, int, error) {
	col, row, err := excelize.CellNameToCoordinates(axis)
	if err != nil {
		return 0, 0, fmt.Errorf("convert axis %s failed: %w", axis, err)
	}
	return col, row, nil
}

func applySheetImageOCRToMatrix(
	ctx context.Context,
	file *excelize.File,
	sheet string,
	matrix [][]tabularCell,
	ocrHelper *embeddedImageOCRHelper,
) {
	if len(matrix) == 0 || file == nil || ocrHelper == nil {
		return
	}
	for rowIndex := range matrix {
		for colIndex := range matrix[rowIndex] {
			cell := &matrix[rowIndex][colIndex]
			pictures, err := file.GetPictures(sheet, cell.CellRef)
			if err != nil || len(pictures) == 0 {
				continue
			}
			parts := make([]string, 0, len(pictures))
			for _, picture := range pictures {
				text := ocrHelper.recognizeBytes(ctx, picture.File, picture.Extension)
				if text == "" {
					continue
				}
				parts = append(parts, text)
			}
			if len(parts) == 0 {
				continue
			}
			cell.Value = mergeStructuredFieldValue(cell.Value, strings.Join(parts, "\n"))
		}
	}
}

func mergeStructuredFieldValue(current, imageText string) string {
	current = strings.TrimSpace(current)
	imageText = strings.TrimSpace(imageText)
	switch {
	case current == "":
		return imageText
	case imageText == "":
		return current
	case strings.Contains(current, imageText):
		return current
	default:
		return current + "\n" + imageText
	}
}
