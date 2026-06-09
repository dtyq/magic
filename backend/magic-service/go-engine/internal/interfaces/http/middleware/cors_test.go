package middleware_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	middleware "magic/internal/interfaces/http/middleware"
	"magic/internal/pkg/ctxmeta"
)

func TestCORSAllowsRequestedOriginHeadersAndMethod(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORS(nil))
	r.POST("/api/v1/hello", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequestWithContext(context.Background(), http.MethodOptions, "/api/v1/hello", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Headers", "authorization,organization-code,x-custom-header")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d", rec.Code)
	}
	assertHeader(t, rec, "Access-Control-Allow-Origin", "https://example.com")
	assertHeader(t, rec, "Access-Control-Allow-Headers", "authorization,organization-code,x-custom-header")
	assertHeader(t, rec, "Access-Control-Allow-Methods", http.MethodPost)
	assertHeader(t, rec, "Access-Control-Allow-Credentials", "true")
	assertHeader(t, rec, "Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method")
}

func TestCORSAddsHeadersForNormalRequest(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORS([]string{"https://allowed.example"}))
	r.POST("/ok", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/ok", http.NoBody)
	req.Header.Set("Origin", "https://other.example")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		body, _ := io.ReadAll(rec.Body)
		t.Fatalf("unexpected status: %d, body: %s", rec.Code, body)
	}
	assertHeader(t, rec, "Access-Control-Allow-Origin", "https://other.example")
	assertHeader(t, rec, "Access-Control-Allow-Headers", "*")
	assertHeader(t, rec, "Access-Control-Allow-Methods", "*")
}

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

func assertHeader(t *testing.T, recorder *httptest.ResponseRecorder, key, want string) {
	t.Helper()

	if got := recorder.Header().Get(key); got != want {
		t.Fatalf("%s = %q, want %q", key, got, want)
	}
}
