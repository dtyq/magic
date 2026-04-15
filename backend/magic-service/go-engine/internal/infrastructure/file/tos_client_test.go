package file_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"

	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/file"
)

func TestTOSFileClient_Fetch_URL_OK(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	c := &file.TOSFileClient{}
	body, err := c.Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer func() {
		if err := body.Close(); err != nil {
			t.Fatalf("close body: %v", err)
		}
	}()
	data, _ := io.ReadAll(body)
	if string(data) != "ok" {
		t.Fatalf("unexpected body: %q", string(data))
	}
}

func TestTOSFileClient_Fetch_URL_StatusNotOK(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer srv.Close()

	c := &file.TOSFileClient{}
	_, err := c.Fetch(context.Background(), srv.URL)
	if err == nil || !strings.Contains(err.Error(), "fetch url failed") {
		t.Fatalf("expected fetch url error, got %v", err)
	}
}

func TestTOSFileClient_GetLink_URL(t *testing.T) {
	t.Parallel()
	c := &file.TOSFileClient{}
	url := "https://example.com/object"
	got, err := c.GetLink(context.Background(), url, http.MethodGet, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != url {
		t.Fatalf("expected same url, got %q", got)
	}
}

func TestTOSFileClient_Stat_URL_OK(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := file.NewTOSFileClientForTest(&shared.StorageConfig{Bucket: "bucket"}, nil)
	if err := c.Stat(context.Background(), srv.URL); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestTOSFileClient_Stat_URL_NotFound(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := file.NewTOSFileClientForTest(&shared.StorageConfig{Bucket: "bucket"}, nil)
	err := c.Stat(context.Background(), srv.URL)
	if !errors.Is(err, file.ErrObjectNotFound) {
		t.Fatalf("expected ErrObjectNotFound, got %v", err)
	}
}

func TestTOSFileClient_Stat_Key_BucketNotFound(t *testing.T) {
	t.Parallel()
	c := file.NewTOSFileClientForTest(&shared.StorageConfig{Bucket: "bucket"}, func(client *tos.ClientV2, ctx context.Context, input *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error) {
		return nil, &tos.TosServerError{
			TosError: tos.TosError{
				Message: "The specified bucket does not exist.",
				EcCode:  "0006-00000001",
			},
			Code: "NoSuchBucket",
		}
	})
	err := c.Stat(context.Background(), "DT001/path/to/file.md")
	if !errors.Is(err, file.ErrBucketNotFound) {
		t.Fatalf("expected ErrBucketNotFound, got %v", err)
	}
}

func TestTOSFileClient_Stat_Key_ObjectNotFound(t *testing.T) {
	t.Parallel()
	c := file.NewTOSFileClientForTest(&shared.StorageConfig{Bucket: "bucket"}, func(client *tos.ClientV2, ctx context.Context, input *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error) {
		return nil, &tos.TosServerError{
			TosError: tos.TosError{
				Message: "The specified key does not exist.",
				EcCode:  "0017-00000003",
			},
			Code: "NoSuchKey",
		}
	})
	err := c.Stat(context.Background(), "DT001/path/to/missing.md")
	if !errors.Is(err, file.ErrObjectNotFound) {
		t.Fatalf("expected ErrObjectNotFound, got %v", err)
	}
}
