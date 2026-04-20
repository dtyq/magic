package ipcrpc

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	common "magic/internal/pkg/jsonrpc"
)

func newIsolatedTestMetrics() *Metrics {
	factory := promauto.With(prometheus.NewRegistry())
	return newMetricsWithFactory(factory)
}

// NewServerForTest 创建使用隔离 metrics 的 server。
func NewServerForTest(logger *logging.SugaredLogger, cfg *RuntimeConfig) *Server {
	if cfg == nil {
		cfg = DefaultRuntimeConfig()
	}
	return &Server{
		logger:   logger,
		config:   cfg,
		metrics:  newIsolatedTestMetrics(),
		handlers: make(map[string]common.ServerHandler),
		clients:  make(map[int64]*Session),
		stopCh:   make(chan struct{}),
	}
}

// PendingKeyForTest 暴露 pendingKey 供测试使用。
func PendingKeyForTest(id any) (string, bool) {
	return pendingKey(id)
}

// DecodeParamsForTest 暴露 decodeParams 供测试使用。
func DecodeParamsForTest(params, out any) error {
	return decodeParams(params, out)
}

// IsClosedErrForTest 暴露 isClosedErr 供测试使用。
func IsClosedErrForTest(err error) bool {
	return isClosedErr(err)
}

// RequestIDFromRequestContextForTest 暴露 request_id 提取逻辑供测试使用。
func RequestIDFromRequestContextForTest(req *common.Request) string {
	return requestIDFromRequestContext(req)
}

// NewSessionForTest 暴露会话构造供测试与 benchmark 使用。
func NewSessionForTest(id int64, conn net.Conn, server *Server) *Session {
	return newSession(id, conn, server)
}

// AttachSessionForTest 将 session 挂到 server 上，便于测试路由与调用逻辑。
func AttachSessionForTest(server *Server, session *Session, primary bool) {
	if server == nil || session == nil {
		return
	}
	server.clientsMu.Lock()
	server.clients[session.ID] = session
	server.clientsMu.Unlock()
	if primary {
		server.primaryClient.Store(session)
	}
}

// SetSessionCapabilitiesForTest 标记 session 已握手并注入能力集。
func SetSessionCapabilitiesForTest(session *Session, methods ...string) {
	if session == nil {
		return
	}
	session.infoMu.Lock()
	session.info.Capabilities = buildCapabilities(methods)
	session.info.MaxMessageBytes = DefaultMaxMessageBytes
	session.infoMu.Unlock()
	session.handshaked.Store(true)
}

// CloseSessionForTest 暴露 close 供测试使用。
func CloseSessionForTest(session *Session) {
	if session == nil {
		return
	}
	session.close()
}

// SetPendingResponseForTest 注册等待响应通道。
func SetPendingResponseForTest(session *Session, key string, responseCh chan *common.Response) {
	if session == nil {
		return
	}
	session.pendingMu.Lock()
	session.pending[key] = responseCh
	session.pendingMu.Unlock()
}

// DeletePendingResponseForTest 删除等待响应通道。
func DeletePendingResponseForTest(session *Session, key string) {
	if session == nil {
		return
	}
	session.pendingMu.Lock()
	delete(session.pending, key)
	session.pendingMu.Unlock()
}

// RequestIDFromRawJSONForTest 暴露 request_id 原始解析逻辑供测试使用。
func RequestIDFromRawJSONForTest(raw json.RawMessage) string {
	return requestIDFromRawJSON(raw)
}

// BuildOutboundRequestContextForTest 暴露出站请求上下文编码逻辑。
func BuildOutboundRequestContextForTest(ctx context.Context) json.RawMessage {
	return buildOutboundRequestContext(ctx)
}

// ReadLegacyHandshakeCodeForTest 暴露兼容字段读取逻辑。
func ReadLegacyHandshakeCodeForTest(raw json.RawMessage) string {
	return readLegacyHandshakeCode(raw)
}

// BuildCapabilitiesForTest 暴露能力集构建逻辑。
func BuildCapabilitiesForTest(methods []string) map[string]struct{} {
	return buildCapabilities(methods)
}

// CallByMethodWithNilContextForTest 暴露 nil context 分支供测试使用。
func CallByMethodWithNilContextForTest(server *Server, method string, params any) (json.RawMessage, error) {
	if server == nil {
		return nil, nil
	}
	_ = method
	_ = params
	return nil, errNilContext
}

// HandleMessageForTest 暴露 handleMessage 供外部测试使用。
func HandleMessageForTest(ctx context.Context, session *Session, payload []byte) {
	if session == nil {
		return
	}
	session.handleMessage(ctx, payload)
}

// CallSessionWithTimeoutForTest 暴露 callWithTimeout 供外部测试使用。
func CallSessionWithTimeoutForTest(ctx context.Context, session *Session, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if session == nil {
		return nil, nil
	}
	return session.callWithTimeout(ctx, method, params, timeout)
}

// CallSessionWithNilContextForTest 暴露 nil context 分支供测试使用。
func CallSessionWithNilContextForTest(session *Session, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if session == nil {
		return nil, nil
	}
	_ = method
	_ = params
	_ = timeout
	return nil, errNilContext
}

// SendPacketToSessionForTest 暴露 sendPacket 供外部测试使用。
func SendPacketToSessionForTest(session *Session, response *common.Response) error {
	if session == nil {
		return nil
	}
	return session.sendPacket(response)
}

// SendErrorPacketForTest 暴露 sendError 编码结果供测试使用。
func SendErrorPacketForTest(id any, code int, message string, data any) ([]byte, error) {
	serverConn, clientConn := net.Pipe()
	defer func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	}()

	session := newSession(1, serverConn, &Server{
		config: DefaultRuntimeConfig(),
	})

	done := make(chan struct{})
	go func() {
		defer close(done)
		session.sendError(context.Background(), id, code, message, data)
	}()

	header := make([]byte, headerSize)
	if _, err := io.ReadFull(clientConn, header); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	bodyLen := binary.BigEndian.Uint32(header)
	body := make([]byte, bodyLen)
	if _, err := io.ReadFull(clientConn, body); err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	<-done
	return body, nil
}

// ExecuteHandlerPacketForTest 暴露 executeHandler 发送结果供测试使用。
func ExecuteHandlerPacketForTest(req *common.Request, handler common.ServerHandler) ([]byte, error) {
	serverConn, clientConn := net.Pipe()
	defer func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	}()

	session := newSession(1, serverConn, &Server{
		config:  DefaultRuntimeConfig(),
		metrics: newIsolatedTestMetrics(),
		logger: logging.NewFromConfig(autoloadcfg.LoggingConfig{
			Level:  autoloadcfg.LogLevelInfo,
			Format: autoloadcfg.LogFormatJSON,
		}),
	})

	done := make(chan struct{})
	go func() {
		defer close(done)
		session.executeHandler(context.Background(), req, handler, time.Now())
	}()

	header := make([]byte, headerSize)
	if _, err := io.ReadFull(clientConn, header); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	bodyLen := binary.BigEndian.Uint32(header)
	body := make([]byte, bodyLen)
	if _, err := io.ReadFull(clientConn, body); err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	<-done
	return body, nil
}

// EncodeRequestForTest 构造测试请求报文。
func EncodeRequestForTest(method string, params, id any) (*common.Request, error) {
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("marshal params: %w", err)
	}
	return &common.Request{
		JSONRPC: common.Version,
		Method:  method,
		Params:  raw,
		ID:      id,
	}, nil
}
