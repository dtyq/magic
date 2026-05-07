package splitter

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

var (
	markdownMagicCompressibleOpenTagRegex  = regexp.MustCompile(`(?is)<\s*MagicCompressibleContent\b[^>]*>`)
	markdownMagicCompressibleCloseTagRegex = regexp.MustCompile(`(?is)<\s*/\s*MagicCompressibleContent\s*>`)
)

func normalizeContent(content string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	lines := strings.Split(content, "\n")
	result := make([]string, 0, len(lines))
	empty := 0
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			empty++
			if empty > 1 {
				continue
			}
		} else {
			empty = 0
		}
		result = append(result, line)
	}
	return strings.Join(result, "\n")
}

func stripMarkdownMagicCompressibleContentTags(content, sourceFileType string) string {
	if normalizeHierarchySourceFileType(sourceFileType) != "md" {
		return content
	}

	// Teamshare 云文档转 Markdown 会用 MagicCompressibleContent 包住 oss-file。
	// 分片时只移除外层标签，保留标签内内容，避免自定义 HTML 块影响后续 Markdown 标题识别。
	content = markdownMagicCompressibleOpenTagRegex.ReplaceAllString(content, "")
	content = markdownMagicCompressibleCloseTagRegex.ReplaceAllString(content, "")
	return content
}

func normalizeHierarchySourceFileType(sourceFileType string) string {
	normalized := strings.ToLower(strings.TrimSpace(sourceFileType))
	normalized = strings.TrimPrefix(normalized, ".")
	switch normalized {
	case "markdown":
		return "md"
	default:
		return normalized
	}
}

func hashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
