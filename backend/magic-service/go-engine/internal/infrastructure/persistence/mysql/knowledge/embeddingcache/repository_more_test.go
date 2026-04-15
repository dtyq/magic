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
	sq "github.com/Masterminds/squirrel"
	mysqlerr "github.com/go-sql-driver/mysql"

	"magic/internal/domain/knowledge/embedding"
	embeddingcache "magic/internal/infrastructure/persistence/mysql/knowledge/embeddingcache"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

var errPlainEmbeddingCache = errors.New("plain")

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

func TestEmbeddingCacheRepositoryQueryHelpersForTest(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 11, 15, 0, 0, 0, time.Local)
	minAccess := 1
	maxAccess := 8
	minTextLength := 10
	maxTextLength := 50
	vectorDimension := 2
	query := &embedding.CacheQuery{
		Model:           "text-embedding-3-small",
		MinAccessCount:  &minAccess,
		MaxAccessCount:  &maxAccess,
		CreatedAfter:    &now,
		CreatedBefore:   &now,
		AccessedAfter:   &now,
		AccessedBefore:  &now,
		MinTextLength:   &minTextLength,
		MaxTextLength:   &maxTextLength,
		VectorDimension: &vectorDimension,
		OrderBy:         embedding.EmbeddingCacheOrderByAccessCount,
		OrderDirection:  embedding.SortAsc,
	}
	if got := len(testBuildEmbeddingCacheSearchConditions(query)); got != 10 {
		t.Fatalf("unexpected condition count=%d", got)
	}
	if got := embeddingcache.BuildOrderByForTest(query); got != "access_count ASC" {
		t.Fatalf("unexpected order by=%q", got)
	}
	if got := embeddingcache.BuildOrderByForTest(&embedding.CacheQuery{}); got != "id DESC" {
		t.Fatalf("unexpected default order by=%q", got)
	}
	if got := embeddingcache.BuildOrderByForTest(&embedding.CacheQuery{
		OrderBy:        embedding.CacheOrderBy("drop table embedding_cache"),
		OrderDirection: embedding.SortDirection("sideways"),
	}); got != "id DESC" {
		t.Fatalf("unexpected fallback order by=%q", got)
	}

	sqlStr, args, hasConditions, err := embeddingcache.BuildFindExpiredCacheIDsQueryForTest(&embedding.CacheCleanupCriteria{}, now, 0, 10)
	if err != nil || hasConditions || sqlStr != "" || len(args) != 0 {
		t.Fatalf("unexpected empty query sql=%q args=%v hasConditions=%v err=%v", sqlStr, args, hasConditions, err)
	}

	criteria := &embedding.CacheCleanupCriteria{
		MinAccessCount:  2,
		MaxIdleDuration: 24 * time.Hour,
		MaxCacheAge:     48 * time.Hour,
	}
	sqlStr, args, hasConditions, err = embeddingcache.BuildFindExpiredCacheIDsQueryForTest(criteria, now, 1, 5)
	if err != nil || !hasConditions || sqlStr == "" || len(args) != 3 {
		t.Fatalf("unexpected built query sql=%q args=%v hasConditions=%v err=%v", sqlStr, args, hasConditions, err)
	}
	if _, _, _, err := embeddingcache.BuildFindExpiredCacheIDsQueryForTest(criteria, now, 0, -1); err == nil {
		t.Fatal("expected invalid limit error")
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
	if err == nil || got != nil {
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
	if err := repo.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
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
WHERE id = ?`)).
		WithArgs(row.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	caches, err := repo.FindByHashes(context.Background(), []string{row.TextHash, row.TextHash, "hash-2"}, row.EmbeddingModel)
	if err != nil || len(caches) != 1 || caches[row.TextHash] == nil {
		t.Fatalf("unexpected FindByHashes caches=%#v err=%v", caches, err)
	}
	if err := repo.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}

	assertEmbeddingCacheMockExpectations(t, mock)
}

func TestEmbeddingCacheRepositoryStatisticsAndSearch(t *testing.T) {
	t.Parallel()

	testCtx := newEmbeddingCacheRepositoryTestContext(t)
	repo, mock := testCtx.repo, testCtx.mock
	rowValues := sampleEmbeddingCacheRowValues(t)
	query := sampleEmbeddingCacheQuery()
	countSQL, countArgs, dataSQL, dataArgs := buildEmbeddingCacheSearchQueries(t, query)

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
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE embedding_model = ?
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?`)).
		WithArgs("text-embedding-3-small", mustInt32EmbeddingCache(t, 10), mustInt32EmbeddingCache(t, 0)).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(rowValues...))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM embedding_cache WHERE embedding_model = ?`)).
		WithArgs("text-embedding-3-small").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
ORDER BY last_accessed_at ASC, access_count ASC
LIMIT ?`)).
		WithArgs(mustInt32EmbeddingCache(t, 1)).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(rowValues...))
	expectEmbeddingCacheQuery(mock, countSQL, countArgs, sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	expectEmbeddingCacheQuery(mock, dataSQL, dataArgs, sqlmock.NewRows(embeddingCacheColumns()).AddRow(rowValues...))

	stats, err := repo.GetCacheStatistics(context.Background())
	if err != nil || stats.TotalCaches != 2 || stats.CachesByModel["text-embedding-3-small"] != 2 {
		t.Fatalf("unexpected stats=%#v err=%v", stats, err)
	}
	if caches, err := repo.GetCachesByModel(context.Background(), "text-embedding-3-small", 0, 10); err != nil || len(caches) != 1 {
		t.Fatalf("unexpected GetCachesByModel caches=%#v err=%v", caches, err)
	}
	if count, err := repo.CountByModel(context.Background(), "text-embedding-3-small"); err != nil || count != 1 {
		t.Fatalf("unexpected CountByModel count=%d err=%v", count, err)
	}
	if caches, err := repo.GetLeastAccessed(context.Background(), 1); err != nil || len(caches) != 1 {
		t.Fatalf("unexpected GetLeastAccessed caches=%#v err=%v", caches, err)
	}
	if caches, total, err := repo.SearchCaches(context.Background(), query); err != nil || total != 1 || len(caches) != 1 {
		t.Fatalf("unexpected SearchCaches caches=%#v total=%d err=%v", caches, total, err)
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
	expiredSQL := `SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE (last_accessed_at < ?)
ORDER BY last_accessed_at ASC, access_count ASC
LIMIT 1 OFFSET 0`
	countExpiredSQL := `SELECT COUNT(*)
FROM embedding_cache
WHERE (last_accessed_at < ?)`
	findExpiredIDsSQL, _, _, err := embeddingcache.BuildFindExpiredCacheIDsQueryForTest(
		criteria,
		time.Date(2026, 3, 11, 15, 0, 0, 0, time.Local),
		0,
		1,
	)
	if err != nil {
		t.Fatalf("buildFindExpiredCacheIDsQuery returned error: %v", err)
	}

	mock.ExpectQuery(regexp.QuoteMeta(expiredSQL)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(embeddingCacheColumns()).AddRow(rowValues...))
	mock.ExpectQuery(regexp.QuoteMeta(countExpiredSQL)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	mock.ExpectQuery(regexp.QuoteMeta(findExpiredIDsSQL)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM embedding_cache WHERE id IN (?)`)).
		WithArgs(int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta(findExpiredIDsSQL)).
		WithArgs(sqlmock.AnyArg()).
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

func sampleEmbeddingCacheQuery() *embedding.CacheQuery {
	now := time.Date(2026, 3, 11, 15, 0, 0, 0, time.Local)
	minAccess := 1
	minTextLength := 5
	vectorDimension := 2
	return &embedding.CacheQuery{
		Model:           "text-embedding-3-small",
		MinAccessCount:  &minAccess,
		CreatedAfter:    &now,
		MinTextLength:   &minTextLength,
		VectorDimension: &vectorDimension,
		OrderBy:         embedding.EmbeddingCacheOrderByAccessCount,
		OrderDirection:  embedding.SortAsc,
		Offset:          0,
		Limit:           10,
	}
}

func buildEmbeddingCacheSearchQueries(t *testing.T, query *embedding.CacheQuery) (string, []any, string, []any) {
	t.Helper()

	conds := testBuildEmbeddingCacheSearchConditions(query)

	countBuilder := sq.Select("COUNT(*)").
		From("embedding_cache").
		PlaceholderFormat(sq.Question)
	if len(conds) > 0 {
		countBuilder = countBuilder.Where(conds)
	}
	countSQL, countArgs, err := countBuilder.ToSql()
	if err != nil {
		t.Fatalf("countBuilder.ToSql returned error: %v", err)
	}

	limitU64, err := convert.SafeIntToUint64(query.Limit, "limit")
	if err != nil {
		t.Fatalf("SafeIntToUint64 limit returned error: %v", err)
	}
	offsetU64, err := convert.SafeIntToUint64(query.Offset, "offset")
	if err != nil {
		t.Fatalf("SafeIntToUint64 offset returned error: %v", err)
	}

	dataBuilder := sq.Select(
		"id", "text_hash", "text_preview", "text_length", "embedding", "embedding_model",
		"vector_dimension", "access_count", "last_accessed_at", "created_at", "updated_at",
	).
		From("embedding_cache").
		OrderBy(embeddingcache.BuildOrderByForTest(query)).
		Limit(limitU64).
		Offset(offsetU64).
		PlaceholderFormat(sq.Question)
	if len(conds) > 0 {
		dataBuilder = dataBuilder.Where(conds)
	}
	dataSQL, dataArgs, err := dataBuilder.ToSql()
	if err != nil {
		t.Fatalf("dataBuilder.ToSql returned error: %v", err)
	}

	return countSQL, countArgs, dataSQL, dataArgs
}

func testBuildEmbeddingCacheSearchConditions(query *embedding.CacheQuery) sq.And {
	conds := sq.And{}

	if query.Model != "" {
		conds = append(conds, sq.Eq{"embedding_model": query.Model})
	}
	if query.MinAccessCount != nil {
		conds = append(conds, sq.GtOrEq{"access_count": *query.MinAccessCount})
	}
	if query.MaxAccessCount != nil {
		conds = append(conds, sq.LtOrEq{"access_count": *query.MaxAccessCount})
	}
	if query.CreatedAfter != nil {
		conds = append(conds, sq.GtOrEq{"created_at": *query.CreatedAfter})
	}
	if query.CreatedBefore != nil {
		conds = append(conds, sq.LtOrEq{"created_at": *query.CreatedBefore})
	}
	if query.AccessedAfter != nil {
		conds = append(conds, sq.GtOrEq{"last_accessed_at": *query.AccessedAfter})
	}
	if query.AccessedBefore != nil {
		conds = append(conds, sq.LtOrEq{"last_accessed_at": *query.AccessedBefore})
	}
	if query.MinTextLength != nil {
		conds = append(conds, sq.GtOrEq{"text_length": *query.MinTextLength})
	}
	if query.MaxTextLength != nil {
		conds = append(conds, sq.LtOrEq{"text_length": *query.MaxTextLength})
	}
	if query.VectorDimension != nil {
		conds = append(conds, sq.Eq{"vector_dimension": *query.VectorDimension})
	}

	return conds
}

func expectEmbeddingCacheQuery(mock sqlmock.Sqlmock, sqlStr string, args []any, rows *sqlmock.Rows) {
	driverArgs := make([]driver.Value, 0, len(args))
	for _, arg := range args {
		driverArgs = append(driverArgs, arg)
	}
	mock.ExpectQuery(regexp.QuoteMeta(sqlStr)).
		WithArgs(driverArgs...).
		WillReturnRows(rows)
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
