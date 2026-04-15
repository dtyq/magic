package docparser

import (
	"context"
	"io"
	"strings"

	"github.com/yuin/goldmark"
	gmast "github.com/yuin/goldmark/ast"
	gmtext "github.com/yuin/goldmark/text"
	"golang.org/x/net/html"

	documentdomain "magic/internal/domain/knowledge/document/service"
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
	blocks := make([]string, 0)
	for node := root.FirstChild(); node != nil; node = node.NextSibling() {
		blocks = append(blocks, p.renderBlock(ctx, fileURL, content, node, ocrHelper)...)
	}
	parsed := documentdomain.NewPlainTextParsedDocument(fileType, strings.Join(filterNonEmptyStrings(blocks), "\n\n"))
	ocrHelper.apply(parsed)
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

func (p *MarkdownParser) renderBlock(
	ctx context.Context,
	fileURL string,
	source []byte,
	node gmast.Node,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	switch typed := node.(type) {
	case *gmast.Heading:
		text := strings.TrimSpace(p.renderInline(ctx, fileURL, source, typed, ocrHelper))
		if text == "" {
			return nil
		}
		return []string{strings.Repeat("#", typed.Level) + " " + text}
	case *gmast.Paragraph:
		text := strings.TrimSpace(p.renderInline(ctx, fileURL, source, typed, ocrHelper))
		if text == "" {
			return nil
		}
		return []string{text}
	case *gmast.TextBlock:
		text := strings.TrimSpace(p.renderInline(ctx, fileURL, source, typed, ocrHelper))
		if text == "" {
			text = strings.TrimSpace(extractGoldmarkLines(source, typed.Lines()))
		}
		if text == "" {
			return nil
		}
		return []string{text}
	case *gmast.List:
		items := make([]string, 0)
		for item := typed.FirstChild(); item != nil; item = item.NextSibling() {
			itemParts := make([]string, 0)
			for child := item.FirstChild(); child != nil; child = child.NextSibling() {
				itemParts = append(itemParts, p.renderBlock(ctx, fileURL, source, child, ocrHelper)...)
			}
			itemText := strings.TrimSpace(strings.Join(filterNonEmptyStrings(itemParts), "\n"))
			if itemText != "" {
				items = append(items, "- "+itemText)
			}
		}
		return items
	case *gmast.FencedCodeBlock:
		return []string{strings.TrimSpace(extractGoldmarkLines(source, typed.Lines()))}
	case *gmast.CodeBlock:
		return []string{strings.TrimSpace(extractGoldmarkLines(source, typed.Lines()))}
	case *gmast.HTMLBlock:
		htmlSource := strings.TrimSpace(extractMarkdownHTMLBlock(source, typed))
		if htmlSource == "" {
			return nil
		}
		return p.renderHTMLFragment(ctx, fileURL, htmlSource, ocrHelper)
	default:
		blocks := make([]string, 0)
		for child := node.FirstChild(); child != nil; child = child.NextSibling() {
			blocks = append(blocks, p.renderBlock(ctx, fileURL, source, child, ocrHelper)...)
		}
		return blocks
	}
}

func (p *MarkdownParser) renderInline(
	ctx context.Context,
	fileURL string,
	source []byte,
	node gmast.Node,
	ocrHelper *embeddedImageOCRHelper,
) string {
	var builder strings.Builder
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch typed := child.(type) {
		case *gmast.Text:
			builder.Write(typed.Segment.Value(source))
			if typed.HardLineBreak() || typed.SoftLineBreak() {
				builder.WriteByte('\n')
			}
		case *gmast.CodeSpan:
			appendInlineSegment(&builder, extractMarkdownInlineNodeText(source, typed))
		case *gmast.String:
			builder.Write(typed.Value)
		case *gmast.Image:
			if imageText := p.assetLoader.resolveReferencedImageText(ctx, fileURL, string(typed.Destination), ocrHelper); imageText != "" {
				appendInlineSegment(&builder, imageText)
			}
		case *gmast.RawHTML:
			if htmlText := strings.Join(
				filterNonEmptyStrings(
					p.renderHTMLFragment(ctx, fileURL, string(typed.Segments.Value(source)), ocrHelper),
				),
				"\n",
			); htmlText != "" {
				appendInlineSegment(&builder, htmlText)
			}
		default:
			if nested := strings.TrimSpace(p.renderInline(ctx, fileURL, source, child, ocrHelper)); nested != "" {
				appendInlineSegment(&builder, nested)
			}
		}
	}
	return strings.TrimSpace(builder.String())
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

func extractMarkdownInlineNodeText(source []byte, node gmast.Node) string {
	if node == nil {
		return ""
	}

	var builder strings.Builder
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch typed := child.(type) {
		case *gmast.Text:
			builder.Write(typed.Value(source))
			if typed.HardLineBreak() || typed.SoftLineBreak() {
				builder.WriteByte('\n')
			}
		case *gmast.String:
			builder.Write(typed.Value)
		default:
			if nested := extractMarkdownInlineNodeText(source, child); nested != "" {
				appendInlineSegment(&builder, nested)
			}
		}
	}
	return strings.TrimSpace(builder.String())
}

func extractGoldmarkLines(source []byte, lines *gmtext.Segments) string {
	if lines == nil {
		return ""
	}
	parts := make([]string, 0, lines.Len())
	for index := range lines.Len() {
		segment := lines.At(index)
		parts = append(parts, string(segment.Value(source)))
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}
