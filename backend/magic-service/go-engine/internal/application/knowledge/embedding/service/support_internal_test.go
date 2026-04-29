package embedapp

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	lockpkg "magic/internal/pkg/lock"
)

var (
	errCleanupBoom = errors.New("cleanup boom")
	errStatsBoom   = errors.New("stats boom")
	errCacheMiss   = errors.New("cache miss")
)

type internalEmbeddingRepoStub struct {
	providers []*embeddingdomain.Provider
}

func (s *internalEmbeddingRepoStub) ComputeEmbedding(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error) {
	return []float64{0.1, 0.2}, nil
}

func (s *internalEmbeddingRepoStub) ComputeBatchEmbeddings(context.Context, []string, string, *ctxmeta.BusinessParams) ([][]float64, error) {
	return [][]float64{{0.1, 0.2}}, nil
}

func (s *internalEmbeddingRepoStub) ListProviders(context.Context, *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error) {
	return s.providers, nil
}

type internalEmbeddingAnalysisRepoStub struct {
	beforeStats      *embeddingdomain.CacheStatistics
	afterStats       *embeddingdomain.CacheStatistics
	getStatsErr      error
	secondStatsErr   error
	cleanupCount     int64
	cleanupErr       error
	cleanupCalls     int
	deleteByHashErr  error
	batchDeleteErr   error
	cleanupBlock     <-chan struct{}
	cleanupStarted   chan struct{}
	cleanupStartOnce sync.Once
}

func (s *internalEmbeddingAnalysisRepoStub) FindByHash(context.Context, string, string) (*embeddingdomain.Cache, error) {
	return nil, errCacheMiss
}

func (s *internalEmbeddingAnalysisRepoStub) FindByHashes(context.Context, []string, string) (map[string]*embeddingdomain.Cache, error) {
	return map[string]*embeddingdomain.Cache{}, nil
}

func (s *internalEmbeddingAnalysisRepoStub) Save(context.Context, *embeddingdomain.Cache) error {
	return nil
}

func (s *internalEmbeddingAnalysisRepoStub) SaveIfAbsent(context.Context, string, []float64, string) error {
	return nil
}

func (s *internalEmbeddingAnalysisRepoStub) SaveBatch(context.Context, []*embeddingdomain.Cache) error {
	return nil
}

func (s *internalEmbeddingAnalysisRepoStub) GetOrCreate(context.Context, string, []float64, string) (*embeddingdomain.Cache, error) {
	return &embeddingdomain.Cache{}, nil
}

func (s *internalEmbeddingAnalysisRepoStub) UpdateAccess(context.Context, int64) error {
	return nil
}

func (s *internalEmbeddingAnalysisRepoStub) Delete(context.Context, int64) error {
	return nil
}

func (s *internalEmbeddingAnalysisRepoStub) DeleteByHash(context.Context, string) error {
	return s.deleteByHashErr
}

func (s *internalEmbeddingAnalysisRepoStub) BatchDelete(context.Context, []int64) error {
	return s.batchDeleteErr
}

func (s *internalEmbeddingAnalysisRepoStub) FindExpiredCaches(context.Context, *embeddingdomain.CacheCleanupCriteria, int, int) ([]*embeddingdomain.Cache, error) {
	return []*embeddingdomain.Cache{}, nil
}

func (s *internalEmbeddingAnalysisRepoStub) CountExpiredCaches(context.Context, *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	return 0, nil
}

func (s *internalEmbeddingAnalysisRepoStub) CleanupExpiredCaches(ctx context.Context, _ *embeddingdomain.CacheCleanupCriteria) (int64, error) {
	s.cleanupCalls++
	if s.cleanupStarted != nil {
		s.cleanupStartOnce.Do(func() {
			close(s.cleanupStarted)
		})
	}
	if s.cleanupBlock != nil {
		select {
		case <-s.cleanupBlock:
		case <-ctx.Done():
			return 0, fmt.Errorf("cleanup blocked context done: %w", ctx.Err())
		}
	}
	if s.cleanupErr != nil {
		return 0, s.cleanupErr
	}
	return s.cleanupCount, nil
}

