package ctxmeta

import "context"

// Detach 返回一个脱离取消/超时控制、但保留链路元数据的 context。
// 目前显式保留 request_id 与 business_params，供后台 goroutine 继续透传日志与业务上下文。
func Detach(ctx context.Context) context.Context {
	if ctx == nil {
		return context.Background()
	}

	detached := context.WithoutCancel(ctx)
	if requestID, ok := RequestIDFromContext(ctx); ok {
		detached = WithRequestID(detached, requestID)
	}
	if businessParams, ok := BusinessParamsFromContext(ctx); ok {
		detached = WithBusinessParams(detached, businessParams)
	}
	return detached
}
