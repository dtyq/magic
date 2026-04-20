package ctxmeta

import "context"

type requestIDContextKey struct{}

// WithRequestID 将 request_id 写入 context，供日志链路透传。
func WithRequestID(ctx context.Context, requestID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if requestID == "" {
		return ctx
	}
	return context.WithValue(ctx, requestIDContextKey{}, requestID)
}

// RequestIDFromContext 从 context 读取 request_id。
func RequestIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	v, ok := ctx.Value(requestIDContextKey{}).(string)
	if !ok || v == "" {
		return "", false
	}
	return v, true
}
