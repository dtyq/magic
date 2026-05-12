// Package i18n 使用 golang.org/x/text 提供国际化消息查询。
package i18n

import (
	"strings"

	"golang.org/x/text/language"
	"golang.org/x/text/message"
)

// MessageKey 标识可翻译的消息。
type MessageKey string

const (
	// CommonValidateFailed 用于通用校验错误
	CommonValidateFailed MessageKey = "common.validate_failed"
	// KnowledgeDocumentResourceLimitGeneric 表示文档命中通用资源限制。
	KnowledgeDocumentResourceLimitGeneric MessageKey = "knowledge.document.resource_limit.generic"
	// KnowledgeDocumentResourceLimitPDFPages 表示 PDF 页数超过限制。
	KnowledgeDocumentResourceLimitPDFPages MessageKey = "knowledge.document.resource_limit.pdf_pages"
	// KnowledgeDocumentResourceLimitSourceBytes 表示文档大小超过限制。
	KnowledgeDocumentResourceLimitSourceBytes MessageKey = "knowledge.document.resource_limit.source_bytes"
	// KnowledgeDocumentResourceLimitTabularRows 表示表格行数超过限制。
	KnowledgeDocumentResourceLimitTabularRows MessageKey = "knowledge.document.resource_limit.tabular_rows"
	// KnowledgeDocumentResourceLimitTabularCells 表示表格单元格数量超过限制。
	KnowledgeDocumentResourceLimitTabularCells MessageKey = "knowledge.document.resource_limit.tabular_cells"
	// KnowledgeDocumentResourceLimitPlainTextChars 表示文档文本长度超过限制。
	KnowledgeDocumentResourceLimitPlainTextChars MessageKey = "knowledge.document.resource_limit.plain_text_chars"
	// KnowledgeDocumentResourceLimitParsedBlocks 表示文档结构块数量超过限制。
	KnowledgeDocumentResourceLimitParsedBlocks MessageKey = "knowledge.document.resource_limit.parsed_blocks"
	// KnowledgeDocumentResourceLimitFragments 表示文档切片数量超过限制。
	KnowledgeDocumentResourceLimitFragments MessageKey = "knowledge.document.resource_limit.fragments"
	// KnowledgeDocumentResourceLimitArchiveUncompressedBytes 表示压缩包解压后大小超过限制。
	KnowledgeDocumentResourceLimitArchiveUncompressedBytes MessageKey = "knowledge.document.resource_limit.archive_uncompressed_bytes"
	// KnowledgeDocumentResourceLimitArchiveEntryBytes 表示压缩包单文件大小超过限制。
	KnowledgeDocumentResourceLimitArchiveEntryBytes MessageKey = "knowledge.document.resource_limit.archive_entry_bytes"
	// KnowledgeDocumentResourceLimitEmbeddedAssetBytes 表示文档内嵌资源大小超过限制。
	KnowledgeDocumentResourceLimitEmbeddedAssetBytes MessageKey = "knowledge.document.resource_limit.embedded_asset_bytes"
	// KnowledgeDocumentResourceLimitPresentationSlides 表示演示文稿页数超过限制。
	KnowledgeDocumentResourceLimitPresentationSlides MessageKey = "knowledge.document.resource_limit.presentation_slides"
	// KnowledgeDocumentSourcePrecheckFailed 表示文档源预检测失败。
	KnowledgeDocumentSourcePrecheckFailed MessageKey = "knowledge.document.source_precheck_failed"
)

