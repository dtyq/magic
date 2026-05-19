package splitter

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	previewURLRegexShared        = regexp.MustCompile(`(?i)(?:(?:https?|ftp|file)://|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])`)
	previewEmailRegexShared      = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	previewWhitespaceRegexShared = regexp.MustCompile(`[\s\n\t]+`)
	previewMagicTagRegexShared   = regexp.MustCompile(`(?s)<MagicCompressibleContent[^>]*>.*?</MagicCompressibleContent>`)
)

// 预览预处理规则常量。
const (
	PreviewRuleReplaceWhitespace = 1
	PreviewRuleRemoveURLEmail    = 2
	PreviewRuleFormatExcel       = 3
)

// SplitPreviewPreprocessRules 将规则拆成预处理阶段与后置空白压缩阶段。
func SplitPreviewPreprocessRules(rules []int) ([]int, bool) {
	pre := make([]int, 0, len(rules))
	postReplaceWhitespace := false
	for _, rule := range rules {
		if rule == PreviewRuleReplaceWhitespace {
			postReplaceWhitespace = true
			continue
		}
		pre = append(pre, rule)
	}
	return pre, postReplaceWhitespace
}

// ApplyPreviewPreprocess 执行预览文本预处理规则。
func ApplyPreviewPreprocess(content string, rules []int) string {
	protectedContent, placeholders := protectPreviewMagicTagsShared(content)
	processed := protectedContent
	for _, rule := range rules {
		switch rule {
		case PreviewRuleRemoveURLEmail:
			processed = previewURLRegexShared.ReplaceAllString(processed, "")
			processed = previewEmailRegexShared.ReplaceAllString(processed, "")
		case PreviewRuleFormatExcel:
			processed = ApplyPreviewFormatExcel(processed)
		}
	}
	return restorePreviewMagicTagsShared(processed, placeholders)
}

// ApplyPreviewReplaceWhitespace 执行预览空白字符压缩。
func ApplyPreviewReplaceWhitespace(content string) string {
	protectedContent, placeholders := protectPreviewMagicTagsShared(content)
	processed := previewWhitespaceRegexShared.ReplaceAllString(protectedContent, "")
	return restorePreviewMagicTagsShared(processed, placeholders)
}

// ApplyPreviewFormatExcel 执行 Excel 预览文本格式化。
func ApplyPreviewFormatExcel(content string) string {
	lines := strings.Split(strings.ReplaceAll(strings.ReplaceAll(content, "\r\n", "\n"), "\r", "\n"), "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.HasPrefix(line, "##") {
			continue
		}
		filtered = append(filtered, line)
	}
	return strings.Join(filtered, "\n\n")
}

func protectPreviewMagicTagsShared(content string) (string, map[string]string) {
	placeholders := map[string]string{}
	index := 0
	protectedContent := previewMagicTagRegexShared.ReplaceAllStringFunc(content, func(match string) string {
		key := "{{PREVIEW_MAGIC_" + strconv.Itoa(index) + "}}"
		placeholders[key] = match
		index++
		return key
	})
	return protectedContent, placeholders
}

func restorePreviewMagicTagsShared(content string, placeholders map[string]string) string {
	restored := content
	for key, value := range placeholders {
		restored = strings.ReplaceAll(restored, key, value)
	}
	return restored
}
