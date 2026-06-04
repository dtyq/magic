package ctxmeta

import "context"

type debugErrorDetailsContextKey struct{}

// WithDebugErrorDetails marks a context that may expose masked internal error details.
func WithDebugErrorDetails(ctx context.Context, enabled ...bool) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	shouldEnable := true
	if len(enabled) > 0 {
		shouldEnable = enabled[0]
	}
	if !shouldEnable {
		return ctx
	}
	return context.WithValue(ctx, debugErrorDetailsContextKey{}, true)
}

// DebugErrorDetailsFromContext reports whether masked internal error details may be exposed.
func DebugErrorDetailsFromContext(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	enabled, _ := ctx.Value(debugErrorDetailsContextKey{}).(bool)
	return enabled
}
