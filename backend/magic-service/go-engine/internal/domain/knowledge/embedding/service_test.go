package embedding_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"

	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

var (
	errTestEmbeddingTimeout = errors.New("connection to LLM service timed out")
	errTestProviderTimeout  = errors.New("provider request timed out")
)

// mockEmbeddingCacheRepository 模拟缓存仓储
type mockEmbeddingCacheRepository struct {
	caches             map[string]*embeddingdomain.Cache
	saveCalled         atomic.Bool
	saveIfAbsentCalled atomic.Bool
	saveError          error
	createCalled       atomic.Bool
}

func newMockCacheRepo() *mockEmbeddingCacheRepository {
	return &mockEmbeddingCacheRepository{
		caches: make(map[string]*embeddingdomain.Cache),
	}
}

func cacheKey(textHash, model string) string {
	return textHash + ":" + model
}

func (m *mockEmbeddingCacheRepository) FindByHash(_ context.Context, textHash, model string) (*embeddingdomain.Cache, error) {
	cache, ok := m.caches[cacheKey(textHash, model)]
	if !ok {
		// 缓存未命中时返回哨兵错误，避免 nilnil
		return nil, shared.ErrNotFound
	}
	return cache, nil
}

func (m *mockEmbeddingCacheRepository) FindByHashes(_ context.Context, textHashes []string, model string) (map[string]*embeddingdomain.Cache, error) {
	result := make(map[string]*embeddingdomain.Cache)
	for _, h := range textHashes {
		if cache, ok := m.caches[cacheKey(h, model)]; ok {
			result[h] = cache
		}
	}
	return result, nil
}

func (m *mockEmbeddingCacheRepository) Save(_ context.Context, cache *embeddingdomain.Cache) error {
	m.saveCalled.Store(true)
	if m.saveError != nil {
		return m.saveError
	}
	m.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache
	return nil
}

func (m *mockEmbeddingCacheRepository) SaveIfAbsent(_ context.Context, text string, embedding []float64, model string) error {
	m.saveIfAbsentCalled.Store(true)
	if m.saveError != nil {
		return m.saveError
	}
	cache := embeddingdomain.NewEmbeddingCache(text, embedding, model)
	m.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache
	return nil
}

func (m *mockEmbeddingCacheRepository) SaveBatch(_ context.Context, caches []*embeddingdomain.Cache) error {
	m.saveCalled.Store(true)
	for _, c := range caches {
		m.caches[cacheKey(c.TextHash, c.EmbeddingModel)] = c
	}
	return nil
}

func (m *mockEmbeddingCacheRepository) GetOrCreate(_ context.Context, text string, embedding []float64, model string) (*embeddingdomain.Cache, error) {
	m.createCalled.Store(true)
	cache := embeddingdomain.NewEmbeddingCache(text, embedding, model)
	m.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache
	return cache, nil
}

// 以下为满足接口要求的空实现方法
func (m *mockEmbeddingCacheRepository) UpdateAccess(_ context.Context, _ int64) error { return nil }

func (m *mockEmbeddingCacheRepository) Delete(_ context.Context, _ int64) error { return nil }

func (m *mockEmbeddingCacheRepository) DeleteByHash(_ context.Context, _ string) error { return nil }

func (m *mockEmbeddingCacheRepository) BatchDelete(_ context.Context, _ []int64) error { return nil }

func (m *mockEmbeddingCacheRepository) FindExpiredCaches(_ context.Context, _ *embeddingdomain.CacheCleanupCriteria, _, _ int) ([]*embeddingdomain.Cache, error) {
	return []*embeddingdomain.Cache{}, nil
}

func (m *mockEmbeddingCacheRepository) CountExpiredCaches(_ context.Context, _ *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	return 0, nil
}

func (m *mockEmbeddingCacheRepository) CleanupExpiredCaches(_ context.Context, _ *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	return 0, nil
}

func (m *mockEmbeddingCacheRepository) GetCacheStatistics(_ context.Context) (*embeddingdomain.CacheStatistics, error) {
	return &embeddingdomain.CacheStatistics{}, nil
}

func (m *mockEmbeddingCacheRepository) GetCachesByModel(_ context.Context, _ string, _, _ int) ([]*embeddingdomain.Cache, error) {
	return []*embeddingdomain.Cache{}, nil
}

func (m *mockEmbeddingCacheRepository) CountByModel(_ context.Context, _ string) (int64, error) {
	return 0, nil
}

func (m *mockEmbeddingCacheRepository) GetLeastAccessed(_ context.Context, _ int) ([]*embeddingdomain.Cache, error) {
	return []*embeddingdomain.Cache{}, nil
}

