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
)

// Init 注册所有翻译到全局目录。
func Init() {
	// 注册中文翻译
	zhCN := language.MustParse("zh-CN")
	_ = message.SetString(zhCN, string(CommonValidateFailed), "验证失败")

	// 注册英文翻译
	enUS := language.MustParse("en-US")
	_ = message.SetString(enUS, string(CommonValidateFailed), "validate failed")
}

// Translate 根据 key 与语言提示返回本地化消息。
// 会规范化语言代码（zh/zh-CN/zh_CN -> zh-CN，en/en-US/en_US -> en-US），
// 当语言提示为空或不支持时默认使用中文（zh-CN）。
func Translate(key MessageKey, languageHint string) string {
	tag := ParseLanguage(languageHint)
	printer := message.NewPrinter(tag)
	return printer.Sprintf(string(key))
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
