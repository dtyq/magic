package external_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	"magic/internal/pkg/ctxmeta"
)

type fakeEmbeddingClient struct {
	lastModel string
	err       error
}

func (f *fakeEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	f.lastModel = model
	if f.err != nil {
		return nil, f.err
	}
	return []float64{1, 2}, nil
}

func (f *fakeEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	f.lastModel = model
	if f.err != nil {
		return nil, f.err
	}
	return [][]float64{{1}, {2}}, nil
}

func (f *fakeEmbeddingClient) SetAccessToken(string) {}

func (f *fakeEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	if f.err != nil {
		return nil, f.err
	}
	return []*embedding.Provider{{ID: "p"}}, nil
}

func TestEmbeddingService_DefaultModel(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")
	_, err := svc.GetEmbedding(context.Background(), "input", "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.lastModel != "default" {
		t.Fatalf("expected default model, got %s", client.lastModel)
	}
}

func TestEmbeddingService_WrapError(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{err: errBoom}
	svc := external.NewEmbeddingService(client, "default")
	if _, err := svc.GetEmbedding(context.Background(), "input", "m", nil); err == nil || !strings.Contains(err.Error(), "get embedding") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestEmbeddingService_ListProviders(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")
	providers, err := svc.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 || providers[0].ID != "p" {
		t.Fatalf("unexpected providers: %#v", providers)
	}
}

func TestEmbeddingService_GetBatchEmbeddings(t *testing.T) {
	t.Parallel()
	client := &fakeEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "default")

	embeddings, err := svc.GetBatchEmbeddings(context.Background(), []string{"a", "b"}, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.lastModel != "default" {
		t.Fatalf("expected default model, got %s", client.lastModel)
	}
	if len(embeddings) != 2 {
		t.Fatalf("unexpected embeddings: %#v", embeddings)
	}

	client.err = errBoom
	if _, err := svc.GetBatchEmbeddings(context.Background(), []string{"a"}, "m", nil); err == nil || !strings.Contains(err.Error(), "get batch embeddings") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}
