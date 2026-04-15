package client_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestPHPFileRPCClient_GetLink_NoClient(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	_, err := c.GetLink(context.Background(), "DT001/path/a.md", http.MethodGet, time.Minute)
	if !errors.Is(err, ipcclient.ErrNoClientConnected) {
		t.Fatalf("expected ErrNoClientConnected, got %v", err)
	}
}

func TestPHPFileRPCClient_GetLink_NormalizeURLPath(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)

	got, err := c.GetLink(context.Background(), "https://example.com/DT001/abc/demo.md?x=1", http.MethodGet, time.Minute)
	if err != nil {
		t.Fatalf("GetLink returned error: %v", err)
	}
	if got != "https://example.com/DT001/abc/demo.md?x=1" {
		t.Fatalf("unexpected link: %s", got)
	}
}

func TestPHPFileRPCClient_GetLink_NotFound(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetGetLinkHookForTest(func(ctx context.Context, params map[string]any) (int, string, string, error) {
		return http.StatusNotFound, "not found", "", nil
	})

	_, err := c.GetLink(context.Background(), "DT001/missing.md", http.MethodGet, time.Minute)
	if !errors.Is(err, ipcclient.ErrFileObjectNotFound) {
		t.Fatalf("expected ErrFileObjectNotFound, got %v", err)
	}
}

func TestPHPFileRPCClient_Stat(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetStatHookForTest(func(ctx context.Context, params map[string]any) (int, string, bool, error) {
		return 0, "", true, nil
	})

	if err := c.Stat(context.Background(), "DT001/path/demo.md"); err != nil {
		t.Fatalf("Stat returned error: %v", err)
	}
}

func TestPHPFileRPCClient_Stat_NotFound(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetStatHookForTest(func(ctx context.Context, params map[string]any) (int, string, bool, error) {
		return http.StatusNotFound, "not found", false, nil
	})

	err := c.Stat(context.Background(), "DT001/path/missing.md")
	if !errors.Is(err, ipcclient.ErrFileObjectNotFound) {
		t.Fatalf("expected ErrFileObjectNotFound, got %v", err)
	}
}

func TestPHPFileRPCClient_Fetch(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("hello"))
	}))
	defer srv.Close()

	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetGetLinkHookForTest(func(ctx context.Context, params map[string]any) (int, string, string, error) {
		return 0, "", srv.URL, nil
	})

	body, err := c.Fetch(context.Background(), "DT001/path/demo.md")
	if err != nil {
		t.Fatalf("Fetch returned error: %v", err)
	}
	defer func() { _ = body.Close() }()

	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body failed: %v", err)
	}
	if string(data) != "hello" {
		t.Fatalf("unexpected body: %s", string(data))
	}
}

func TestPHPFileRPCClient_Fetch_NotFound(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetGetLinkHookForTest(func(ctx context.Context, params map[string]any) (int, string, string, error) {
		return 0, "", srv.URL, nil
	})

	_, err := c.Fetch(context.Background(), "DT001/path/missing.md")
	if !errors.Is(err, ipcclient.ErrFileObjectNotFound) {
		t.Fatalf("expected ErrFileObjectNotFound, got %v", err)
	}
}

func TestPHPFileRPCClient_GetLink_InvalidPath(t *testing.T) {
	t.Parallel()
	c := ipcclient.NewPHPFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })

	_, err := c.GetLink(context.Background(), "", http.MethodGet, time.Minute)
	if err == nil || !strings.Contains(err.Error(), "file path") {
		t.Fatalf("expected file path error, got %v", err)
	}
}