func (s *internalEmbeddingAnalysisRepoStub) GetCacheStatistics(context.Context) (*embeddingdomain.CacheStatistics, error) {
	if s.cleanupCalls == 0 {
		if s.getStatsErr != nil {
			return nil, s.getStatsErr
		}
		if s.beforeStats != nil {
			return s.beforeStats, nil
		}
		return &embeddingdomain.CacheStatistics{}, nil
	}
	if s.secondStatsErr != nil {
		return nil, s.secondStatsErr
	}
	if s.afterStats != nil {
		return s.afterStats, nil
	}
	return &embeddingdomain.CacheStatistics{}, nil
}

func TestEmbeddingCacheCleanupServiceManualCleanup(t *testing.T) {
	t.Parallel()

	repo := &internalEmbeddingAnalysisRepoStub{
		beforeStats:  &embeddingdomain.CacheStatistics{StorageSizeBytes: 8 * embeddingdomain.BytesPerMB},
		afterStats:   &embeddingdomain.CacheStatistics{StorageSizeBytes: 2 * embeddingdomain.BytesPerMB},
		cleanupCount: 3,
	}
	embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
	svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, &CleanupConfig{
		CleanupInterval:    time.Hour,
		CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
		AutoCleanupEnabled: true,
		CleanupTimeout:     time.Second,
	}, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
	if err != nil {
		t.Fatalf("new cleanup service: %v", err)
	}

	result, err := svc.ManualCleanup(context.Background(), nil)
	if err != nil {
		t.Fatalf("manual cleanup: %v", err)
	}
	if result.DeletedCount != 3 || result.BeforeStats == nil || result.AfterStats == nil {
		t.Fatalf("unexpected cleanup result: %#v", result)
	}
}

func TestEmbeddingCacheCleanupServiceManualCleanupErrorPaths(t *testing.T) {
	t.Parallel()

	t.Run("before stats error", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{getStatsErr: errStatsBoom}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, nil, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}
		if _, err := svc.ManualCleanup(context.Background(), nil); !errors.Is(err, errStatsBoom) {
			t.Fatalf("expected stats error, got %v", err)
		}
	})

	t.Run("cleanup error", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{
			beforeStats: &embeddingdomain.CacheStatistics{},
			cleanupErr:  errCleanupBoom,
		}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, nil, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}
		if _, err := svc.ManualCleanup(context.Background(), nil); !errors.Is(err, errCleanupBoom) {
			t.Fatalf("expected cleanup error, got %v", err)
		}
	})

	t.Run("after stats warning is tolerated", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{
			beforeStats:    &embeddingdomain.CacheStatistics{},
			secondStatsErr: errStatsBoom,
			cleanupCount:   1,
		}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, nil, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}
		result, err := svc.ManualCleanup(context.Background(), nil)
		if err != nil {
			t.Fatalf("manual cleanup should tolerate after stats error: %v", err)
		}
		if result.AfterStats != nil {
			t.Fatalf("expected nil after stats, got %#v", result.AfterStats)
		}
	})
}

func TestEmbeddingCacheCleanupServiceDaemonAndRetry(t *testing.T) {
	t.Parallel()

	t.Run("start daemon with cancelled context", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, &CleanupConfig{
			CleanupInterval:    time.Second,
			CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
			AutoCleanupEnabled: true,
			CleanupTimeout:     time.Millisecond,
		}, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if err := svc.StartCleanupDaemon(ctx); err != nil {
			t.Fatalf("start daemon: %v", err)
		}
	})

	t.Run("scheduled cleanup success", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{cleanupCount: 2}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, &CleanupConfig{
			CleanupInterval:    time.Second,
			CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
			AutoCleanupEnabled: false,
			CleanupTimeout:     time.Second,
		}, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}
		if err := svc.performScheduledCleanupWithRetry(context.Background()); err != nil {
			t.Fatalf("scheduled cleanup: %v", err)
		}
		if repo.cleanupCalls != 1 {
			t.Fatalf("expected one cleanup call, got %d", repo.cleanupCalls)
		}
		if err := svc.shutdown(context.Background()); err != nil {
			t.Fatalf("shutdown: %v", err)
		}
	})

	t.Run("scheduled cleanup cancelled during retry wait", func(t *testing.T) {
		t.Parallel()

		repo := &internalEmbeddingAnalysisRepoStub{cleanupErr: errCleanupBoom}
		embeddingDomain := embeddingdomain.NewDomainService(repo, repo, &internalEmbeddingRepoStub{}, logging.New())
		svc, err := NewEmbeddingCacheCleanupService(embeddingDomain, &CleanupConfig{
			CleanupInterval:    time.Second,
			CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
			AutoCleanupEnabled: false,
			CleanupTimeout:     time.Millisecond,
		}, lockpkg.NewLocalSinglePodJobRunner(), logging.New())
		if err != nil {
			t.Fatalf("new cleanup service: %v", err)
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if err := svc.performScheduledCleanupWithRetry(ctx); err == nil {
			t.Fatal("expected cancelled retry error")
		}
	})
}

