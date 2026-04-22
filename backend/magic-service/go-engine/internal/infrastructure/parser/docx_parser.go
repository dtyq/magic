package docparser

import (
	"archive/zip"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"baliance.com/gooxml/document"
	"baliance.com/gooxml/schema/soo/dml"
	pic "baliance.com/gooxml/schema/soo/dml/picture"
	"baliance.com/gooxml/schema/soo/wml"
	_ "golang.org/x/image/bmp"  // Register BMP decoder for gooxml embedded image extraction.
	_ "golang.org/x/image/webp" // Register WebP decoder so unsupported OCR formats can still be skipped safely.

	documentdomain "magic/internal/domain/knowledge/document/service"
)

// DocxParser Word 解析器
type DocxParser struct {
	ocrClient     documentdomain.OCRClient
	maxOCRPerFile int
}

type docxEmbeddedImageAsset struct {
	format string
	data   []byte
}

type docxRelationships struct {
	Items []docxRelationship `xml:"Relationship"`
}

type docxRelationship struct {
	ID     string `xml:"Id,attr"`
	Type   string `xml:"Type,attr"`
	Target string `xml:"Target,attr"`
}

var (
	docxHeadingStyleRegex        = regexp.MustCompile(`(?i)^heading[\s_-]*([1-6])$`)
	docxHeadingChineseStyleRegex = regexp.MustCompile(`^标题[\s_-]*([1-6])$`)
	errDocxZipEntryNotFound      = errors.New("docx zip entry not found")
)

const docxImageRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

// NewDocxParser 创建 Word 解析器
func NewDocxParser(ocrClient documentdomain.OCRClient) *DocxParser {
	return NewDocxParserWithLimit(ocrClient, documentdomain.DefaultEmbeddedImageOCRLimit())
}

// NewDocxParserWithLimit 创建带单文件 OCR 限额的 Word 解析器。
func NewDocxParserWithLimit(ocrClient documentdomain.OCRClient, maxOCRPerFile int) *DocxParser {
	return &DocxParser{
		ocrClient:     ocrClient,
		maxOCRPerFile: documentdomain.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
	}
}

