package routes

import (
	"magic/internal/constants"
)

// RegisterEmbeddingRoutes 注册嵌入 RPC 路由。
func RegisterEmbeddingRoutes(router RPCRouter, h HandlerProvider) {
	if router == nil || h == nil {
		return
	}

	registerHandlers(router, h, []string{
		constants.MethodEmbeddingCompute,
		constants.MethodEmbeddingComputeBatch,
		constants.MethodEmbeddingProvidersList,
	})
}
