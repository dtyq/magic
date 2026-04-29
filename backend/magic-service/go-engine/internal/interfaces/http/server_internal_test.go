package httpapi

import (
	"context"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"magic/internal/infrastructure/logging"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

func TestServerStart_IPCOnlyModeSkipsHTTPInitialization(t *testing.T) {
	t.Parallel()

	rpcStarted := make(chan struct{})
	server := NewServerWithDependencies(&ServerDependencies{
		Config: &ServerConfig{
			Enabled: false,
			Host:    "127.0.0.1",
			Port:    0,
			Mode:    ModeTest,
			Env:     "dev",
		},
		InfraServices: ipcOnlyInfraServicesStub{},
		Logger:        logging.New().Named("httpapi.test"),
		Metrics:       ipcOnlyMetricsServiceStub{},
		RPCServer:     &ipcOnlyRPCServerStub{startCh: rpcStarted},
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	select {
	case <-rpcStarted:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for rpc start")
	}

	if got := len(server.engine.Routes()); got != 0 {
		t.Fatalf("expected no http routes in ipc-only mode, got %d", got)
	}

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

type ipcOnlyInfraServicesStub struct{}

func (ipcOnlyInfraServicesStub) HealthCheck(context.Context) (map[string]bool, error) {
	return map[string]bool{"ok": true}, nil
}

func (ipcOnlyInfraServicesStub) Close(context.Context) error {
	return nil
}

type ipcOnlyMetricsServiceStub struct{}

func (ipcOnlyMetricsServiceStub) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func (ipcOnlyMetricsServiceStub) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Status(200)
	}
}

type ipcOnlyRPCServerStub struct {
	startCh chan struct{}
}

func (s *ipcOnlyRPCServerStub) Start() error {
	if s.startCh != nil {
		close(s.startCh)
	}
	return nil
}

func (*ipcOnlyRPCServerStub) Close() error {
	return nil
}

func (*ipcOnlyRPCServerStub) RegisterHandler(string, jsonrpc.ServerHandler) {}
