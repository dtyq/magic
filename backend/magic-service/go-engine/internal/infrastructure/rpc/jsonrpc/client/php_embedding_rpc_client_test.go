package client_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/domain/knowledge/embedding"
	client "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

const (
	oldToken = "old-token"
	newToken = "new-token"
)

type fakeRefreshableTokenProvider struct {
	getToken     string
	refreshToken string
	getCalls     int
	refreshCalls int
	getErr       error
	refreshErr   error
}

func (f *fakeRefreshableTokenProvider) GetAccessToken(ctx context.Context) (string, error) {
	f.getCalls++
	if f.getErr != nil {
		return "", f.getErr
	}
	return f.getToken, nil
}

func (f *fakeRefreshableTokenProvider) RefreshAccessToken(ctx context.Context) (string, error) {
	f.refreshCalls++
	if f.refreshErr != nil {
		return "", f.refreshErr
	}
	return f.refreshToken, nil
}

func TestPHPEmbeddingRPCClient_GetBatchEmbeddings_ShouldRefreshAndRetryOnAuthError(t *testing.T) {
	t.Parallel()
	provider := &fakeRefreshableTokenProvider{
		getToken:     "old-token",
		refreshToken: "new-token",
	}
	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, provider)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		result, ok := out.(*client.RPCResultForTest[client.EmbeddingResultForTest])
		if !ok {
			t.Fatalf("unexpected compute result type %T", out)
		}
		callCount++
		if callCount == 1 {
			if got := params["access_token"]; got != oldToken {
				t.Fatalf("first call should use old token, got %v", got)
			}
			*result = client.RPCResultForTest[client.EmbeddingResultForTest]{Code: 500, Message: "token invalid", ErrorCode: 4000}
			return nil
		}
		if got := params["access_token"]; got != newToken {
			t.Fatalf("retry should use refreshed token, got %v", got)
		}
		*result = client.RPCResultForTest[client.EmbeddingResultForTest]{
			Code:    0,
			Message: "success",
			Data: client.EmbeddingResultForTest{
				Data: []client.EmbeddingDataForTest{{Index: 0, Embedding: []float64{0.1, 0.2}}},
			},
		}
		return nil
	})

	embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), []string{"hello"}, "text-embedding-3-large", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(embeddings) != 1 {
		t.Fatalf("expected 1 embedding, got %d", len(embeddings))
	}
	if provider.refreshCalls != 1 {
		t.Fatalf("expected refresh once, got %d", provider.refreshCalls)
	}
	if callCount != 2 {
		t.Fatalf("expected 2 rpc calls, got %d", callCount)
	}
}

func TestPHPEmbeddingRPCClient_GetBatchEmbeddings_ShouldNotRetryWhenErrorCodeIsNotAuth(t *testing.T) {
	t.Parallel()
	provider := &fakeRefreshableTokenProvider{
		getToken:     "old-token",
		refreshToken: "new-token",
	}
	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, provider)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		result, ok := out.(*client.RPCResultForTest[client.EmbeddingResultForTest])
		if !ok {
			t.Fatalf("unexpected compute result type %T", out)
		}
		callCount++
		*result = client.RPCResultForTest[client.EmbeddingResultForTest]{Code: 500, Message: "internal", ErrorCode: 4999}
		return nil
	})

	_, err := embeddingClient.GetBatchEmbeddings(context.Background(), []string{"hello"}, "text-embedding-3-large", nil)
	if err == nil {
		t.Fatalf("expected error")
	}
	if !strings.Contains(err.Error(), "error_code=4999") {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.refreshCalls != 0 {
		t.Fatalf("expected no refresh, got %d", provider.refreshCalls)
	}
	if callCount != 1 {
		t.Fatalf("expected 1 rpc call, got %d", callCount)
	}
}

func TestPHPEmbeddingRPCClient_ListProviders_ShouldRefreshAndRetryOnAuthError(t *testing.T) {
	t.Parallel()
	provider := &fakeRefreshableTokenProvider{
		getToken:     "old-token",
		refreshToken: "new-token",
	}
	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, provider)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingProvidersRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		result, ok := out.(*client.RPCResultForTest[[]*embedding.Provider])
		if !ok {
			t.Fatalf("unexpected providers result type %T", out)
		}
		callCount++
		if callCount == 1 {
			if got := params["access_token"]; got != oldToken {
				t.Fatalf("first call should use old token, got %v", got)
			}
			*result = client.RPCResultForTest[[]*embedding.Provider]{Code: 500, Message: "token disabled", ErrorCode: 4019}
			return nil
		}
		if got := params["access_token"]; got != newToken {
			t.Fatalf("retry should use refreshed token, got %v", got)
		}
		*result = client.RPCResultForTest[[]*embedding.Provider]{
			Code:    0,
			Message: "success",
			Data: []*embedding.Provider{
				{ID: "p1", Name: "Provider 1"},
			},
		}
		return nil
	})

	providers, err := embeddingClient.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(providers) != 1 {
		t.Fatalf("expected 1 provider, got %d", len(providers))
	}
	if provider.refreshCalls != 1 {
		t.Fatalf("expected refresh once, got %d", provider.refreshCalls)
	}
	if callCount != 2 {
		t.Fatalf("expected 2 rpc calls, got %d", callCount)
	}
}
