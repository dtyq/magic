package httpapi

import (
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/http/handlers"
	rpchandler "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
)

// ServerRuntimeDeps 聚合 RPC 运行时依赖，供 Wire 显式拼装。
type ServerRuntimeDeps struct {
	rpcServer    RPCServer
	rpcHandlers  RPCHandlers
	debugHandler *handlers.DebugHandler
}

// ServerBackgroundDeps 聚合 HTTP 服务所需的后台任务依赖。
type ServerBackgroundDeps struct {
	cacheCleanupService *embeddingapp.EmbeddingCacheCleanupService
	retrievalWarmup     RetrievalWarmupService
}

// ProvideRPCHandlers 显式构造 RPCHandlers，避免 Wire 通过 struct 字段猜测依赖。
func ProvideRPCHandlers(
	knowledge *rpchandler.KnowledgeBaseRPCService,
	fragment *rpchandler.FragmentRPCService,
	document *rpchandler.DocumentRPCService,
	embedding *rpchandler.EmbeddingRPCService,
) RPCHandlers {
	return RPCHandlers{
		Knowledge: knowledge,
		Fragment:  fragment,
		Document:  document,
		Embedding: embedding,
	}
}

// ProvideServerRuntimeDeps 聚合 RPC 运行时依赖，避免过长 provider 参数列表。
func ProvideServerRuntimeDeps(
	rpcServer RPCServer,
	rpcHandlers RPCHandlers,
	debugHandler *handlers.DebugHandler,
) ServerRuntimeDeps {
	return ServerRuntimeDeps{
		rpcServer:    rpcServer,
		rpcHandlers:  rpcHandlers,
		debugHandler: debugHandler,
	}
}

// ProvideServerBackgroundDeps 聚合后台服务依赖，避免构造函数参数过多。
func ProvideServerBackgroundDeps(
	cacheCleanupService *embeddingapp.EmbeddingCacheCleanupService,
	retrievalWarmup RetrievalWarmupService,
) ServerBackgroundDeps {
	return ServerBackgroundDeps{
		cacheCleanupService: cacheCleanupService,
		retrievalWarmup:     retrievalWarmup,
	}
}

// ProvideServerDependencies 显式构造 ServerDependencies，集中处理 HTTP 服务依赖聚合。
func ProvideServerDependencies(
	config *ServerConfig,
	backgroundDeps ServerBackgroundDeps,
	infraServices InfraServices,
	logger *logging.SugaredLogger,
	metrics MetricsService,
	runtimeDeps ServerRuntimeDeps,
) *ServerDependencies {
	return &ServerDependencies{
		Config:              config,
		CacheCleanupService: backgroundDeps.cacheCleanupService,
		RetrievalWarmup:     backgroundDeps.retrievalWarmup,
		InfraServices:       infraServices,
		Logger:              logger,
		Metrics:             metrics,
		RPCServer:           runtimeDeps.rpcServer,
		RPCHandlers:         runtimeDeps.rpcHandlers,
		DebugHandler:        runtimeDeps.debugHandler,
	}
}
