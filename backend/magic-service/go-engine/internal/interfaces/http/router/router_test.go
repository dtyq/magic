package router_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	httpapi "magic/internal/interfaces/http"
	"magic/internal/interfaces/http/handlers"
	"magic/internal/interfaces/http/router"
)

func TestSetupRoutesRegistersPprofWhenEnabled(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		PprofEnabled:   true,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		HelloHandler:   handlers.NewHelloHandler(),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/debug/pprof/", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected pprof route to be available, got %d", recorder.Code)
	}
}

func TestSetupRoutesDoesNotRegisterPprofWhenDisabled(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		PprofEnabled:   false,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		HelloHandler:   handlers.NewHelloHandler(),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/debug/pprof/", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected pprof route to stay disabled, got %d", recorder.Code)
	}
}

func TestSetupRoutesRegistersHello(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		HelloHandler:   handlers.NewHelloHandler(),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/hello", nil)
	engine.ServeHTTP(recorder, request)

	assertHelloResponse(t, recorder)
}

func TestSetupRoutesHelloSupportsGoPrefix(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		HelloHandler:   handlers.NewHelloHandler(),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/go/api/v1/hello", nil)
	httpapi.NewStripPathPrefixHandler("/go", engine).ServeHTTP(recorder, request)

	assertHelloResponse(t, recorder)
}

func TestSetupRoutesRegistersMagicFSFileVersion(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		MagicFSHandler: magicFSRouteHandlerStub{},
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/v1/open-api/magicfs/files/42/version",
		nil,
	)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected MagicFS route status 204, got %d", recorder.Code)
	}
}

func TestSetupRoutesMagicFSSupportsGoPrefix(t *testing.T) {
	t.Parallel()

	engine := gin.New()
	router.SetupRoutes(router.Dependencies{
		Engine:         engine,
		HealthHandler:  healthHandlerStub{},
		MetricsHandler: metricsRouteHandlerStub{},
		DebugHandler:   debugHandlerStub{},
		MagicFSHandler: magicFSRouteHandlerStub{},
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/go/api/v1/open-api/magicfs/files/42/version",
		nil,
	)
	httpapi.NewStripPathPrefixHandler("/go", engine).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected MagicFS route status 204, got %d", recorder.Code)
	}
}

func assertHelloResponse(t *testing.T, recorder *httptest.ResponseRecorder) {
	t.Helper()

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected hello route status 200, got %d", recorder.Code)
	}

	var response struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode hello response: %v", err)
	}
	if response.Code != 1000 || response.Message != "ok" || response.Data.Message != "hello world" {
		t.Fatalf("unexpected hello response: %+v", response)
	}
}

type healthHandlerStub struct{}

func (healthHandlerStub) Check(c *gin.Context) {
	c.Status(http.StatusOK)
}

type metricsRouteHandlerStub struct{}

func (metricsRouteHandlerStub) Handle(c *gin.Context) {
	c.Status(http.StatusOK)
}

type magicFSRouteHandlerStub struct{}

func (magicFSRouteHandlerStub) GetVersion(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

type debugHandlerStub struct{}

func (debugHandlerStub) ListProviders(c *gin.Context) {
	c.Status(http.StatusOK)
}
