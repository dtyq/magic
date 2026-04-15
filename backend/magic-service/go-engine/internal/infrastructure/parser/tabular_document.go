package docparser

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"maps"
	"math"
	"net/url"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	"magic/internal/domain/knowledge/document/service"
)

const (
	tabularDefaultSheetName     = "CSV"
	tabularDefaultTableTitle    = "Table"
	tabularHeaderMaxRows        = 4
	tabularIdentifierMinRunes   = 4
	tabularHeaderLabelMaxRunes  = 12
	tabularSummarySampleLimit   = 3
	tabularSummaryNumberFmt     = "%.2f"
	tabularCrossTableValueLabel = "值"
	tabularUniqueRatioWeight    = 0.7
	tabularTextRatioWeight      = 0.3
	tabularHeaderTextRatioMin   = 0.6
	tabularHeaderUniqueRatioMin = 0.5
	tabularDataLikeRatioMin     = 0.5
	tabularUniquenessSelectMin  = 0.6
	tabularDelimiterProbeLines  = 8
	tabularIntegerTolerance     = 1e-9
)

type tabularCell struct {
	Value      string
	CellRef    string
	HasFormula bool
}

type tableRange struct {
	rowStart int
	rowEnd   int
	colStart int
	colEnd   int
}

type tabularField struct {
	HeaderPath string
	Value      string
	CellRef    string
}

type tabularRow struct {
	Index       int
	Fields      []tabularField
	PrimaryKeys []string
	HasFormula  bool
}

type tabularTable struct {
	FileName          string
	SourceFormat      string
	SheetName         string
	SheetHidden       bool
	TableID           string
	Title             string
	Headers           []string
	Rows              []tabularRow
	PrimaryKeyHeaders []string
}

type tabularTableBuildInput struct {
	FileName     string
	SourceFormat string
	SheetName    string
	SheetHidden  bool
	TableOrdinal int
	TableRange   tableRange
	Cells        [][]tabularCell
}

func parseCSVDocument(file io.Reader, fileURL, fileType string) (*document.ParsedDocument, error) {
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read csv failed: %w", err)
	}
	delimiter := detectCSVDelimiter(data)
	reader := csv.NewReader(strings.NewReader(string(data)))
	reader.Comma = delimiter
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read csv records failed: %w", err)
	}
	matrix := make([][]tabularCell, 0, len(records))
	for rowIndex, record := range records {
		row := make([]tabularCell, len(record))
		for colIndex, value := range record {
			row[colIndex] = tabularCell{
				Value:   strings.TrimSpace(value),
				CellRef: "",
			}
		}
		if rowIndex == len(records)-1 && len(row) == 1 && row[0].Value == "" {
			continue
		}
		matrix = append(matrix, row)
	}
	tables := buildTablesFromMatrix(resolveTabularFileName(fileURL), fileType, tabularDefaultSheetName, false, matrix)
	if len(tables) == 0 {
		return document.NewPlainTextParsedDocument(fileType, strings.TrimSpace(string(data))), nil
	}
	return buildTabularParsedDocument(fileType, tables), nil
}

func buildTablesFromMatrix(fileName, sourceFormat, sheetName string, sheetHidden bool, matrix [][]tabularCell) []tabularTable {
	ranges := detectTableRanges(matrix)
	tables := make([]tabularTable, 0, len(ranges))
	for index, tableRange := range ranges {
		cells := sliceMatrix(matrix, tableRange)
		table, ok := buildTabularTable(tabularTableBuildInput{
			FileName:     fileName,
			SourceFormat: sourceFormat,
			SheetName:    sheetName,
			SheetHidden:  sheetHidden,
			TableOrdinal: index + 1,
			TableRange:   tableRange,
			Cells:        cells,
		})
		if !ok {
			continue
		}
		tables = append(tables, table)
	}
	return tables
}

func detectTableRanges(matrix [][]tabularCell) []tableRange {
	if len(matrix) == 0 {
		return nil
	}
	rowRanges := make([][2]int, 0)
	start := -1
	for rowIndex, row := range matrix {
		if isBlankTabularRow(row) {
			if start >= 0 {
				rowRanges = append(rowRanges, [2]int{start, rowIndex - 1})
				start = -1
			}
			continue
		}
		if start < 0 {
			start = rowIndex
		}
	}
	if start >= 0 {
		rowRanges = append(rowRanges, [2]int{start, len(matrix) - 1})
	}

	ranges := make([]tableRange, 0, len(rowRanges))
	for _, rowRange := range rowRanges {
		columnBands := detectColumnBands(matrix, rowRange[0], rowRange[1])
		for _, band := range columnBands {
			ranges = append(ranges, tableRange{
				rowStart: rowRange[0],
				rowEnd:   rowRange[1],
				colStart: band[0],
				colEnd:   band[1],
			})
		}
	}
	return ranges
}

