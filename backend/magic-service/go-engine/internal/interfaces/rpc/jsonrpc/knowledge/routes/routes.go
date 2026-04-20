// Package routes 提供 RPC 路由的分组注册。
package routes

import (
	"context"
	"encoding/json"

	"magic/internal/constants"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

// RPCRouter 定义服务端注册接口。
type RPCRouter interface {
	RegisterHandler(method string, handler jsonrpc.ServerHandler)
}

// HandlerProvider 提供已包装好的 RPC 处理器集合。
type HandlerProvider interface {
	Handlers() map[string]jsonrpc.ServerHandler
}

// Dependencies 聚合 RPC 路由所需的处理器。
type Dependencies struct {
	Server           RPCRouter
	KnowledgeHandler HandlerProvider
	FragmentHandler  HandlerProvider
	EmbeddingHandler HandlerProvider
	DocumentHandler  HandlerProvider
}

// SetupRPCRoutes 注册全部 RPC 路由。
func SetupRPCRoutes(deps Dependencies) {
	if deps.Server == nil {
		return
	}

	// Ping（系统方法）
	deps.Server.RegisterHandler(constants.MethodPing, func(ctx context.Context, _ string, params json.RawMessage) (any, error) {
		return map[string]bool{"ok": true}, nil
	})

	RegisterKnowledgeBaseRoutes(deps.Server, deps.KnowledgeHandler)
	RegisterFragmentRoutes(deps.Server, deps.FragmentHandler)
	RegisterEmbeddingRoutes(deps.Server, deps.EmbeddingHandler)
	RegisterDocumentRoutes(deps.Server, deps.DocumentHandler)
}

func registerHandlers(router RPCRouter, provider HandlerProvider, methods []string) {
	handlers := provider.Handlers()
	for _, method := range methods {
		handler := handlers[method]
		if handler == nil {
			continue
		}
		router.RegisterHandler(method, handler)
	}
}
