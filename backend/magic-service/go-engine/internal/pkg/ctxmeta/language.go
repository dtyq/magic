package ctxmeta

import "context"

type languageContextKey struct{}

// WithLanguage 将语言写入 context，供接口响应文案本地化使用。
func WithLanguage(ctx context.Context, language string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if language == "" {
		return ctx
	}
	return context.WithValue(ctx, languageContextKey{}, language)
}

// LanguageFromContext 从 context 读取语言。
func LanguageFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	v, ok := ctx.Value(languageContextKey{}).(string)
	if !ok || v == "" {
		return "", false
	}
	return v, true
}
