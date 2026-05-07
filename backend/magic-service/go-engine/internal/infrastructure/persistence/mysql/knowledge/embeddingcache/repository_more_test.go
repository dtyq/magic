package embeddingcache_test

import (
	"context"
	"database/sql/driver"
	"errors"
	"math"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	mysqlerr "github.com/go-sql-driver/mysql"

	"magic/internal/domain/knowledge/embedding"
	embeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var (
	errPlainEmbeddingCache        = errors.New("plain")
	errUpdateAccessEmbeddingCache = errors.New("update access failed")
)

func TestSQLCCacheToEntityForTest(t *testing.T) {
	t.Parallel()

	row := sampleEmbeddingCacheSQLCRow(t)
	cache, err := embeddingcache.SQLCCacheToEntityForTest(row)
	if err != nil {
		t.Fatalf("SQLCCacheToEntityForTest returned error: %v", err)
	}
	if cache.TextHash != row.TextHash || len(cache.Embedding) != 2 || cache.VectorDimension != 2 {
		t.Fatalf("unexpected cache=%#v", cache)
	}

	row.Embedding = []byte("{")
	if _, err := embeddingcache.SQLCCacheToEntityForTest(row); err == nil {
		t.Fatal("expected invalid embedding json error")
	}
}

func TestBuildEmbeddingCacheInsertHelpersForTest(t *testing.T) {
	t.Parallel()

	cache := sampleEmbeddingCacheEntity()
	params, err := embeddingcache.BuildInsertEmbeddingCacheParamsForTest(cache)
	if err != nil {
		t.Fatalf("BuildInsertEmbeddingCacheParamsForTest returned error: %v", err)
	}
	if params.TextHash != cache.TextHash || params.VectorDimension != mustInt32EmbeddingCache(t, cache.VectorDimension) {
		t.Fatalf("unexpected params=%#v", params)
	}

	args, err := embeddingcache.BuildEmbeddingCacheInsertArgsForTest(cache)
	if err != nil {
		t.Fatalf("BuildEmbeddingCacheInsertArgsForTest returned error: %v", err)
	}
	if len(args) != 10 {
		t.Fatalf("unexpected flattened args length=%d", len(args))
	}
	if embeddingcache.BuildEmbeddingCacheInsertBatchSQLForTest(2) == "" {
		t.Fatal("expected non-empty batch sql")
	}

	cache.VectorDimension = math.MaxInt
	if _, err := embeddingcache.BuildInsertEmbeddingCacheParamsForTest(cache); err == nil {
		t.Fatal("expected vector_dimension overflow error")
	}
}

func TestEmbeddingCacheRepositoryGetOrCreateHelperForTest(t *testing.T) {
	t.Parallel()

	if !embeddingcache.IsDuplicateEntryErrorForTest(&mysqlerr.MySQLError{Number: 1062}) {
		t.Fatal("expected duplicate entry error to be recognized")
	}
	if embeddingcache.IsDuplicateEntryErrorForTest(errPlainEmbeddingCache) {
		t.Fatal("expected plain error not to be recognized as duplicate entry")
	}

	ctx := context.Background()
	existing := sampleEmbeddingCacheEntity()
	cache := sampleEmbeddingCacheEntity()

	got, err := embeddingcache.GetOrCreateCacheForTest(
		ctx,
		cache,
		cache.EmbeddingModel,
		func(context.Context, string, string) (*embedding.Cache, error) { return existing, nil },
		func(context.Context, *embedding.Cache) error { return nil },
	)
	if err != nil || got != existing {
		t.Fatalf("expected existing cache, got cache=%#v err=%v", got, err)
	}

	got, err = embeddingcache.GetOrCreateCacheForTest(
		ctx,
		cache,
		cache.EmbeddingModel,
		func(context.Context, string, string) (*embedding.Cache, error) {
			return nil, embeddingcache.ErrCacheNotFound
		},
		func(context.Context, *embedding.Cache) error { return nil },
	)
	if err != nil || got != cache {
		t.Fatalf("expected created cache, got cache=%#v err=%v", got, err)
	}

	got, err = embeddingcache.GetOrCreateCacheForTest(
		ctx,
		cache,
		cache.EmbeddingModel,
		func(context.Context, string, string) (*embedding.Cache, error) {
			return nil, embeddingcache.ErrCacheNotFound
		},
		func(context.Context, *embedding.Cache) error {
			return &mysqlerr.MySQLError{Number: 1062}
		},
	)
	if !errors.Is(err, embeddingcache.ErrCacheNotFound) || got != nil {
		t.Fatalf("expected duplicate fallback read error, got cache=%#v err=%v", got, err)
	}
}

func TestEmbeddingCacheRepositorySaveAndDeleteFlows(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	cache := sampleEmbeddingCacheEntity()

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)).
		WithArgs(
			cache.TextHash,
			cache.TextPreview,
			mustInt32EmbeddingCache(t, cache.TextLength),
			sqlmock.AnyArg(),
			cache.EmbeddingModel,
			mustInt32EmbeddingCache(t, cache.VectorDimension),
			mustInt32EmbeddingCache(t, cache.AccessCount),
			cache.LastAccessedAt,
			cache.CreatedAt,
			cache.UpdatedAt,
		).
		WillReturnResult(sqlmock.NewResult(101, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM embedding_cache WHERE id = ?`)).
		WithArgs(int64(101)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM embedding_cache WHERE text_hash = ?`)).
		WithArgs(cache.TextHash).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM embedding_cache WHERE id IN (?,?)`)).
		WithArgs(int64(101), int64(102)).
		WillReturnResult(sqlmock.NewResult(0, 2))

	if err := repo.Save(context.Background(), cache); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if cache.ID != 101 {
		t.Fatalf("expected inserted id 101, got %d", cache.ID)
	}
	if err := repo.Delete(context.Background(), 101); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if err := repo.DeleteByHash(context.Background(), cache.TextHash); err != nil {
		t.Fatalf("DeleteByHash returned error: %v", err)
	}
	if err := repo.BatchDelete(context.Background(), []int64{101, 102}); err != nil {
		t.Fatalf("BatchDelete returned error: %v", err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryFindByHashFlow(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	row := sampleEmbeddingCacheSQLCRow(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash = ?
  AND embedding_model = ?
LIMIT 1`)).
		WithArgs(row.TextHash, row.EmbeddingModel).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(sampleEmbeddingCacheRowValues(t)...))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?`)).
		WithArgs(row.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	cache, err := repo.FindByHash(context.Background(), row.TextHash, row.EmbeddingModel)
	if err != nil || cache == nil || cache.ID != row.ID {
		t.Fatalf("unexpected FindByHash cache=%#v err=%v", cache, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryFindByHashMissReturnsNotFound(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	row := sampleEmbeddingCacheSQLCRow(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash = ?
  AND embedding_model = ?
LIMIT 1`)).
		WithArgs(row.TextHash, row.EmbeddingModel).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()))

	cache, err := repo.FindByHash(context.Background(), row.TextHash, row.EmbeddingModel)
	if !errors.Is(err, embeddingcache.ErrCacheNotFound) || cache != nil {
		t.Fatalf("expected cache miss to return nil cache and ErrCacheNotFound, got cache=%#v err=%v", cache, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryFindByHashesFlow(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	row := sampleEmbeddingCacheSQLCRow(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash IN (?,?)
  AND embedding_model = ?`)).
		WithArgs(row.TextHash, "hash-2", row.EmbeddingModel).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(sampleEmbeddingCacheRowValues(t)...))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (?)`)).
		WithArgs(row.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	caches, err := repo.FindByHashes(context.Background(), []string{row.TextHash, row.TextHash, "hash-2"}, row.EmbeddingModel)
	if err != nil || len(caches) != 1 || caches[row.TextHash] == nil {
		t.Fatalf("unexpected FindByHashes caches=%#v err=%v", caches, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryFindByHashIgnoresAccessUpdateFailure(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	row := sampleEmbeddingCacheSQLCRow(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash = ?
  AND embedding_model = ?
LIMIT 1`)).
		WithArgs(row.TextHash, row.EmbeddingModel).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(sampleEmbeddingCacheRowValues(t)...))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?`)).
		WithArgs(row.ID).
		WillReturnError(errUpdateAccessEmbeddingCache)

	cache, err := repo.FindByHash(context.Background(), row.TextHash, row.EmbeddingModel)
	if err != nil || cache == nil || cache.ID != row.ID {
		t.Fatalf("unexpected FindByHash cache=%#v err=%v", cache, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryStatistics(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleEmbeddingCacheRowValues(t)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) AS total_caches,
       CAST(COALESCE(SUM(access_count), 0) AS SIGNED) AS total_access_count,
       CAST(COALESCE(AVG(access_count), 0) AS DOUBLE) AS average_access_count,
       COUNT(DISTINCT embedding_model) AS unique_models,
       COALESCE(CAST(MIN(created_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS oldest_cache,
       COALESCE(CAST(MAX(created_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS newest_cache,
       COALESCE(CAST(MAX(last_accessed_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS last_access_time
FROM embedding_cache`)).
		WillReturnRows(sqlmock.NewRows([]string{
			"total_caches", "total_access_count", "average_access_count", "unique_models",
			"oldest_cache", "newest_cache", "last_access_time",
		}).AddRow(int64(2), int64(5), 2.5, int64(1), rowValues[9], rowValues[9], rowValues[8]))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT embedding_model, COUNT(*) AS count
FROM embedding_cache
GROUP BY embedding_model`)).
		WillReturnRows(sqlmock.NewRows([]string{"embedding_model", "count"}).AddRow("text-embedding-3-small", int64(2)))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT CAST(COALESCE(SUM(LENGTH(embedding) + LENGTH(text_preview)), 0) AS SIGNED) AS storage_size
FROM embedding_cache`)).
		WillReturnRows(sqlmock.NewRows([]string{"storage_size"}).AddRow(int64(256)))

	stats, err := repo.GetCacheStatistics(context.Background())
	if err != nil || stats.TotalCaches != 2 || stats.CachesByModel["text-embedding-3-small"] != 2 {
		t.Fatalf("unexpected stats=%#v err=%v", stats, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryExpiredCacheFlows(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	criteria := &embedding.CacheCleanupCriteria{
		MaxIdleDuration: 24 * time.Hour,
		BatchSize:       1,
	}
	rowValues := sampleEmbeddingCacheRowValues(t)

	mock.ExpectQuery(regexp.QuoteMeta(`-- name: ListExpiredCachesByIdle :many`)).
		WithArgs(sqlmock.AnyArg(), int32(1), int32(0)).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(rowValues...))
	mock.ExpectQuery(regexp.QuoteMeta(`-- name: CountExpiredCachesByIdle :one`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	mock.ExpectQuery(regexp.QuoteMeta(`-- name: ListExpiredCacheIDsByIdle :many`)).
		WithArgs(sqlmock.AnyArg(), int32(1), int32(0)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM embedding_cache WHERE id IN (?)`)).
		WithArgs(int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta(`-- name: ListExpiredCacheIDsByIdle :many`)).
		WithArgs(sqlmock.AnyArg(), int32(1), int32(0)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	if caches, err := repo.FindExpiredCaches(context.Background(), criteria, 0, 1); err != nil || len(caches) != 1 {
		t.Fatalf("unexpected FindExpiredCaches caches=%#v err=%v", caches, err)
	}
	if count, err := repo.CountExpiredCaches(context.Background(), criteria); err != nil || count != 1 {
		t.Fatalf("unexpected CountExpiredCaches count=%d err=%v", count, err)
	}
	if deleted, err := repo.CleanupExpiredCaches(context.Background(), criteria); err != nil || deleted != 1 {
		t.Fatalf("unexpected CleanupExpiredCaches deleted=%d err=%v", deleted, err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

type embeddingCacheRepositoryTestContext struct {
	repo *embeddingcache.Repository
	mock sqlmock.Sqlmock
}

func newEmbeddingCacheRepositoryTestContext(t *testing.T) embeddingCacheRepositoryTestContext {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	repo := embeddingcache.NewRepositoryWithDBForTest(db, nil)
	t.Cleanup(func() {
		_ = repo.Close(context.Background())
		_ = db.Close()
	})

	return embeddingCacheRepositoryTestContext{
		repo: repo,
		mock: mock,
	}
}

func sampleEmbeddingCacheEntity() *embedding.Cache {
	now := time.Date(2026, 3, 11, 15, 0, 0, 0, time.Local)
	cache := embedding.NewEmbeddingCache("hello world", []float64{0.1, 0.2}, "text-embedding-3-small")
	cache.ID = 1
	cache.LastAccessedAt = now
	cache.CreatedAt = now
	cache.UpdatedAt = now
	return cache
}

func sampleEmbeddingCacheSQLCRow(t *testing.T) mysqlsqlc.EmbeddingCache {
	t.Helper()

	cache := sampleEmbeddingCacheEntity()
	embeddingJSON, err := cache.GetEmbeddingAsJSON()
	if err != nil {
		t.Fatalf("GetEmbeddingAsJSON returned error: %v", err)
	}
	return mysqlsqlc.EmbeddingCache{
		ID:              cache.ID,
		TextHash:        cache.TextHash,
		TextPreview:     cache.TextPreview,
		TextLength:      mustInt32EmbeddingCache(t, cache.TextLength),
		Embedding:       []byte(embeddingJSON),
		EmbeddingModel:  cache.EmbeddingModel,
		VectorDimension: mustInt32EmbeddingCache(t, cache.VectorDimension),
		AccessCount:     mustInt32EmbeddingCache(t, cache.AccessCount),
		LastAccessedAt:  cache.LastAccessedAt,
		CreatedAt:       cache.CreatedAt,
		UpdatedAt:       cache.UpdatedAt,
	}
}

func sampleEmbeddingCacheRowValues(t *testing.T) []driver.Value {
	t.Helper()

	row := sampleEmbeddingCacheSQLCRow(t)
	return []driver.Value{
		row.ID,
		row.TextHash,
		row.TextPreview,
		row.TextLength,
		row.Embedding,
		row.EmbeddingModel,
		row.VectorDimension,
		row.AccessCount,
		row.LastAccessedAt,
		row.CreatedAt,
		row.UpdatedAt,
	}
}

func embeddingCacheColumns() []string {
	return []string{
		"id",
		"text_hash",
		"text_preview",
		"text_length",
		"embedding",
		"embedding_model",
		"vector_dimension",
		"access_count",
		"last_accessed_at",
		"created_at",
		"updated_at",
	}
}

func assertEmbeddingCacheMockExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func mustInt32EmbeddingCache(t *testing.T, value int) int32 {
	t.Helper()

	converted, err := convert.SafeIntToInt32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToInt32 returned error: %v", err)
	}
	return converted
}
