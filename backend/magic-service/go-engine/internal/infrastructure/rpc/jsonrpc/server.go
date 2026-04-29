// Package ipcrpc 提供 JSON-RPC 2.0 runtime 实现。
package ipcrpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"magic/internal/infrastructure/logging"
	common "magic/internal/pkg/jsonrpc"
	"magic/internal/pkg/runguard"
)

// 默认配置
const (
	DefaultCallTimeout          = 30 * time.Second  // 默认 RPC 调用超时
	DefaultReadTimeout          = 30 * time.Second  // 默认读超时
	DefaultWriteTimeout         = 10 * time.Second  // 写超时
	DefaultHeartbeatInterval    = 10 * time.Second  // 心跳间隔
	DefaultHeartbeatTimeout     = 30 * time.Second  // 心跳超时
	DefaultProtocolVersion      = ipcFrameVersionV2 // 默认协议版本
	DefaultMaxMessageBytes      = 30 * 1024 * 1024  // 默认最大消息大小 (30MB, on-wire)
	DefaultMaxPendingRequests   = 1024              // 默认最大等待响应数
	DefaultDiscardCapMultiplier = 4                 // 超限丢弃上限倍数
	DefaultDiscardChunkSize     = 32 * 1024         // 超限丢弃分块大小
)

var (
	errClientNotFound               = errors.New("client not found")
	errNoConnectedClients           = errors.New("no connected clients")
	errNoCapableClients             = errors.New("no capable clients")
	errNilContext                   = errors.New("context is nil")
	errConnectionClosed             = errors.New("connection closed")
	errConnectionClosedWhileWaiting = errors.New("connection closed while waiting for response")
	errWriteMessageFailed           = errors.New("write message failed")
	errCallTimeout                  = errors.New("RPC call timeout")
	errHandshakeRequired            = errors.New("handshake required")
	errOverloaded                   = errors.New("too many pending requests")
	errPayloadTooLarge              = errors.New("payload too large")
	errListenerNil                  = errors.New("listener is nil")
)

// RuntimeConfig RPC runtime 配置。
type RuntimeConfig struct {
	ProtocolVersion      int
	AuthCredential       string
	MaxMessageBytes      int
	CallTimeout          time.Duration
	ReadTimeout          time.Duration
	WriteTimeout         time.Duration
	HeartbeatInterval    time.Duration
	HeartbeatTimeout     time.Duration
	MaxPendingRequests   int
	DiscardCapMultiplier int
	DiscardChunkSize     int
	DiscardTimeout       time.Duration
	OversizeMaxBurst     int
}

// DefaultRuntimeConfig 返回默认配置。
func DefaultRuntimeConfig() *RuntimeConfig {
	return &RuntimeConfig{
		ProtocolVersion:      DefaultProtocolVersion,
		AuthCredential:       "",
		MaxMessageBytes:      DefaultMaxMessageBytes,
		CallTimeout:          DefaultCallTimeout,
		ReadTimeout:          DefaultReadTimeout,
		WriteTimeout:         DefaultWriteTimeout,
		HeartbeatInterval:    DefaultHeartbeatInterval,
		HeartbeatTimeout:     DefaultHeartbeatTimeout,
		MaxPendingRequests:   DefaultMaxPendingRequests,
		DiscardCapMultiplier: DefaultDiscardCapMultiplier,
		DiscardChunkSize:     DefaultDiscardChunkSize,
		DiscardTimeout:       0,
		OversizeMaxBurst:     3,
	}
}

// Server 是 JSON-RPC 2.0 runtime 服务器。
type Server struct {
	logger   *logging.SugaredLogger
	config   *RuntimeConfig
	metrics  *Metrics
	listener net.Listener
	// endpointLabel 用于日志标识，由 transport 适配器传入。
	endpointLabel string

	// 注册的方法处理器
	handlers   map[string]common.ServerHandler
	handlersMu sync.RWMutex

	// 活跃的客户端连接
	clients   map[int64]*Session
	clientsMu sync.RWMutex
	nextID    atomic.Int64

	// 主客户端指针（用于单客户端场景）
	primaryClient atomic.Pointer[Session]

	stateChangedMu sync.Mutex
	stateChanged   chan struct{}
	stopCh         chan struct{}
	panicExit      func(int)
}

