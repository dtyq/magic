package embedding_test

import (
	"bytes"
	"context"
	"errors"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"

	autoloadcfg "magic/internal/config/autoload"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

var (
	errTestEmbeddingTimeout = errors.New("connection to LLM service timed out")
	errTestProviderTimeout  = errors.New("provider request timed out")
	errTestCacheSaveFailed  = errors.New("save failed")
)

// mockEmbeddingCacheRepository 模拟缓存仓储
type mockEmbeddingCacheRepository struct {
	caches             map[string]*embeddingdomain.Cache
	mu                 sync.Mutex
	saveCalled         atomic.Bool
	saveIfAbsentCalled atomic.Bool
	saveError          error
	createCalled       atomic.Bool
	saveBatchCalls     [][]string
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
	m.mu.Lock()
	defer m.mu.Unlock()
	cache, ok := m.caches[cacheKey(textHash, model)]
	if !ok {
		return nil, embeddingdomain.ErrCacheNotFound
	}
	return cache, nil
}

func (m *mockEmbeddingCacheRepository) FindByHashes(_ context.Context, textHashes []string, model string) (map[string]*embeddingdomain.Cache, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
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
	m.mu.Lock()
	defer m.mu.Unlock()
	m.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache
	return nil
}

func (m *mockEmbeddingCacheRepository) SaveIfAbsent(_ context.Context, text string, embedding []float64, model string) error {
	m.saveIfAbsentCalled.Store(true)
	if m.saveError != nil {
		return m.saveError
	}
	cache := embeddingdomain.NewEmbeddingCache(text, embedding, model)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.caches[cacheKey(cache.TextHash, cache.EmbeddingModel)] = cache
	return nil
}

func (m *mockEmbeddingCacheRepository) SaveBatch(_ context.Context, caches []*embeddingdomain.Cache) error {
	m.saveCalled.Store(true)
	if m.saveError != nil {
		return m.saveError
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	call := make([]string, 0, len(caches))
	for _, c := range caches {
		m.caches[cacheKey(c.TextHash, c.EmbeddingModel)] = c
		call = append(call, c.TextPreview)
	}
	m.saveBatchCalls = append(m.saveBatchCalls, call)
	return nil
}

func (m *mockEmbeddingCacheRepository) GetOrCreate(_ context.Context, text string, embedding []float64, model string) (*embeddingdomain.Cache, error) {
	m.createCalled.Store(true)
	cache := embeddingdomain.NewEmbeddingCache(text, embedding, model)
	m.mu.Lock()
	defer m.mu.Unlock()
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

type serialSaveBatchCacheRepository struct {
	*mockEmbeddingCacheRepository
	firstSaveStarted chan struct{}
	releaseFirstSave chan struct{}
	startedCount     atomic.Int32
	concurrentSaves  atomic.Int32
	maxConcurrent    atomic.Int32
}

func newSerialSaveBatchCacheRepo() *serialSaveBatchCacheRepository {
	repo := &serialSaveBatchCacheRepository{
		mockEmbeddingCacheRepository: newMockCacheRepo(),
		firstSaveStarted:             make(chan struct{}),
		releaseFirstSave:             make(chan struct{}),
	}
	return repo
}

func (m *serialSaveBatchCacheRepository) SaveBatch(ctx context.Context, caches []*embeddingdomain.Cache) error {
	current := m.concurrentSaves.Add(1)
	for {
		maxSeen := m.maxConcurrent.Load()
		if current <= maxSeen || m.maxConcurrent.CompareAndSwap(maxSeen, current) {
			break
		}
	}
	defer m.concurrentSaves.Add(-1)

	started := m.startedCount.Add(1)
	if started == 1 {
		close(m.firstSaveStarted)
		<-m.releaseFirstSave
	}

	return m.mockEmbeddingCacheRepository.SaveBatch(ctx, caches)
}

// mockEmbeddingRepository 模拟 embedding 计算仓储
type mockEmbeddingRepository struct {
	embeddings         map[string][]float64
	computeError       error
	computeCalled      atomic.Bool
	batchCallCount     atomic.Int32
	batchConcurrent    atomic.Int32
	maxBatchConcurrent atomic.Int32
	mu                 sync.Mutex
	batchErrors        map[int32]error
	batchErrorsByKey   map[string]error
	blockBatchCalls    map[int32]chan struct{}
	blockBatchByKey    map[string]chan struct{}
	batchInputs        [][]string
	lastBatchInputs    []string
	beforeBatchCompute func(callNo int32, texts []string)
	afterBatchCompute  func(callNo int32, texts []string)
}

func newMockEmbeddingRepo() *mockEmbeddingRepository {
	return &mockEmbeddingRepository{
		embeddings:       make(map[string][]float64),
		batchErrors:      make(map[int32]error),
		batchErrorsByKey: make(map[string]error),
		blockBatchCalls:  make(map[int32]chan struct{}),
		blockBatchByKey:  make(map[string]chan struct{}),
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
	callNo := m.batchCallCount.Add(1)
	currentConcurrent := m.batchConcurrent.Add(1)
	for {
		maxSeen := m.maxBatchConcurrent.Load()
		if currentConcurrent <= maxSeen || m.maxBatchConcurrent.CompareAndSwap(maxSeen, currentConcurrent) {
			break
		}
	}
	defer m.batchConcurrent.Add(-1)

	m.mu.Lock()
	copied := append([]string(nil), texts...)
	m.lastBatchInputs = copied
	m.batchInputs = append(m.batchInputs, copied)
	batchErr := m.batchErrors[callNo]
	blockCh := m.blockBatchCalls[callNo]
	if len(copied) > 0 {
		batchKey := copied[0]
		if keyedErr, ok := m.batchErrorsByKey[batchKey]; ok {
			batchErr = keyedErr
		}
		if keyedBlockCh, ok := m.blockBatchByKey[batchKey]; ok {
			blockCh = keyedBlockCh
		}
	}
	beforeHook := m.beforeBatchCompute
	afterHook := m.afterBatchCompute
	m.mu.Unlock()

	if beforeHook != nil {
		beforeHook(callNo, copied)
	}
	defer func() {
		if afterHook != nil {
			afterHook(callNo, copied)
		}
	}()

	if blockCh != nil {
		<-blockCh
	}
	if m.computeError != nil {
		return nil, m.computeError
	}
	if batchErr != nil {
		return nil, batchErr
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

		if !cacheRepo.saveIfAbsentCalled.Load() {
			t.Error("expected SaveIfAbsent to be invoked for sync cache save")
		}
		if cacheRepo.createCalled.Load() {
			t.Error("did not expect GetOrCreate on sync cache save")
		}
	})
}

func TestGetEmbedding_CacheMissDoesNotWarn(t *testing.T) {
	var buf bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	}, &buf)

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	embeddingRepo.embeddings["test text"] = []float64{0.5, 0.6, 0.7}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	if _, err := svc.GetEmbedding(context.Background(), "test text", "test-model", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := buf.String(); bytes.Contains([]byte(got), []byte("Failed to query cache")) ||
		bytes.Contains([]byte(got), []byte("goEngineException")) {
		t.Fatalf("expected cache miss to avoid warning logs, got %q", got)
	}
}

func TestGetEmbedding_CacheMissSyncSaveFailureOnlyWarns(t *testing.T) {
	var buf bytes.Buffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	}, &buf)

	cacheRepo := newMockCacheRepo()
	cacheRepo.saveError = errTestCacheSaveFailed

	embeddingRepo := newMockEmbeddingRepo()
	embeddingRepo.embeddings["test text"] = []float64{0.5, 0.6, 0.7}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	if _, err := svc.GetEmbeddings(context.Background(), []string{"test text"}, "test-model", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := buf.String(); !bytes.Contains([]byte(got), []byte("failed to save embedding cache batch synchronously")) {
		t.Fatalf("expected sync cache save warning log, got %q", got)
	}
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

func TestGetEmbeddingsWithMeta_SplitMissingTextsIntoSubBatches(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		cacheRepo := newMockCacheRepo()
		embeddingRepo := newMockEmbeddingRepo()
		logger := logging.New()

		texts := []string{"a", "b", "c", "d", "e"}
		for idx, text := range texts {
			embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
		}

		svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

		result, err := svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.CacheHit != 0 {
			t.Fatalf("expected cache hit count 0, got %d", result.CacheHit)
		}
		if embeddingRepo.batchCallCount.Load() != 2 {
			t.Fatalf("expected two batch compute calls, got %d", embeddingRepo.batchCallCount.Load())
		}

		embeddingRepo.mu.Lock()
		if len(embeddingRepo.batchInputs) != 2 {
			embeddingRepo.mu.Unlock()
			t.Fatalf("expected two batch input groups, got %d", len(embeddingRepo.batchInputs))
		}
		firstCall := append([]string(nil), embeddingRepo.batchInputs[0]...)
		secondCall := append([]string(nil), embeddingRepo.batchInputs[1]...)
		embeddingRepo.mu.Unlock()

		if got, want := len(firstCall), 4; got != want {
			t.Fatalf("expected first batch size %d, got %d", want, got)
		}
		if got, want := len(secondCall), 1; got != want {
			t.Fatalf("expected second batch size %d, got %d", want, got)
		}
		if len(result.Embeddings) != len(texts) {
			t.Fatalf("expected %d embeddings, got %d", len(texts), len(result.Embeddings))
		}

		cacheRepo.mu.Lock()
		defer cacheRepo.mu.Unlock()
		if len(cacheRepo.saveBatchCalls) != 2 {
			t.Fatalf("expected two sync cache save batches, got %d", len(cacheRepo.saveBatchCalls))
		}
		saveSizes := []int{len(cacheRepo.saveBatchCalls[0]), len(cacheRepo.saveBatchCalls[1])}
		slices.Sort(saveSizes)
		if !slices.Equal(saveSizes, []int{1, 4}) {
			t.Fatalf("expected sync cache save sizes [1 4], got %v", saveSizes)
		}
	})
}

