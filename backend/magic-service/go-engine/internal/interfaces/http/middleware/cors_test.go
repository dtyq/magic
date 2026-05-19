package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	middleware "magic/internal/interfaces/http/middleware"
	"magic/internal/pkg/ctxmeta"
)

func TestRequestID_GenerateAndInjectContext(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/ok", func(c *gin.Context) {
		requestID, ok := ctxmeta.RequestIDFromContext(c.Request.Context())
		if !ok || requestID == "" {
			t.Fatalf("request_id should be injected into request context")
		}
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/ok", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d", rec.Code)
	}
	if got := rec.Header().Get("X-Request-ID"); got == "" {
		t.Fatalf("X-Request-ID should be set")
	}
}

func TestRequestID_RespectIncomingHeader(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/ok", func(c *gin.Context) {
		requestID, ok := ctxmeta.RequestIDFromContext(c.Request.Context())
		if !ok {
			t.Fatalf("request_id should be available in context")
		}
		if requestID != "req_from_client" {
			t.Fatalf("unexpected request_id: %q", requestID)
		}
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/ok", nil)
	req.Header.Set("X-Request-ID", " req_from_client ")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Request-ID"); got != "req_from_client" {
		t.Fatalf("unexpected response X-Request-ID: %q", got)
	}
}
