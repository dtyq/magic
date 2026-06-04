package service

import (
	"magic/internal/constants"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

type rpcHandlerEntry struct {
	method  string
	handler jsonrpc.ServerHandler
}

// Handlers returns all knowledge-base RPC handlers exposed by the service.
func (h *KnowledgeBaseRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	handlers := rpcHandlerMap(h.knowledgeBaseCRUDHandlers()...)
	addRPCHandlers(handlers, h.knowledgeBaseTeamshareHandlers()...)
	addRPCHandlers(handlers, h.knowledgeBaseMaintenanceHandlers()...)
	return handlers
}

func (h *KnowledgeBaseRPCService) knowledgeBaseCRUDHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodKnowledgeBaseCreate, jsonrpc.WrapTyped(h.CreateRPC)},
		{constants.MethodKnowledgeBaseUpdate, jsonrpc.WrapTyped(h.UpdateRPC)},
		{constants.MethodKnowledgeBaseSaveProcess, jsonrpc.WrapTyped(h.SaveProcessRPC)},
		{constants.MethodKnowledgeBaseShow, jsonrpc.WrapTyped(h.ShowRPC)},
		{constants.MethodKnowledgeBaseList, jsonrpc.WrapTyped(h.ListRPC)},
		{constants.MethodKnowledgeBaseNodes, jsonrpc.WrapTyped(h.ListSourceBindingNodesRPC)},
		{constants.MethodKnowledgeBaseDestroy, jsonrpc.WrapTyped(h.DestroyRPC)},
	}
}

func (h *KnowledgeBaseRPCService) knowledgeBaseTeamshareHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodKnowledgeTeamshareStartVector, jsonrpc.WrapTyped(h.TeamshareStartVectorRPC)},
		{constants.MethodKnowledgeTeamshareManageable, jsonrpc.WrapTyped(h.TeamshareManageableRPC)},
		{constants.MethodKnowledgeTeamshareManageableProgress, jsonrpc.WrapTyped(h.TeamshareManageableProgressRPC)},
	}
}

func (h *KnowledgeBaseRPCService) knowledgeBaseMaintenanceHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodKnowledgeBaseRebuildPermissions, jsonrpc.WrapTyped(h.RebuildPermissionsRPC)},
		{constants.MethodKnowledgeBaseRebuild, jsonrpc.WrapTyped(h.RebuildRPC)},
		{constants.MethodKnowledgeBaseRepairSourceBindings, jsonrpc.WrapTyped(h.RepairSourceBindingsRPC)},
		{constants.MethodKnowledgeBaseRebuildCleanup, jsonrpc.WrapTyped(h.RebuildCleanupRPC)},
	}
}

// Handlers returns all fragment RPC handlers exposed by the service.
func (h *FragmentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	handlers := rpcHandlerMap(h.fragmentReadWriteHandlers()...)
	addRPCHandlers(handlers, h.fragmentRuntimeHandlers()...)
	addRPCHandlers(handlers, h.fragmentSearchHandlers()...)
	return handlers
}

func (h *FragmentRPCService) fragmentReadWriteHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodFragmentCreate, jsonrpc.WrapTyped(h.CreateRPC)},
		{constants.MethodFragmentShow, jsonrpc.WrapTyped(h.ShowRPC)},
		{constants.MethodFragmentList, jsonrpc.WrapTyped(h.ListRPC)},
		{constants.MethodFragmentListHTTP, jsonrpc.WrapTyped(h.ListHTTPRPC)},
		{constants.MethodFragmentDestroy, jsonrpc.WrapTyped(h.DestroyRPC)},
		{constants.MethodFragmentSync, jsonrpc.WrapTyped(h.SyncRPC)},
	}
}