func TestGetEmbeddingsWithMeta_SubBatchesRunWithFourConcurrentWorkers(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()

	texts := []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"}
	for idx, text := range texts {
		embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
	}

	firstFourStarted := make(chan struct{}, 4)
	releaseFirstFour := make(chan struct{})
	embeddingRepo.beforeBatchCompute = func(callNo int32, _ []string) {
		if callNo > 4 {
			return
		}
		firstFourStarted <- struct{}{}
		<-releaseFirstFour
	}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	done := make(chan struct{})
	var (
		result *embeddingdomain.BatchResult
		err    error
	)
	go func() {
		defer close(done)
		result, err = svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
	}()

	<-firstFourStarted
	<-firstFourStarted
	<-firstFourStarted
	<-firstFourStarted

	if got := embeddingRepo.batchCallCount.Load(); got != 4 {
		t.Fatalf("expected four sub-batches to start before releasing workers, got %d", got)
	}
	if got := embeddingRepo.maxBatchConcurrent.Load(); got != 4 {
		t.Fatalf("expected max concurrent sub-batches to be 4, got %d", got)
	}

	close(releaseFirstFour)
	<-done

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Embeddings) != len(texts) {
		t.Fatalf("expected %d embeddings, got %d", len(texts), len(result.Embeddings))
	}
	if got := embeddingRepo.batchCallCount.Load(); got != 4 {
		t.Fatalf("expected four sub-batches in total, got %d", got)
	}
	if got := embeddingRepo.maxBatchConcurrent.Load(); got != 4 {
		t.Fatalf("expected max concurrent sub-batches to stay at 4, got %d", got)
	}
}

