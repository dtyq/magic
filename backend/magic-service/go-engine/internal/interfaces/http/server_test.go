package httpapi_test

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"magic/internal/infrastructure/logging"
	httpapi "magic/internal/interfaces/http"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

var errWarmupBoom = errors.New("warmup boom")

func TestServerStartDoesNotBlockOnRetrievalWarmup(t *testing.T) {
	t.Parallel()
	assertBackgroundServiceStartDoesNotBlock(t, "warmup start", func(
		deps *httpapi.ServerDependencies,
		started chan struct{},
		release chan struct{},
	) {
		deps.RetrievalWarmup = &warmupServiceStub{
			started: started,
			waitCh:  release,
		}
	})
}

func TestServerStartContinuesWhenRetrievalWarmupFails(t *testing.T) {
	t.Parallel()

	port := mustAllocateFreePort(t)
	server := httpapi.NewServerWithDependencies(&httpapi.ServerDependencies{
		Config: &httpapi.ServerConfig{
			Enabled: true,
			Host:    "127.0.0.1",
			Port:    port,
			Mode:    httpapi.ModeTest,
			Env:     "dev",
		},
		RetrievalWarmup: &warmupServiceStub{err: errWarmupBoom},
		InfraServices:   infraServicesStub{},
		Logger:          logging.New().Named("httpapi.test"),
		Metrics:         metricsServiceStub{},
		RPCServer:       &rpcServerStub{},
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForListen(t, port)
	stopServerForTest(t, server, errCh)
}

func TestServerStopCancelsRetrievalWarmupContext(t *testing.T) {
	t.Parallel()
	assertBackgroundServiceStopCancels(t, "warmup start", "warmup cancel", func(
		deps *httpapi.ServerDependencies,
		started chan struct{},
		cancelled chan struct{},
	) {
		deps.RetrievalWarmup = &warmupServiceStub{
			started:    started,
			cancelled:  cancelled,
			waitForCtx: true,
		}
	})
}

func TestServerStopClosesInfraServicesInDev(t *testing.T) {
	t.Parallel()

	port := mustAllocateFreePort(t)
	infra := &recordingInfraServicesStub{}
	server := httpapi.NewServerWithDependencies(&httpapi.ServerDependencies{
		Config: &httpapi.ServerConfig{
			Enabled: true,
			Host:    "127.0.0.1",
			Port:    port,
			Mode:    httpapi.ModeTest,
			Env:     "dev",
		},
		InfraServices: infra,
		Logger:        logging.New().Named("httpapi.test"),
		Metrics:       metricsServiceStub{},
		RPCServer:     &rpcServerStub{},
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForListen(t, port)
	stopServerForTest(t, server, errCh)

	if infra.closed.Load() == 0 {
		t.Fatal("expected infra services to be closed in dev stop")
	}
}

func TestServerStart_IPCOnlyModeDoesNotListenOnHTTPPort(t *testing.T) {
	t.Parallel()

	port := mustAllocateFreePort(t)
	rpcStarted := make(chan struct{})
	infra := &recordingInfraServicesStub{}
	server := httpapi.NewServerWithDependencies(&httpapi.ServerDependencies{
		Config: &httpapi.ServerConfig{
			Enabled: false,
			Host:    "127.0.0.1",
			Port:    port,
			Mode:    httpapi.ModeTest,
			Env:     "dev",
		},
		InfraServices: infra,
		Logger:        logging.New().Named("httpapi.test"),
		Metrics:       metricsServiceStub{},
		RPCServer:     &rpcServerStub{startCh: rpcStarted},
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForChannel(t, rpcStarted, "rpc start")
	assertNotListening(t, port)
	stopServerForTest(t, server, errCh)

	if infra.closed.Load() == 0 {
		t.Fatal("expected infra services to be closed in ipc-only stop")
	}
}

type warmupServiceStub struct {
	started    chan struct{}
	cancelled  chan struct{}
	waitCh     chan struct{}
	waitForCtx bool
	err        error
}

func (s *warmupServiceStub) WarmupRetrieval(ctx context.Context) error {
	if s.started != nil {
		close(s.started)
	}
	if s.waitForCtx {
		<-ctx.Done()
		if s.cancelled != nil {
			close(s.cancelled)
		}
		return fmt.Errorf("warmup context done: %w", ctx.Err())
	}
	if s.waitCh != nil {
		<-s.waitCh
	}
	return s.err
}

type infraServicesStub struct{}

func (infraServicesStub) HealthCheck(context.Context) (map[string]bool, error) {
	return map[string]bool{"ok": true}, nil
}

func (infraServicesStub) Close(context.Context) error {
	return nil
}

type recordingInfraServicesStub struct {
	closed atomic.Int32
}

func (s *recordingInfraServicesStub) HealthCheck(context.Context) (map[string]bool, error) {
	return map[string]bool{"ok": true}, nil
}

func (s *recordingInfraServicesStub) Close(context.Context) error {
	s.closed.Add(1)
	return nil
}

type metricsServiceStub struct{}

func (metricsServiceStub) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func (metricsServiceStub) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Status(200)
	}
}

type rpcServerStub struct {
	startCh chan struct{}
	started atomic.Int32
}

func (s *rpcServerStub) Start() error {
	s.started.Add(1)
	if s.startCh != nil {
		close(s.startCh)
	}
	return nil
}

func (*rpcServerStub) Close() error {
	return nil
}

func (*rpcServerStub) RegisterHandler(string, jsonrpc.ServerHandler) {}

func newServerDependenciesForTest(port int) *httpapi.ServerDependencies {
	return &httpapi.ServerDependencies{
		Config: &httpapi.ServerConfig{
			Enabled: true,
			Host:    "127.0.0.1",
			Port:    port,
			Mode:    httpapi.ModeTest,
			Env:     "dev",
		},
		InfraServices: infraServicesStub{},
		Logger:        logging.New().Named("httpapi.test"),
		Metrics:       metricsServiceStub{},
		RPCServer:     &rpcServerStub{},
	}
}

func assertBackgroundServiceStartDoesNotBlock(
	t *testing.T,
	startedName string,
	attach func(*httpapi.ServerDependencies, chan struct{}, chan struct{}),
) {
	t.Helper()

	port := mustAllocateFreePort(t)
	started := make(chan struct{})
	release := make(chan struct{})
	rpcStarted := make(chan struct{})
	deps := newServerDependenciesForTest(port)
	deps.RPCServer = &rpcServerStub{startCh: rpcStarted}
	attach(deps, started, release)

	server := httpapi.NewServerWithDependencies(deps)
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForChannel(t, started, startedName)
	waitForChannel(t, rpcStarted, "rpc start")
	waitForListen(t, port)

	close(release)
	stopServerForTest(t, server, errCh)
}

func assertBackgroundServiceStopCancels(
	t *testing.T,
	startedName string,
	cancelledName string,
	attach func(*httpapi.ServerDependencies, chan struct{}, chan struct{}),
) {
	t.Helper()

	port := mustAllocateFreePort(t)
	started := make(chan struct{})
	cancelled := make(chan struct{})
	deps := newServerDependenciesForTest(port)
	attach(deps, started, cancelled)

	server := httpapi.NewServerWithDependencies(deps)
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForChannel(t, started, startedName)
	waitForListen(t, port)

	stopServerForTest(t, server, errCh)
	waitForChannel(t, cancelled, cancelledName)
}

func mustAllocateFreePort(t *testing.T) int {
	t.Helper()

	listener, err := (&net.ListenConfig{}).Listen(context.Background(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen free port: %v", err)
	}
	addr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		t.Fatalf("unexpected addr type %T", listener.Addr())
	}
	if err := listener.Close(); err != nil {
		t.Fatalf("close free port listener: %v", err)
	}
	return addr.Port
}

func waitForListen(t *testing.T, port int) {
	t.Helper()

	address := fmt.Sprintf("127.0.0.1:%d", port)
	deadline := time.Now().Add(3 * time.Second)
	dialer := &net.Dialer{Timeout: 100 * time.Millisecond}
	for time.Now().Before(deadline) {
		conn, err := dialer.DialContext(context.Background(), "tcp", address)
		if err == nil {
			_ = conn.Close()
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("server did not listen on %s", address)
}

func waitForChannel(t *testing.T, ch <-chan struct{}, name string) {
	t.Helper()

	select {
	case <-ch:
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for %s", name)
	}
}

func assertNotListening(t *testing.T, port int) {
	t.Helper()

	address := fmt.Sprintf("127.0.0.1:%d", port)
	dialer := &net.Dialer{Timeout: 20 * time.Millisecond}
	deadline := time.Now().Add(80 * time.Millisecond)
	for time.Now().Before(deadline) {
		conn, err := dialer.DialContext(context.Background(), "tcp", address)
		if err == nil {
			_ = conn.Close()
			t.Fatalf("server should not listen on %s in ipc-only mode", address)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func stopServerForTest(t *testing.T, server *httpapi.Server, errCh <-chan error) {
	t.Helper()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := server.Stop(shutdownCtx); err != nil {
		t.Fatalf("stop server: %v", err)
	}
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("server start returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for server start to exit")
	}
}