func detectColumnBands(matrix [][]tabularCell, rowStart, rowEnd int) [][2]int {
	maxCols := 0
	for rowIndex := rowStart; rowIndex <= rowEnd; rowIndex++ {
		maxCols = max(maxCols, len(matrix[rowIndex]))
	}
	if maxCols == 0 {
		return nil
	}

	occupied := make([]bool, maxCols)
	for rowIndex := rowStart; rowIndex <= rowEnd; rowIndex++ {
		row := matrix[rowIndex]
		for colIndex := range maxCols {
			if colIndex >= len(row) || strings.TrimSpace(row[colIndex].Value) == "" {
				continue
			}
			occupied[colIndex] = true
		}
	}

	bands := make([][2]int, 0)
	start := -1
	for colIndex, used := range occupied {
		if !used {
			if start >= 0 {
				bands = append(bands, [2]int{start, colIndex - 1})
				start = -1
			}
			continue
		}
		if start < 0 {
			start = colIndex
		}
	}
	if start >= 0 {
		bands = append(bands, [2]int{start, maxCols - 1})
	}
	return bands
}

func sliceMatrix(matrix [][]tabularCell, tableRange tableRange) [][]tabularCell {
	sliced := make([][]tabularCell, 0, tableRange.rowEnd-tableRange.rowStart+1)
	for rowIndex := tableRange.rowStart; rowIndex <= tableRange.rowEnd; rowIndex++ {
		row := matrix[rowIndex]
		width := tableRange.colEnd - tableRange.colStart + 1
		cells := make([]tabularCell, width)
		for colIndex := range width {
			globalCol := tableRange.colStart + colIndex
			if globalCol >= 0 && globalCol < len(row) {
				cells[colIndex] = row[globalCol]
			}
		}
		sliced = append(sliced, cells)
	}
	return trimTabularMatrix(sliced)
}

func trimTabularMatrix(matrix [][]tabularCell) [][]tabularCell {
	if len(matrix) == 0 {
		return nil
	}
	top := 0
	for top < len(matrix) && isBlankTabularRow(matrix[top]) {
		top++
	}
	bottom := len(matrix) - 1
	for bottom >= top && isBlankTabularRow(matrix[bottom]) {
		bottom--
	}
	if top > bottom {
		return nil
	}

	left := math.MaxInt
	right := -1
	for rowIndex := top; rowIndex <= bottom; rowIndex++ {
		for colIndex, cell := range matrix[rowIndex] {
			if strings.TrimSpace(cell.Value) == "" {
				continue
			}
			left = min(left, colIndex)
			right = max(right, colIndex)
		}
	}
	if right < 0 {
		return nil
	}

	trimmed := make([][]tabularCell, 0, bottom-top+1)
	for rowIndex := top; rowIndex <= bottom; rowIndex++ {
		row := matrix[rowIndex]
		rowCopy := make([]tabularCell, right-left+1)
		copy(rowCopy, row[left:right+1])
		trimmed = append(trimmed, rowCopy)
	}
	return trimmed
}

func buildTabularTable(input tabularTableBuildInput) (tabularTable, bool) {
	if len(input.Cells) == 0 {
		return tabularTable{}, false
	}

	title := ""
	titleOffset := 0
	if looksLikeTitleRow(input.Cells[0]) && len(input.Cells) > 1 {
		title = firstNonEmptyCellValue(input.Cells[0])
		titleOffset = 1
	}
	dataMatrix := input.Cells[titleOffset:]
	if len(dataMatrix) == 0 {
		return tabularTable{}, false
	}

	headerRows := resolveHeaderRowCountForSourceFormat(input.SourceFormat, dataMatrix)
	headerCells := dataMatrix[:headerRows]
	rowCells := dataMatrix[headerRows:]
	if len(rowCells) == 0 {
		return tabularTable{}, false
	}

	headers := flattenHeaderPaths(headerCells, widthOfMatrix(dataMatrix))
	if len(headers) == 0 {
		headers = buildDefaultHeaders(widthOfMatrix(dataMatrix))
	}

	title = resolveTableTitle(title, input.SheetName, input.TableOrdinal)
	rows := buildTabularRows(headers, rowCells, input.TableRange.rowStart+titleOffset+headerRows)
	if len(rows) == 0 {
		return tabularTable{}, false
	}
	headers, rows = maybeConvertCrossTable(headers, rows)
	primaryKeyHeaders := detectPrimaryKeyHeaders(headers, rows)
	assignRowPrimaryKeys(rows, primaryKeyHeaders)

	tableID := stableTabularID(
		input.SourceFormat,
		input.SheetName,
		title,
		strconv.Itoa(input.TableRange.rowStart),
		strconv.Itoa(input.TableRange.colStart),
	)
	return tabularTable{
		FileName:          input.FileName,
		SourceFormat:      input.SourceFormat,
		SheetName:         input.SheetName,
		SheetHidden:       input.SheetHidden,
		TableID:           tableID,
		Title:             title,
		Headers:           headers,
		Rows:              rows,
		PrimaryKeyHeaders: primaryKeyHeaders,
	}, true
}

