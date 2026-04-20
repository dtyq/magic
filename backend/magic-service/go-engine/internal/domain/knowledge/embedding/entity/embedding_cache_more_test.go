package entity_test

import (
	"errors"
	"testing"
	"time"

	"magic/internal/domain/knowledge/embedding/entity"
)

func TestEmbeddingCacheLifecycleHelpers(t *testing.T) {
	t.Parallel()

	cache := entity.NewEmbeddingCache("hello", []float64{1, 2}, "m1")
	beforeAccess := cache.AccessCount
	beforeUpdatedAt := cache.UpdatedAt
	cache.LastAccessedAt = time.Now().Add(-2 * time.Hour)

	cache.IncrementAccess()

	if cache.AccessCount != beforeAccess+1 {
		t.Fatalf("expected access count incremented, got %d", cache.AccessCount)
	}
	if !cache.UpdatedAt.After(beforeUpdatedAt) {
		t.Fatalf("expected updated_at refreshed, before=%v after=%v", beforeUpdatedAt, cache.UpdatedAt)
	}
	cache.LastAccessedAt = time.Now().Add(-2 * time.Hour)
	if !cache.IsExpired(time.Hour) {
		t.Fatal("expected cache to be expired")
	}
	if cache.IsExpired(24 * time.Hour) {
		t.Fatal("expected cache not to be expired")
	}
}

func TestEmbeddingCacheJSONHelpers(t *testing.T) {
	t.Parallel()

	cache := &entity.EmbeddingCache{Embedding: []float64{1, 2.5}}
	data, err := cache.GetEmbeddingAsJSON()
	if err != nil {
		t.Fatalf("marshal embedding: %v", err)
	}
	if data != "[1,2.5]" {
		t.Fatalf("unexpected embedding json: %s", data)
	}

	cache = &entity.EmbeddingCache{}
	if err := cache.SetEmbeddingFromJSON(`[3,4]`); err != nil {
		t.Fatalf("set embedding from json: %v", err)
	}
	if len(cache.Embedding) != 2 || cache.VectorDimension != 2 {
		t.Fatalf("unexpected cache after set: %#v", cache)
	}
}

func TestEmbeddingCacheSetEmbeddingFromJSONError(t *testing.T) {
	t.Parallel()

	cache := &entity.EmbeddingCache{}
	err := cache.SetEmbeddingFromJSON(`{`)
	if err == nil || !errors.Is(err, err) {
		t.Fatalf("expected unmarshal error, got %v", err)
	}
}

func TestEmbeddingCacheValidate(t *testing.T) {
	t.Parallel()

	valid := entity.NewEmbeddingCache("hello", []float64{1, 2}, "m1")
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid cache, got %v", err)
	}

	testCases := []struct {
		name  string
		cache *entity.EmbeddingCache
		want  error
	}{
		{"empty_hash", &entity.EmbeddingCache{TextLength: 1, Embedding: []float64{1}, VectorDimension: 1, EmbeddingModel: "m1"}, entity.ErrTextHashEmpty},
		{"invalid_hash_length", &entity.EmbeddingCache{TextHash: "short", TextLength: 1, Embedding: []float64{1}, VectorDimension: 1, EmbeddingModel: "m1"}, entity.ErrTextHashInvalidLength},
		{"invalid_text_length", &entity.EmbeddingCache{TextHash: valid.TextHash, TextLength: 0, Embedding: []float64{1}, VectorDimension: 1, EmbeddingModel: "m1"}, entity.ErrTextLengthInvalid},
		{"empty_embedding", &entity.EmbeddingCache{TextHash: valid.TextHash, TextLength: 1, VectorDimension: 1, EmbeddingModel: "m1"}, entity.ErrEmbeddingEmpty},
		{"dimension_mismatch", &entity.EmbeddingCache{TextHash: valid.TextHash, TextLength: 1, Embedding: []float64{1}, VectorDimension: 2, EmbeddingModel: "m1"}, entity.ErrVectorDimensionMismatch},
		{"empty_model", &entity.EmbeddingCache{TextHash: valid.TextHash, TextLength: 1, Embedding: []float64{1}, VectorDimension: 1}, entity.ErrEmbeddingModelEmpty},
		{"negative_access_count", &entity.EmbeddingCache{TextHash: valid.TextHash, TextLength: 1, Embedding: []float64{1}, VectorDimension: 1, EmbeddingModel: "m1", AccessCount: -1}, entity.ErrAccessCountInvalid},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.cache.Validate(); !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}
}

func TestDefaultCleanupCriteriaAndShouldCleanup(t *testing.T) {
	t.Parallel()

	criteria := entity.DefaultCleanupCriteria()
	if criteria.MinAccessCount != entity.DefaultMinAccessCount || criteria.BatchSize != entity.DefaultBatchSize {
		t.Fatalf("unexpected default criteria: %#v", criteria)
	}

	now := time.Now()
	cache := &entity.EmbeddingCache{
		AccessCount:    1,
		LastAccessedAt: now,
		CreatedAt:      now,
	}
	if !cache.ShouldCleanup(criteria) {
		t.Fatal("expected low access count to trigger cleanup")
	}

	cache.AccessCount = 5
	cache.LastAccessedAt = now.Add(-criteria.MaxIdleDuration - time.Hour)
	if !cache.ShouldCleanup(criteria) {
		t.Fatal("expected idle duration to trigger cleanup")
	}

	cache.LastAccessedAt = now
	cache.CreatedAt = now.Add(-criteria.MaxCacheAge - time.Hour)
	if !cache.ShouldCleanup(criteria) {
		t.Fatal("expected cache age to trigger cleanup")
	}

	cache.CreatedAt = now
	if cache.ShouldCleanup(criteria) {
		t.Fatal("expected fresh active cache not to cleanup")
	}
}

func TestEmbeddingCacheOrderByIsValid(t *testing.T) {
	t.Parallel()

	validOrders := []entity.EmbeddingCacheOrderBy{
		entity.EmbeddingCacheOrderByID,
		entity.EmbeddingCacheOrderByCreatedAt,
		entity.EmbeddingCacheOrderByUpdatedAt,
		entity.EmbeddingCacheOrderByLastAccessedAt,
		entity.EmbeddingCacheOrderByAccessCount,
		entity.EmbeddingCacheOrderByTextLength,
		entity.EmbeddingCacheOrderByVectorDimension,
	}
	for _, order := range validOrders {
		if !order.IsValid() {
			t.Fatalf("expected %q valid", order)
		}
	}
	if entity.EmbeddingCacheOrderBy("other").IsValid() {
		t.Fatal("expected unknown order invalid")
	}
}