// NewServer 创建新的 JSON-RPC runtime 服务器。
func NewServer(logger *logging.SugaredLogger, cfg *RuntimeConfig) *Server {
	if cfg == nil {
		cfg = DefaultRuntimeConfig()
	}
	return &Server{
		logger:       logger,
		config:       cfg,
		metrics:      NewMetrics(),
		handlers:     make(map[string]common.ServerHandler),
		clients:      make(map[int64]*Session),
		stateChanged: make(chan struct{}),
		stopCh:       make(chan struct{}),
		panicExit:    os.Exit,
	}
}

// RegisterHandler 注册 RPC 方法处理器
func (s *Server) RegisterHandler(method string, handler common.ServerHandler) {
	s.handlersMu.Lock()
	s.handlers[method] = handler
	s.handlersMu.Unlock()
}

// Serve 基于传入 listener 启动 runtime。
func (s *Server) Serve(listener net.Listener, endpointLabel string) error {
	if listener == nil {
		return errListenerNil
	}
	s.listener = listener
	if endpointLabel == "" {
		endpointLabel = "unknown"
	}
	s.endpointLabel = endpointLabel

	s.startAcceptLoop(endpointLabel)

	return nil
}

func (s *Server) startAcceptLoop(endpointLabel string) {
	go func() {
		defer runguard.Recover(context.Background(), runguard.Options{
			Scope:  "rpc.accept_loop",
			Policy: runguard.ExitProcess,
			Fields: []any{"endpoint", endpointLabel},
			OnPanic: func(ctx context.Context, report runguard.Report) {
				logPanicReport(ctx, s.logger, report)
			},
			Exit: s.exitProcess,
		})
		s.acceptLoop()
	}()
}

func (s *Server) exitProcess(code int) {
	if s.panicExit != nil {
		s.panicExit(code)
		return
	}
	os.Exit(code)
}

// Stop 停止服务器
func (s *Server) Stop() {
	close(s.stopCh)
	if s.listener != nil {
		_ = s.listener.Close()
	}

	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()
	for _, client := range s.clients {
		client.close()
	}
}

func (s *Server) acceptLoop() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
				s.logger.ErrorContext(context.Background(), "Accept failed", "error", err)
				continue
			}
		}

		s.handleNewConnection(conn)
	}
}

func (s *Server) handleNewConnection(conn net.Conn) {
	session := newSession(s.nextID.Add(1), conn, s)

	s.clientsMu.Lock()
	s.clients[session.ID] = session
	if s.primaryClient.Load() == nil {
		s.primaryClient.Store(session)
	}
	s.clientsMu.Unlock()

	s.metrics.RPCActiveConnections.Inc()

	runguard.Go(
		context.Background(),
		runguard.Options{
			Scope:  "rpc.session.read_loop",
			Policy: runguard.CloseScope,
			Fields: []any{
				"session_id", session.ID,
				"endpoint", s.endpointLabel,
				"direction", DirectionRecv,
			},
			OnPanic: func(ctx context.Context, report runguard.Report) {
				logPanicReport(ctx, s.logger, report)
			},
		},
		func() {
			defer s.cleanupConnection(session)
			session.readLoop(context.Background())
		},
	)
}

func logPanicReport(ctx context.Context, logger *logging.SugaredLogger, report runguard.Report) {
	if logger == nil {
		return
	}
	logger.ErrorContext(ctx, "Goroutine panic recovered", report.Fields...)
}

func (s *Server) cleanupConnection(session *Session) {
	s.clientsMu.Lock()
	delete(s.clients, session.ID)

	if s.primaryClient.Load() == session {
		s.primaryClient.Store(nil)
		// 选一个新的主客户端
		for _, c := range s.clients {
			s.primaryClient.Store(c)
			break
		}
	}
	s.clientsMu.Unlock()

	s.metrics.RPCActiveConnections.Dec()
	s.notifyStateChanged()
	if session.handshaked.Load() {
		s.logger.InfoContext(context.Background(), "IPC client disconnected", "id", session.ID)
		return
	}
	// 忽略未握手探测连接的 info 日志，避免启动阶段噪音。
	s.logger.DebugContext(context.Background(), "IPC probe client disconnected before handshake", "id", session.ID)
}

