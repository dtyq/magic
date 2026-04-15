package embeddingcache

import (
	"context"
	"strings"
	"testing"
	"time"

	mysqlerr "github.com/go-sql-driver/mysql"

	"magic/internal/domain/knowledge/embedding"
)

func TestGetOrCreateCache_DuplicateInsertFallsBackToRead(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	model := "test-model"
	cache := embedding.NewEmbeddingCache("hello", []float64{1, 2, 3}, model)
	existing := embedding.NewEmbeddingCache("hello", []float64{1, 2, 3}, model)

	findCalls := 0
	got, err := getOrCreateCache(
		ctx,
		cache,
		model,
		func(_ context.Context, _, _ string) (*embedding.Cache, error) {
			findCalls++
			if findCalls == 1 {
				return nil, ErrCacheNotFound
			}
			return existing, nil
		},
		func(context.Context, *embedding.Cache) error {
			return &mysqlerr.MySQLError{Number: mysqlDuplicateEntryErrorNumber, Message: "Duplicate entry"}
		},
	)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got != existing {
		t.Fatal("expected duplicate path to return existing cache")
	}
	if findCalls != 2 {
		t.Fatalf("expected 2 find calls, got %d", findCalls)
	}
}

func TestGetOrCreateCache_SaveNonDuplicateError(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	model := "test-model"
	cache := embedding.NewEmbeddingCache("hello", []float64{1, 2, 3}, model)

	_, err := getOrCreateCache(
		ctx,
		cache,
		model,
		func(_ context.Context, _, _ string) (*embedding.Cache, error) { return nil, ErrCacheNotFound },
		func(context.Context, *embedding.Cache) error { return context.Canceled },
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to create new cache") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildFindExpiredCacheIDsQuery_SelectsIDOnly(t *testing.T) {
	t.Parallel()

	criteria := &embedding.CacheCleanupCriteria{
		MinAccessCount:  2,
		MaxIdleDuration: 24 * time.Hour,
		MaxCacheAge:     7 * 24 * time.Hour,
	}

	sqlStr, args, hasConditions, err := buildFindExpiredCacheIDsQuery(criteria, time.Date(2026, 3, 9, 12, 0, 0, 0, time.UTC), 0, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !hasConditions {
		t.Fatal("expected hasConditions=true")
	}

	normalizedSQL := strings.ToLower(strings.Join(strings.Fields(sqlStr), " "))
	if !strings.Contains(normalizedSQL, "select id from embedding_cache") {
		t.Fatalf("unexpected sql: %s", sqlStr)
	}
	if strings.Contains(normalizedSQL, " embedding ") {
		t.Fatalf("query should not include embedding column: %s", sqlStr)
	}
	if !strings.Contains(normalizedSQL, "order by last_accessed_at asc, access_count asc, id asc") {
		t.Fatalf("missing stable order by: %s", sqlStr)
	}
	if len(args) == 0 {
		t.Fatal("expected non-empty args")
	}
}
