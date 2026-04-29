package routes_test

import (
	"testing"

	"magic/internal/constants"
	routes "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

type fakeRouter struct {
	handlers map[string]jsonrpc.ServerHandler
}

func (r *fakeRouter) RegisterHandler(method string, handler jsonrpc.ServerHandler) {
	if r.handlers == nil {
		r.handlers = make(map[string]jsonrpc.ServerHandler)
	}
	r.handlers[method] = handler
}

func TestRegisterKnowledgeBaseRoutes(t *testing.T) {
	t.Parallel()
	router := &fakeRouter{}
	h := stubProvider(
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
	)

	routes.RegisterKnowledgeBaseRoutes(router, h)

	expectedMethods := []string{
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

	if len(router.handlers) != len(expectedMethods) {
		t.Fatalf("expected %d handlers, got %d", len(expectedMethods), len(router.handlers))
	}
	for _, method := range expectedMethods {
		handler, ok := router.handlers[method]
		if !ok {
			t.Fatalf("expected method %q to be registered", method)
		}
		if handler == nil {
			t.Fatalf("expected method %q handler not nil", method)
		}
	}
}
