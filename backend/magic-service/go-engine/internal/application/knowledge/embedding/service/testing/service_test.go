package embedapp_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	embeddto "magic/internal/application/knowledge/embedding/dto"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	"magic/internal/domain/knowledge/embedding"
	"magic/internal/pkg/ctxmeta"
)

var errUpstreamDown = errors.New("upstream down")

type stubEmbeddingProviderPort struct {
	providers []*embedding.Provider
	err       error
	calls     int
}

func (s *stubEmbeddingProviderPort) GetEmbeddingWithMeta(_ context.Context, _, _ string, _ *ctxmeta.BusinessParams) (*embedding.Result, error) {
	return &embedding.Result{
		Embedding: []float64{1, 2, 3},
		CacheHit:  true,
	}, nil
}

func (s *stubEmbeddingProviderPort) GetEmbeddingsWithMeta(_ context.Context, _ []string, _ string, _ *ctxmeta.BusinessParams) (*embedding.BatchResult, error) {
	return &embedding.BatchResult{
		Embeddings: [][]float64{{1, 2, 3}},
		CacheHit:   1,
	}, nil
}

func (s *stubEmbeddingProviderPort) GetProviders(_ context.Context, _ *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	return s.providers, nil
}

func TestEmbeddingAppServiceListProvidersReturnsAllProviders(t *testing.T) {
	t.Parallel()
	stub := &stubEmbeddingProviderPort{
		providers: []*embedding.Provider{
			{
				ID:   "p1",
				Name: "provider1",
				Models: []embedding.Model{
					{ID: "m1", Name: "Model One", ModelID: "m1"},
					{ID: "m2", Name: "Model Two", ModelID: "dmeta-embedding"},
				},
			},
			{
				ID:   "p2",
				Name: "provider2",
				Models: []embedding.Model{
					{ID: "m3", Name: "Model Three", ModelID: "m3"},
				},
			},
		},
	}
	svc := embeddingapp.NewEmbeddingAppService(stub, nil, "dmeta-embedding")

	providers, err := svc.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if stub.calls != 1 {
		t.Fatalf("expected upstream ListProviders called once, got %d", stub.calls)
	}
	if len(providers) != 2 {
		t.Fatalf("expected two providers, got %d", len(providers))
	}
	if providers[0].ID != "p1" {
		t.Fatalf("expected provider id p1, got %q", providers[0].ID)
	}
	if len(providers[0].Models) != 2 {
		t.Fatalf("expected two models, got %d", len(providers[0].Models))
	}
	if providers[1].ID != "p2" {
		t.Fatalf("expected provider id p2, got %q", providers[1].ID)
	}
}

func TestEmbeddingAppServiceListProvidersIgnoresBlankDefaultModel(t *testing.T) {
	t.Parallel()
	stub := &stubEmbeddingProviderPort{
		providers: []*embedding.Provider{
			{
				ID:   "p1",
				Name: "provider1",
				Models: []embedding.Model{
					{ID: "m1", Name: "Model One", ModelID: "m1"},
				},
			},
		},
	}
	svc := embeddingapp.NewEmbeddingAppService(stub, nil, " ")

	providers, err := svc.ListProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if stub.calls != 1 {
		t.Fatalf("expected upstream ListProviders called once, got %d", stub.calls)
	}
	if len(providers) != 1 {
		t.Fatalf("expected one provider, got %#v", providers)
	}
}

func TestEmbeddingAppServiceListProvidersReturnsUpstreamError(t *testing.T) {
	t.Parallel()
	stub := &stubEmbeddingProviderPort{err: errUpstreamDown}
	svc := embeddingapp.NewEmbeddingAppService(stub, nil, "dmeta-embedding")

	_, err := svc.ListProviders(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if stub.calls != 1 {
		t.Fatalf("expected upstream ListProviders called once, got %d", stub.calls)
	}
	if !errors.Is(err, embeddingapp.ErrEmbeddingProvidersListFailed) {
		t.Fatalf("expected ErrEmbeddingProvidersListFailed, got %v", err)
	}
	if !strings.Contains(err.Error(), "upstream down") {
		t.Fatalf("expected upstream reason in error, got %v", err)
	}
}

func TestEmbeddingAppServiceCompute(t *testing.T) {
	t.Parallel()
	stub := &stubEmbeddingProviderPort{}
	svc := embeddingapp.NewEmbeddingAppService(stub, nil, "dmeta-embedding")

	output, err := svc.Compute(context.Background(), &embeddto.ComputeEmbeddingInput{
		Text:           "hello",
		Model:          "m1",
		BusinessParams: &ctxmeta.BusinessParams{OrganizationCode: "org-1"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if output == nil || len(output.Embedding) != 3 || !output.CacheHit {
		t.Fatalf("unexpected output: %#v", output)
	}
}

func TestEmbeddingAppServiceComputeBatch(t *testing.T) {
	t.Parallel()
	stub := &stubEmbeddingProviderPort{}
	svc := embeddingapp.NewEmbeddingAppService(stub, nil, "dmeta-embedding")

	output, err := svc.ComputeBatch(context.Background(), &embeddto.ComputeBatchEmbeddingInput{
		Texts:          []string{"a", "b"},
		Model:          "m1",
		BusinessParams: &ctxmeta.BusinessParams{OrganizationCode: "org-1"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if output == nil || len(output.Embeddings) != 1 || output.CacheStats.Total != 2 || output.CacheStats.CacheHit != 1 {
		t.Fatalf("unexpected output: %#v", output)
	}
}
