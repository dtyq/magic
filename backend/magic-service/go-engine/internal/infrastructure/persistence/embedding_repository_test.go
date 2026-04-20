package persistence_test

import (
	"context"
	"strings"
	"testing"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	"magic/internal/infrastructure/persistence"
	"magic/internal/pkg/ctxmeta"
)

type stubEmbeddingClient struct {
	embedding []float64
	batch     [][]float64
	err       error
}

func (s *stubEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.embedding, nil
}

func (s *stubEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.batch, nil
}

func (s *stubEmbeddingClient) SetAccessToken(string) {}

func (s *stubEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []*embedding.Provider{{ID: "p"}}, nil
}

type testError string

func (e testError) Error() string { return string(e) }

const errBoom testError = "boom"

func TestEmbeddingRepository_ComputeEmbedding(t *testing.T) {
	t.Parallel()
	client := &stubEmbeddingClient{embedding: []float64{1, 2}}
	svc := external.NewEmbeddingService(client, "model")
	repo := persistence.NewEmbeddingRepository(svc)
	out, err := repo.ComputeEmbedding(context.Background(), "text", "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("unexpected output: %#v", out)
	}
}

func TestEmbeddingRepository_ComputeEmbedding_Error(t *testing.T) {
	t.Parallel()
	client := &stubEmbeddingClient{err: errBoom}
	svc := external.NewEmbeddingService(client, "model")
	repo := persistence.NewEmbeddingRepository(svc)
	if _, err := repo.ComputeEmbedding(context.Background(), "text", "", nil); err == nil || !strings.Contains(err.Error(), "compute embedding") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestEmbeddingRepository_ComputeBatchEmbeddings(t *testing.T) {
	t.Parallel()
	client := &stubEmbeddingClient{batch: [][]float64{{1}, {2}}}
	svc := external.NewEmbeddingService(client, "model")
	repo := persistence.NewEmbeddingRepository(svc)
	out, err := repo.ComputeBatchEmbeddings(context.Background(), []string{"a", "b"}, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("unexpected output: %#v", out)
	}
}

func TestEmbeddingRepository_ListProviders(t *testing.T) {
	t.Parallel()
	client := &stubEmbeddingClient{}
	svc := external.NewEmbeddingService(client, "model")
	repo := persistence.NewEmbeddingRepository(svc)
	providers, err := repo.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(providers) != 1 || providers[0].ID != "p" {
		t.Fatalf("unexpected providers: %#v", providers)
	}
}