func buildTabularRows(headers []string, rows [][]tabularCell, rowOffset int) []tabularRow {
	output := make([]tabularRow, 0, len(rows))
	for rowIndex, row := range rows {
		fields := make([]tabularField, 0, len(headers))
		hasFormula := tabularRowHasFormula(row)
		for colIndex, header := range headers {
			if colIndex >= len(row) {
				continue
			}
			value := strings.TrimSpace(row[colIndex].Value)
			if value == "" {
				continue
			}
			field := tabularField{
				HeaderPath: header,
				Value:      value,
				CellRef:    row[colIndex].CellRef,
			}
			fields = append(fields, field)
		}
		if len(fields) == 0 {
			continue
		}
		output = append(output, tabularRow{
			Index:      rowOffset + rowIndex + 1,
			Fields:     fields,
			HasFormula: hasFormula,
		})
	}
	return output
}

func maybeConvertCrossTable(headers []string, rows []tabularRow) ([]string, []tabularRow) {
	if len(headers) < 3 || len(rows) == 0 {
		return headers, rows
	}
	if !looksLikeCrossTable(headers, rows) {
		return headers, rows
	}

	rowHeader := strings.TrimSpace(headers[0])
	if rowHeader == "" {
		rowHeader = "row_key"
	}
	converted := make([]tabularRow, 0, len(rows)*(len(headers)-1))
	for _, row := range rows {
		rowKey := ""
		rowCellRef := ""
		valueByHeader := make(map[string]tabularField, len(row.Fields))
		for _, field := range row.Fields {
			valueByHeader[field.HeaderPath] = field
			if field.HeaderPath == headers[0] {
				rowKey = field.Value
				rowCellRef = field.CellRef
			}
		}
		if rowKey == "" {
			continue
		}
		subIndex := 0
		for _, header := range headers[1:] {
			field, ok := valueByHeader[header]
			if !ok || field.Value == "" {
				continue
			}
			converted = append(converted, tabularRow{
				Index: row.Index*1000 + subIndex,
				Fields: []tabularField{
					{HeaderPath: rowHeader, Value: rowKey, CellRef: rowCellRef},
					{HeaderPath: "指标", Value: header, CellRef: ""},
					{HeaderPath: tabularCrossTableValueLabel, Value: field.Value, CellRef: field.CellRef},
				},
				HasFormula: row.HasFormula,
			})
			subIndex++
		}
	}
	if len(converted) == 0 {
		return headers, rows
	}
	return []string{rowHeader, "指标", tabularCrossTableValueLabel}, converted
}

func looksLikeCrossTable(headers []string, rows []tabularRow) bool {
	if len(headers) < 3 || len(rows) == 0 {
		return false
	}
	if isDataLikeValue(headers[0]) {
		return false
	}
	dataLikeHeaders := 0
	for _, header := range headers[1:] {
		if !isDataLikeValue(header) {
			dataLikeHeaders++
		}
	}
	if dataLikeHeaders < len(headers[1:])/2 {
		return false
	}

	numericCount := 0
	totalCount := 0
	for _, row := range rows {
		for _, field := range row.Fields {
			if field.HeaderPath == headers[0] {
				continue
			}
			totalCount++
			if _, ok := parseNumericValue(field.Value); ok {
				numericCount++
			}
		}
	}
	return totalCount > 0 && float64(numericCount)/float64(totalCount) >= 0.6
}

func tabularRowHasFormula(row []tabularCell) bool {
	for _, cell := range row {
		if cell.HasFormula {
			return true
		}
	}
	return false
}

