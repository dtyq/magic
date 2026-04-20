package docparser

import (
	"context"
	"fmt"
	"io"
	"strings"

	"golang.org/x/net/html"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

// HTMLParser 解析 HTML 文档。
type HTMLParser struct {
	assetLoader   richTextAssetLoader
	htmlRenderer  htmlTextRenderer
	ocrClient     documentdomain.OCRClient
	maxOCRPerFile int
}

// NewHTMLParser 创建 HTML 解析器。
func NewHTMLParser() *HTMLParser {
	return NewHTMLParserWithAssets(nil, nil, documentdomain.DefaultEmbeddedImageOCRLimit())
}

// NewHTMLParserWithAssets 创建带资源与 OCR 能力的 HTML 解析器。
func NewHTMLParserWithAssets(
	fileFetcher documentdomain.FileFetcher,
	ocrClient documentdomain.OCRClient,
	maxOCRPerFile int,
) *HTMLParser {
	assetLoader := newRichTextAssetLoader(fileFetcher)
	return &HTMLParser{
		assetLoader:   assetLoader,
		htmlRenderer:  newHTMLTextRenderer(assetLoader),
		ocrClient:     ocrClient,
		maxOCRPerFile: documentdomain.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
	}
}

// Parse 解析 HTML 文件。
func (p *HTMLParser) Parse(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 HTML 文件。
func (p *HTMLParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 HTML 文件并返回结构化结果。
func (p *HTMLParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 HTML 文件并返回结构化结果。
func (p *HTMLParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	content, err := readAndNormalizeParserSource(fileReader, fileType)
	if err != nil {
		return nil, err
	}
	root, err := html.Parse(strings.NewReader(string(content)))
	if err != nil {
		return nil, fmt.Errorf("parse html failed: %w", err)
	}
	ocrHelper := newRichTextImageOCRHelper(p.ocrClient, p.maxOCRPerFile, options)
	blocks := p.htmlRenderer.renderBlocks(ctx, fileURL, root, ocrHelper)
	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.Join(filterNonEmptyStrings(blocks), "\n\n"))
	ocrHelper.apply(parsed)
	return parsed, nil
}

// Supports 检查是否支持该文件类型。
func (p *HTMLParser) Supports(fileType string) bool {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case "html", "htm":
		return true
	default:
		return false
	}
}

// NeedsResolvedURL HTML 解析只依赖文件流。
func (p *HTMLParser) NeedsResolvedURL() bool {
	return false
}