// CallRaw 调用指定客户端的方法
func (s *Server) CallRaw(clientID int64, method string, params any) (json.RawMessage, error) {
	return s.CallRawWithTimeout(clientID, method, params, s.config.CallTimeout)
}

// CallRawWithTimeout 带超时的调用
func (s *Server) CallRawWithTimeout(clientID int64, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	s.clientsMu.RLock()
	client, ok := s.clients[clientID]
	s.clientsMu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("%w: %d", errClientNotFound, clientID)
	}

	return client.callWithTimeout(context.Background(), method, params, timeout)
}

// CallByMethod 根据方法能力选择客户端
func (s *Server) CallByMethod(method string, params any) (json.RawMessage, error) {
	return s.CallByMethodWithContext(context.Background(), method, params)
}

// CallByMethodWithContext 根据方法能力选择客户端（携带上下文）。
func (s *Server) CallByMethodWithContext(ctx context.Context, method string, params any) (json.RawMessage, error) {
	return s.CallByMethodWithContextAndTimeout(ctx, method, params, s.config.CallTimeout)
}

// CallByMethodWithTimeout 根据方法能力选择客户端（带超时）
func (s *Server) CallByMethodWithTimeout(method string, params any, timeout time.Duration) (json.RawMessage, error) {
	return s.CallByMethodWithContextAndTimeout(context.Background(), method, params, timeout)
}

// CallByMethodWithContextAndTimeout 根据方法能力选择客户端（携带上下文 + 超时）。
func (s *Server) CallByMethodWithContextAndTimeout(ctx context.Context, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if ctx == nil {
		return nil, errNilContext
	}

	client := s.selectClientForMethod(method)
	if client == nil {
		s.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errNoCapableClients
	}
	return client.callWithTimeout(ctx, method, params, timeout)
}

// CallFirstRaw 调用主客户端
func (s *Server) CallFirstRaw(method string, params any) (json.RawMessage, error) {
	return s.CallFirstRawWithTimeout(method, params, s.config.CallTimeout)
}

// CallFirstRawWithTimeout 带超时调用主客户端
func (s *Server) CallFirstRawWithTimeout(method string, params any, timeout time.Duration) (json.RawMessage, error) {
	client := s.primaryClient.Load()
	if client == nil {
		s.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errNoConnectedClients
	}

	return client.callWithTimeout(context.Background(), method, params, timeout)
}

func (s *Server) selectClientForMethod(method string) *Session {
	return s.selectClientForMethods(method)
}

func (s *Server) selectClientForMethods(methods ...string) *Session {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	primary := s.primaryClient.Load()
	if primary != nil && primary.SupportsMethods(methods...) {
		return primary
	}

	for _, client := range s.clients {
		if client.SupportsMethods(methods...) {
			return client
		}
	}
	return nil
}

// HasCapableClient 判断是否已有完成握手并声明指定能力的客户端。
// 不传 methods 时表示任意已握手客户端。
func (s *Server) HasCapableClient(methods ...string) bool {
	if s == nil {
		return false
	}
	return s.selectClientForMethods(methods...) != nil
}

// WaitCapableClient 等待出现完成握手并声明指定能力的客户端。
func (s *Server) WaitCapableClient(ctx context.Context, methods ...string) error {
	if ctx == nil {
		return errNilContext
	}
	if s == nil {
		return errNoCapableClients
	}

	for {
		changed := s.subscribeStateChanged()
		if s.HasCapableClient(methods...) {
			return nil
		}
		select {
		case <-changed:
		case <-ctx.Done():
			return fmt.Errorf("wait capable IPC client: %w", ctx.Err())
		}
	}
}

func (s *Server) subscribeStateChanged() <-chan struct{} {
	s.stateChangedMu.Lock()
	defer s.stateChangedMu.Unlock()

	if s.stateChanged == nil {
		s.stateChanged = make(chan struct{})
	}
	return s.stateChanged
}

func (s *Server) notifyStateChanged() {
	s.stateChangedMu.Lock()
	changed := s.stateChanged
	s.stateChanged = make(chan struct{})
	s.stateChangedMu.Unlock()

	if changed != nil {
		close(changed)
	}
}

// GetClientCount 获取连接的客户端数量
func (s *Server) GetClientCount() int {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()
	return len(s.clients)
}
