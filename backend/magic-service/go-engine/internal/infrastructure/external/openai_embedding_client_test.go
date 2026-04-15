package external_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"magic/internal/infrastructure/external"
	"magic/internal/pkg/ctxmeta"
)

type fakeTokenProvider struct {
	token string
	err   error
}

func (f fakeTokenProvider) GetAccessToken(ctx context.Context) (string, error) {
	return f.token, f.err
}

func TestOpenAIEmbeddingClient_ListProviders(t *testing.T) {
	t.Parallel()
	errCh := make(chan error, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			errCh <- fmt.Errorf("%w: path=%s", errUnexpectedRequest, r.URL.Path)
		}
		if r.URL.Query().Get("with_info") != "true" || r.URL.Query().Get("type") != "embedding" {
			errCh <- fmt.Errorf("%w: query=%s", errUnexpectedRequest, r.URL.RawQuery)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token123" {
			errCh <- fmt.Errorf("%w: auth=%s", errUnexpectedRequest, got)
		}
		if got := r.Header.Get("Magic-Organization-Code"); got != "org" {
			errCh <- fmt.Errorf("%w: org_code=%s", errUnexpectedRequest, got)
		}
		if got := r.Header.Get("Magic-Organization-Id"); got != "org" {
			errCh <- fmt.Errorf("%w: org_id=%s", errUnexpectedRequest, got)
		}
		if got := r.Header.Get("Magic-User-Id"); got != "user" {
			errCh <- fmt.Errorf("%w: user_id=%s", errUnexpectedRequest, got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"data":[{"id":"m1","info":{"attributes":{"key":"k1","name":"n1","label":"l1","icon":"ico","provider_alias":"Provider"}}}]}`)
	}))
	defer srv.Close()

	client := external.NewOpenAIEmbeddingClient(srv.URL, fakeTokenProvider{token: "token123"})
	providers, err := client.ListProviders(context.Background(), &ctxmeta.BusinessParams{OrganizationID: "org", UserID: "user"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	select {
	case srvErr := <-errCh:
		t.Fatalf("handler validation failed: %v", srvErr)
	default:
	}
	if len(providers) != 1 {
		t.Fatalf("expected 1 provider, got %d", len(providers))
	}
	if providers[0].ID != "Provider" || len(providers[0].Models) != 1 {
		t.Fatalf("unexpected providers: %#v", providers)
	}
	if providers[0].Models[0].ID != "k1" || providers[0].Models[0].Name != "l1" {
		t.Fatalf("unexpected model mapping: %#v", providers[0].Models[0])
	}
}

func TestOpenAIEmbeddingClient_ListProviders_TokenError(t *testing.T) {
	t.Parallel()
	client := external.NewOpenAIEmbeddingClient("http://example.invalid", fakeTokenProvider{err: io.EOF})
	if _, err := client.ListProviders(context.Background(), nil); err == nil {
		t.Fatalf("expected error")
	}
}

func TestOpenAIEmbeddingClient_GetEmbedding(t *testing.T) {
	t.Parallel()
	errCh := make(chan error, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/embeddings" {
			errCh <- fmt.Errorf("%w: path=%s", errUnexpectedRequest, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer api-key" {
			errCh <- fmt.Errorf("%w: auth=%s", errUnexpectedRequest, got)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errCh <- err
		}
		input, ok := body["input"].([]any)
		if !ok || len(input) != 1 {
			errCh <- fmt.Errorf("%w: input", errUnexpectedRequest)
		} else {
			first, ok := input[0].(string)
			if !ok || first != "hello" {
				errCh <- fmt.Errorf("%w: input", errUnexpectedRequest)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"data":[{"embedding":[1,2,3]}]}`)
	}))
	defer srv.Close()

	client := external.NewOpenAIEmbeddingClient(srv.URL, nil)
	client.SetAccessToken("api-key")
	out, err := client.GetEmbedding(context.Background(), "hello", "model", &ctxmeta.BusinessParams{OrganizationID: "org"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	select {
	case srvErr := <-errCh:
		t.Fatalf("handler validation failed: %v", srvErr)
	default:
	}
	if len(out) != 3 {
		t.Fatalf("unexpected embedding: %#v", out)
	}
}

func TestOpenAIEmbeddingClient_GetBatchEmbeddings_ErrorStatus(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, "boom")
	}))
	defer srv.Close()

	client := external.NewOpenAIEmbeddingClient(srv.URL, nil)
	client.SetAccessToken("api-key")
	_, err := client.GetBatchEmbeddings(context.Background(), []string{"a", "b"}, "model", nil)
	if err == nil || !strings.Contains(err.Error(), "OpenAI embedding request failed") {
		t.Fatalf("expected request failed error, got %v", err)
	}
}
