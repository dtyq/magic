package service

import (
	"magic/internal/constants"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

// Handlers returns all knowledge-base RPC handlers exposed by the service.
func (h *KnowledgeBaseRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return map[string]jsonrpc.ServerHandler{
		constants.MethodKnowledgeBaseCreate:                  jsonrpc.WrapTyped(h.CreateRPC),
		constants.MethodKnowledgeBaseUpdate:                  jsonrpc.WrapTyped(h.UpdateRPC),
		constants.MethodKnowledgeBaseSaveProcess:             jsonrpc.WrapTyped(h.SaveProcessRPC),
		constants.MethodKnowledgeBaseShow:                    jsonrpc.WrapTyped(h.ShowRPC),
		constants.MethodKnowledgeBaseList:                    jsonrpc.WrapTyped(h.ListRPC),
		constants.MethodKnowledgeTeamshareStartVector:        jsonrpc.WrapTyped(h.TeamshareStartVectorRPC),
		constants.MethodKnowledgeTeamshareManageable:         jsonrpc.WrapTyped(h.TeamshareManageableRPC),
		constants.MethodKnowledgeTeamshareManageableProgress: jsonrpc.WrapTyped(h.TeamshareManageableProgressRPC),
		constants.MethodKnowledgeBaseNodes:                   jsonrpc.WrapTyped(h.ListSourceBindingNodesRPC),
		constants.MethodKnowledgeBaseDestroy:                 jsonrpc.WrapTyped(h.DestroyRPC),
		constants.MethodKnowledgeBaseRebuildPermissions:      jsonrpc.WrapTyped(h.RebuildPermissionsRPC),
		constants.MethodKnowledgeBaseRebuild:                 jsonrpc.WrapTyped(h.RebuildRPC),
		constants.MethodKnowledgeBaseRepairSourceBindings:    jsonrpc.WrapTyped(h.RepairSourceBindingsRPC),
		constants.MethodKnowledgeBaseRebuildCleanup:          jsonrpc.WrapTyped(h.RebuildCleanupRPC),
	}
}

// Handlers returns all fragment RPC handlers exposed by the service.
func (h *FragmentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return map[string]jsonrpc.ServerHandler{
		constants.MethodFragmentCreate:                         jsonrpc.WrapTyped(h.CreateRPC),
		constants.MethodFragmentRuntimeCreate:                  jsonrpc.WrapTyped(h.RuntimeCreateRPC),
		constants.MethodFragmentShow:                           jsonrpc.WrapTyped(h.ShowRPC),
		constants.MethodFragmentList:                           jsonrpc.WrapTyped(h.ListRPC),
		constants.MethodFragmentListHTTP:                       jsonrpc.WrapTyped(h.ListHTTPRPC),
		constants.MethodFragmentDestroy:                        jsonrpc.WrapTyped(h.DestroyRPC),
		constants.MethodFragmentRuntimeDestroyByBusinessID:     jsonrpc.WrapTyped(h.RuntimeDestroyByBusinessIDRPC),
		constants.MethodFragmentRuntimeDestroyByMetadataFilter: jsonrpc.WrapTyped(h.RuntimeDestroyByMetadataFilterRPC),
		constants.MethodFragmentSync:                           jsonrpc.WrapTyped(h.SyncRPC),
		constants.MethodFragmentSimilarity:                     jsonrpc.WrapTyped(h.SimilarityRPC),
		constants.MethodFragmentSimilarityHTTP:                 jsonrpc.WrapTyped(h.SimilarityHTTPRPC),
		constants.MethodFragmentRuntimeSimilarity:              jsonrpc.WrapTyped(h.RuntimeSimilarityRPC),
		constants.MethodFragmentSimilarityByAgent:              jsonrpc.WrapTyped(h.SimilarityByAgentRPC),
		constants.MethodFragmentPreview:                        jsonrpc.WrapTyped(h.PreviewRPC),
		constants.MethodFragmentPreviewHTTP:                    jsonrpc.WrapTyped(h.PreviewHTTPRPC),
	}
}

// Handlers returns all embedding RPC handlers exposed by the service.
func (h *EmbeddingRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return map[string]jsonrpc.ServerHandler{
		constants.MethodEmbeddingCompute:       jsonrpc.WrapTyped(h.ComputeRPC),
		constants.MethodEmbeddingComputeBatch:  jsonrpc.WrapTyped(h.ComputeBatchRPC),
		constants.MethodEmbeddingProvidersList: jsonrpc.WrapTyped(h.ListProvidersRPC),
	}
}

// Handlers returns all document RPC handlers exposed by the service.
func (h *DocumentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return map[string]jsonrpc.ServerHandler{
		constants.MethodDocumentCreate:                    jsonrpc.WrapTyped(h.CreateRPC),
		constants.MethodDocumentUpdate:                    jsonrpc.WrapTyped(h.UpdateRPC),
		constants.MethodDocumentShow:                      jsonrpc.WrapTyped(h.ShowRPC),
		constants.MethodDocumentGetOriginalFileLink:       jsonrpc.WrapTyped(h.GetOriginalFileLinkRPC),
		constants.MethodDocumentList:                      jsonrpc.WrapTyped(h.ListRPC),
		constants.MethodDocumentGetByThirdFileID:          jsonrpc.WrapTyped(h.GetByThirdFileIdRPC),
		constants.MethodDocumentCountByKnowledgeBaseCodes: jsonrpc.WrapTyped(h.CountByKnowledgeBaseCodesRPC),
		constants.MethodDocumentDestroy:                   jsonrpc.WrapTyped(h.DestroyRPC),
		constants.MethodDocumentSync:                      jsonrpc.WrapTyped(h.SyncRPC),
		constants.MethodDocumentReVectorizedByThirdFileID: jsonrpc.WrapTyped(h.ReVectorizedByThirdFileIdRPC),
		constants.MethodKnowledgeProjectFileNotifyChange:  jsonrpc.WrapTyped(h.NotifyProjectFileChangeRPC),
	}
}
