package docapp

import "context"

type deferSyncFailureMarkKey struct{}

// WithDeferredSyncFailureMark 让同步失败先返回错误，暂不把文档落为 failed。
func WithDeferredSyncFailureMark(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, deferSyncFailureMarkKey{}, true)
}

func shouldDeferSyncFailureMark(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	deferred, _ := ctx.Value(deferSyncFailureMarkKey{}).(bool)
	return deferred
}
