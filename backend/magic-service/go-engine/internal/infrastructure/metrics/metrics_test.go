package appmetrics_test

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	metrics "magic/internal/infrastructure/metrics"
)

func mustInt64(t *testing.T, v any, name string) int64 {
	t.Helper()
	value, ok := v.(int64)
	if !ok {
		t.Fatalf("unexpected type for %s", name)
	}
	return value
}

func mustFloat64(t *testing.T, v any, name string) float64 {
	t.Helper()
	value, ok := v.(float64)
	if !ok {
		t.Fatalf("unexpected type for %s", name)
	}
	return value
}

func mustMapStringInt64(t *testing.T, v any, name string) map[string]int64 {
	t.Helper()
	value, ok := v.(map[string]int64)
	if !ok {
		t.Fatalf("unexpected type for %s", name)
	}
	return value
}

func TestMetrics_RecordAndSnapshot(t *testing.T) {
	t.Parallel()
	m := metrics.NewMetrics()
	m.RecordHTTPRequest("GET", "/path", 200, 150*time.Millisecond)
	m.RecordHTTPRequest("GET", "/path", 200, 50*time.Millisecond)
	m.RecordCacheHit()
	m.RecordCacheMiss()
	m.RecordEmbeddingCompute(200 * time.Millisecond)
	m.RecordEmbeddingCompute(100 * time.Millisecond)

	snap := m.GetSnapshot()
	reqTotal := mustMapStringInt64(t, snap["http_requests_total"], "http_requests_total")
	key := "GET:/path:200"
	if reqTotal[key] != 2 {
		t.Fatalf("expected 2 requests, got %d", reqTotal[key])
	}
	if mustInt64(t, snap["embedding_cache_hits"], "embedding_cache_hits") != 1 {
		t.Fatalf("expected 1 cache hit")
	}
	if mustInt64(t, snap["embedding_cache_misses"], "embedding_cache_misses") != 1 {
		t.Fatalf("expected 1 cache miss")
	}
	hitRate := mustFloat64(t, snap["embedding_cache_hit_rate"], "embedding_cache_hit_rate")
	if math.Abs(hitRate-50.0) > 0.01 {
		t.Fatalf("expected hit rate 50, got %v", hitRate)
	}
	avg := mustFloat64(t, snap["embedding_avg_compute_ms"], "embedding_avg_compute_ms")
	if math.Abs(avg-150.0) > 0.01 {
		t.Fatalf("expected avg 150, got %v", avg)
	}
}

func TestMetrics_Handler(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	m := metrics.NewMetrics()
	r := gin.New()
	r.GET("/metrics", m.Handler())

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/metrics", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if _, ok := payload["http_requests_total"]; !ok {
		t.Fatalf("expected http_requests_total")
	}
}

func TestMetrics_Middleware(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	m := metrics.NewMetrics()
	r := gin.New()
	r.Use(m.Middleware())
	r.GET("/ping", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	snap := m.GetSnapshot()
	reqTotal := mustMapStringInt64(t, snap["http_requests_total"], "http_requests_total")
	if reqTotal["GET:/ping:200"] != 1 {
		t.Fatalf("expected recorded request")
	}
}

func TestMetrics_RecordFragmentTermStatsWriteEvents(t *testing.T) {
	t.Parallel()
	m := metrics.NewMetrics()
	m.RecordFragmentTermStatsRetry(metrics.FragmentTermStatsRetryLabels{
		Operation:      "replace_point_terms",
		KnowledgeCode:  "kb",
		CollectionName: "collection",
		DocumentCode:   "doc",
		MySQLCode:      1213,
		Stage:          "delete_point_terms_before_replace",
		ContentionHint: "same_target_candidate",
		TargetScope:    "point",
	})
	m.RecordFragmentTermStatsResult(metrics.FragmentTermStatsResultLabels{
		Operation:      "replace_point_terms",
		KnowledgeCode:  "kb",
		CollectionName: "collection",
		DocumentCode:   "doc",
		MySQLCode:      0,
		Stage:          "completed",
		ContentionHint: "none",
		TargetScope:    "point",
		Result:         "success",
	})

	snap := m.GetSnapshot()
	retries := mustMapStringInt64(t, snap["fragment_term_stats_retries_total"], "fragment_term_stats_retries_total")
	results := mustMapStringInt64(t, snap["fragment_term_stats_results_total"], "fragment_term_stats_results_total")

	retryKey := "operation=replace_point_terms,knowledge_code=kb,collection_name=collection,document_code=doc,mysql_code=1213,stage=delete_point_terms_before_replace,contention_hint=same_target_candidate,target_scope=point"
	resultKey := "operation=replace_point_terms,knowledge_code=kb,collection_name=collection,document_code=doc,mysql_code=0,stage=completed,contention_hint=none,target_scope=point,result=success"

	if retries[retryKey] != 1 {
		t.Fatalf("expected one retry metric, got %d", retries[retryKey])
	}
	if results[resultKey] != 1 {
		t.Fatalf("expected one success metric, got %d", results[resultKey])
	}
}