func buildTabularParsedDocument(sourceFormat string, tables []tabularTable) *document.ParsedDocument {
	blocks := make([]document.ParsedBlock, 0, len(tables))
	for _, table := range tables {
		if shouldBuildTabularSummary(table.SourceFormat) {
			blocks = append(blocks, buildTableSummaryBlock(table))
		}
		for _, row := range table.Rows {
			blocks = append(blocks, buildTableRowBlock(table, row))
		}
	}
	parts := make([]string, 0, len(blocks))
	for _, block := range blocks {
		if trimmed := strings.TrimSpace(block.Content); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return &document.ParsedDocument{
		SourceType: document.ParsedDocumentSourceTabular,
		PlainText:  strings.Join(parts, "\n\n"),
		Blocks:     blocks,
		DocumentMeta: map[string]any{
			document.ParsedMetaSourceFormat: sourceFormat,
			document.ParsedMetaFileName:     firstNonEmptyTabularFileName(tables),
			"table_count":                   len(tables),
		},
	}
}

func buildTableRowBlock(table tabularTable, row tabularRow) document.ParsedBlock {
	metadata := baseTabularMetadata(table)
	metadata[document.ParsedMetaChunkType] = document.ParsedBlockTypeTableRow
	metadata[document.ParsedMetaRowIndex] = row.Index
	metadata[document.ParsedMetaPrimaryKeys] = append([]string(nil), row.PrimaryKeys...)
	metadata[document.ParsedMetaHeaderPaths] = collectFieldHeaders(row.Fields)
	metadata[document.ParsedMetaCellRefs] = collectFieldCellRefs(row.Fields)
	metadata[document.ParsedMetaHasFormula] = row.HasFormula
	metadata[document.ParsedMetaFields] = buildFieldMetadata(row.Fields)
	metadata[document.ParsedMetaRowSubchunkIndex] = 0

	return document.ParsedBlock{
		Type:     document.ParsedBlockTypeTableRow,
		Content:  renderTableRowContent(table, row, row.Fields),
		Metadata: metadata,
	}
}

func buildTableSummaryBlock(table tabularTable) document.ParsedBlock {
	metadata := baseTabularMetadata(table)
	metadata[document.ParsedMetaChunkType] = document.ParsedBlockTypeTableSummary
	metadata[document.ParsedMetaHeaderPaths] = append([]string(nil), table.Headers...)
	metadata[document.ParsedMetaPrimaryKeyHeaders] = append([]string(nil), table.PrimaryKeyHeaders...)

	return document.ParsedBlock{
		Type:     document.ParsedBlockTypeTableSummary,
		Content:  renderTableSummaryContent(table),
		Metadata: metadata,
	}
}

func baseTabularMetadata(table tabularTable) map[string]any {
	metadata := map[string]any{
		document.ParsedMetaSourceFormat:      table.SourceFormat,
		document.ParsedMetaSheetName:         table.SheetName,
		document.ParsedMetaSheetHidden:       table.SheetHidden,
		document.ParsedMetaTableID:           table.TableID,
		document.ParsedMetaTableTitle:        table.Title,
		document.ParsedMetaTableRowCount:     len(table.Rows),
		document.ParsedMetaPrimaryKeyHeaders: append([]string(nil), table.PrimaryKeyHeaders...),
	}
	if strings.TrimSpace(table.FileName) != "" {
		metadata[document.ParsedMetaFileName] = strings.TrimSpace(table.FileName)
	}
	return metadata
}

func renderTableRowContent(table tabularTable, row tabularRow, fields []tabularField) string {
	if isExcelLikeTabularSource(table.SourceFormat) {
		return renderExcelLikeTableRowContent(table, row, fields)
	}
	var builder strings.Builder
	if strings.TrimSpace(table.FileName) != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", table.FileName)
	}
	_, _ = fmt.Fprintf(&builder, "来源格式: %s\n", table.SourceFormat)
	_, _ = fmt.Fprintf(&builder, "工作表: %s\n", table.SheetName)
	_, _ = fmt.Fprintf(&builder, "表格: %s\n", table.Title)
	_, _ = fmt.Fprintf(&builder, "行号: %d\n", row.Index)
	if len(row.PrimaryKeys) > 0 {
		_, _ = fmt.Fprintf(&builder, "主键: %s\n", strings.Join(row.PrimaryKeys, "; "))
	}
	builder.WriteString("字段:\n")
	for _, field := range fields {
		_, _ = fmt.Fprintf(&builder, "- %s: %s\n", field.HeaderPath, field.Value)
	}
	return strings.TrimSpace(builder.String())
}

func renderExcelLikeTableRowContent(table tabularTable, row tabularRow, fields []tabularField) string {
	var builder strings.Builder
	if strings.TrimSpace(table.FileName) != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", table.FileName)
	}
	_, _ = fmt.Fprintf(&builder, "工作表: %s\n", table.SheetName)
	_, _ = fmt.Fprintf(&builder, "表格: %s\n", table.Title)
	_, _ = fmt.Fprintf(&builder, "行号: %d\n", row.Index)
	builder.WriteString(renderExcelLikeTabularFields(fields))
	return strings.TrimSpace(builder.String())
}

