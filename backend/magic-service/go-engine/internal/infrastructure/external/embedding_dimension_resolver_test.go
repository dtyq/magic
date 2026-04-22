package external_test

import (
	"context"
	"errors"
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	"magic/internal/pkg/ctxmeta"
)

type stubEmbeddingClient struct {
	embedding          []float64
	err                error
	lastBusinessParams *ctxmeta.BusinessParams
}

func (s *stubEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	s.lastBusinessParams = businessParams
	return s.embedding, s.err
}

func (s *stubEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	return nil, nil
}

func (s *stubEmbeddingClient) SetAccessToken(string) {}

func (s *stubEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	return nil, nil
}

func TestEmbeddingDimensionResolver_PHPRequiresDimension(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypePHP)}}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	if _, err := resolver.ResolveDimension(context.Background(), "custom-model"); err == nil || !errors.Is(err, external.ErrServiceUnavailable) {
		t.Fatalf("expected ErrServiceUnavailable, got %v", err)
	}
}

func TestEmbeddingDimensionResolver_PHPProbeEmpty(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypePHP)}}
	svc := external.NewEmbeddingService(&stubEmbeddingClient{}, "")
	resolver := external.NewEmbeddingDimensionResolver(cfg, svc)
	if _, err := resolver.ResolveDimension(context.Background(), "custom-model"); err == nil || !errors.Is(err, external.ErrEmptyEmbedding) {
		t.Fatalf("expected ErrEmptyEmbedding, got %v", err)
	}
}

func TestEmbeddingDimensionResolver_PHPUsesConfig(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypePHP), Dimension: 768}}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	dim, err := resolver.ResolveDimension(context.Background(), "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 768 {
		t.Fatalf("expected 768, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_PHPKnownModelWithMatchedDimension(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{
		Embedding: autoloadcfg.EmbeddingConfig{
			ClientType: string(external.EmbeddingClientTypePHP),
			Dimension:  768,
		},
		MagicModelGateway: autoloadcfg.MagicModelGatewayConfig{
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	dim, err := resolver.ResolveDimension(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 1536 {
		t.Fatalf("expected 1536, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_PHPKnownModelIgnoresConfigMismatchSmall(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{
		Embedding: autoloadcfg.EmbeddingConfig{
			ClientType: string(external.EmbeddingClientTypePHP),
			Dimension:  1024,
		},
		MagicModelGateway: autoloadcfg.MagicModelGatewayConfig{
			DefaultEmbeddingModel: "text-embedding-3-small",
		},
	}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	dim, err := resolver.ResolveDimension(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 1536 {
		t.Fatalf("expected 1536, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_PHPKnownModelIgnoresConfigMismatchLarge(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{
		Embedding: autoloadcfg.EmbeddingConfig{
			ClientType: string(external.EmbeddingClientTypePHP),
			Dimension:  1536,
		},
	}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	dim, err := resolver.ResolveDimension(context.Background(), "text-embedding-3-large")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 3072 {
		t.Fatalf("expected 3072, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_ServiceUnavailable(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypeOpenAI)}}
	resolver := external.NewEmbeddingDimensionResolver(cfg, nil)
	if _, err := resolver.ResolveDimension(context.Background(), "custom-model"); err == nil || !errors.Is(err, external.ErrServiceUnavailable) {
		t.Fatalf("expected ErrServiceUnavailable, got %v", err)
	}
}

func TestEmbeddingDimensionResolver_ProbeSuccess(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypeOpenAI)}}
	svc := external.NewEmbeddingService(&stubEmbeddingClient{embedding: []float64{1, 2, 3}}, "")
	resolver := external.NewEmbeddingDimensionResolver(cfg, svc)
	dim, err := resolver.ResolveDimension(context.Background(), "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 3 {
		t.Fatalf("expected 3, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_ProbeUsesBusinessParamsFromContext(t *testing.T) {
	t.Parallel()

	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypeOpenAI)}}
	client := &stubEmbeddingClient{embedding: []float64{1, 2, 3}}
	svc := external.NewEmbeddingService(client, "")
	resolver := external.NewEmbeddingDimensionResolver(cfg, svc)

	ctx := ctxmeta.WithBusinessParams(context.Background(), &ctxmeta.BusinessParams{
		OrganizationCode: "DT001",
		UserID:           "usi_test",
		BusinessID:       "KNOWLEDGE-1",
	})
	dim, err := resolver.ResolveDimension(ctx, "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 3 {
		t.Fatalf("expected 3, got %d", dim)
	}
	if client.lastBusinessParams == nil {
		t.Fatal("expected business params to be passed to probe")
	}
	if client.lastBusinessParams.OrganizationCode != "DT001" || client.lastBusinessParams.UserID != "usi_test" || client.lastBusinessParams.BusinessID != "KNOWLEDGE-1" {
		t.Fatalf("unexpected business params: %#v", client.lastBusinessParams)
	}
}

func TestEmbeddingDimensionResolver_ProbeIgnoresConfigMismatch(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypeOpenAI), Dimension: 4}}
	svc := external.NewEmbeddingService(&stubEmbeddingClient{embedding: []float64{1, 2, 3}}, "")
	resolver := external.NewEmbeddingDimensionResolver(cfg, svc)
	dim, err := resolver.ResolveDimension(context.Background(), "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 3 {
		t.Fatalf("expected 3, got %d", dim)
	}
}

func TestEmbeddingDimensionResolver_FallbackToConfig(t *testing.T) {
	t.Parallel()
	cfg := &autoloadcfg.Config{Embedding: autoloadcfg.EmbeddingConfig{ClientType: string(external.EmbeddingClientTypeOpenAI), Dimension: 5}}
	svc := external.NewEmbeddingService(&stubEmbeddingClient{err: errFail}, "")
	resolver := external.NewEmbeddingDimensionResolver(cfg, svc)
	dim, err := resolver.ResolveDimension(context.Background(), "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim != 5 {
		t.Fatalf("expected 5, got %d", dim)
	}
}
