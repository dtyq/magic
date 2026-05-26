//go:build wireinject

package main

import (
	"github.com/google/wire"

	fragmentapp "magic/internal/application/knowledge/fragment/service"
	"magic/internal/config/autoload"
	diapp "magic/internal/di/app"
	diinfra "magic/internal/di/infra"
	direbuild "magic/internal/di/rebuild"
	"magic/internal/infrastructure/health"
	"magic/internal/infrastructure/knowledge/documentsync"
	metrics "magic/internal/infrastructure/metrics"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	httpserver "magic/internal/interfaces/http"
	"magic/internal/interfaces/http/handlers"
	rpchandler "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	opshandler "magic/internal/interfaces/rpc/jsonrpc/ops/service"
)

func provideServerConfig(cfg *autoload.Config) *httpserver.ServerConfig {
	return &httpserver.ServerConfig{
		Port:            cfg.Server.Port,
		StripPathPrefix: cfg.Server.StripPathPrefix,
		Mode:            httpserver.Mode(cfg.Server.Mode),
		BasePath:        cfg.Server.BasePath,
		Env:             cfg.Server.Env,
		PprofEnabled:    cfg.Server.PprofEnabled,
		AllowedOrigins:  cfg.Security.AllowedOrigins,
	}
}

func InitializeApplication() (*httpserver.Server, func(), error) {
	wire.Build(
		diinfra.ProviderSet,
		diapp.ProviderSet,
		direbuild.ProviderSet,

		provideServerConfig,

		httpserver.ProvideServerRuntimeDeps,
		httpserver.ProvideServerBackgroundDeps,
		httpserver.ProvideServerDependencies,
		httpserver.ProvideRPCHandlers,
		httpserver.NewServerWithDependencies,

		// 处理器
		rpchandler.ProvideKnowledgeBaseRPCDeps,
		rpchandler.ProvideKnowledgeBaseRPCService,
		rpchandler.NewFragmentRPCService,
		rpchandler.NewDocumentRPCService,
		rpchandler.NewEmbeddingRPCService,
		opshandler.ProvideOpsRPCService,

		handlers.NewDebugHandler,
		handlers.NewMagicFSFileHandler,

		// 接口绑定
		wire.Bind(new(httpserver.InfraServices), new(*health.CheckService)),
		wire.Bind(new(httpserver.MetricsService), new(*metrics.Metrics)),
		wire.Bind(new(httpserver.RPCServer), new(*unixsocket.Server)),
		wire.Bind(new(httpserver.RetrievalWarmupService), new(*fragmentapp.FragmentAppService)),
		wire.Bind(new(httpserver.TaskQueueService), new(*documentsync.Runtime)),
		wire.Bind(new(opshandler.OfficialOrganizationMemberChecker), new(*ipcclient.PHPKnowledgeBasePermissionRPCClient)),
	)
	return nil, nil, nil
}
