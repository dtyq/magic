package unixsocket

import (
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
)

// NewServerForTest 创建使用隔离 metrics registry 的 IPC Server。
func NewServerForTest(cfg *autoloadcfg.IPCConfig, logger *logging.SugaredLogger) *Server {
	path := defaultEngineSocketPath
	runtimeCfg := jsonrpc.DefaultRuntimeConfig()
	if cfg != nil {
		applyIPCConfig(runtimeCfg, &path, cfg)
	}

	return &Server{
		path:      path,
		logger:    logger,
		rpcServer: jsonrpc.NewServerForTest(logger, runtimeCfg),
	}
}