func (h *FragmentRPCService) fragmentRuntimeHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodFragmentRuntimeCreate, jsonrpc.WrapTyped(h.RuntimeCreateRPC)},
		{constants.MethodFragmentRuntimeDestroyByBusinessID, jsonrpc.WrapTyped(h.RuntimeDestroyByBusinessIDRPC)},
		{constants.MethodFragmentRuntimeDestroyByMetadataFilter, jsonrpc.WrapTyped(h.RuntimeDestroyByMetadataFilterRPC)},
		{constants.MethodFragmentRuntimeSimilarity, jsonrpc.WrapTyped(h.RuntimeSimilarityRPC)},
	}
}

func (h *FragmentRPCService) fragmentSearchHandlers() []rpcHandlerEntry {
	return []rpcHandlerEntry{
		{constants.MethodFragmentSimilarity, jsonrpc.WrapTyped(h.SimilarityRPC)},
		{constants.MethodFragmentSimilarityHTTP, jsonrpc.WrapTyped(h.SimilarityHTTPRPC)},
		{constants.MethodFragmentSimilarityByAgent, jsonrpc.WrapTyped(h.SimilarityByAgentRPC)},
		{constants.MethodFragmentPreview, jsonrpc.WrapTyped(h.PreviewRPC)},
		{constants.MethodFragmentPreviewHTTP, jsonrpc.WrapTyped(h.PreviewHTTPRPC)},
	}
}

// Handlers returns all embedding RPC handlers exposed by the service.
func (h *EmbeddingRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return rpcHandlerMap(
		rpcHandlerEntry{constants.MethodEmbeddingCompute, jsonrpc.WrapTyped(h.ComputeRPC)},
		rpcHandlerEntry{constants.MethodEmbeddingComputeBatch, jsonrpc.WrapTyped(h.ComputeBatchRPC)},
		rpcHandlerEntry{constants.MethodEmbeddingProvidersList, jsonrpc.WrapTyped(h.ListProvidersRPC)},
	)
}

// Handlers returns all document RPC handlers exposed by the service.
func (h *DocumentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if h == nil {
		return nil
	}

	return rpcHandlerMap(
		rpcHandlerEntry{constants.MethodDocumentCreate, jsonrpc.WrapTyped(h.CreateRPC)},
		rpcHandlerEntry{constants.MethodDocumentUpdate, jsonrpc.WrapTyped(h.UpdateRPC)},
		rpcHandlerEntry{constants.MethodDocumentShow, jsonrpc.WrapTyped(h.ShowRPC)},
		rpcHandlerEntry{constants.MethodDocumentGetOriginalFileLink, jsonrpc.WrapTyped(h.GetOriginalFileLinkRPC)},
		rpcHandlerEntry{constants.MethodDocumentList, jsonrpc.WrapTyped(h.ListRPC)},
		rpcHandlerEntry{constants.MethodDocumentGetByThirdFileID, jsonrpc.WrapTyped(h.GetByThirdFileIdRPC)},
		rpcHandlerEntry{constants.MethodDocumentCountByKnowledgeBaseCodes, jsonrpc.WrapTyped(h.CountByKnowledgeBaseCodesRPC)},
		rpcHandlerEntry{constants.MethodDocumentDestroy, jsonrpc.WrapTyped(h.DestroyRPC)},
		rpcHandlerEntry{constants.MethodDocumentSync, jsonrpc.WrapTyped(h.SyncRPC)},
		rpcHandlerEntry{constants.MethodDocumentReVectorizedByThirdFileID, jsonrpc.WrapTyped(h.ReVectorizedByThirdFileIdRPC)},
		rpcHandlerEntry{constants.MethodKnowledgeProjectFileNotifyChange, jsonrpc.WrapTyped(h.NotifyProjectFileChangeRPC)},
	)
}

func rpcHandlerMap(entries ...rpcHandlerEntry) map[string]jsonrpc.ServerHandler {
	handlers := make(map[string]jsonrpc.ServerHandler, len(entries))
	addRPCHandlers(handlers, entries...)
	return handlers
}

func addRPCHandlers(handlers map[string]jsonrpc.ServerHandler, entries ...rpcHandlerEntry) {
	for _, entry := range entries {
		handlers[entry.method] = entry.handler
	}
}
