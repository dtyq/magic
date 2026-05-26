package httpapi_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	httpapi "magic/internal/interfaces/http"
)

func TestStripPathPrefixHandler(t *testing.T) {
	t.Parallel()

	for _, tt := range stripPathPrefixTestCases() {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var gotPath string
			var gotQuery string
			handler := httpapi.NewStripPathPrefixHandler(tt.prefix, http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				gotQuery = r.URL.RawQuery
			}))

			request := httptest.NewRequestWithContext(context.Background(), http.MethodGet, tt.target, nil)
			handler.ServeHTTP(httptest.NewRecorder(), request)

			if gotPath != tt.wantPath {
				t.Fatalf("path = %q, want %q", gotPath, tt.wantPath)
			}
			if gotQuery != tt.wantQuery {
				t.Fatalf("query = %q, want %q", gotQuery, tt.wantQuery)
			}
		})
	}
}

func stripPathPrefixTestCases() []struct {
	name      string
	prefix    string
	target    string
	wantPath  string
	wantQuery string
} {
	return []struct {
		name      string
		prefix    string
		target    string
		wantPath  string
		wantQuery string
	}{
		{
			name:      "strip api path and preserve query",
			prefix:    "/go",
			target:    "/go/api/v1/foo?x=1",
			wantPath:  "/api/v1/foo",
			wantQuery: "x=1",
		},
		{
			name:     "strip websocket path",
			prefix:   "/go",
			target:   "/go/ws/example",
			wantPath: "/ws/example",
		},
		{
			name:     "strip exact prefix to root",
			prefix:   "/go",
			target:   "/go",
			wantPath: "/",
		},
		{
			name:     "do not strip partial path segment",
			prefix:   "/go",
			target:   "/gofoo",
			wantPath: "/gofoo",
		},
		{
			name:     "keep unrelated health path",
			prefix:   "/go",
			target:   "/health",
			wantPath: "/health",
		},
		{
			name:     "disabled by empty prefix",
			prefix:   "",
			target:   "/go/api/v1/foo",
			wantPath: "/go/api/v1/foo",
		},
		{
			name:     "normalize missing leading slash",
			prefix:   "go/",
			target:   "/go/api/v1/foo",
			wantPath: "/api/v1/foo",
		},
	}
}
