package ipcrpc

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"

	"magic/internal/pkg/ctxmeta"
	common "magic/internal/pkg/jsonrpc"
	"magic/internal/pkg/logkey"
	"magic/pkg/convert"
)

const (
	headerSize          = 4
	requestLogFieldsCap = 8
	methodHello         = "ipc.hello"
	methodPing          = "ipc.ping"
	maxPooledBodyBytes  = 1 << 20
	heartbeatDebugEvery = time.Minute
)

var (
	// ErrUnknownPayloadType 表示无法识别 payload 类型
	ErrUnknownPayloadType = errors.New("unknown payload type")
	// ErrMessageTooLarge 表示消息超过允许的最大大小
	ErrMessageTooLarge = errors.New("message too large")
	// ErrInvalidRequestID 表示请求 ID 无效
	ErrInvalidRequestID = errors.New("invalid request id")
)

type messageEnvelope struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Context json.RawMessage `json:"context,omitempty"`
	ID      any             `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *common.Error   `json:"error,omitempty"`
}

type requestIDEnvelope struct {
	RequestID json.RawMessage `json:"request_id"`
}

type clientInfo struct {
	PID             int
	ProtocolVersion int
	MaxMessageBytes int
	Capabilities    map[string]struct{}
}

type helloParams struct {
	ProtocolVersion int      `json:"protocol_version"`
	ClientID        string   `json:"client_id"`
	PID             int      `json:"pid"`
	Capabilities    []string `json:"capabilities"`
	HandshakeCode   string   `json:"handshake_code"`
	MaxMessageBytes int      `json:"max_message_bytes"`
}

type helloResult struct {
	OK                bool   `json:"ok"`
	ServerID          string `json:"server_id"`
	ProtocolVersion   int    `json:"protocol_version"`
	HeartbeatInterval int    `json:"heartbeat_interval"`
	HeartbeatTimeout  int    `json:"heartbeat_timeout"`
	MaxMessageBytes   int    `json:"max_message_bytes"`
	ReadTimeout       int    `json:"read_timeout"`
	WriteTimeout      int    `json:"write_timeout"`
}

// Session 表示一个客户端会话
type Session struct {
	ID     int64
	conn   net.Conn
	server *Server
	sendMu sync.Mutex

	// 等待响应的请求
	pending   map[string]chan *common.Response
	pendingMu sync.RWMutex
	nextReqID atomic.Int64

	handshaked    atomic.Bool
	infoMu        sync.RWMutex
	info          clientInfo
	lastSeen      atomic.Int64
	heartbeatOnce sync.Once
	oversizeBurst int

	closed   atomic.Bool
	closedCh chan struct{}
}

// newSession 创建新会话
func newSession(id int64, conn net.Conn, server *Server) *Session {
	s := &Session{
		ID:       id,
		conn:     conn,
		server:   server,
		pending:  make(map[string]chan *common.Response),
		closedCh: make(chan struct{}),
	}
	s.touch()
	return s
}

// readLoop 读取客户端消息的循环
func (s *Session) readLoop(ctx context.Context) {
	defer func() {
		s.close()
	}()

	headerBuf := make([]byte, headerSize)
	maxMessageBytes := s.server.config.MaxMessageBytes
	if maxMessageBytes <= 0 {
		maxMessageBytes = DefaultMaxMessageBytes
	}
	discardCapMultiplier := s.server.config.DiscardCapMultiplier
	if discardCapMultiplier <= 0 {
		discardCapMultiplier = DefaultDiscardCapMultiplier
	}
	discardChunkSize := s.server.config.DiscardChunkSize
	if discardChunkSize <= 0 {
		discardChunkSize = DefaultDiscardChunkSize
	}
	discardTimeout := s.server.config.DiscardTimeout
	if discardTimeout <= 0 {
		discardTimeout = s.server.config.ReadTimeout
	}

	for {
		// 1. 读取 Header（4 字节长度）
		if s.server.config.ReadTimeout > 0 {
			_ = s.conn.SetReadDeadline(time.Now().Add(s.server.config.ReadTimeout))
		}
		if _, err := io.ReadFull(s.conn, headerBuf); err != nil {
			if !isClosedErr(err) {
				s.server.logger.WarnContext(ctx, "读取消息头失败", "sessionId", s.ID, "error", err)
			}
			return
		}

		bodyLen := binary.BigEndian.Uint32(headerBuf)

		// 长度合理性检查（如最大 10MB）
		if maxMessageBytes > 0 && int64(bodyLen) > int64(maxMessageBytes) {
			if !s.handleOversizeFrame(ctx, int64(bodyLen), int64(maxMessageBytes), discardCapMultiplier, discardChunkSize, discardTimeout) {
				return
			}
			continue
		}

		// 2. 读取 Body
		bodyBuf, ok := s.readBodyFrame(ctx, bodyLen)
		if !ok {
			return
		}

		// 3. 处理消息
		s.oversizeBurst = 0
		s.touch()
		s.handleMessage(ctx, bodyBuf)
		releaseBodyBuffer()
	}
}

func (s *Session) readBodyFrame(ctx context.Context, bodyLen uint32) ([]byte, bool) {
	if s.server.config.ReadTimeout > 0 {
		_ = s.conn.SetReadDeadline(time.Now().Add(s.server.config.ReadTimeout))
	}

	bodyLenInt, err := convert.SafeUint64ToInt(uint64(bodyLen), "body_len")
	if err != nil {
		s.server.logger.WarnContext(ctx, "消息体长度溢出", "sessionId", s.ID, "bodyLen", bodyLen, "error", err)
		return nil, false
	}

	bodyBuf := acquireBodyBuffer(bodyLenInt)
	if _, err := io.ReadFull(s.conn, bodyBuf); err != nil {
		if !isClosedErr(err) {
			s.server.logger.WarnContext(ctx, "读取消息体失败", "sessionId", s.ID, "error", err)
		}
		releaseBodyBuffer()
		return nil, false
	}
	return bodyBuf, true
}

func isClosedErr(err error) bool {
	return errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed)
}

func (s *Session) touch() {
	s.lastSeen.Store(time.Now().UnixNano())
}

func pendingKey(id any) (string, bool) {
	if id == nil {
		return "", false
	}
	switch v := id.(type) {
	case int:
		return fmt.Sprintf("n:%d", v), true
	case int64:
		return fmt.Sprintf("n:%d", v), true
	case float64:
		if math.Trunc(v) == v {
			return fmt.Sprintf("n:%d", int64(v)), true
		}
		return fmt.Sprintf("f:%g", v), true
	case json.Number:
		if i, err := v.Int64(); err == nil {
			return fmt.Sprintf("n:%d", i), true
		}
		return "f:" + v.String(), true
	case string:
		return "s:" + v, true
	default:
		return fmt.Sprintf("t:%T:%v", v, v), true
	}
}

func (s *Session) close() {
	if s.closed.CompareAndSwap(false, true) {
		close(s.closedCh)
		_ = s.conn.Close()

		s.pendingMu.Lock()
		for _, ch := range s.pending {
			close(ch)
		}
		s.pending = make(map[string]chan *common.Response)
		s.pendingMu.Unlock()
	}
}

// SupportsMethod 判断客户端是否声明支持该方法。
func (s *Session) SupportsMethod(method string) bool {
	if !s.handshaked.Load() {
		return false
	}
	s.infoMu.RLock()
	defer s.infoMu.RUnlock()
	if len(s.info.Capabilities) == 0 {
		return false
	}
	_, ok := s.info.Capabilities[method]
	return ok
}

// handleMessage 处理收到的消息
func (s *Session) handleMessage(ctx context.Context, data []byte) {
	var envelope messageEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		s.server.logger.WarnContext(ctx, "无法解析消息", "error", err)
		return
	}

	if envelope.JSONRPC != common.Version {
		s.server.logger.WarnContext(ctx, "无效的 JSON-RPC 版本", "jsonrpc", envelope.JSONRPC)
		return
	}

	if envelope.Method != "" {
		req := &common.Request{
			JSONRPC: envelope.JSONRPC,
			Method:  envelope.Method,
			Params:  envelope.Params,
			Context: envelope.Context,
			ID:      envelope.ID,
		}
		s.handleRequest(ctx, req)
		return
	}

	if envelope.ID == nil {
		s.server.logger.WarnContext(ctx, "收到无 ID 的响应", "sessionId", s.ID)
		return
	}

	if envelope.Error == nil && len(bytes.TrimSpace(envelope.Result)) == 0 {
		s.server.logger.WarnContext(ctx, "收到无结果也无错误的响应", "sessionId", s.ID)
		return
	}

	resp := &common.Response{
		JSONRPC: envelope.JSONRPC,
		Result:  envelope.Result,
		Error:   envelope.Error,
		ID:      envelope.ID,
	}
	s.handleResponse(ctx, resp)
}

// handleResponse 处理响应
func (s *Session) handleResponse(ctx context.Context, resp *common.Response) {
	key, ok := pendingKey(resp.ID)
	if !ok {
		s.server.logger.WarnContext(ctx, "收到无效 ID 的响应", "id", resp.ID, "sessionId", s.ID)
		return
	}

	s.pendingMu.RLock()
	ch, ok := s.pending[key]
	s.pendingMu.RUnlock()

	if !ok {
		s.server.logger.WarnContext(ctx, "收到未知 ID 的响应", "id", resp.ID, "sessionId", s.ID)
		return
	}

	select {
	case ch <- resp:
	default:
	}
}

// handleRequest 处理请求
func (s *Session) handleRequest(ctx context.Context, req *common.Request) {
	requestID := requestIDFromRequestContext(req)
	if requestID != "" {
		ctx = ctxmeta.WithRequestID(ctx, requestID)
	}

	startTime := time.Now()
	meta := requestLogMeta{
		msg:       "IPC request",
		direction: DirectionRecv,
		method:    req.Method,
		id:        req.ID,
	}
	s.logRequest(ctx, meta, req.Params)

	if s.handleSystemRequest(ctx, req, startTime) {
		return
	}

	if !s.ensureHandshake(ctx, req, startTime) {
		return
	}

	handler, ok := s.findHandler(ctx, req, startTime)
	if !ok {
		return
	}

	// 异步处理
	go s.executeHandler(ctx, req, handler, startTime)
}

type requestLogMeta struct {
	msg       string
	direction string
	method    string
	id        any
}

type responseLogMeta struct {
	msg       string
	direction string
	method    string
	id        any
}

func (s *Session) logRequest(ctx context.Context, meta requestLogMeta, params any) {
	if !shouldLogMethod(meta.method) {
		return
	}

	payloadSummary := encodePayload(params)
	keyvals := make([]any, 0, requestLogFieldsCap)
	keyvals = append(
		keyvals,
		"direction", meta.direction,
		"method", meta.method,
		"id", meta.id,
		"request_bytes", payloadSummary.Bytes,
	)
	s.server.logger.InfoContext(ctx, meta.msg, keyvals...)
}

func (s *Session) logResponse(ctx context.Context, meta responseLogMeta, durationMs float64, payload any) {
	if !shouldLogMethod(meta.method) {
		return
	}

	payloadSummary := encodePayload(payload)
	s.server.logger.InfoContext(ctx, meta.msg,
		"direction", meta.direction,
		"method", meta.method,
		"id", meta.id,
		"response_bytes", payloadSummary.Bytes,
		logkey.DurationMS, logkey.RoundDurationMS(durationMs),
	)
}

func (s *Session) handleSystemRequest(ctx context.Context, req *common.Request, startTime time.Time) bool {
	switch req.Method {
	case methodHello:
		s.handleHello(ctx, req, startTime)
		return true
	case methodPing:
		s.handlePing(ctx, req, startTime)
		return true
	}
	return false
}

func (s *Session) ensureHandshake(ctx context.Context, req *common.Request, startTime time.Time) bool {
	if s.handshaked.Load() {
		return true
	}

	if !req.IsNotification() {
		meta := responseLogMeta{
			msg:       "IPC response",
			direction: DirectionRecv,
			method:    req.Method,
			id:        req.ID,
		}
		s.logResponse(ctx, meta, time.Since(startTime).Seconds()*1000, map[string]any{
			"code":    ErrCodeHandshakeRequired,
			"message": "handshake required",
		})
		s.sendError(ctx, req.ID, ErrCodeHandshakeRequired, "handshake required", nil)
	}
	s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusError).Inc()
	return false
}

func (s *Session) findHandler(ctx context.Context, req *common.Request, startTime time.Time) (common.ServerHandler, bool) {
	s.server.handlersMu.RLock()
	handler, ok := s.server.handlers[req.Method]
	s.server.handlersMu.RUnlock()

	if !ok {
		if !req.IsNotification() {
			meta := responseLogMeta{
				msg:       "IPC response",
				direction: DirectionRecv,
				method:    req.Method,
				id:        req.ID,
			}
			s.logResponse(ctx, meta, time.Since(startTime).Seconds()*1000, map[string]any{
				"code":    common.MethodNotFound,
				"message": "method not found: " + req.Method,
			})
			s.sendError(ctx, req.ID, common.MethodNotFound, "method not found: "+req.Method, nil)
			s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusError).Inc()
		}
		return nil, false
	}
	return handler, true
}

func (s *Session) executeHandler(ctx context.Context, req *common.Request, handler common.ServerHandler, startTime time.Time) {
	// Panic 恢复
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			s.server.logger.ErrorContext(ctx, "Handler panic recovered",
				"method", req.Method,
				"panic", r,
				"stack", string(stack),
			)

			if !req.IsNotification() {
				s.sendError(ctx, req.ID, common.ErrCodeInternalError, common.GetErrorMessage(common.ErrCodeInternalError), nil)
			}
			s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusError).Inc()
		}
	}()

	result, err := handler(ctx, req.Method, req.Params)

	// 记录指标
	duration := time.Since(startTime).Seconds()
	s.server.metrics.RPCCallDuration.WithLabelValues(req.Method, DirectionRecv).Observe(duration)

	payload := result
	if err != nil {
		payload = rpcErrorPayload(err)
	}
	meta := responseLogMeta{
		msg:       "IPC response",
		direction: DirectionRecv,
		method:    req.Method,
		id:        req.ID,
	}
	s.logResponse(ctx, meta, time.Since(startTime).Seconds()*1000, payload)

	if req.IsNotification() {
		return
	}

	if err != nil {
		s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusError).Inc()

		var rpcErr *common.Error
		var bizErr *common.BusinessError
		switch {
		case errors.As(err, &rpcErr):
			s.sendError(ctx, req.ID, rpcErr.Code, rpcErr.Message, rpcErr.Data)
		case errors.As(err, &bizErr):
			s.sendError(ctx, req.ID, bizErr.Code, bizErr.Message, bizErr.Data)
		default:
			s.sendError(ctx, req.ID, common.ErrCodeInternalError, common.GetErrorMessage(common.ErrCodeInternalError), nil)
		}
		return
	}

	s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusSuccess).Inc()
	s.sendResult(ctx, req.ID, result)
}

func (s *Session) handleHello(ctx context.Context, req *common.Request, startTime time.Time) {
	var params helloParams
	if err := decodeParams(req.Params, &params); err != nil {
		s.handleHelloFailure(ctx, req, common.InvalidParams, "invalid params: "+err.Error(), false)
		return
	}

	if params.ProtocolVersion == 0 {
		params.ProtocolVersion = DefaultProtocolVersion
	}

	if params.ProtocolVersion != s.server.config.ProtocolVersion {
		s.handleHelloFailure(ctx, req, ErrCodeVersionMismatch, "protocol version mismatch", true)
		return
	}

	if params.HandshakeCode == "" {
		params.HandshakeCode = readLegacyHandshakeCode(req.Params)
	}
	if s.server.config.AuthCredential != "" && params.HandshakeCode != s.server.config.AuthCredential {
		s.handleHelloFailure(ctx, req, ErrCodeAuthFailed, "auth failed", true)
		return
	}

	capabilities := buildCapabilities(params.Capabilities)

	maxMessageBytes := params.MaxMessageBytes
	if maxMessageBytes <= 0 {
		maxMessageBytes = s.server.config.MaxMessageBytes
	}

	s.infoMu.Lock()
	s.info = clientInfo{
		PID:             params.PID,
		ProtocolVersion: params.ProtocolVersion,
		MaxMessageBytes: maxMessageBytes,
		Capabilities:    capabilities,
	}
	s.infoMu.Unlock()

	alreadyHandshaked := s.handshaked.Load()
	s.handshaked.Store(true)
	s.touch()
	s.startHeartbeatLoop(ctx)
	if !alreadyHandshaked {
		s.server.logger.InfoContext(ctx, "New IPC client connected",
			"id", s.ID,
			"pid", params.PID,
		)
	}

	if !req.IsNotification() {
		s.sendResult(ctx, req.ID, s.buildHelloResult())
	}

	s.server.metrics.RPCCallDuration.WithLabelValues(req.Method, DirectionRecv).Observe(time.Since(startTime).Seconds())
	s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusSuccess).Inc()
}

func (s *Session) handleHelloFailure(ctx context.Context, req *common.Request, code int, message string, shouldClose bool) {
	if !req.IsNotification() {
		s.sendError(ctx, req.ID, code, message, nil)
	}
	s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusError).Inc()
	if shouldClose {
		s.close()
	}
}

func (s *Session) buildHelloResult() helloResult {
	return helloResult{
		OK:                true,
		ServerID:          "magic-service-go-engine",
		ProtocolVersion:   s.server.config.ProtocolVersion,
		HeartbeatInterval: int(s.server.config.HeartbeatInterval.Seconds()),
		HeartbeatTimeout:  int(s.server.config.HeartbeatTimeout.Seconds()),
		MaxMessageBytes:   s.server.config.MaxMessageBytes,
		ReadTimeout:       int(s.server.config.ReadTimeout.Seconds()),
		WriteTimeout:      int(s.server.config.WriteTimeout.Seconds()),
	}
}

func (s *Session) handlePing(ctx context.Context, req *common.Request, startTime time.Time) {
	s.touch()
	if !req.IsNotification() {
		s.sendResult(ctx, req.ID, map[string]any{"ok": true})
	}
	s.server.metrics.RPCCallDuration.WithLabelValues(req.Method, DirectionRecv).Observe(time.Since(startTime).Seconds())
	s.server.metrics.RPCCallsTotal.WithLabelValues(req.Method, DirectionRecv, StatusSuccess).Inc()
}

// callWithTimeout 带超时的远程调用
func (s *Session) callWithTimeout(ctx context.Context, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if ctx == nil {
		return nil, errNilContext
	}

	if s.closed.Load() {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errConnectionClosed
	}
	if !s.handshaked.Load() {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errHandshakeRequired
	}
	if timeout <= 0 {
		timeout = s.server.config.CallTimeout
	}

	startTime := time.Now()

	rawParams, err := s.marshalParams(method, params)
	if err != nil {
		return nil, err
	}

	id := s.nextReqID.Add(1)
	reqContext := buildOutboundRequestContext(ctx)
	req := common.NewRequestWithContext(method, rawParams, id, reqContext)

	meta := requestLogMeta{
		msg:       "IPC request",
		direction: DirectionSend,
		method:    method,
		id:        id,
	}
	s.logRequest(ctx, meta, rawParams)

	// 创建响应通道
	respCh := make(chan *common.Response, 1)
	key, ok := pendingKey(id)
	if !ok {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, ErrInvalidRequestID
	}

	s.pendingMu.Lock()
	if s.server.config.MaxPendingRequests > 0 && len(s.pending) >= s.server.config.MaxPendingRequests {
		s.pendingMu.Unlock()
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errOverloaded
	}
	s.pending[key] = respCh
	s.pendingMu.Unlock()

	// 更新待处理请求数
	s.server.metrics.RPCPendingRequests.Inc()

	defer func() {
		s.pendingMu.Lock()
		delete(s.pending, key)
		s.pendingMu.Unlock()
		s.server.metrics.RPCPendingRequests.Dec()
	}()

	// 发送请求
	if err := s.sendPacket(req); err != nil {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		if errors.Is(err, ErrMessageTooLarge) {
			return nil, errPayloadTooLarge
		}
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	return s.waitForResponse(ctx, method, id, respCh, startTime, timeout)
}

func (s *Session) waitForResponse(ctx context.Context, method string, id any, respCh chan *common.Response, startTime time.Time, timeout time.Duration) (json.RawMessage, error) {
	// 使用 context 超时控制
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 等待响应或超时
	select {
	case resp, ok := <-respCh:
		return s.handleResponseSuccess(ctx, method, id, startTime, resp, ok)
	case <-ctx.Done():
		return nil, s.handleResponseContextDone(ctx, method, id, startTime, timeout)
	case <-s.closedCh:
		return nil, s.handleResponseClosed(ctx, method, id, startTime)
	}
}

func (s *Session) handleResponseSuccess(ctx context.Context, method string, id any, startTime time.Time, resp *common.Response, ok bool) (json.RawMessage, error) {
	duration := time.Since(startTime).Seconds()
	s.server.metrics.RPCCallDuration.WithLabelValues(method, DirectionSend).Observe(duration)

	if !ok {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, errConnectionClosedWhileWaiting
	}

	if resp.Error != nil {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		payload := rpcErrorPayload(resp.Error)
		meta := responseLogMeta{
			msg:       "IPC response",
			direction: DirectionSend,
			method:    method,
			id:        id,
		}
		s.logResponse(ctx, meta, duration*1000, payload)
		return nil, resp.Error
	}

	s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusSuccess).Inc()
	meta := responseLogMeta{
		msg:       "IPC response",
		direction: DirectionSend,
		method:    method,
		id:        id,
	}
	s.logResponse(ctx, meta, duration*1000, resp.Result)
	return resp.Result, nil
}

func (s *Session) handleResponseContextDone(
	ctx context.Context,
	method string,
	id any,
	startTime time.Time,
	timeout time.Duration,
) error {
	if errors.Is(ctx.Err(), context.Canceled) {
		return s.handleResponseCanceled(ctx, method, id, startTime)
	}
	return s.handleResponseTimeout(ctx, method, id, startTime, timeout)
}

func (s *Session) handleResponseTimeout(ctx context.Context, method string, id any, startTime time.Time, timeout time.Duration) error {
	s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusTimeout).Inc()
	s.server.logger.WarnContext(ctx, "RPC 调用超时", "method", method, "id", id, "sessionId", s.ID)
	durationMs := time.Since(startTime).Seconds() * 1000
	meta := responseLogMeta{
		msg:       "IPC response",
		direction: DirectionSend,
		method:    method,
		id:        id,
	}
	s.logResponse(ctx, meta, durationMs, "timeout")
	return fmt.Errorf("%w: method=%s, timeout=%v", errCallTimeout, method, timeout)
}

func (s *Session) handleResponseCanceled(ctx context.Context, method string, id any, startTime time.Time) error {
	s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
	s.server.logger.WarnContext(ctx, "RPC 调用已取消", "method", method, "id", id, "sessionId", s.ID)
	durationMs := time.Since(startTime).Seconds() * 1000
	meta := responseLogMeta{
		msg:       "IPC response",
		direction: DirectionSend,
		method:    method,
		id:        id,
	}
	s.logResponse(ctx, meta, durationMs, "canceled")
	return fmt.Errorf("RPC call canceled: method=%s: %w", method, context.Canceled)
}

func (s *Session) handleResponseClosed(ctx context.Context, method string, id any, startTime time.Time) error {
	s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
	durationMs := time.Since(startTime).Seconds() * 1000
	meta := responseLogMeta{
		msg:       "IPC response",
		direction: DirectionSend,
		method:    method,
		id:        id,
	}
	s.logResponse(ctx, meta, durationMs, "connection_closed")
	return errConnectionClosedWhileWaiting
}

func (s *Session) sendResult(ctx context.Context, id, result any) {
	resp, err := common.NewResponse(id, result)
	if err != nil {
		s.server.logger.ErrorContext(ctx, "编码响应失败", "error", err)
		s.sendError(ctx, id, common.InternalError, err.Error(), nil)
		return
	}
	if err := s.sendPacket(resp); err != nil {
		s.server.logger.ErrorContext(ctx, "发送响应失败", "error", err)
	}
}

func (s *Session) sendError(ctx context.Context, id any, code int, message string, data any) {
	resp := common.NewErrorResponse(id, code, message, data)
	if err := s.sendPacket(resp); err != nil {
		s.server.logger.ErrorContext(ctx, "发送错误响应失败", "error", err)
	}
}

// sendPacket 统一发送包（Head+Body）
func (s *Session) sendPacket(payload any) error {
	var data []byte
	var err error

	if req, ok := payload.(*common.Request); ok {
		data, err = req.Encode()
	} else if resp, ok := payload.(*common.Response); ok {
		data, err = resp.Encode()
	} else {
		return ErrUnknownPayloadType
	}

	if err != nil {
		return fmt.Errorf("encode failed: %w", err)
	}

	maxOutboundBytes := s.server.config.MaxMessageBytes
	s.infoMu.RLock()
	if s.info.MaxMessageBytes > 0 && (maxOutboundBytes == 0 || s.info.MaxMessageBytes < maxOutboundBytes) {
		maxOutboundBytes = s.info.MaxMessageBytes
	}
	s.infoMu.RUnlock()
	if maxOutboundBytes > 0 && len(data) > maxOutboundBytes {
		return ErrMessageTooLarge
	}

	// 转换前检查整数溢出
	length, err := convert.SafeIntToUint32(len(data), "payload")
	if err != nil {
		return ErrMessageTooLarge
	}

	var header [headerSize]byte
	binary.BigEndian.PutUint32(header[:], length)

	s.sendMu.Lock()
	defer s.sendMu.Unlock()

	if s.server.config.WriteTimeout > 0 {
		_ = s.conn.SetWriteDeadline(time.Now().Add(s.server.config.WriteTimeout))
	}

	// 使用 writev 一次性写入 header + body，减少系统调用开销。
	buffers := net.Buffers{header[:], data}
	written, err := buffers.WriteTo(s.conn)
	if err != nil {
		return fmt.Errorf("%w: write frame failed: %w", errWriteMessageFailed, err)
	}
	if written != int64(len(header)+len(data)) {
		return fmt.Errorf("%w: short write: written=%d expected=%d", errWriteMessageFailed, written, len(header)+len(data))
	}

	return nil
}

func (s *Session) startHeartbeatLoop(ctx context.Context) {
	if s.server.config.HeartbeatInterval <= 0 {
		return
	}
	s.heartbeatOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(s.server.config.HeartbeatInterval)
			defer ticker.Stop()
			var lastHeartbeatDebugAt time.Time
			for {
				select {
				case <-ticker.C:
					timeout := s.server.config.HeartbeatTimeout
					if timeout <= 0 {
						timeout = s.server.config.CallTimeout
					}
					heartbeatStart := time.Now()
					if _, err := s.callWithTimeout(ctx, methodPing, nil, timeout); err != nil {
						s.server.logger.WarnContext(ctx, "heartbeat failed", "sessionId", s.ID, "error", err)
						s.close()
						return
					}
					now := time.Now()
					if lastHeartbeatDebugAt.IsZero() || now.Sub(lastHeartbeatDebugAt) >= heartbeatDebugEvery {
						lastHeartbeatDebugAt = now
						durationMs := time.Since(heartbeatStart).Seconds() * 1000
						s.server.logger.DebugContext(ctx, "IPC heartbeat ok",
							"sessionId", s.ID,
							"method", methodPing,
							logkey.DurationMS, logkey.RoundDurationMS(durationMs),
						)
					}
				case <-s.closedCh:
					return
				}
			}
		}()
	})
}

func (s *Session) marshalParams(method string, params any) (json.RawMessage, error) {
	if params == nil {
		return nil, nil
	}
	rawParams, err := json.Marshal(params)
	if err != nil {
		s.server.metrics.RPCCallsTotal.WithLabelValues(method, DirectionSend, StatusError).Inc()
		return nil, fmt.Errorf("marshal params failed: %w", err)
	}
	return rawParams, nil
}

func (s *Session) handleOversizeFrame(ctx context.Context, bodyLen, maxMessageBytes int64, capMultiplier, chunkSize int, timeout time.Duration) bool {
	discardCap := maxMessageBytes * int64(capMultiplier)
	if capMultiplier <= 0 {
		discardCap = maxMessageBytes * DefaultDiscardCapMultiplier
	}
	if discardCap <= 0 {
		discardCap = maxMessageBytes
	}

	if bodyLen > discardCap {
		s.server.metrics.RPCOversizeFrames.Inc()
		s.server.metrics.RPCOversizeBytes.Add(float64(bodyLen))
		s.server.metrics.RPCOversizeDisconnects.Inc()
		s.server.logger.ErrorContext(ctx, "消息体过大，超过丢弃上限，断开连接",
			"sessionId", s.ID,
			"length", bodyLen,
			"max", maxMessageBytes,
			"discardCap", discardCap,
		)
		return false
	}

	if err := s.discardBytes(timeout, bodyLen, chunkSize); err != nil {
		s.server.metrics.RPCOversizeFrames.Inc()
		s.server.metrics.RPCOversizeBytes.Add(float64(bodyLen))
		s.server.metrics.RPCOversizeDisconnects.Inc()
		s.server.logger.ErrorContext(ctx, "丢弃超限消息失败，断开连接",
			"sessionId", s.ID,
			"length", bodyLen,
			"max", maxMessageBytes,
			"discardCap", discardCap,
			"error", err,
		)
		return false
	}

	s.server.metrics.RPCOversizeFrames.Inc()
	s.server.metrics.RPCOversizeBytes.Add(float64(bodyLen))
	s.server.logger.WarnContext(ctx, "已丢弃超限消息并保持连接",
		"sessionId", s.ID,
		"length", bodyLen,
		"max", maxMessageBytes,
		"discardCap", discardCap,
	)

	s.oversizeBurst++
	if s.server.config.OversizeMaxBurst > 0 && s.oversizeBurst >= s.server.config.OversizeMaxBurst {
		s.server.metrics.RPCOversizeDisconnects.Inc()
		s.server.logger.WarnContext(ctx, "连续超限次数过多，断开连接",
			"sessionId", s.ID,
			"burst", s.oversizeBurst,
			"limit", s.server.config.OversizeMaxBurst,
		)
		return false
	}

	return true
}

func (s *Session) discardBytes(timeout time.Duration, total int64, chunkSize int) error {
	if total <= 0 {
		return nil
	}
	if chunkSize <= 0 {
		chunkSize = DefaultDiscardChunkSize
	}
	buf := make([]byte, chunkSize)
	remaining := total

	for remaining > 0 {
		readSize := min(remaining, int64(chunkSize))
		if timeout > 0 {
			_ = s.conn.SetReadDeadline(time.Now().Add(timeout))
		}
		readSizeInt := int(readSize)
		if _, err := io.ReadFull(s.conn, buf[:readSizeInt]); err != nil {
			return fmt.Errorf("discard read failed: %w", err)
		}
		remaining -= readSize
	}
	return nil
}

func decodeParams(params, out any) error {
	if params == nil {
		return nil
	}
	switch p := params.(type) {
	case json.RawMessage:
		if err := json.Unmarshal(p, out); err != nil {
			return fmt.Errorf("unmarshal raw params: %w", err)
		}
		return nil
	default:
		data, err := json.Marshal(params)
		if err != nil {
			return fmt.Errorf("marshal params: %w", err)
		}
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("unmarshal params: %w", err)
		}
		return nil
	}
}

func requestIDFromRequestContext(req *common.Request) string {
	if req == nil {
		return ""
	}

	if requestID := requestIDFromRawJSON(req.Context); requestID != "" {
		return requestID
	}

	return requestIDFromRawJSON(req.Params)
}

func requestIDFromRawJSON(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var envelope requestIDEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return ""
	}

	if len(envelope.RequestID) == 0 || bytes.Equal(bytes.TrimSpace(envelope.RequestID), []byte("null")) {
		return ""
	}

	var stringID string
	if err := json.Unmarshal(envelope.RequestID, &stringID); err == nil {
		return stringID
	}

	decoder := json.NewDecoder(bytes.NewReader(envelope.RequestID))
	decoder.UseNumber()
	var numberID json.Number
	if err := decoder.Decode(&numberID); err == nil {
		return numberID.String()
	}

	var genericID any
	if err := json.Unmarshal(envelope.RequestID, &genericID); err != nil {
		return ""
	}
	return fmt.Sprintf("%v", genericID)
}

func buildOutboundRequestContext(ctx context.Context) json.RawMessage {
	requestID, ok := ctxmeta.RequestIDFromContext(ctx)
	if !ok || requestID == "" {
		return nil
	}

	data, err := json.Marshal(map[string]string{
		logkey.RequestID: requestID,
	})
	if err != nil {
		return nil
	}

	return data
}

func readLegacyHandshakeCode(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var values map[string]any
	if err := json.Unmarshal(raw, &values); err != nil {
		return ""
	}

	value, ok := values["auth_token"]
	if !ok || value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func buildCapabilities(methods []string) map[string]struct{} {
	capabilities := make(map[string]struct{})
	for _, method := range methods {
		if method == "" {
			continue
		}
		capabilities[method] = struct{}{}
	}
	return capabilities
}

func acquireBodyBuffer(size int) []byte {
	if size <= 0 {
		return nil
	}
	return make([]byte, size)
}

func releaseBodyBuffer() {}