func renderTableSummaryContent(table tabularTable) string {
	var builder strings.Builder
	if strings.TrimSpace(table.FileName) != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", table.FileName)
	}
	_, _ = fmt.Fprintf(&builder, "来源格式: %s\n", table.SourceFormat)
	_, _ = fmt.Fprintf(&builder, "工作表: %s\n", table.SheetName)
	_, _ = fmt.Fprintf(&builder, "表格: %s\n", table.Title)
	_, _ = fmt.Fprintf(&builder, "类型: 表摘要\n")
	_, _ = fmt.Fprintf(&builder, "总行数: %d\n", len(table.Rows))
	if len(table.PrimaryKeyHeaders) > 0 {
		_, _ = fmt.Fprintf(&builder, "主键列: %s\n", strings.Join(table.PrimaryKeyHeaders, ", "))
	}
	if len(table.Headers) > 0 {
		_, _ = fmt.Fprintf(&builder, "字段列表: %s\n", strings.Join(table.Headers, ", "))
	}

	categorySamples, numericStats := summarizeTable(table)
	if len(categorySamples) > 0 {
		builder.WriteString("代表值:\n")
		keys := slices.Sorted(maps.Keys(categorySamples))
		for _, key := range keys {
			_, _ = fmt.Fprintf(&builder, "- %s: %s\n", key, strings.Join(categorySamples[key], ", "))
		}
	}
	if len(numericStats) > 0 {
		builder.WriteString("数值统计:\n")
		keys := slices.Sorted(maps.Keys(numericStats))
		for _, key := range keys {
			stats := numericStats[key]
			_, _ = fmt.Fprintf(
				&builder,
				"- %s: count=%d, min=%s, max=%s, avg=%s, sum=%s\n",
				key,
				stats.count,
				formatNumeric(stats.min),
				formatNumeric(stats.max),
				formatNumeric(stats.avg()),
				formatNumeric(stats.sum),
			)
		}
	}
	return strings.TrimSpace(builder.String())
}

func renderExcelLikeTabularFields(fields []tabularField) string {
	if len(fields) == 0 {
		return ""
	}
	var builder strings.Builder
	for _, field := range fields {
		label := strings.TrimSpace(field.HeaderPath)
		value := strings.TrimSpace(field.Value)
		if label == "" || value == "" {
			continue
		}
		if builder.Len() > 0 {
			builder.WriteString("\n")
		}
		if strings.Contains(value, "\n") {
			builder.WriteString(renderExcelLikeMultilineField(label, value))
			continue
		}
		builder.WriteString(label)
		builder.WriteString("：")
		builder.WriteString(value)
	}
	return builder.String()
}

func renderExcelLikeMultilineField(label, value string) string {
	lines := splitStructuredValueLines(value)
	if len(lines) == 0 {
		return label + "：\n" + value
	}
	var builder strings.Builder
	builder.WriteString(label)
	builder.WriteString("：\n")
	for index, line := range lines {
		if index > 0 {
			builder.WriteString("\n")
		}
		builder.WriteString("  - ")
		builder.WriteString(line)
	}
	return builder.String()
}

func splitStructuredValueLines(value string) []string {
	parts := strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	return lines
}

type numericSummary struct {
	count int
	min   float64
	max   float64
	sum   float64
}

func (n numericSummary) avg() float64 {
	if n.count == 0 {
		return 0
	}
	return n.sum / float64(n.count)
}

func summarizeTable(table tabularTable) (map[string][]string, map[string]numericSummary) {
	categorySamples := make(map[string][]string)
	numericStats := make(map[string]numericSummary)
	for _, row := range table.Rows {
		for _, field := range row.Fields {
			if number, ok := parseNumericValue(field.Value); ok {
				stats := numericStats[field.HeaderPath]
				if stats.count == 0 {
					stats.min = number
					stats.max = number
				} else {
					stats.min = min(stats.min, number)
					stats.max = max(stats.max, number)
				}
				stats.count++
				stats.sum += number
				numericStats[field.HeaderPath] = stats
				continue
			}
			values := categorySamples[field.HeaderPath]
			if len(values) >= tabularSummarySampleLimit || slices.Contains(values, field.Value) {
				continue
			}
			categorySamples[field.HeaderPath] = append(values, field.Value)
		}
	}
	return categorySamples, numericStats
}

func collectFieldHeaders(fields []tabularField) []string {
	headers := make([]string, 0, len(fields))
	for _, field := range fields {
		headers = append(headers, field.HeaderPath)
	}
	return headers
}

func collectFieldCellRefs(fields []tabularField) map[string]string {
	cellRefs := make(map[string]string, len(fields))
	for _, field := range fields {
		if strings.TrimSpace(field.CellRef) == "" {
			continue
		}
		cellRefs[field.HeaderPath] = field.CellRef
	}
	return cellRefs
}

func buildFieldMetadata(fields []tabularField) []map[string]any {
	output := make([]map[string]any, 0, len(fields))
	for _, field := range fields {
		item := map[string]any{
			"header":      field.HeaderPath,
			"header_path": field.HeaderPath,
			"value":       field.Value,
		}
		if field.CellRef != "" {
			item["cell_ref"] = field.CellRef
		}
		output = append(output, item)
	}
	return output
}