func (m *mockEmbeddingCacheRepository) SearchCaches(_ context.Context, _ *embeddingdomain.CacheQuery) ([]*embeddingdomain.Cache, int64, error) {
	return []*embeddingdomain.Cache{}, 0, nil
}

// mockEmbeddingRepository 模拟 embedding 计算仓储
type mockEmbeddingRepository struct {
	embeddings      map[string][]float64
	computeError    error
	computeCalled   atomic.Bool
	batchCallCount  atomic.Int32
	lastBatchInputs []string
}

func newMockEmbeddingRepo() *mockEmbeddingRepository {
	return &mockEmbeddingRepository{
		embeddings: make(map[string][]float64),
	}
}

func (m *mockEmbeddingRepository) ComputeEmbedding(_ context.Context, text, _ string, _ *ctxmeta.BusinessParams) ([]float64, error) {
	m.computeCalled.Store(true)
	if m.computeError != nil {
		return nil, m.computeError
	}
	// 返回固定的模拟 embedding
	if emb, ok := m.embeddings[text]; ok {
		return emb, nil
	}
	return []float64{0.1, 0.2, 0.3}, nil
}

func (m *mockEmbeddingRepository) ComputeBatchEmbeddings(_ context.Context, texts []string, _ string, _ *ctxmeta.BusinessParams) ([][]float64, error) {
	m.batchCallCount.Add(1)
	m.lastBatchInputs = append([]string(nil), texts...)
	if m.computeError != nil {
		return nil, m.computeError
	}
	result := make([][]float64, len(texts))
	for i, text := range texts {
		if emb, ok := m.embeddings[text]; ok {
			result[i] = emb
		} else {
			result[i] = []float64{0.1, 0.2, 0.3}
		}
	}
	return result, nil
}

func (m *mockEmbeddingRepository) ListProviders(ctx context.Context, _ *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error) {
	return []*embeddingdomain.Provider{}, nil
}

// TestGetEmbedding_CacheHit 测试缓存命中场景
func TestGetEmbedding_CacheHit(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	// 预置缓存
	cachedEmbedding := []float64{1.0, 2.0, 3.0}
	cache := embeddingdomain.NewEmbeddingCache("test text", cachedEmbedding, "test-model")
	cacheRepo.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	result, err := svc.GetEmbedding(context.Background(), "test text", "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 验证返回缓存数据
	if len(result) != len(cachedEmbedding) {
		t.Errorf("expected embedding length %d, got %d", len(cachedEmbedding), len(result))
	}

	// 验证未调用计算
	if embeddingRepo.computeCalled.Load() {
		t.Error("expected no compute call when cache hit")
	}
}

// TestGetEmbedding_CacheMiss 测试缓存未命中场景
func TestGetEmbedding_CacheMiss(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		cacheRepo := newMockCacheRepo()
		embeddingRepo := newMockEmbeddingRepo()
		logger := logging.New()

		expectedEmbedding := []float64{0.5, 0.6, 0.7}
		embeddingRepo.embeddings["test text"] = expectedEmbedding

		svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

		result, err := svc.GetEmbedding(context.Background(), "test text", "test-model", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(result) != len(expectedEmbedding) {
			t.Errorf("expected embedding length %d, got %d", len(expectedEmbedding), len(result))
		}
		if !embeddingRepo.computeCalled.Load() {
			t.Error("expected compute call when cache miss")
		}

		synctest.Wait()

		if !cacheRepo.saveIfAbsentCalled.Load() {
			t.Error("expected SaveIfAbsent to be invoked for async cache save")
		}
		if cacheRepo.createCalled.Load() {
			t.Error("did not expect GetOrCreate on async cache save")
		}
	})
}

// TestGetEmbeddings_BatchProcessing 测试批量处理
func TestGetEmbeddings_BatchProcessing(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	texts := []string{"text1", "text2", "text3"}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	results, err := svc.GetEmbeddings(context.Background(), texts, "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != len(texts) {
		t.Errorf("expected %d results, got %d", len(texts), len(results))
	}
}

// TestGetEmbeddings_EmptyInput 测试空输入
func TestGetEmbeddings_EmptyInput(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	results, err := svc.GetEmbeddings(context.Background(), []string{}, "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 results for empty input, got %d", len(results))
	}
}