func TestGetEmbeddingsWithMeta_DeduplicateBeforeSplitting(t *testing.T) {
	t.Parallel()

	cacheRepo := newMockCacheRepo()
	embeddingRepo := newMockEmbeddingRepo()
	logger := logging.New()
	texts := []string{"a", "a", "b", "b", "c", "d", "e"}
	for idx, text := range []string{"a", "b", "c", "d", "e"} {
		embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
	}

	svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

	result, err := svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Embeddings) != len(texts) {
		t.Fatalf("expected %d embeddings, got %d", len(texts), len(result.Embeddings))
	}
	if embeddingRepo.batchCallCount.Load() != 2 {
		t.Fatalf("expected two batch compute calls after deduplication, got %d", embeddingRepo.batchCallCount.Load())
	}

	embeddingRepo.mu.Lock()
	if len(embeddingRepo.batchInputs) != 2 {
		embeddingRepo.mu.Unlock()
		t.Fatalf("expected two batch input groups, got %d", len(embeddingRepo.batchInputs))
	}
	batchSizes := []int{len(embeddingRepo.batchInputs[0]), len(embeddingRepo.batchInputs[1])}
	embeddingRepo.mu.Unlock()

	slices.Sort(batchSizes)
	if !slices.Equal(batchSizes, []int{1, 4}) {
		t.Fatalf("expected deduplicated batch sizes [1 4], got %v", batchSizes)
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

func TestGetEmbeddingsWithMeta_StopAfterSubBatchFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cacheRepo := newMockCacheRepo()
		embeddingRepo := newMockEmbeddingRepo()
		firstBatchRelease := make(chan struct{})
		secondBatchFinished := make(chan struct{})
		embeddingRepo.blockBatchByKey["a"] = firstBatchRelease
		embeddingRepo.batchErrorsByKey["e"] = errTestEmbeddingTimeout
		embeddingRepo.afterBatchCompute = func(_ int32, batchTexts []string) {
			if len(batchTexts) > 0 && batchTexts[0] == "e" {
				close(secondBatchFinished)
			}
		}
		logger := logging.New()

		texts := []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q"}
		for idx, text := range texts {
			embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
		}

		svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

		errCh := make(chan error, 1)
		go func() {
			_, err := svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
			errCh <- err
		}()

		<-secondBatchFinished
		startedBeforeRelease := embeddingRepo.batchCallCount.Load()
		if startedBeforeRelease < 2 || startedBeforeRelease > 4 {
			t.Fatalf("expected between two and four sub-batches to start before failure propagation, got %d", startedBeforeRelease)
		}
		close(firstBatchRelease)

		err := <-errCh
		if err == nil {
			t.Fatal("expected error")
		}
		if !errors.Is(err, embeddingdomain.ErrEmbeddingComputeFailed) {
			t.Fatalf("expected ErrEmbeddingComputeFailed, got %v", err)
		}
		if got := embeddingRepo.batchCallCount.Load(); got > 4 {
			t.Fatalf("expected failure to stop before launching a second sub-batch wave, got %d calls after starting with %d", got, startedBeforeRelease)
		}

		synctest.Wait()

		cacheRepo.mu.Lock()
		defer cacheRepo.mu.Unlock()
		if len(cacheRepo.saveBatchCalls) != 1 {
			t.Fatalf("expected only first successful batch to trigger cache save, got %d", len(cacheRepo.saveBatchCalls))
		}
		if got, want := len(cacheRepo.saveBatchCalls[0]), 4; got != want {
			t.Fatalf("expected first successful cache save size %d, got %d", want, got)
		}
	})
}