func TestEmbeddingCacheCleanupServiceScheduledCleanupUsesSinglePodLock(t *testing.T) {
	t.Parallel()

	redisServer, redisClient := newCleanupTestRedis(t)
	defer redisServer.Close()

	lockManager := lockpkg.NewRedisLockManager(redisClient, &lockpkg.RedisConfig{
		LockPrefix:         "lock:",
		LockTTLSeconds:     1,
		SpinMaxRetries:     1,
		SpinIntervalMillis: 1,
	})

	release := make(chan struct{})
	repo1 := &internalEmbeddingAnalysisRepoStub{
		cleanupCount:   1,
		cleanupStarted: make(chan struct{}),
		cleanupBlock:   release,
	}
	repo2 := &internalEmbeddingAnalysisRepoStub{cleanupCount: 1}

	embeddingDomain1 := embeddingdomain.NewDomainService(repo1, repo1, &internalEmbeddingRepoStub{}, logging.New())
	embeddingDomain2 := embeddingdomain.NewDomainService(repo2, repo2, &internalEmbeddingRepoStub{}, logging.New())

	cfg := &CleanupConfig{
		CleanupInterval:    time.Second,
		CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
		AutoCleanupEnabled: false,
		CleanupTimeout:     time.Second,
	}

	svc1, err := NewEmbeddingCacheCleanupService(embeddingDomain1, cfg, lockpkg.NewRedisSinglePodJobRunner(lockManager), logging.New())
	if err != nil {
		t.Fatalf("new cleanup service 1: %v", err)
	}
	svc2, err := NewEmbeddingCacheCleanupService(embeddingDomain2, cfg, lockpkg.NewRedisSinglePodJobRunner(lockManager), logging.New())
	if err != nil {
		t.Fatalf("new cleanup service 2: %v", err)
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- svc1.runScheduledCleanup(context.Background())
	}()

	<-repo1.cleanupStarted

	if err := svc2.runScheduledCleanup(context.Background()); err != nil {
		t.Fatalf("second scheduled cleanup should skip without error: %v", err)
	}

	close(release)

	if err := <-errCh; err != nil {
		t.Fatalf("first scheduled cleanup failed: %v", err)
	}
	if repo1.cleanupCalls != 1 {
		t.Fatalf("expected first repo cleanup once, got %d", repo1.cleanupCalls)
	}
	if repo2.cleanupCalls != 0 {
		t.Fatalf("expected second repo cleanup to be skipped, got %d", repo2.cleanupCalls)
	}
}

func TestDomainServiceSatisfiesEmbeddingProvider(t *testing.T) {
	t.Parallel()

	repo := &internalEmbeddingAnalysisRepoStub{}
	embeddingRepo := &internalEmbeddingRepoStub{
		providers: []*embeddingdomain.Provider{{Name: "openai"}},
	}
	domain := embeddingdomain.NewDomainService(repo, repo, embeddingRepo, logging.New())

	single, err := domain.GetEmbeddingWithMeta(context.Background(), "hello", "m1", nil)
	if err != nil {
		t.Fatalf("get embedding: %v", err)
	}
	if len(single.Embedding) == 0 {
		t.Fatalf("unexpected single result: %#v", single)
	}

	batch, err := domain.GetEmbeddingsWithMeta(context.Background(), []string{"a"}, "m1", nil)
	if err != nil {
		t.Fatalf("get batch embeddings: %v", err)
	}
	if len(batch.Embeddings) != 1 {
		t.Fatalf("unexpected batch result: %#v", batch)
	}

	providers, err := domain.GetProviders(context.Background(), nil)
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if len(providers) != 1 || providers[0].Name != "openai" {
		t.Fatalf("unexpected providers: %#v", providers)
	}
}

func newCleanupTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: server.Addr(),
	})
	t.Cleanup(func() {
		_ = client.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis: %v", err)
	}

	return server, client
}
