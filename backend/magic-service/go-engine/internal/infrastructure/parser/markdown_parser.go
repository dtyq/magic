package docparser

import (
	"context"
	"io"
	"strings"

	"github.com/yuin/goldmark"
	gmast "github.com/yuin/goldmark/ast"
	gmtext "github.com/yuin/goldmark/text"
	"golang.org/x/net/html"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

// MarkdownParser 解析 Markdown 文档。
type MarkdownParser struct {
	assetLoader   richTextAssetLoader
	htmlRenderer  htmlTextRenderer
	ocrClient     documentdomain.OCRClient
	maxOCRPerFile int
}

// NewMarkdownParser 创建 Markdown 解析器。
func NewMarkdownParser() *MarkdownParser {
	return NewMarkdownParserWithAssets(nil, nil, documentdomain.DefaultEmbeddedImageOCRLimit())
}

// NewMarkdownParserWithAssets 创建带资源与 OCR 能力的 Markdown 解析器。
func NewMarkdownParserWithAssets(
	fileFetcher documentdomain.FileFetcher,
	ocrClient documentdomain.OCRClient,
	maxOCRPerFile int,
) *MarkdownParser {
	assetLoader := newRichTextAssetLoader(fileFetcher)
	return &MarkdownParser{
		assetLoader:   assetLoader,
		htmlRenderer:  newHTMLTextRenderer(assetLoader),
		ocrClient:     ocrClient,
		maxOCRPerFile: documentdomain.NormalizeEmbeddedImageOCRLimit(maxOCRPerFile),
	}
}

// Parse 解析 Markdown 文件。
func (p *MarkdownParser) Parse(
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

// ParseWithOptions 按解析选项解析 Markdown 文件。
func (p *MarkdownParser) ParseWithOptions(
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

// ParseDocument 解析 Markdown 文件并返回结构化结果。
func (p *MarkdownParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 Markdown 文件并返回结构化结果。
func (p *MarkdownParser) ParseDocumentWithOptions(
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
	root := goldmark.DefaultParser().Parse(gmtext.NewReader(content))
	ocrHelper := newRichTextImageOCRHelper(p.ocrClient, p.maxOCRPerFile, options)
	enhancementBlocks := p.collectMarkdownEnhancementBlocks(ctx, fileURL, content, root, ocrHelper)
	blocks := make([]string, 0, len(enhancementBlocks)+1)
	blocks = append(blocks, string(content))
	blocks = append(blocks, enhancementBlocks...)
	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.Join(filterNonEmptyStrings(blocks), "\n\n"))
	ocrHelper.apply(parsed)
	if err := failIfEmptyDueToOCROverload(parsed, ocrHelper); err != nil {
		return nil, err
	}
	return parsed, nil
}

// Supports 检查是否支持该文件类型。
func (p *MarkdownParser) Supports(fileType string) bool {
	return strings.ToLower(strings.TrimSpace(fileType)) == "md"
}

// NeedsResolvedURL Markdown 解析只依赖文件流。
func (p *MarkdownParser) NeedsResolvedURL() bool {
	return false
}

func (p *MarkdownParser) collectMarkdownEnhancementBlocks(
	ctx context.Context,
	fileURL string,
	source []byte,
	node gmast.Node,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	if node == nil {
		return nil
	}

	blocks := make([]string, 0)
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch typed := child.(type) {
		case *gmast.Image:
			if imageText := p.assetLoader.resolveReferencedImageText(ctx, fileURL, string(typed.Destination), ocrHelper); imageText != "" {
				blocks = append(blocks, imageText)
			}
		case *gmast.HTMLBlock:
			htmlSource := strings.TrimSpace(extractMarkdownHTMLBlock(source, typed))
			if htmlSource != "" {
				blocks = append(blocks, p.renderHTMLFragment(ctx, fileURL, htmlSource, ocrHelper)...)
			}
		case *gmast.RawHTML:
			htmlSource := strings.TrimSpace(string(typed.Segments.Value(source)))
			if htmlSource != "" {
				blocks = append(blocks, p.renderHTMLFragment(ctx, fileURL, htmlSource, ocrHelper)...)
			}
		default:
			blocks = append(blocks, p.collectMarkdownEnhancementBlocks(ctx, fileURL, source, child, ocrHelper)...)
		}
	}
	return filterNonEmptyStrings(blocks)
}

func (p *MarkdownParser) renderHTMLFragment(
	ctx context.Context,
	fileURL string,
	htmlSource string,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	root, err := html.Parse(strings.NewReader(htmlSource))
	if err != nil {
		return []string{htmlSource}
	}
	return p.htmlRenderer.renderBlocks(ctx, fileURL, root, ocrHelper)
}

func extractMarkdownHTMLBlock(source []byte, node *gmast.HTMLBlock) string {
	if node == nil {
		return ""
	}

	content := node.Lines().Value(source)
	if node.HasClosure() {
		content = append(content, node.ClosureLine.Value(source)...)
	}
	return strings.TrimSpace(string(content))
}
