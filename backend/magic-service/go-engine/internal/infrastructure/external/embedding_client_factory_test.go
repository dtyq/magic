package external_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/pkg/ctxmeta"
)

type captureClient struct {
	lastToken string
	err       error
}

func (c *captureClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if c.err != nil {
		return nil, c.err
	}
	return []float64{1}, nil
}

func (c *captureClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	if c.err != nil {
		return nil, c.err
	}
	return [][]float64{{1}}, nil
}

func (c *captureClient) SetAccessToken(token string) { c.lastToken = token }

func (c *captureClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	if c.err != nil {
		return nil, c.err
	}
	return []*embedding.Provider{{ID: "p"}}, nil
}

func TestEmbeddingClientFactory_GetClientTypes(t *testing.T) {
	t.Parallel()
	openaiFactory := external.NewEmbeddingClientFactory(nil, "http://example", external.EmbeddingClientTypeOpenAI, nil, nil)
	if _, ok := openaiFactory.GetClient().(*external.OpenAIEmbeddingClient); !ok {
		t.Fatalf("expected OpenAIEmbeddingClient")
	}

	phpFactory := external.NewEmbeddingClientFactory(nil, "http://example", external.EmbeddingClientTypePHP, nil, nil)
	if _, ok := phpFactory.GetClient().(*ipcclient.PHPEmbeddingRPCClient); !ok {
		t.Fatalf("expected PHPEmbeddingRPCClient")
	}
}

func TestCompositeEmbeddingClient_ListProviders(t *testing.T) {
	t.Parallel()
	compute := &captureClient{}
	provider := &captureClient{}
	comp := external.NewCompositeEmbeddingClientForTest(compute, provider)

	providers, err := comp.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 || providers[0].ID != "p" {
		t.Fatalf("unexpected providers: %#v", providers)
	}

	comp2 := external.NewCompositeEmbeddingClientForTest(compute, nil)
	providers, err = comp2.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 || providers[0].ID != "p" {
		t.Fatalf("unexpected providers: %#v", providers)
	}
}

func TestCompositeEmbeddingClient_SetAccessToken(t *testing.T) {
	t.Parallel()
	compute := &captureClient{}
	provider := &captureClient{}
	comp := external.NewCompositeEmbeddingClientForTest(compute, provider)
	comp.SetAccessToken("token")
	if compute.lastToken != "token" || provider.lastToken != "token" {
		t.Fatalf("expected token propagated")
	}
}

func TestCompositeEmbeddingClient_WrapError(t *testing.T) {
	t.Parallel()
	compute := &captureClient{err: errBoom}
	comp := external.NewCompositeEmbeddingClientForTest(compute, nil)
	_, err := comp.GetEmbedding(context.Background(), "input", "model", nil)
	if err == nil || !strings.Contains(err.Error(), "failed to get embedding") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestCompositeEmbeddingClient_GetBatchEmbeddingsAndListProviderError(t *testing.T) {
	t.Parallel()
	compute := &captureClient{}
	provider := &captureClient{err: errBoom}
	comp := external.NewCompositeEmbeddingClientForTest(compute, provider)

	embeddings, err := comp.GetBatchEmbeddings(context.Background(), []string{"input"}, "model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(embeddings) != 1 {
		t.Fatalf("unexpected embeddings: %#v", embeddings)
	}

	if _, err := comp.ListProviders(context.Background(), nil); err == nil || !strings.Contains(err.Error(), "failed to list providers") {
		t.Fatalf("expected wrapped provider error, got %v", err)
	}
}

func TestEmbeddingClientFactory_DefaultsToOpenAIOnUnknownType(t *testing.T) {
	t.Parallel()
	factory := external.NewEmbeddingClientFactory(nil, "http://example", external.EmbeddingClientType("unknown"), nil, nil)
	if _, ok := factory.GetClient().(*external.OpenAIEmbeddingClient); !ok {
		t.Fatalf("expected OpenAIEmbeddingClient fallback")
	}
}
