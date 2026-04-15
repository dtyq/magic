package docparser

import (
	"context"
	"strings"

	"golang.org/x/net/html"
)

type htmlTextRenderer struct {
	assetLoader richTextAssetLoader
}

func newHTMLTextRenderer(assetLoader richTextAssetLoader) htmlTextRenderer {
	return htmlTextRenderer{assetLoader: assetLoader}
}

func (r htmlTextRenderer) renderBlocks(
	ctx context.Context,
	fileURL string,
	node *html.Node,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	if node == nil {
		return nil
	}

	switch node.Type {
	case html.DocumentNode:
		blocks := make([]string, 0)
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			blocks = append(blocks, r.renderBlocks(ctx, fileURL, child, ocrHelper)...)
		}
		return blocks
	case html.TextNode:
		if text := strings.TrimSpace(node.Data); text != "" {
			return []string{text}
		}
		return nil
	case html.ElementNode:
		tag := strings.ToLower(strings.TrimSpace(node.Data))
		switch tag {
		case "script", "style", "noscript":
			return nil
		case "img":
			if text := r.assetLoader.resolveReferencedImageText(ctx, fileURL, htmlAttr(node, "src"), ocrHelper); text != "" {
				return []string{text}
			}
			return nil
		case "table":
			return r.renderTable(ctx, fileURL, node, ocrHelper)
		}
		if level, ok := resolveHTMLHeadingLevel(tag); ok {
			text := strings.TrimSpace(r.collectInlineText(ctx, fileURL, node, ocrHelper))
			if text == "" {
				return nil
			}
			return []string{strings.Repeat("#", level) + " " + text}
		}
		if isHTMLBlockTextContainer(tag) {
			text := strings.TrimSpace(r.collectInlineText(ctx, fileURL, node, ocrHelper))
			if text == "" {
				return nil
			}
			return []string{text}
		}
	case html.CommentNode, html.DoctypeNode, html.RawNode, html.ErrorNode:
		return nil
	}

	blocks := make([]string, 0)
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		blocks = append(blocks, r.renderBlocks(ctx, fileURL, child, ocrHelper)...)
	}
	return blocks
}

func (r htmlTextRenderer) collectInlineText(
	ctx context.Context,
	fileURL string,
	node *html.Node,
	ocrHelper *embeddedImageOCRHelper,
) string {
	if node == nil {
		return ""
	}

	var builder strings.Builder
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		switch child.Type {
		case html.DocumentNode, html.CommentNode, html.DoctypeNode, html.RawNode, html.ErrorNode:
			continue
		case html.TextNode:
			appendInlineSegment(&builder, child.Data)
		case html.ElementNode:
			tag := strings.ToLower(strings.TrimSpace(child.Data))
			switch tag {
			case "script", "style", "noscript":
				continue
			case "br":
				builder.WriteByte('\n')
			case "img":
				if text := r.assetLoader.resolveReferencedImageText(ctx, fileURL, htmlAttr(child, "src"), ocrHelper); text != "" {
					appendInlineSegment(&builder, text)
				}
			default:
				if nested := r.collectInlineText(ctx, fileURL, child, ocrHelper); nested != "" {
					appendInlineSegment(&builder, nested)
				}
			}
		}
	}
	return strings.TrimSpace(builder.String())
}

func (r htmlTextRenderer) renderTable(
	ctx context.Context,
	fileURL string,
	table *html.Node,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	rows := r.collectTableRows(ctx, fileURL, table, ocrHelper)
	if len(rows) == 0 {
		return nil
	}

	blocks := make([]string, 0, len(rows))
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		blocks = append(blocks, strings.Join(row, " | "))
	}
	return filterNonEmptyStrings(blocks)
}

func (r htmlTextRenderer) collectTableRows(
	ctx context.Context,
	fileURL string,
	table *html.Node,
	ocrHelper *embeddedImageOCRHelper,
) [][]string {
	if table == nil {
		return nil
	}

	rows := make([][]string, 0)
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node == nil {
			return
		}
		if node != table && node.Type == html.ElementNode && strings.EqualFold(strings.TrimSpace(node.Data), "table") {
			return
		}
		if node.Type == html.ElementNode && strings.EqualFold(strings.TrimSpace(node.Data), "tr") {
			if row := r.collectTableRow(ctx, fileURL, node, ocrHelper); len(row) > 0 {
				rows = append(rows, row)
			}
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(table)
	return rows
}

func (r htmlTextRenderer) collectTableRow(
	ctx context.Context,
	fileURL string,
	row *html.Node,
	ocrHelper *embeddedImageOCRHelper,
) []string {
	if row == nil {
		return nil
	}

	cells := make([]string, 0)
	for child := row.FirstChild; child != nil; child = child.NextSibling {
		if child.Type != html.ElementNode {
			continue
		}
		tag := strings.ToLower(strings.TrimSpace(child.Data))
		if tag != "td" && tag != "th" {
			continue
		}
		text := normalizeHTMLTableCellText(r.collectInlineText(ctx, fileURL, child, ocrHelper))
		cells = append(cells, text)
	}
	if len(filterNonEmptyStrings(cells)) == 0 {
		return nil
	}
	return trimTrailingEmptyCells(cells)
}

func normalizeHTMLTableCellText(text string) string {
	lines := strings.Split(strings.ReplaceAll(strings.TrimSpace(text), "\r\n", "\n"), "\n")
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, " / ")
}

func trimTrailingEmptyCells(cells []string) []string {
	end := len(cells)
	for end > 0 && strings.TrimSpace(cells[end-1]) == "" {
		end--
	}
	return append([]string(nil), cells[:end]...)
}

func resolveHTMLHeadingLevel(tag string) (int, bool) {
	if len(tag) != 2 || tag[0] != 'h' || tag[1] < '1' || tag[1] > '6' {
		return 0, false
	}
	return int(tag[1] - '0'), true
}

func isHTMLBlockTextContainer(tag string) bool {
	switch tag {
	case "p", "li", "blockquote", "figcaption", "td", "th", "caption", "pre":
		return true
	default:
		return false
	}
}

func htmlAttr(node *html.Node, key string) string {
	for _, attr := range node.Attr {
		if strings.EqualFold(strings.TrimSpace(attr.Key), key) {
			return strings.TrimSpace(attr.Val)
		}
	}
	return ""
}
