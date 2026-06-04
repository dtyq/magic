package routes

import "magic/internal/constants"

// RegisterOpsRoutes 注册运维 RPC 路由。
func RegisterOpsRoutes(router RPCRouter, h HandlerProvider) {
	if router == nil || h == nil {
		return
	}

	registerHandlers(router, h, []string{
		constants.MethodSocketIORedisCleanup,
	})
}