func assignRowPrimaryKeys(rows []tabularRow, primaryKeyHeaders []string) {
	for index := range rows {
		primaryKeys := make([]string, 0, max(1, len(primaryKeyHeaders)))
		if len(primaryKeyHeaders) > 0 {
			for _, header := range primaryKeyHeaders {
				if value := findFieldValue(rows[index].Fields, header); value != "" {
					primaryKeys = append(primaryKeys, header+"="+value)
				}
			}
		}
		if len(primaryKeys) == 0 {
			for _, field := range rows[index].Fields {
				if isDataLikeValue(field.Value) {
					continue
				}
				primaryKeys = append(primaryKeys, field.HeaderPath+"="+field.Value)
				break
			}
		}
		if len(primaryKeys) == 0 && len(rows[index].Fields) > 0 {
			field := rows[index].Fields[0]
			primaryKeys = append(primaryKeys, field.HeaderPath+"="+field.Value)
		}
		rows[index].PrimaryKeys = primaryKeys
	}
}

func findFieldValue(fields []tabularField, header string) string {
	for _, field := range fields {
		if field.HeaderPath == header {
			return field.Value
		}
	}
	return ""
}

func detectPrimaryKeyHeaders(headers []string, rows []tabularRow) []string {
	if len(headers) == 0 {
		return nil
	}
	selected := make([]string, 0, 2)
	for _, header := range headers {
		lowerHeader := strings.ToLower(strings.TrimSpace(header))
		for _, keyword := range primaryKeyHeaderKeywords() {
			if strings.Contains(lowerHeader, strings.ToLower(keyword)) {
				selected = append(selected, header)
				break
			}
		}
	}
	if len(selected) > 0 {
		return uniqueStrings(selected)
	}

	bestHeader := ""
	bestScore := 0.0
	for _, header := range headers {
		values := collectColumnValues(rows, header)
		if len(values) == 0 {
			continue
		}
		uniqueRatio := float64(len(uniqueStrings(values))) / float64(len(values))
		textRatio := textLikeRatio(values)
		score := uniqueRatio*tabularUniqueRatioWeight + textRatio*tabularTextRatioWeight
		if score > bestScore && uniqueRatio >= tabularUniquenessSelectMin {
			bestScore = score
			bestHeader = header
		}
	}
	if bestHeader == "" {
		return nil
	}
	return []string{bestHeader}
}

func collectColumnValues(rows []tabularRow, header string) []string {
	values := make([]string, 0, len(rows))
	for _, row := range rows {
		if value := findFieldValue(row.Fields, header); value != "" {
			values = append(values, value)
		}
	}
	return values
}

func textLikeRatio(values []string) float64 {
	if len(values) == 0 {
		return 0
	}
	textCount := 0
	for _, value := range values {
		if !isDataLikeValue(value) {
			textCount++
		}
	}
	return float64(textCount) / float64(len(values))
}

func resolveHeaderRowCount(matrix [][]tabularCell) int {
	if len(matrix) == 0 {
		return 0
	}
	if len(matrix) == 1 {
		return 0
	}

	maxRows := min(tabularHeaderMaxRows, len(matrix)-1)
	headerRows := 0
	for rowIndex := range maxRows {
		if !looksLikeHeaderRow(matrix[rowIndex]) {
			break
		}
		headerRows++
		if rowIndex+1 < len(matrix) && looksLikeDataRow(matrix[rowIndex+1]) {
			break
		}
	}
	if headerRows == 0 && looksLikeHeaderRow(matrix[0]) {
		return 1
	}
	return headerRows
}

func resolveHeaderRowCountForSourceFormat(sourceFormat string, matrix [][]tabularCell) int {
	if strings.EqualFold(strings.TrimSpace(sourceFormat), "csv") {
		if len(matrix) > 1 && looksLikeHeaderRow(matrix[0]) {
			return 1
		}
		return 0
	}
	return resolveHeaderRowCount(matrix)
}

func flattenHeaderPaths(headerRows [][]tabularCell, width int) []string {
	if width <= 0 {
		return nil
	}
	if len(headerRows) == 0 {
		return buildDefaultHeaders(width)
	}

	normalizedHeaderRows := normalizeHeaderRows(headerRows, width)
	headers := make([]string, width)
	for colIndex := range width {
		parts := make([]string, 0, len(normalizedHeaderRows))
		for _, row := range normalizedHeaderRows {
			if colIndex >= len(row) {
				continue
			}
			value := strings.TrimSpace(row[colIndex].Value)
			if value == "" {
				continue
			}
			if len(parts) == 0 || parts[len(parts)-1] != value {
				parts = append(parts, value)
			}
		}
		if len(parts) == 0 {
			headers[colIndex] = fmt.Sprintf("column_%d", colIndex+1)
			continue
		}
		headers[colIndex] = strings.Join(parts, " / ")
	}
	return headers
}

func normalizeHeaderRows(headerRows [][]tabularCell, width int) [][]tabularCell {
	if len(headerRows) <= 1 || width <= 1 {
		return headerRows
	}

	normalized := make([][]tabularCell, len(headerRows))
	for rowIndex, row := range headerRows {
		rowCopy := make([]tabularCell, width)
		copy(rowCopy, row)
		if rowIndex < len(headerRows)-1 {
			fillForwardHeaderRow(rowCopy)
		}
		normalized[rowIndex] = rowCopy
	}
	return normalized
}