func TestGetEmbeddingWithMeta_CacheHit(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	cachedEmbedding := []float64{1.0, 2.0, 3.0}
	cache := embeddingdomain.NewEmbeddingCache("test text", cachedEmbedding, "test-model")
	cacheRepo.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	result, err := svc.GetEmbeddingWithMeta(context.Background(), "test text", "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.CacheHit {
		t.Fatal("expected cache hit")
	}
	if len(result.Embedding) != len(cachedEmbedding) {
		t.Fatalf("expected embedding length %d, got %d", len(cachedEmbedding), len(result.Embedding))
	}
}

func TestGetEmbeddingsWithMeta_CacheHitCountByItems(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	cacheA := embeddingdomain.NewEmbeddingCache("a", []float64{1, 1, 1}, "test-model")
	cacheB := embeddingdomain.NewEmbeddingCache("b", []float64{2, 2, 2}, "test-model")
	cacheRepo.caches[cacheKey(cacheA.TextHash, cacheA.EmbeddingModel)] = cacheA
	cacheRepo.caches[cacheKey(cacheB.TextHash, cacheB.EmbeddingModel)] = cacheB
	embeddingRepo.embeddings["c"] = []float64{3, 3, 3}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	result, err := svc.GetEmbeddingsWithMeta(context.Background(), []string{"a", "a", "b", "c"}, "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.CacheHit != 3 {
		t.Fatalf("expected cache hit count 3, got %d", result.CacheHit)
	}
	if len(result.Embeddings) != 4 {
		t.Fatalf("expected 4 embeddings, got %d", len(result.Embeddings))
	}
	if embeddingRepo.batchCallCount.Load() != 1 {
		t.Fatalf("expected one batch compute call, got %d", embeddingRepo.batchCallCount.Load())
	}
}

func TestGetEmbeddingsWithMeta_DeduplicateMissingTexts(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()
	embeddingRepo.embeddings["dup"] = []float64{9, 9, 9}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	result, err := svc.GetEmbeddingsWithMeta(context.Background(), []string{"dup", "dup"}, "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.CacheHit != 0 {
		t.Fatalf("expected cache hit count 0, got %d", result.CacheHit)
	}
	if embeddingRepo.batchCallCount.Load() != 1 {
		t.Fatalf("expected one batch compute call, got %d", embeddingRepo.batchCallCount.Load())
	}
	if len(embeddingRepo.lastBatchInputs) != 1 {
		t.Fatalf("expected deduplicated batch input length 1, got %d", len(embeddingRepo.lastBatchInputs))
	}
	if len(result.Embeddings) != 2 {
		t.Fatalf("expected 2 embeddings, got %d", len(result.Embeddings))
	}
}

func TestGetEmbeddingWithMeta_ComputeErrorWrapsSentinel(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	embeddingRepo.computeError = errTestEmbeddingTimeout
	logger := logging.New()

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	_, err := svc.GetEmbeddingWithMeta(context.Background(), "test text", "test-model", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, embeddingdomain.ErrEmbeddingComputeFailed) {
		t.Fatalf("expected ErrEmbeddingComputeFailed, got %v", err)
	}
}

func TestGetEmbeddingsWithMeta_BatchComputeErrorWrapsSentinel(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	embeddingRepo.computeError = errTestEmbeddingTimeout
	logger := logging.New()

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	_, err := svc.GetEmbeddingsWithMeta(context.Background(), []string{"a", "b"}, "test-model", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, embeddingdomain.ErrEmbeddingComputeFailed) {
		t.Fatalf("expected ErrEmbeddingComputeFailed, got %v", err)
	}
}

func TestGetProviders_ListErrorWrapsSentinel(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	logger := logging.New()
	embeddingRepoWithProviderError := &mockEmbeddingRepositoryWithProviderError{
		err: errTestProviderTimeout,
	}
	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepoWithProviderError, logger)

	_, err := svc.GetProviders(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, embeddingdomain.ErrEmbeddingProvidersListFailed) {
		t.Fatalf("expected ErrEmbeddingProvidersListFailed, got %v", err)
	}
}

type mockEmbeddingRepositoryWithProviderError struct {
	err error
}

func (m *mockEmbeddingRepositoryWithProviderError) ComputeEmbedding(_ context.Context, _, _ string, _ *ctxmeta.BusinessParams) ([]float64, error) {
	return []float64{0.1, 0.2, 0.3}, nil
}

func (m *mockEmbeddingRepositoryWithProviderError) ComputeBatchEmbeddings(_ context.Context, texts []string, _ string, _ *ctxmeta.BusinessParams) ([][]float64, error) {
	result := make([][]float64, len(texts))
	for i := range texts {
		result[i] = []float64{0.1, 0.2, 0.3}
	}
	return result, nil
}

func (m *mockEmbeddingRepositoryWithProviderError) ListProviders(_ context.Context, _ *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error) {
	return nil, m.err
}
