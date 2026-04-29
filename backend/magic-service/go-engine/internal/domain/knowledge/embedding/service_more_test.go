package embedding_test

import (
	"context"
	"errors"
	"testing"

	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

var (
	errAnalysisBoom    = errors.New("analysis boom")
	errDeleteHashBoom  = errors.New("delete hash boom")
	errBatchDeleteBoom = errors.New("batch delete boom")
)

type embeddingAnalysisRepoStub struct {
	stats          *embeddingdomain.CacheStatistics
	statsErr       error
	cleanupCount   int64
	cleanupErr     error
	deleteHashErr  error
	batchDeleteErr error
}

func (s *embeddingAnalysisRepoStub) FindByHash(context.Context, string, string) (*embeddingdomain.Cache, error) {
	return nil, shared.ErrNotFound
}

func (s *embeddingAnalysisRepoStub) FindByHashes(context.Context, []string, string) (map[string]*embeddingdomain.Cache, error) {
	return map[string]*embeddingdomain.Cache{}, nil
}

func (s *embeddingAnalysisRepoStub) Save(context.Context, *embeddingdomain.Cache) error {
	return nil
}

func (s *embeddingAnalysisRepoStub) SaveIfAbsent(context.Context, string, []float64, string) error {
	return nil
}

func (s *embeddingAnalysisRepoStub) SaveBatch(context.Context, []*embeddingdomain.Cache) error {
	return nil
}

func (s *embeddingAnalysisRepoStub) GetOrCreate(context.Context, string, []float64, string) (*embeddingdomain.Cache, error) {
	return &embeddingdomain.Cache{}, nil
}

func (s *embeddingAnalysisRepoStub) UpdateAccess(context.Context, int64) error {
	return nil
}

func (s *embeddingAnalysisRepoStub) Delete(context.Context, int64) error {
	return nil
}

func (s *embeddingAnalysisRepoStub) DeleteByHash(context.Context, string) error {
	return s.deleteHashErr
}

func (s *embeddingAnalysisRepoStub) BatchDelete(context.Context, []int64) error {
	return s.batchDeleteErr
}

func (s *embeddingAnalysisRepoStub) FindExpiredCaches(context.Context, *embeddingdomain.CacheCleanupCriteria, int, int) ([]*embeddingdomain.Cache, error) {
	return []*embeddingdomain.Cache{}, nil
}

func (s *embeddingAnalysisRepoStub) CountExpiredCaches(context.Context, *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	return 0, nil
}

func (s *embeddingAnalysisRepoStub) CleanupExpiredCaches(context.Context, *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	if s.cleanupErr != nil {
		return 0, s.cleanupErr
	}
	return s.cleanupCount, nil
}

func (s *embeddingAnalysisRepoStub) GetCacheStatistics(context.Context) (*embeddingdomain.CacheStatistics, error) {
	if s.statsErr != nil {
		return nil, s.statsErr
	}
	return s.stats, nil
}

type embeddingRepoWithProvidersStub struct {
	providers []*embeddingdomain.Provider
	err       error
}

func (s *embeddingRepoWithProvidersStub) ComputeEmbedding(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error) {
	return []float64{0.1}, nil
}

func (s *embeddingRepoWithProvidersStub) ComputeBatchEmbeddings(context.Context, []string, string, *ctxmeta.BusinessParams) ([][]float64, error) {
	return [][]float64{{0.1}}, nil
}

func (s *embeddingRepoWithProvidersStub) ListProviders(context.Context, *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.providers, nil
}

func TestEmbeddingDomainServiceAnalysisWrappers(t *testing.T) {
	t.Parallel()

	repo := &embeddingAnalysisRepoStub{
		stats:        &embeddingdomain.CacheStatistics{TotalCaches: 1},
		cleanupCount: 2,
	}
	svc := embeddingdomain.NewEmbeddingDomainService(repo, repo, &embeddingRepoWithProvidersStub{
		providers: []*embeddingdomain.Provider{{Name: "openai"}},
	}, logging.New())

	stats, err := svc.GetCacheStatistics(context.Background())
	if err != nil || stats.TotalCaches != 1 {
		t.Fatalf("unexpected stats=%#v err=%v", stats, err)
	}
	deleted, err := svc.CleanupExpiredCaches(context.Background(), embeddingdomain.DefaultCleanupCriteria())
	if err != nil || deleted != 2 {
		t.Fatalf("unexpected cleanup deleted=%d err=%v", deleted, err)
	}
	if err := svc.DeleteCacheByHash(context.Background(), "hash-1"); err != nil {
		t.Fatalf("delete cache by hash: %v", err)
	}
	if err := svc.BatchDeleteCaches(context.Background(), []int64{1, 2}); err != nil {
		t.Fatalf("batch delete caches: %v", err)
	}
	providers, err := svc.GetProviders(context.Background(), nil)
	if err != nil || len(providers) != 1 || providers[0].Name != "openai" {
		t.Fatalf("unexpected providers=%#v err=%v", providers, err)
	}
}

func TestEmbeddingDomainServiceAnalysisWrapperErrors(t *testing.T) {
	t.Parallel()

	repo := &embeddingAnalysisRepoStub{
		statsErr:       errAnalysisBoom,
		cleanupErr:     errAnalysisBoom,
		deleteHashErr:  errDeleteHashBoom,
		batchDeleteErr: errBatchDeleteBoom,
	}
	svc := embeddingdomain.NewEmbeddingDomainService(repo, repo, &embeddingRepoWithProvidersStub{}, logging.New())

	if _, err := svc.GetCacheStatistics(context.Background()); !errors.Is(err, errAnalysisBoom) {
		t.Fatalf("expected stats error, got %v", err)
	}
	if _, err := svc.CleanupExpiredCaches(context.Background(), embeddingdomain.DefaultCleanupCriteria()); !errors.Is(err, errAnalysisBoom) {
		t.Fatalf("expected cleanup error, got %v", err)
	}
	if err := svc.DeleteCacheByHash(context.Background(), "hash-1"); !errors.Is(err, errDeleteHashBoom) {
		t.Fatalf("expected delete hash error, got %v", err)
	}
	if err := svc.BatchDeleteCaches(context.Background(), []int64{1}); !errors.Is(err, errBatchDeleteBoom) {
		t.Fatalf("expected batch delete error, got %v", err)
	}
}