func fillForwardHeaderRow(row []tabularCell) {
	lastValue := ""
	for index := range row {
		value := strings.TrimSpace(row[index].Value)
		if value != "" {
			lastValue = value
			continue
		}
		if lastValue != "" {
			row[index].Value = lastValue
		}
	}
}

func buildDefaultHeaders(width int) []string {
	headers := make([]string, width)
	for colIndex := range width {
		headers[colIndex] = fmt.Sprintf("column_%d", colIndex+1)
	}
	return headers
}

func looksLikeTitleRow(row []tabularCell) bool {
	nonEmpty := nonEmptyCount(row)
	if nonEmpty == 1 {
		return true
	}
	if nonEmpty < 2 {
		return false
	}
	values := uniqueNonEmptyValues(row)
	return len(values) == 1 && !looksLikeDataCellValue(values[0])
}

func looksLikeHeaderRow(row []tabularCell) bool {
	nonEmpty := nonEmptyCount(row)
	if nonEmpty == 0 {
		return false
	}
	if nonEmpty >= 2 {
		firstValue := firstNonEmptyCellValue(row)
		if looksLikeIdentifierValue(firstValue) {
			return false
		}
	}
	textLike := 0
	labelLike := 0
	unique := make(map[string]struct{}, nonEmpty)
	groupCount := nonEmptyGroupCount(row)
	for _, cell := range row {
		value := strings.TrimSpace(cell.Value)
		if value == "" {
			continue
		}
		unique[value] = struct{}{}
		if !isDataLikeValue(value) {
			textLike++
		}
		if looksLikeHeaderLabelValue(value) {
			labelLike++
		}
	}
	textRatio := float64(textLike) / float64(nonEmpty)
	denominator := max(1, groupCount)
	uniqueRatio := float64(len(unique)) / float64(denominator)
	if textRatio >= tabularHeaderTextRatioMin && uniqueRatio >= tabularHeaderUniqueRatioMin {
		return true
	}
	labelRatio := float64(labelLike) / float64(nonEmpty)
	return uniqueRatio >= tabularHeaderUniqueRatioMin && labelRatio >= tabularHeaderTextRatioMin
}

func looksLikeDataRow(row []tabularCell) bool {
	nonEmpty := nonEmptyCount(row)
	if nonEmpty == 0 {
		return false
	}
	dataLike := 0
	structuredLike := 0
	identifierLike := 0
	textLike := 0
	for _, cell := range row {
		value := strings.TrimSpace(cell.Value)
		if value == "" {
			continue
		}
		if isDataLikeValue(value) {
			dataLike++
		}
		if looksLikeStructuredRecordValue(value) {
			structuredLike++
		}
		if looksLikeIdentifierValue(value) {
			identifierLike++
		}
		if !isDataLikeValue(value) {
			textLike++
		}
	}
	if float64(dataLike)/float64(nonEmpty) >= tabularDataLikeRatioMin {
		return true
	}
	if structuredLike >= 2 {
		return true
	}
	if identifierLike >= 1 && textLike >= 1 && nonEmpty >= 2 {
		return true
	}
	return structuredLike >= 1 && identifierLike >= 1 && nonEmpty >= 3
}

func nonEmptyCount(row []tabularCell) int {
	count := 0
	for _, cell := range row {
		if strings.TrimSpace(cell.Value) != "" {
			count++
		}
	}
	return count
}

func isBlankTabularRow(row []tabularCell) bool {
	return nonEmptyCount(row) == 0
}

