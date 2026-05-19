package routes

import (
	"magic/internal/constants"
)

// RegisterKnowledgeBaseRoutes 注册知识库 RPC 路由。
func RegisterKnowledgeBaseRoutes(router RPCRouter, h HandlerProvider) {
	if router == nil || h == nil {
		return
	}

	registerHandlers(router, h, []string{
		constants.MethodKnowledgeBaseCreate,
		constants.MethodKnowledgeBaseUpdate,
		constants.MethodKnowledgeBaseSaveProcess,
		constants.MethodKnowledgeBaseShow,
		constants.MethodKnowledgeBaseList,
		constants.MethodKnowledgeTeamshareStartVector,
		constants.MethodKnowledgeTeamshareManageable,
		constants.MethodKnowledgeTeamshareManageableProgress,
		constants.MethodKnowledgeBaseNodes,
		constants.MethodKnowledgeBaseDestroy,
		constants.MethodKnowledgeBaseRebuildPermissions,
		constants.MethodKnowledgeBaseRebuild,
		constants.MethodKnowledgeBaseRepairSourceBindings,
		constants.MethodKnowledgeBaseRebuildCleanup,
	})
}