func TestGetEmbeddingsWithMeta_SyncCacheWritesStaySerial(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		cacheRepo := newSerialSaveBatchCacheRepo()
		embeddingRepo := newMockEmbeddingRepo()
		logger := logging.New()

		texts := []string{"a", "b", "c", "d", "e", "f", "g", "h"}
		for idx, text := range texts {
			embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
		}

		svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

		type resultWithErr struct {
			result *embeddingdomain.BatchResult
			err    error
		}
		resultCh := make(chan resultWithErr, 1)
		go func() {
			result, err := svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
			resultCh <- resultWithErr{result: result, err: err}
		}()
		<-cacheRepo.firstSaveStarted
		if got := cacheRepo.startedCount.Load(); got != 1 {
			t.Fatalf("expected exactly one cache save batch to start while first batch is blocked, got %d", got)
		}
		if got := cacheRepo.maxConcurrent.Load(); got != 1 {
			t.Fatalf("expected cache batch saves to stay serial, max concurrent got %d", got)
		}

		close(cacheRepo.releaseFirstSave)

		outcome := <-resultCh
		if outcome.err != nil {
			t.Fatalf("unexpected error: %v", outcome.err)
		}
		if len(outcome.result.Embeddings) != len(texts) {
			t.Fatalf("expected %d embeddings, got %d", len(texts), len(outcome.result.Embeddings))
		}
		if got := cacheRepo.startedCount.Load(); got != 2 {
			t.Fatalf("expected two synchronous cache save batches after releasing first batch, got %d", got)
		}
	})
}

func TestGetEmbeddingsWithMeta_WritesCacheBeforeNextWave(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		cacheRepo := newSerialSaveBatchCacheRepo()
		embeddingRepo := newMockEmbeddingRepo()
		logger := logging.New()

		texts := []string{
			"a", "b", "c", "d",
			"e", "f", "g", "h",
			"i", "j", "k", "l",
			"m", "n", "o", "p",
			"q",
		}
		for idx, text := range texts {
			embeddingRepo.embeddings[text] = []float64{float64(idx + 1)}
		}

		svc := embeddingdomain.NewEmbeddingDomainService(cacheRepo, cacheRepo, embeddingRepo, logger)

		type resultWithErr struct {
			result *embeddingdomain.BatchResult
			err    error
		}
		resultCh := make(chan resultWithErr, 1)
		go func() {
			result, err := svc.GetEmbeddingsWithMeta(context.Background(), texts, "test-model", nil)
			resultCh <- resultWithErr{result: result, err: err}
		}()

		<-cacheRepo.firstSaveStarted
		if got := embeddingRepo.batchCallCount.Load(); got != 4 {
			t.Fatalf("expected next wave to wait for first wave cache save, got %d compute batches started", got)
		}
		if got := cacheRepo.startedCount.Load(); got != 1 {
			t.Fatalf("expected first cache save to be the only blocked save, got %d", got)
		}

		close(cacheRepo.releaseFirstSave)

		outcome := <-resultCh
		if outcome.err != nil {
			t.Fatalf("unexpected error: %v", outcome.err)
		}
		if len(outcome.result.Embeddings) != len(texts) {
			t.Fatalf("expected %d embeddings, got %d", len(texts), len(outcome.result.Embeddings))
		}
		if got := embeddingRepo.batchCallCount.Load(); got != 5 {
			t.Fatalf("expected five compute batches after releasing first wave cache save, got %d", got)
		}
		if got := cacheRepo.startedCount.Load(); got != 5 {
			t.Fatalf("expected five cache save batches, got %d", got)
		}
	})
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
