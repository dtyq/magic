package routes_test

import (
	"context"
	"encoding/json"
	"testing"

	"magic/internal/constants"
	routes "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

func knowledgeMethods() []string {
	return []string{
		constants.MethodKnowledgeBaseCreate,
		constants.MethodKnowledgeBaseUpdate,
		constants.MethodKnowledgeBaseSaveProcess,
		constants.MethodKnowledgeBaseShow,
		constants.MethodKnowledgeBaseList,
		constants.MethodKnowledgeTeamshareStartVector,
		constants.MethodKnowledgeTeamshareManageable,
		constants.MethodKnowledgeTeamshareManageableProgress,
		constants.MethodKnowledgeBaseDestroy,
		constants.MethodKnowledgeBaseRebuild,
		constants.MethodKnowledgeBaseRepairSourceBindings,
		constants.MethodKnowledgeBaseRebuildCleanup,
	}
}

func fragmentMethods() []string {
	return []string{
		constants.MethodFragmentCreate,
		constants.MethodFragmentShow,
		constants.MethodFragmentList,
		constants.MethodFragmentDestroy,
		constants.MethodFragmentSync,
		constants.MethodFragmentSimilarity,
		constants.MethodFragmentPreview,
	}
}

func embeddingMethods() []string {
	return []string{
		constants.MethodEmbeddingCompute,
		constants.MethodEmbeddingComputeBatch,
		constants.MethodEmbeddingProvidersList,
	}
}

func documentMethods() []string {
	return []string{
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
	}
}

func TestSetupRPCRoutesRegistersAllKnowledgeHandlers(t *testing.T) {
	t.Parallel()

	router := &fakeRouter{}

	routes.SetupRPCRoutes(newDependencies(router))

	assertRegisteredMethods(t, router, allKnowledgeMethods())
	assertPingHandler(t, router)
}

func TestSetupRPCRoutesIgnoresNilServer(t *testing.T) {
	t.Parallel()

	routes.SetupRPCRoutes(routes.Dependencies{})
}

type staticHandlerProvider map[string]jsonrpc.ServerHandler

func (p staticHandlerProvider) Handlers() map[string]jsonrpc.ServerHandler {
	return p
}

func stubProvider(methods ...string) staticHandlerProvider {
	handlers := make(staticHandlerProvider, len(methods))
	for _, method := range methods {
		handlers[method] = func(context.Context, string, json.RawMessage) (any, error) {
			return map[string]bool{"ok": true}, nil
		}
	}
	return handlers
}

func TestRegisterDocumentRoutesNilGuard(t *testing.T) {
	t.Parallel()

	router := &fakeRouter{}
	routes.RegisterDocumentRoutes(nil, stubProvider(constants.MethodDocumentCreate))
	routes.RegisterDocumentRoutes(router, nil)
	if len(router.handlers) != 0 {
		t.Fatalf("expected no handlers, got %d", len(router.handlers))
	}
}

func TestRegisterFragmentRoutes(t *testing.T) {
	t.Parallel()

	router := &fakeRouter{}
	routes.RegisterFragmentRoutes(router, stubProvider(fragmentMethods()...))

	assertRegisteredMethods(t, router, fragmentMethods())
}

func TestRegisterEmbeddingRoutes(t *testing.T) {
	t.Parallel()

	router := &fakeRouter{}
	routes.RegisterEmbeddingRoutes(router, stubProvider(embeddingMethods()...))

	assertRegisteredMethods(t, router, embeddingMethods())
}

func newDependencies(router *fakeRouter) routes.Dependencies {
	return routes.Dependencies{
		Server:           router,
		KnowledgeHandler: stubProvider(knowledgeMethods()...),
		FragmentHandler:  stubProvider(fragmentMethods()...),
		EmbeddingHandler: stubProvider(embeddingMethods()...),
		DocumentHandler:  stubProvider(documentMethods()...),
	}
}

func allKnowledgeMethods() []string {
	knowledge := knowledgeMethods()
	fragment := fragmentMethods()
	embedding := embeddingMethods()
	document := documentMethods()
	methods := make([]string, 0, 1+len(knowledge)+len(fragment)+len(embedding)+len(document))
	methods = append(methods, constants.MethodPing)
	methods = append(methods, knowledge...)
	methods = append(methods, fragment...)
	methods = append(methods, embedding...)
	methods = append(methods, document...)
	return methods
}

func assertRegisteredMethods(t *testing.T, router *fakeRouter, expectedMethods []string) {
	t.Helper()

	if len(router.handlers) != len(expectedMethods) {
		t.Fatalf("expected %d handlers, got %d", len(expectedMethods), len(router.handlers))
	}
	for _, method := range expectedMethods {
		if router.handlers[method] == nil {
			t.Fatalf("expected method %q to be registered", method)
		}
	}
}

func assertPingHandler(t *testing.T, router *fakeRouter) {
	t.Helper()

	pingResult, err := router.handlers[constants.MethodPing](context.Background(), constants.MethodPing, nil)
	if err != nil {
		t.Fatalf("expected ping handler success, got %v", err)
	}
	resultMap, ok := pingResult.(map[string]bool)
	if !ok || !resultMap["ok"] {
		t.Fatalf("unexpected ping result: %#v", pingResult)
	}
}