// Init 注册所有翻译到全局目录。
func Init() {
	// 注册中文翻译
	zhCN := language.MustParse("zh-CN")
	_ = message.SetString(zhCN, string(CommonValidateFailed), "验证失败")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitGeneric), "文档超过处理限制，请调整文件后重试")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitPDFPages), "PDF页数超过限制，当前%s页，最多支持%s页")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitSourceBytes), "文档大小超过限制，当前%s字节，最多支持%s字节")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitTabularRows), "表格行数超过限制，当前%s行，最多支持%s行")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitTabularCells), "表格单元格数量超过限制，当前%s个，最多支持%s个")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitPlainTextChars), "文档文本长度超过限制，当前%s字符，最多支持%s字符")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitParsedBlocks), "文档结构块数量超过限制，当前%s个，最多支持%s个")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitFragments), "文档切片数量超过限制，当前%s个，最多支持%s个")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitArchiveUncompressedBytes), "压缩包解压后大小超过限制，当前%s字节，最多支持%s字节")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitArchiveEntryBytes), "压缩包单文件大小超过限制，当前%s字节，最多支持%s字节")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitEmbeddedAssetBytes), "文档内嵌资源大小超过限制，当前%s字节，最多支持%s字节")
	_ = message.SetString(zhCN, string(KnowledgeDocumentResourceLimitPresentationSlides), "演示文稿页数超过限制，当前%s页，最多支持%s页")
	_ = message.SetString(zhCN, string(KnowledgeDocumentSourcePrecheckFailed), "文档源预检测失败，请检查文件是否存在或可访问")

	// 注册英文翻译
	enUS := language.MustParse("en-US")
	_ = message.SetString(enUS, string(CommonValidateFailed), "validate failed")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitGeneric), "The document exceeds the processing limit. Please adjust the file and try again.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitPDFPages), "PDF page count exceeds the limit. Current: %s pages, maximum: %s pages.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitSourceBytes), "Document size exceeds the limit. Current: %s bytes, maximum: %s bytes.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitTabularRows), "Table row count exceeds the limit. Current: %s rows, maximum: %s rows.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitTabularCells), "Table cell count exceeds the limit. Current: %s cells, maximum: %s cells.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitPlainTextChars), "Document text length exceeds the limit. Current: %s characters, maximum: %s characters.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitParsedBlocks), "Document block count exceeds the limit. Current: %s blocks, maximum: %s blocks.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitFragments), "Document fragment count exceeds the limit. Current: %s fragments, maximum: %s fragments.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitArchiveUncompressedBytes), "Archive uncompressed size exceeds the limit. Current: %s bytes, maximum: %s bytes.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitArchiveEntryBytes), "Archive entry size exceeds the limit. Current: %s bytes, maximum: %s bytes.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitEmbeddedAssetBytes), "Embedded asset size exceeds the limit. Current: %s bytes, maximum: %s bytes.")
	_ = message.SetString(enUS, string(KnowledgeDocumentResourceLimitPresentationSlides), "Presentation slide count exceeds the limit. Current: %s slides, maximum: %s slides.")
	_ = message.SetString(enUS, string(KnowledgeDocumentSourcePrecheckFailed), "Document source precheck failed. Please check whether the file exists and is accessible.")
}

// Translate 根据 key 与语言提示返回本地化消息。
// 会规范化语言代码（zh/zh-CN/zh_CN -> zh-CN，en/en-US/en_US -> en-US），
// 当语言提示为空或不支持时默认使用中文（zh-CN）。
func Translate(key MessageKey, languageHint string) string {
	return Translatef(key, languageHint)
}

// Translatef 根据 key、语言提示和参数返回本地化消息。
func Translatef(key MessageKey, languageHint string, args ...any) string {
	tag := ParseLanguage(languageHint)
	printer := message.NewPrinter(tag)
	return printer.Sprintf(string(key), args...)
}

// ParseLanguage 将语言提示规范化为支持的语言标签。
// 当提示为空或不支持时默认使用 zh-CN。
// 支持格式：zh、zh-CN、zh_CN、en、en-US、en_US 等。
func ParseLanguage(hint string) language.Tag {
	zhCN := language.MustParse("zh-CN")
	enUS := language.MustParse("en-US")

	if hint == "" {
		return zhCN // 默认中文
	}

	// 将下划线规范为短横线以便标准解析（zh_CN -> zh-CN）
	normalizedHint := strings.ReplaceAll(hint, "_", "-")

	// 尝试解析提示
	tags, _, err := language.ParseAcceptLanguage(normalizedHint)
	if err != nil || len(tags) == 0 {
		return zhCN // 回退到中文
	}

	// 匹配支持的语言（zh-CN 优先）
	matcher := language.NewMatcher([]language.Tag{zhCN, enUS})
	tag, index, confidence := matcher.Match(tags...)

	// 置信度低（No match）时回退中文
	// index 0 = zh-CN，index 1 = en-US（索引说明）
	if confidence == language.No {
		return zhCN
	}

	// 明确请求英文则返回英文
	// 否则默认优先中文
	if index == 1 && confidence >= language.Low {
		return tag
	}

	return tag
}
