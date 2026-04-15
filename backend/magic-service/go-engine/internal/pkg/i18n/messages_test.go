package i18n_test

import (
	"testing"

	"golang.org/x/text/language"

	"magic/internal/pkg/i18n"
)

func TestParseLanguage(t *testing.T) {
	t.Parallel()
	zhCN := language.MustParse("zh-CN")
	enUS := language.MustParse("en-US")

	tests := []struct {
		name     string
		hint     string
		expected language.Tag
	}{
		{"empty defaults to zh-CN", "", zhCN},
		{"zh maps to zh-CN", "zh", zhCN},
		{"zh-CN exact match", "zh-CN", zhCN},
		{"zh_CN normalized (underscore)", "zh_CN", zhCN},
		{"en maps to en-US", "en", enUS},
		{"en-US exact match", "en-US", enUS},
		{"en_US normalized (underscore)", "en_US", enUS},
		{"Accept-Language zh", "zh-CN,zh;q=0.9,en;q=0.8", zhCN},
		{"Accept-Language en", "en-US,en;q=0.9", enUS},
		// 未知语言回退到 zh-CN（默认中文）
		{"unknown falls back to zh-CN", "fr-FR", zhCN},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := i18n.ParseLanguage(tt.hint)
			// 对未知语言（如 fr-FR），matcher 可能添加区域扩展
			// 只要 base 匹配即可（中文为 zh-CN）
			if tt.hint == "fr-FR" {
				base, _ := got.Base()
				expBase, _ := tt.expected.Base()
				if base == expBase {
					return
				}
			}
			if got != tt.expected {
				t.Errorf("ParseLanguage(%q) = %v, want %v", tt.hint, got, tt.expected)
			}
		})
	}
}

func TestTranslate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		key      i18n.MessageKey
		hint     string
		expected string
	}{
		{"zh validate failed", i18n.CommonValidateFailed, "zh", "验证失败"},
		{"zh-CN validate failed", i18n.CommonValidateFailed, "zh-CN", "验证失败"},
		{"zh_CN validate failed (underscore)", i18n.CommonValidateFailed, "zh_CN", "验证失败"},
		{"en validate failed", i18n.CommonValidateFailed, "en", "validate failed"},
		{"en-US validate failed", i18n.CommonValidateFailed, "en-US", "validate failed"},
		{"en_US validate failed (underscore)", i18n.CommonValidateFailed, "en_US", "validate failed"},
		{"default validate failed (Chinese)", i18n.CommonValidateFailed, "", "验证失败"},
	}

	i18n.Init()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := i18n.Translate(tt.key, tt.hint)
			if got != tt.expected {
				t.Errorf("Translate(%q, %q) = %q, want %q", tt.key, tt.hint, got, tt.expected)
			}
		})
	}
}