func firstNonEmptyCellValue(row []tabularCell) string {
	for _, cell := range row {
		if trimmed := strings.TrimSpace(cell.Value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func nonEmptyGroupCount(row []tabularCell) int {
	count := 0
	lastValue := ""
	for _, cell := range row {
		value := strings.TrimSpace(cell.Value)
		if value == "" {
			continue
		}
		if count == 0 || value != lastValue {
			count++
			lastValue = value
		}
	}
	return count
}

func uniqueNonEmptyValues(row []tabularCell) []string {
	values := make([]string, 0, len(row))
	for _, cell := range row {
		if trimmed := strings.TrimSpace(cell.Value); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return uniqueStrings(values)
}

func widthOfMatrix(matrix [][]tabularCell) int {
	width := 0
	for _, row := range matrix {
		width = max(width, len(row))
	}
	return width
}

func resolveTableTitle(title, sheetName string, ordinal int) string {
	if trimmed := strings.TrimSpace(title); trimmed != "" {
		return trimmed
	}
	base := strings.TrimSpace(sheetName)
	if base == "" {
		base = tabularDefaultTableTitle
	}
	return fmt.Sprintf("%s 表%d", base, ordinal)
}

func stableTabularID(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}

func detectCSVDelimiter(data []byte) rune {
	candidates := []rune{',', '\t', ';', '|'}
	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	lines = lines[:min(len(lines), tabularDelimiterProbeLines)]

	bestDelimiter := ','
	bestScore := -1
	for _, candidate := range candidates {
		score := scoreCSVDelimiter(lines, candidate)
		if score > bestScore {
			bestDelimiter = candidate
			bestScore = score
		}
	}
	return bestDelimiter
}

func resolveTabularFileName(fileURL string) string {
	trimmed := strings.TrimSpace(fileURL)
	if trimmed == "" {
		return ""
	}
	if parsed, err := url.Parse(trimmed); err == nil {
		if base := strings.TrimSpace(path.Base(parsed.Path)); base != "" && base != "." && base != "/" {
			return base
		}
	}
	if base := strings.TrimSpace(path.Base(trimmed)); base != "" && base != "." && base != "/" {
		return base
	}
	return ""
}

func firstNonEmptyTabularFileName(tables []tabularTable) string {
	for _, table := range tables {
		if trimmed := strings.TrimSpace(table.FileName); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func shouldBuildTabularSummary(sourceFormat string) bool {
	return !isExcelLikeTabularSource(sourceFormat)
}

func isExcelLikeTabularSource(sourceFormat string) bool {
	switch strings.ToLower(strings.TrimSpace(sourceFormat)) {
	case "xlsx", "xlsm", "xls":
		return true
	default:
		return false
	}
}

func scoreCSVDelimiter(lines []string, delimiter rune) int {
	score := 0
	consistentColumns := 0
	lastColumns := 0
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		columns := len(splitCSVLine(line, delimiter))
		if columns <= 1 {
			continue
		}
		score += columns
		if lastColumns == 0 || lastColumns == columns {
			consistentColumns++
		}
		lastColumns = columns
	}
	return score + consistentColumns*4
}

func splitCSVLine(line string, delimiter rune) []string {
	reader := csv.NewReader(strings.NewReader(line))
	reader.Comma = delimiter
	reader.FieldsPerRecord = -1
	record, err := reader.Read()
	if err != nil {
		return []string{line}
	}
	return record
}

func isDataLikeValue(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	if looksLikeStructuredRecordValue(trimmed) || looksLikeIdentifierValue(trimmed) {
		return true
	}
	if _, ok := parseNumericValue(trimmed); ok {
		return true
	}
	if isDateLikeValue(trimmed) {
		return true
	}
	switch strings.ToLower(trimmed) {
	case "true", "false", "yes", "no", "是", "否":
		return true
	}
	hasLetter := false
	for _, r := range trimmed {
		if unicode.IsLetter(r) {
			hasLetter = true
			break
		}
	}
	return !hasLetter && strings.IndexFunc(trimmed, unicode.IsDigit) >= 0
}

func looksLikeStructuredRecordValue(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	return strings.ContainsAny(trimmed, "\r\n") || strings.Contains(trimmed, "：") || strings.Contains(trimmed, ":")
}

func looksLikeIdentifierValue(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	if len([]rune(trimmed)) < tabularIdentifierMinRunes {
		return false
	}
	hasLetter := false
	hasDigit := false
	for _, r := range trimmed {
		if unicode.IsLetter(r) {
			hasLetter = true
		}
		if unicode.IsDigit(r) {
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}

func looksLikeDataCellValue(value string) bool {
	return looksLikeStructuredRecordValue(value) || looksLikeIdentifierValue(value) || isDataLikeValue(value)
}

func looksLikeHeaderLabelValue(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	if looksLikeStructuredRecordValue(trimmed) || looksLikeIdentifierValue(trimmed) {
		return false
	}
	if _, ok := parseNumericValue(trimmed); ok {
		return false
	}
	if isDateLikeValue(trimmed) {
		return false
	}
	switch strings.ToLower(trimmed) {
	case "true", "false", "yes", "no", "是", "否":
		return false
	}
	runes := []rune(trimmed)
	if len(runes) > tabularHeaderLabelMaxRunes {
		return false
	}
	return slices.ContainsFunc(runes, unicode.IsLetter)
}

func parseNumericValue(value string) (float64, bool) {
	normalized := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(value, ",", ""), "%", ""))
	if normalized == "" {
		return 0, false
	}
	number, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 0, false
	}
	return number, true
}

func isDateLikeValue(value string) bool {
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"2006.01.02",
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		"2006-01",
		"2006/01",
	}
	for _, layout := range layouts {
		if _, err := time.Parse(layout, value); err == nil {
			return true
		}
	}
	return false
}

func formatNumeric(number float64) string {
	if math.Abs(number-math.Round(number)) < tabularIntegerTolerance {
		return strconv.FormatInt(int64(math.Round(number)), 10)
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf(tabularSummaryNumberFmt, number), "0"), ".")
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func primaryKeyHeaderKeywords() []string {
	return []string{"id", "编号", "编码", "订单号", "单号", "姓名", "名称", "标题", "sku", "物料"}
}
