package routes

import (
	"magic/internal/constants"
)

// RegisterFragmentRoutes 注册片段 RPC 路由。
func RegisterFragmentRoutes(router RPCRouter, h HandlerProvider) {
	if router == nil || h == nil {
		return
	}

	registerHandlers(router, h, []string{
		constants.MethodFragmentCreate,
		constants.MethodFragmentRuntimeCreate,
		constants.MethodFragmentShow,
		constants.MethodFragmentList,
		constants.MethodFragmentDestroy,
		constants.MethodFragmentRuntimeDestroyByBusinessID,
		constants.MethodFragmentRuntimeDestroyByMetadataFilter,
		constants.MethodFragmentSync,
		constants.MethodFragmentSimilarity,
		constants.MethodFragmentRuntimeSimilarity,
		constants.MethodFragmentSimilarityByAgent,
		constants.MethodFragmentPreview,
	})
}
