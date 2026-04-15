package external_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"magic/internal/infrastructure/external"
)

type staticRoundTripper struct {
	status int
	header http.Header
	body   string
}

func (rt staticRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: rt.status,
		Header:     rt.header,
		Body:       io.NopCloser(strings.NewReader(rt.body)),
		Request:    req,
	}, nil
}

func TestContentLoader_LoadFromURL_HTML(t *testing.T) {
	t.Parallel()
	targetURL := "http://example.test/"
	header := make(http.Header)
	header.Set("Content-Type", "text/html; charset=utf-8")
	client := &http.Client{
		Transport: staticRoundTripper{
			status: http.StatusOK,
			header: header,
			body:   "<html><body><h1>Hello</h1><script>ignored()</script></body></html>",
		},
	}
	loader := external.NewContentLoaderWithClient(client)
	got, err := loader.LoadFromURL(context.Background(), targetURL)
	if err != nil {
		t.Fatalf("LoadFromURL failed: %v", err)
	}
	if !strings.Contains(got, "Hello") {
		t.Fatalf("expected extracted text to contain Hello, got %q", got)
	}
}

func TestContentLoader_LoadFromURL_Empty(t *testing.T) {
	t.Parallel()
	loader := external.NewContentLoader()
	if _, err := loader.LoadFromURL(context.Background(), ""); err == nil {
		t.Fatalf("expected error for empty url")
	}
}

func TestContentLoader_LoadFromURL_StatusNotOK(t *testing.T) {
	t.Parallel()
	header := make(http.Header)
	header.Set("Content-Type", "text/plain")
	client := &http.Client{
		Transport: staticRoundTripper{
			status: http.StatusBadRequest,
			header: header,
			body:   "bad",
		},
	}
	loader := external.NewContentLoaderWithClient(client)
	_, err := loader.LoadFromURL(context.Background(), "http://example.test/")
	if err == nil || !strings.Contains(err.Error(), "unexpected status code") {
		t.Fatalf("expected status code error, got %v", err)
	}
}

func TestContentLoader_LoadFromURL_PlainText(t *testing.T) {
	t.Parallel()
	header := make(http.Header)
	header.Set("Content-Type", "text/plain")
	client := &http.Client{
		Transport: staticRoundTripper{
			status: http.StatusOK,
			header: header,
			body:   "plain text",
		},
	}
	loader := external.NewContentLoaderWithClient(client)
	got, err := loader.LoadFromURL(context.Background(), "http://example.test/")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "plain text" {
		t.Fatalf("unexpected body: %q", got)
	}
}

func TestContentLoader_LoadFromURL_TooManyRedirects(t *testing.T) {
	t.Parallel()
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, srv.URL, http.StatusFound)
	}))
	defer srv.Close()

	loader := external.NewContentLoader()
	_, err := loader.LoadFromURL(context.Background(), srv.URL)
	if err == nil {
		t.Fatalf("expected redirect error")
	}
	if !errors.Is(err, external.ErrTooManyRedirects) {
		t.Fatalf("expected ErrTooManyRedirects, got %v", err)
	}
}
