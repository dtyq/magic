package router_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

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
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/debug/pprof/", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected pprof route to stay disabled, got %d", recorder.Code)
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

type debugHandlerStub struct{}

func (debugHandlerStub) ListProviders(c *gin.Context) {
	c.Status(http.StatusOK)
}
