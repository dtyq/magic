package docparser

import (
	"archive/zip"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

// PptxParser 按幻灯片顺序提取文本与内嵌图片 OCR 文本。
type PptxParser struct {
	ocrClient     documentdomain.OCRClient
	maxOCRPerFile int
}

type pptxRelationships struct {
	Items []pptxRelationship `xml:"Relationship"`
}

type pptxRelationship struct {
	ID     string `xml:"Id,attr"`
	Type   string `xml:"Type,attr"`
	Target string `xml:"Target,attr"`
}

type pptxImageAsset struct {
	format string
	data   []byte
}

var pptxSlidePathRegex = regexp.MustCompile(`^ppt/slides/slide(\d+)\.xml$`)

var errZipEntryNotFound = errors.New("zip entry not found")

const (
	pptxImageRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
	pptxXMLStackCapacity      = 8
)

// NewPptxParserWithLimit 创建带单文件 OCR 限额的 PPTX 解析器。
func NewPptxParserWithLimit(ocrClient documentdomain.OCRClient, maxOCRPerFile int) *PptxParser {
	return &PptxParser{
		ocrClient:     ocrClient,
		maxOCRPerFile: documentdomain.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
	}
}

// Parse 解析 PPTX 文件并返回最佳努力纯文本。
func (p *PptxParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 PPTX 文件。
func (p *PptxParser) ParseWithOptions(
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
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 PPTX 文件并返回结构化结果。
func (p *PptxParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, file, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 PPTX 文件并返回结构化结果。
func (p *PptxParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	tmpFile, err := os.CreateTemp("", "pptx-*.pptx")
	if err != nil {
		return nil, fmt.Errorf("create temp file failed: %w", err)
	}
	tmpPath := filepath.Clean(tmpFile.Name())
	defer func() { _ = os.Remove(tmpPath) }()
	defer func() { _ = tmpFile.Close() }()

	if _, err := io.Copy(tmpFile, file); err != nil {
		return nil, fmt.Errorf("write temp file failed: %w", err)
	}
	_ = tmpFile.Close()

	reader, err := zip.OpenReader(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("open pptx zip failed: %w", err)
	}
	defer func() { _ = reader.Close() }()

	slidePaths := resolvePPTXSlidePaths(reader.File)
	var ocrHelper *embeddedImageOCRHelper
	if options.ImageExtraction && options.ImageOCR {
		ocrHelper = newEmbeddedImageOCRHelper(p.ocrClient, p.maxOCRPerFile)
	}
	blocks := make([]string, 0, len(slidePaths))
	for _, slidePath := range slidePaths {
		imageAssets, err := buildPPTXImageAssets(reader.File, slidePath)
		if err != nil {
			return nil, fmt.Errorf("load slide images failed: %w", err)
		}
		slideContent, err := extractPPTXSlideContent(ctx, reader.File, slidePath, imageAssets, ocrHelper)
		if err != nil {
			return nil, fmt.Errorf("extract slide content failed: %w", err)
		}
		if strings.TrimSpace(slideContent) == "" {
			continue
		}
		slideNumber := resolvePPTXSlideNumber(slidePath)
		blocks = append(blocks, fmt.Sprintf("# Slide %d\n%s", slideNumber, slideContent))
	}

	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.Join(blocks, "\n\n"))
	ocrHelper.apply(parsed)
	return parsed, nil
}

// Supports 检查是否支持该文件类型。
func (p *PptxParser) Supports(fileType string) bool {
	return strings.EqualFold(strings.TrimSpace(fileType), "pptx")
}

// NeedsResolvedURL PPTX 解析只依赖文件流。
func (p *PptxParser) NeedsResolvedURL() bool {
	return false
}

func resolvePPTXSlidePaths(files []*zip.File) []string {
	paths := make([]string, 0)
	for _, file := range files {
		name := path.Clean(file.Name)
		if pptxSlidePathRegex.MatchString(name) {
			paths = append(paths, name)
		}
	}
	slices.SortFunc(paths, func(left, right string) int {
		return resolvePPTXSlideNumber(left) - resolvePPTXSlideNumber(right)
	})
	return paths
}

func resolvePPTXSlideNumber(slidePath string) int {
	matches := pptxSlidePathRegex.FindStringSubmatch(path.Clean(slidePath))
	if len(matches) != 2 {
		return 0
	}
	number, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0
	}
	return number
}

func buildPPTXImageAssets(files []*zip.File, slidePath string) (map[string]pptxImageAsset, error) {
	relsPath := path.Join(path.Dir(slidePath), "_rels", path.Base(slidePath)+".rels")
	raw, err := readZipEntry(files, relsPath)
	if err != nil {
		if errors.Is(err, errZipEntryNotFound) {
			return map[string]pptxImageAsset{}, nil
		}
		return nil, err
	}

	var relationships pptxRelationships
	if err := xml.Unmarshal(raw, &relationships); err != nil {
		return nil, fmt.Errorf("unmarshal slide relationships: %w", err)
	}

	assets := make(map[string]pptxImageAsset)
	for _, relationship := range relationships.Items {
		if strings.TrimSpace(relationship.Type) != pptxImageRelationshipType {
			continue
		}
		relID := strings.TrimSpace(relationship.ID)
		target := strings.TrimSpace(relationship.Target)
		if relID == "" || target == "" {
			continue
		}
		entryPath := path.Clean(path.Join(path.Dir(slidePath), target))
		data, readErr := readZipEntry(files, entryPath)
		if readErr != nil {
			return nil, fmt.Errorf("read pptx image %s: %w", entryPath, readErr)
		}
		assets[relID] = pptxImageAsset{
			format: normalizeEmbeddedOCRFormat(path.Ext(entryPath)),
			data:   data,
		}
	}
	return assets, nil
}

func extractPPTXSlideContent(
	ctx context.Context,
	files []*zip.File,
	slidePath string,
	imageAssets map[string]pptxImageAsset,
	ocrHelper *embeddedImageOCRHelper,
) (string, error) {
	raw, err := readZipEntry(files, slidePath)
	if err != nil {
		return "", err
	}

	decoder := xml.NewDecoder(strings.NewReader(string(raw)))
	stack := make([]string, 0, pptxXMLStackCapacity)
	var builder strings.Builder
	for {
		token, err := decoder.Token()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return "", fmt.Errorf("decode slide xml: %w", err)
		}
		processPPTXSlideToken(ctx, token, imageAssets, ocrHelper, &stack, &builder)
	}

	return normalizeStructuredMultilineText(builder.String()), nil
}

func processPPTXSlideToken(
	ctx context.Context,
	token xml.Token,
	imageAssets map[string]pptxImageAsset,
	ocrHelper *embeddedImageOCRHelper,
	stack *[]string,
	builder *strings.Builder,
) {
	switch typed := token.(type) {
	case xml.StartElement:
		*stack = append(*stack, typed.Name.Local)
		processPPTXStartElement(ctx, typed, imageAssets, ocrHelper, builder)
	case xml.EndElement:
		processPPTXEndElement(typed, stack, builder)
	case xml.CharData:
		processPPTXCharData(typed, *stack, builder)
	}
}

func processPPTXStartElement(
	ctx context.Context,
	element xml.StartElement,
	imageAssets map[string]pptxImageAsset,
	ocrHelper *embeddedImageOCRHelper,
	builder *strings.Builder,
) {
	switch element.Name.Local {
	case "br":
		builder.WriteByte('\n')
	case "blip":
		processPPTXBlipElement(ctx, element, imageAssets, ocrHelper, builder)
	}
}

func processPPTXBlipElement(
	ctx context.Context,
	element xml.StartElement,
	imageAssets map[string]pptxImageAsset,
	ocrHelper *embeddedImageOCRHelper,
	builder *strings.Builder,
) {
	relID := resolveXMLAttrValue(element.Attr, "embed")
	if asset, ok := imageAssets[relID]; ok {
		if text := ocrHelper.recognizeBytes(ctx, asset.data, asset.format); text != "" {
			appendInlineSegment(builder, text)
		}
		return
	}
	if strings.TrimSpace(relID) == "" {
		return
	}
	stats := ocrHelper.Stats()
	stats.Total++
	stats.Failed++
}

func processPPTXEndElement(element xml.EndElement, stack *[]string, builder *strings.Builder) {
	if element.Name.Local == "p" || element.Name.Local == "txBody" {
		builder.WriteByte('\n')
	}
	if len(*stack) > 0 {
		*stack = (*stack)[:len(*stack)-1]
	}
}

func processPPTXCharData(data xml.CharData, stack []string, builder *strings.Builder) {
	if len(stack) > 0 && stack[len(stack)-1] == "t" {
		appendInlineSegment(builder, string(data))
	}
}

func resolveXMLAttrValue(attrs []xml.Attr, localName string) string {
	for _, attr := range attrs {
		if strings.EqualFold(strings.TrimSpace(attr.Name.Local), localName) {
			return strings.TrimSpace(attr.Value)
		}
	}
	return ""
}

func readZipEntry(files []*zip.File, entryPath string) ([]byte, error) {
	cleanEntryPath := path.Clean(strings.TrimSpace(entryPath))
	for _, file := range files {
		if path.Clean(file.Name) != cleanEntryPath {
			continue
		}
		handle, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("open zip entry: %w", err)
		}
		defer func() { _ = handle.Close() }()
		data, err := io.ReadAll(handle)
		if err != nil {
			return nil, fmt.Errorf("read zip entry: %w", err)
		}
		return data, nil
	}
	return nil, fmt.Errorf("%w: %s", errZipEntryNotFound, cleanEntryPath)
}

func normalizeStructuredMultilineText(raw string) string {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	return strings.Join(cleaned, "\n")
}
