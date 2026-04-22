package routes

import (
	"magic/internal/constants"
)

// RegisterDocumentRoutes 注册文档 RPC 路由。
func RegisterDocumentRoutes(router RPCRouter, h HandlerProvider) {
	if router == nil || h == nil {
		return
	}

	registerHandlers(router, h, []string{
		constants.MethodDocumentCreate,
		constants.MethodDocumentUpdate,
		constants.MethodDocumentShow,
		constants.MethodDocumentGetOriginalFileLink,
		constants.MethodDocumentList,
		constants.MethodDocumentGetByThirdFileID,
		constants.MethodDocumentCountByKnowledgeBaseCodes,
		constants.MethodDocumentDestroy,
		constants.MethodDocumentSync,
		constants.MethodDocumentReVectorizedByThirdFileID,
		constants.MethodKnowledgeProjectFileNotifyChange,
	})
}
