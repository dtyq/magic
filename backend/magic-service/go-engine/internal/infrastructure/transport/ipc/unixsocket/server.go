// Package unixsocket 实现 IPC 服务器封装。
package unixsocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"time"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
	pkgjsonrpc "magic/internal/pkg/jsonrpc"
)

const defaultEngineSocketPath = "/tmp/magic_engine.sock"

// Server 用于 UDS IPC 的封装。
type Server struct {
	path      string
	logger    *logging.SugaredLogger
	rpcServer *jsonrpc.Server
}

// NewServer 创建新的 Server。
func NewServer(cfg *autoloadcfg.IPCConfig, logger *logging.SugaredLogger) *Server {
	path := defaultEngineSocketPath
	runtimeCfg := jsonrpc.DefaultRuntimeConfig()
	if cfg != nil {
		applyIPCConfig(runtimeCfg, &path, cfg)
	}

	return &Server{
		path:      path,
		logger:    logger,
		rpcServer: jsonrpc.NewServer(logger, runtimeCfg),
	}
}

func applyIPCConfig(runtimeCfg *jsonrpc.RuntimeConfig, path *string, cfg *autoloadcfg.IPCConfig) {
	if cfg.EngineSocket != "" {
		*path = cfg.EngineSocket
	}
	if cfg.ProtocolVersion > 0 {
		runtimeCfg.ProtocolVersion = cfg.ProtocolVersion
	}
	if cfg.HandshakeCode != "" {
		runtimeCfg.AuthCredential = cfg.HandshakeCode
	}
	if cfg.MaxMessageBytes > 0 {
		runtimeCfg.MaxMessageBytes = cfg.MaxMessageBytes
	}
	if cfg.ReadTimeout > 0 {
		runtimeCfg.ReadTimeout = time.Duration(cfg.ReadTimeout) * time.Second
	}
	if cfg.WriteTimeout > 0 {
		runtimeCfg.WriteTimeout = time.Duration(cfg.WriteTimeout) * time.Second
	}
	if cfg.HeartbeatInterval > 0 {
		runtimeCfg.HeartbeatInterval = time.Duration(cfg.HeartbeatInterval) * time.Second
	}
	if cfg.HeartbeatTimeout > 0 {
		runtimeCfg.HeartbeatTimeout = time.Duration(cfg.HeartbeatTimeout) * time.Second
	}
	if cfg.MaxPendingRequests > 0 {
		runtimeCfg.MaxPendingRequests = cfg.MaxPendingRequests
	}
	if cfg.DiscardCapMultiplier > 0 {
		runtimeCfg.DiscardCapMultiplier = cfg.DiscardCapMultiplier
	}
	if cfg.DiscardChunkSize > 0 {
		runtimeCfg.DiscardChunkSize = cfg.DiscardChunkSize
	}
	if cfg.DiscardTimeout > 0 {
		runtimeCfg.DiscardTimeout = time.Duration(cfg.DiscardTimeout) * time.Second
	}
	if cfg.OversizeMaxBurst > 0 {
		runtimeCfg.OversizeMaxBurst = cfg.OversizeMaxBurst
	}
}

// RegisterHandler 注册 JSON-RPC 方法处理器
func (s *Server) RegisterHandler(method string, handler pkgjsonrpc.ServerHandler) {
	s.rpcServer.RegisterHandler(method, handler)
}

// CallRPC 调用 PHP 客户端的方法
func (s *Server) CallRPC(method string, params any) (json.RawMessage, error) {
	return s.CallRPCWithContext(context.Background(), method, params)
}

// CallRPCWithContext 调用 PHP 客户端的方法（携带上下文）。
func (s *Server) CallRPCWithContext(ctx context.Context, method string, params any) (json.RawMessage, error) {
	result, err := s.rpcServer.CallByMethodWithContext(ctx, method, params)
	if err != nil {
		return nil, fmt.Errorf("call client by method: %w", err)
	}
	return result, nil
}

// CallRPCTypedWithContext 调用 PHP 客户端的方法（强类型 + 上下文）。
func CallRPCTypedWithContext[T any](ctx context.Context, srv *Server, method string, params any, out *T) error {
	raw, err := srv.CallRPCWithContext(ctx, method, params)
	if err != nil {
		return err
	}
	return pkgjsonrpc.DecodeResult[T](raw, out)
}

// GetRPCClientCount 获取客户端连接数
func (s *Server) GetRPCClientCount() int {
	return s.rpcServer.GetClientCount()
}

// Start 启动服务
func (s *Server) Start() error {
	const dirPerm = 0o750
	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(s.path), dirPerm); err != nil {
		return fmt.Errorf("mkdir failed: %w", err)
	}
	if _, err := os.Stat(s.path); err == nil {
		if err := os.Remove(s.path); err != nil {
			return fmt.Errorf("remove old socket failed: %w", err)
		}
	}

	var lc net.ListenConfig
	listener, err := lc.Listen(context.Background(), "unix", s.path)
	if err != nil {
		return fmt.Errorf("listen on unix socket failed: %w", err)
	}

	if err := s.rpcServer.Serve(listener, s.path); err != nil {
		_ = listener.Close()
		return fmt.Errorf("rpc runtime serve failed: %w", err)
	}
	return nil
}

// Close 停止服务
func (s *Server) Close() error {
	s.rpcServer.Stop()
	return nil
}