// Parse 解析 Word 文件
func (p *DocxParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 Word 文件。
func (p *DocxParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, options)
	if err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 Word 文件并返回结构化结果。
func (p *DocxParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 Word 文件并返回结构化结果。
func (p *DocxParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	tmpFile, err := os.CreateTemp("", "docx-*.docx")
	if err != nil {
		return nil, fmt.Errorf("create temp file failed: %w", err)
	}
	tmpPathMap := map[string]string{"path": filepath.Clean(tmpFile.Name())}
	tmpPath := tmpPathMap["path"]
	defer func(path string) { _ = os.Remove(path) }(tmpPath)
	defer func() { _ = tmpFile.Close() }()

	if _, err := io.Copy(tmpFile, file); err != nil {
		return nil, fmt.Errorf("write temp file failed: %w", err)
	}

	_ = tmpFile.Close()

	doc, err := document.Open(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("read docx failed: %w", err)
	}
	defer cleanupDocxTempDir(doc)

	imageAssetByRelID, err := buildDocxImageAssetByRelID(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("load docx image assets failed: %w", err)
	}

	var ocrHelper *embeddedImageOCRHelper
	if options.ImageExtraction && options.ImageOCR {
		ocrHelper = newEmbeddedImageOCRHelper(p.ocrClient, p.maxOCRPerFile)
	}
	lines := p.extractDocxLines(ctx, doc, imageAssetByRelID, ocrHelper, options.TableExtraction)
	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.Join(lines, "\n\n"))
	ocrHelper.apply(parsed)
	return parsed, nil
}

// Supports 检查是否支持该文件类型
func (p *DocxParser) Supports(fileType string) bool {
	return strings.ToLower(fileType) == "docx"
}

// NeedsResolvedURL Docx 解析只依赖文件流。
func (p *DocxParser) NeedsResolvedURL() bool {
	return false
}

func cleanupDocxTempDir(doc *document.Document) {
	if doc == nil || doc.TmpPath == "" {
		return
	}
	if strings.HasPrefix(doc.TmpPath, os.TempDir()) {
		_ = os.RemoveAll(doc.TmpPath)
	}
}

func (p *DocxParser) extractDocxLines(
	ctx context.Context,
	doc *document.Document,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
	includeTables bool,
) []string {
	if !hasDocxBody(doc) {
		return nil
	}

	paragraphByRef, tableByRef := buildDocxReferenceLookups(doc)
	lines := make([]string, 0, len(paragraphByRef))
	for _, block := range doc.X().Body.EG_BlockLevelElts {
		for _, contentBlock := range block.EG_ContentBlockContent {
			lines = p.appendDocxLinesFromParagraphRefs(ctx, lines, contentBlock.P, paragraphByRef, imageAssetByRelID, ocrHelper)
			if includeTables {
				lines = p.appendDocxLinesFromTableRefs(ctx, lines, contentBlock.Tbl, tableByRef, imageAssetByRelID, ocrHelper)
			}
		}
	}
	return lines
}

func hasDocxBody(doc *document.Document) bool {
	return doc != nil && doc.X() != nil && doc.X().Body != nil
}

func buildDocxReferenceLookups(doc *document.Document) (map[*wml.CT_P]document.Paragraph, map[*wml.CT_Tbl]document.Table) {
	paragraphByRef := make(map[*wml.CT_P]document.Paragraph, len(doc.Paragraphs()))
	for _, paragraph := range doc.Paragraphs() {
		paragraphByRef[paragraph.X()] = paragraph
	}

	tableByRef := make(map[*wml.CT_Tbl]document.Table, len(doc.Tables()))
	for _, table := range doc.Tables() {
		tableByRef[table.X()] = table
		for _, row := range table.Rows() {
			for _, cell := range row.Cells() {
				for _, paragraph := range cell.Paragraphs() {
					paragraphByRef[paragraph.X()] = paragraph
				}
			}
		}
	}

	return paragraphByRef, tableByRef
}

func (p *DocxParser) appendDocxLinesFromParagraphRefs(
	ctx context.Context,
	lines []string,
	paragraphRefs []*wml.CT_P,
	paragraphByRef map[*wml.CT_P]document.Paragraph,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	for _, paragraphRef := range paragraphRefs {
		paragraph, ok := paragraphByRef[paragraphRef]
		if !ok {
			continue
		}
		lines = p.appendDocxParagraphLine(ctx, lines, paragraph, imageAssetByRelID, ocrHelper)
	}
	return lines
}

func (p *DocxParser) appendDocxLinesFromTableRefs(
	ctx context.Context,
	lines []string,
	tableRefs []*wml.CT_Tbl,
	tableByRef map[*wml.CT_Tbl]document.Table,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	for _, tableRef := range tableRefs {
		table, ok := tableByRef[tableRef]
		if !ok {
			continue
		}
		lines = append(lines, p.extractDocxLinesFromTable(ctx, table, imageAssetByRelID, ocrHelper)...)
	}
	return lines
}

func (p *DocxParser) extractDocxLinesFromTable(
	ctx context.Context,
	table document.Table,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	lines := make([]string, 0)
	for _, row := range table.Rows() {
		for _, cell := range row.Cells() {
			for _, paragraph := range cell.Paragraphs() {
				lines = p.appendDocxParagraphLine(ctx, lines, paragraph, imageAssetByRelID, ocrHelper)
			}
		}
	}
	return lines
}

func (p *DocxParser) appendDocxParagraphLine(
	ctx context.Context,
	lines []string,
	paragraph document.Paragraph,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	text := p.extractDocxParagraphText(ctx, paragraph, imageAssetByRelID, ocrHelper)
	if text == "" {
		return lines
	}

	if level, ok := resolveDocxHeadingLevel(paragraph); ok {
		return append(lines, strings.Repeat("#", level)+" "+text)
	}
	return append(lines, text)
}

func (p *DocxParser) extractDocxParagraphText(
	ctx context.Context,
	paragraph document.Paragraph,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) string {
	var sb strings.Builder
	for _, run := range paragraph.Runs() {
		for _, innerContent := range run.X().EG_RunInnerContent {
			switch {
			case innerContent.T != nil:
				sb.WriteString(innerContent.T.Content)
			case innerContent.Tab != nil:
				sb.WriteByte('\t')
			case innerContent.Br != nil:
				sb.WriteByte('\n')
			case innerContent.Drawing != nil:
				sb.WriteString(p.extractDocxDrawingText(ctx, innerContent.Drawing, imageAssetByRelID, ocrHelper))
			}
		}
	}
	return strings.TrimSpace(sb.String())
}

func (p *DocxParser) extractDocxDrawingText(
	ctx context.Context,
	drawing *wml.CT_Drawing,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) string {
	if drawing == nil {
		return ""
	}

	parts := make([]string, 0, len(drawing.Inline)+len(drawing.Anchor))
	for _, inline := range drawing.Inline {
		if text := p.extractDocxGraphicOCRText(ctx, inline.Graphic, imageAssetByRelID, ocrHelper); text != "" {
			parts = append(parts, text)
		}
	}
	for _, anchor := range drawing.Anchor {
		if text := p.extractDocxGraphicOCRText(ctx, anchor.Graphic, imageAssetByRelID, ocrHelper); text != "" {
			parts = append(parts, text)
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return " " + strings.Join(parts, " ") + " "
}

func (p *DocxParser) extractDocxGraphicOCRText(
	ctx context.Context,
	graphic *dml.Graphic,
	imageAssetByRelID map[string]docxEmbeddedImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) string {
	relID, ok := extractDocxImageRelID(graphic)
	if !ok {
		return ""
	}

	imageAsset, ok := imageAssetByRelID[relID]
	if !ok {
		ocrHelper.stats.Total++
		ocrHelper.stats.Failed++
		return ""
	}
	return ocrHelper.recognizeBytes(ctx, imageAsset.data, imageAsset.format)
}

func buildDocxImageAssetByRelID(docxPath string) (map[string]docxEmbeddedImageAsset, error) {
	raw, err := readDocxZipEntry(docxPath, "word/_rels/document.xml.rels")
	if err != nil {
		return nil, err
	}

	var relationships docxRelationships
	if err := xml.Unmarshal(raw, &relationships); err != nil {
		return nil, fmt.Errorf("unmarshal docx relationships: %w", err)
	}

	imageAssetByRelID := make(map[string]docxEmbeddedImageAsset, len(relationships.Items))
	for _, item := range relationships.Items {
		if strings.TrimSpace(item.Type) != docxImageRelationshipType {
			continue
		}
		relID := strings.TrimSpace(item.ID)
		target := strings.TrimSpace(item.Target)
		if relID == "" || target == "" {
			continue
		}
		entryPath := pathpkg.Clean(pathpkg.Join("word", target))
		data, readErr := readDocxZipEntry(docxPath, entryPath)
		if readErr != nil {
			return nil, fmt.Errorf("read docx image %s: %w", entryPath, readErr)
		}
		imageAssetByRelID[relID] = docxEmbeddedImageAsset{
			format: normalizeDocxEmbeddedImageFormat(pathpkg.Ext(entryPath)),
			data:   data,
		}
	}
	return imageAssetByRelID, nil
}

func readDocxZipEntry(docxPath, entryPath string) ([]byte, error) {
	reader, err := zip.OpenReader(filepath.Clean(docxPath))
	if err != nil {
		return nil, fmt.Errorf("open docx zip: %w", err)
	}
	defer func() { _ = reader.Close() }()

	cleanEntryPath := pathpkg.Clean(strings.TrimSpace(entryPath))
	for _, file := range reader.File {
		if pathpkg.Clean(file.Name) != cleanEntryPath {
			continue
		}
		handle, openErr := file.Open()
		if openErr != nil {
			return nil, fmt.Errorf("open zip entry: %w", openErr)
		}
		defer func() { _ = handle.Close() }()
		data, readErr := io.ReadAll(handle)
		if readErr != nil {
			return nil, fmt.Errorf("read zip entry: %w", readErr)
		}
		return data, nil
	}
	return nil, fmt.Errorf("%w: %s", errDocxZipEntryNotFound, cleanEntryPath)
}

func extractDocxImageRelID(graphic *dml.Graphic) (string, bool) {
	if graphic == nil || graphic.GraphicData == nil {
		return "", false
	}
	for _, item := range graphic.GraphicData.Any {
		if relID, ok := extractDocxPictureEmbedRelID(item); ok {
			return relID, true
		}
	}
	return "", false
}

func extractDocxPictureEmbedRelID(value any) (string, bool) {
	picture, ok := value.(*pic.Pic)
	if !ok || picture.BlipFill == nil || picture.BlipFill.Blip == nil || picture.BlipFill.Blip.EmbedAttr == nil {
		return "", false
	}
	return strings.TrimSpace(*picture.BlipFill.Blip.EmbedAttr), picture.BlipFill.Blip.EmbedAttr != nil
}

func normalizeDocxEmbeddedImageFormat(ext string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(ext)), ".")
}

func resolveDocxHeadingLevel(paragraph document.Paragraph) (int, bool) {
	for _, style := range []string{
		strings.TrimSpace(paragraph.Style()),
		strings.TrimSpace(paragraph.Properties().Style()),
	} {
		level, ok := parseDocxHeadingLevel(style)
		if ok {
			return level, true
		}
	}
	return 0, false
}

func parseDocxHeadingLevel(style string) (int, bool) {
	if style == "" {
		return 0, false
	}
	for _, regex := range []*regexp.Regexp{
		docxHeadingStyleRegex,
		docxHeadingChineseStyleRegex,
	} {
		matches := regex.FindStringSubmatch(style)
		if len(matches) != 2 {
			continue
		}
		level, err := strconv.Atoi(matches[1])
		if err != nil || level < 1 || level > 6 {
			return 0, false
		}
		return level, true
	}
	return 0, false
}
