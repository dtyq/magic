package filetype_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"magic/internal/pkg/filetype"
)

var (
	errFiletypeFetchNotImplemented   = errors.New("fetch not implemented")
	errFiletypeGetLinkNotImplemented = errors.New("get link not implemented")
	errFiletypeStatNotImplemented    = errors.New("stat not implemented")
	errFiletypeFetchFailed           = errors.New("fetch failed")
)

type mockFetcher struct {
	fetchFn   func(context.Context, string) (io.ReadCloser, error)
	getLinkFn func(context.Context, string, string, time.Duration) (string, error)
	statFn    func(context.Context, string) error
}

func (m *mockFetcher) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	if m.fetchFn == nil {
		return nil, errFiletypeFetchNotImplemented
	}
	return m.fetchFn(ctx, path)
}

func (m *mockFetcher) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	if m.getLinkFn == nil {
		return "", errFiletypeGetLinkNotImplemented
	}
	return m.getLinkFn(ctx, path, method, expire)
}

func (m *mockFetcher) Stat(ctx context.Context, path string) error {
	if m.statFn == nil {
		return errFiletypeStatNotImplemented
	}
	return m.statFn(ctx, path)
}

func TestExtractExtension(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"a/b/c.md":                          "md",
		"https://example.com/a/b/c.CSV":     "csv",
		"https://example.com/a/b/c.txt?q=1": "txt",
		"no_extension":                      "",
	}
	for input, want := range cases {
		if got := filetype.ExtractExtension(input); got != want {
			t.Fatalf("ExtractExtension(%q)=%q want %q", input, got, want)
		}
	}
}

func TestResolveByPHPCompatibleStrategy_FromLocalFile(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	filePath := filepath.Join(dir, "payload")
	if err := os.WriteFile(filePath, []byte("hello"), 0o600); err != nil {
		t.Fatalf("write temp file: %v", err)
	}

	got, err := filetype.ResolveByPHPCompatibleStrategy(context.Background(), filePath, nil)
	if err != nil {
		t.Fatalf("ResolveByPHPCompatibleStrategy returned error: %v", err)
	}
	if got != "txt" {
		t.Fatalf("unexpected extension: %q", got)
	}
}

func TestResolveByPHPCompatibleStrategy_FromHeaders(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	got, err := filetype.ResolveByPHPCompatibleStrategy(context.Background(), server.URL+"/download", nil)
	if err != nil {
		t.Fatalf("ResolveByPHPCompatibleStrategy returned error: %v", err)
	}
	if got != "csv" {
		t.Fatalf("unexpected extension: %q", got)
	}
}

func TestResolveByPHPCompatibleStrategy_FromImageHeaders(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	got, err := filetype.ResolveByPHPCompatibleStrategy(context.Background(), server.URL+"/download", nil)
	if err != nil {
		t.Fatalf("ResolveByPHPCompatibleStrategy returned error: %v", err)
	}
	if got != "jpg" {
		t.Fatalf("unexpected extension: %q", got)
	}
}

func TestResolveByPHPCompatibleStrategy_FromDownloadSniffing(t *testing.T) {
	t.Parallel()
	fetcher := &mockFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("%PDF-1.4 test payload")), nil
		},
	}

	got, err := filetype.ResolveByPHPCompatibleStrategy(context.Background(), "object-without-ext", fetcher)
	if err != nil {
		t.Fatalf("ResolveByPHPCompatibleStrategy returned error: %v", err)
	}
	if got != "pdf" {
		t.Fatalf("unexpected extension: %q", got)
	}
}

func TestResolveByPHPCompatibleStrategy_Failed(t *testing.T) {
	t.Parallel()
	fetcher := &mockFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return nil, errFiletypeFetchFailed
		},
	}

	_, err := filetype.ResolveByPHPCompatibleStrategy(context.Background(), "object-without-ext", fetcher)
	if err == nil {
		t.Fatal("expected error but got nil")
	}
	if !strings.Contains(err.Error(), "resolve from local file failed") || !strings.Contains(err.Error(), "resolve from download failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}
