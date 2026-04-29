package ipcrpc

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	common "magic/internal/pkg/jsonrpc"
)

var errRPCPanicTestUnreachable = errors.New("rpc panic test should not continue")

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	n, _ := b.buf.Write(p)
	return n, nil
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func newBufferedRPCLogger() (*logging.SugaredLogger, *lockedBuffer) {
	var buf lockedBuffer
	return logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel("debug"),
		Format: autoloadcfg.LogFormatJSON,
	}, &buf).Named("rpc.panic.test"), &buf
}

func TestExecuteHandlerPanicLogsStructuredFieldsAndReturnsInternalError(t *testing.T) {
	t.Parallel()

	logger, logs := newBufferedRPCLogger()
	serverConn, clientConn := net.Pipe()
	defer func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	}()

	session := newSession(88, serverConn, &Server{
		config:  DefaultRuntimeConfig(),
		metrics: newIsolatedTestMetrics(),
		logger:  logger,
	})
	req := &common.Request{
		JSONRPC: common.Version,
		Method:  "svc.test.panic",
		ID:      100,
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		session.executeHandler(context.Background(), req, func(context.Context, string, json.RawMessage) (any, error) {
			triggerRPCPanicTestPanic()
			return nil, errRPCPanicTestUnreachable
		}, time.Now())
	}()

	resp := readResponseFromConn(t, clientConn)
	<-done

	if resp.Error == nil || resp.Error.Code != common.ErrCodeInternalError {
		t.Fatalf("expected internal error response, got %#v", resp)
	}
	assertLogContains(t, logs, "goEngineException: Goroutine panic recovered", "rpc.handler", "svc.test.panic", "stack")
}

func TestSystemRequestPanicLogsAndClosesSession(t *testing.T) {
	t.Parallel()

	logger, logs := newBufferedRPCLogger()
	serverConn, clientConn := net.Pipe()
	defer func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	}()

	session := newSession(89, serverConn, &Server{
		config: DefaultRuntimeConfig(),
		logger: logger,
	})
	req := &common.Request{
		JSONRPC: common.Version,
		Method:  methodPing,
	}

	if !session.handleSystemRequest(context.Background(), req, time.Now()) {
		t.Fatal("expected ping to be handled as system request")
	}
	if !session.closed.Load() {
		t.Fatal("expected session to be closed after system request panic")
	}
	assertLogContains(t, logs, "goEngineException: Goroutine panic recovered", "rpc.system_request", methodPing, "stack")
}

func TestReadLoopPanicCleansSessionAndLogs(t *testing.T) {
	t.Parallel()

	logger, logs := newBufferedRPCLogger()
	server := NewServerForTest(logger, DefaultRuntimeConfig())
	conn := &panicReadConn{closed: make(chan struct{})}

	server.handleNewConnection(conn)

	deadline := time.After(time.Second)
	for server.GetClientCount() != 0 {
		select {
		case <-deadline:
			t.Fatal("timeout waiting for panicked session cleanup")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	assertLogContains(t, logs, "goEngineException: Goroutine panic recovered", "rpc.session.read_loop", "stack")
}

func TestAcceptLoopPanicTriggersExitPolicy(t *testing.T) {
	logger, logs := newBufferedRPCLogger()
	exitCalled := make(chan int, 1)
	server := NewServerForTest(logger, DefaultRuntimeConfig())
	server.panicExit = func(code int) {
		exitCalled <- code
	}
	if err := server.Serve(panicListener{}, "panic-listener"); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	select {
	case code := <-exitCalled:
		if code != 1 {
			t.Fatalf("expected exit code 1, got %d", code)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for accept loop exit policy")
	}
	assertLogContains(t, logs, "goEngineException: Goroutine panic recovered", "rpc.accept_loop", "stack")
}

func readResponseFromConn(t *testing.T, conn net.Conn) *common.Response {
	t.Helper()

	header := make([]byte, headerSize)
	if _, err := io.ReadFull(conn, header); err != nil {
		t.Fatalf("read header: %v", err)
	}
	bodyLen := binary.BigEndian.Uint32(header)
	body := make([]byte, bodyLen)
	if _, err := io.ReadFull(conn, body); err != nil {
		t.Fatalf("read body: %v", err)
	}
	decoded, _, err := decodeIPCFrame(body)
	if err != nil {
		t.Fatalf("decode ipc frame: %v", err)
	}
	resp, err := common.DecodeResponse(decoded)
	if err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func assertLogContains(t *testing.T, logs *lockedBuffer, parts ...string) {
	t.Helper()

	deadline := time.After(time.Second)
	for {
		line := logs.String()
		missing := ""
		for _, part := range parts {
			if !strings.Contains(line, part) {
				missing = part
				break
			}
		}
		if missing == "" {
			return
		}
		select {
		case <-deadline:
			t.Fatalf("expected logs to contain %q; got %s", missing, line)
		default:
			time.Sleep(time.Millisecond)
		}
	}
}

type panicReadConn struct {
	closed chan struct{}
}

func (c *panicReadConn) Read([]byte) (int, error) {
	triggerRPCPanicTestPanic()
	return 0, nil
}

func (c *panicReadConn) Write(p []byte) (int, error) {
	return len(p), nil
}

func (c *panicReadConn) Close() error {
	select {
	case <-c.closed:
	default:
		close(c.closed)
	}
	return nil
}

func (c *panicReadConn) LocalAddr() net.Addr                    { return dummyAddr("local") }
func (c *panicReadConn) RemoteAddr() net.Addr                   { return dummyAddr("remote") }
func (c *panicReadConn) SetDeadline(time.Time) error            { return nil }
func (c *panicReadConn) SetReadDeadline(time.Time) error        { return nil }
func (c *panicReadConn) SetWriteDeadline(time.Time) error       { return nil }
func (c *panicReadConn) SetReadBuffer(int) error                { return nil }
func (c *panicReadConn) SetWriteBuffer(int) error               { return nil }
func (c *panicReadConn) SetLinger(int) error                    { return nil }
func (c *panicReadConn) SetNoDelay(bool) error                  { return nil }
func (c *panicReadConn) SetKeepAlive(bool) error                { return nil }
func (c *panicReadConn) SetKeepAlivePeriod(time.Duration) error { return nil }

type panicListener struct{}

func (panicListener) Accept() (net.Conn, error) {
	triggerRPCPanicTestPanic()
	return nil, errRPCPanicTestUnreachable
}

func (panicListener) Close() error {
	return nil
}

func (panicListener) Addr() net.Addr {
	return dummyAddr("listener")
}

type dummyAddr string

func (a dummyAddr) Network() string { return string(a) }
func (a dummyAddr) String() string  { return string(a) }

func triggerRPCPanicTestPanic() {
	var ptr *int
	_ = *ptr
}
