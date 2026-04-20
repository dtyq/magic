package ctxmeta

import "context"

type businessParamsContextKey struct{}

// WithBusinessParams 将业务参数写入 context，供跨层链路复用。
func WithBusinessParams(ctx context.Context, businessParams *BusinessParams) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if businessParams == nil || businessParams.IsEmpty() {
		return ctx
	}

	cloned := *businessParams
	return context.WithValue(ctx, businessParamsContextKey{}, &cloned)
}

// BusinessParamsFromContext 从 context 读取业务参数。
func BusinessParamsFromContext(ctx context.Context) (*BusinessParams, bool) {
	if ctx == nil {
		return nil, false
	}

	businessParams, ok := ctx.Value(businessParamsContextKey{}).(*BusinessParams)
	if !ok || businessParams == nil || businessParams.IsEmpty() {
		return nil, false
	}

	cloned := *businessParams
	return &cloned, true
}
