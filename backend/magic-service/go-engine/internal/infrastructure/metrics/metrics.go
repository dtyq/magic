// Package appmetrics 提供 Prometheus 指标暴露
package appmetrics

import (
	"maps"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Metrics 管理 Prometheus 指标
type Metrics struct {
	mu sync.RWMutex

	// HTTP 请求指标
	httpRequestsTotal   map[string]int64   // method:path:status -> 计数
	httpRequestDuration map[string]float64 // method:path -> 总耗时（毫秒）
	httpRequestCount    map[string]int64   // method:path -> 计数（用于平均值计算）

	// 业务指标
	embeddingCacheHits            int64
	embeddingCacheMisses          int64
	embeddingComputeTime          float64
	embeddingComputeCount         int64
	fragmentTermStatsRetriesTotal map[string]int64 // 维度键 -> 重试次数
	fragmentTermStatsResultsTotal map[string]int64 // 维度键 -> 最终结果次数
}

// NewMetrics 创建指标收集器
func NewMetrics() *Metrics {
	return &Metrics{
		httpRequestsTotal:             make(map[string]int64),
		httpRequestDuration:           make(map[string]float64),
		httpRequestCount:              make(map[string]int64),
		fragmentTermStatsRetriesTotal: make(map[string]int64),
		fragmentTermStatsResultsTotal: make(map[string]int64),
	}
}

// RecordHTTPRequest 记录 HTTP 请求
func (m *Metrics) RecordHTTPRequest(method, path string, status int, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := method + ":" + path + ":" + strconv.Itoa(status)
	m.httpRequestsTotal[key]++

	durationKey := method + ":" + path
	m.httpRequestDuration[durationKey] += float64(duration.Milliseconds())
	m.httpRequestCount[durationKey]++
}

// RecordCacheHit 记录缓存命中
func (m *Metrics) RecordCacheHit() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.embeddingCacheHits++
}

// RecordCacheMiss 记录缓存未命中
func (m *Metrics) RecordCacheMiss() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.embeddingCacheMisses++
}

// RecordEmbeddingCompute 记录 embedding 计算时间
func (m *Metrics) RecordEmbeddingCompute(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.embeddingComputeTime += float64(duration.Milliseconds())
	m.embeddingComputeCount++
}

// FragmentTermStatsRetryLabels 描述词项统计写入重试事件的维度。
type FragmentTermStatsRetryLabels struct {
	Operation      string
	KnowledgeCode  string
	CollectionName string
	DocumentCode   string
	MySQLCode      int
	Stage          string
	ContentionHint string
	TargetScope    string
}

// FragmentTermStatsResultLabels 描述词项统计写入最终结果的维度。
type FragmentTermStatsResultLabels struct {
	Operation      string
	KnowledgeCode  string
	CollectionName string
	DocumentCode   string
	MySQLCode      int
	Stage          string
	ContentionHint string
	TargetScope    string
	Result         string
}

// RecordFragmentTermStatsRetry 记录词项统计写入重试事件。
func (m *Metrics) RecordFragmentTermStatsRetry(labels FragmentTermStatsRetryLabels) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.fragmentTermStatsRetriesTotal[buildFragmentTermStatsRetryKey(labels)]++
}

// RecordFragmentTermStatsResult 记录词项统计写入最终结果。
func (m *Metrics) RecordFragmentTermStatsResult(labels FragmentTermStatsResultLabels) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.fragmentTermStatsResultsTotal[buildFragmentTermStatsResultKey(labels)]++
}

// GetSnapshot 获取指标快照
func (m *Metrics) GetSnapshot() map[string]any {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 计算缓存命中率
	totalCacheRequests := m.embeddingCacheHits + m.embeddingCacheMisses
	var cacheHitRate float64
	if totalCacheRequests > 0 {
		cacheHitRate = float64(m.embeddingCacheHits) / float64(totalCacheRequests) * 100
	}

	// 计算平均 embedding 计算时间
	var avgEmbeddingTime float64
	if m.embeddingComputeCount > 0 {
		avgEmbeddingTime = m.embeddingComputeTime / float64(m.embeddingComputeCount)
	}

	return map[string]any{
		"http_requests_total":               m.httpRequestsTotal,
		"embedding_cache_hits":              m.embeddingCacheHits,
		"embedding_cache_misses":            m.embeddingCacheMisses,
		"embedding_cache_hit_rate":          cacheHitRate,
		"embedding_avg_compute_ms":          avgEmbeddingTime,
		"fragment_term_stats_retries_total": cloneInt64Map(m.fragmentTermStatsRetriesTotal),
		"fragment_term_stats_results_total": cloneInt64Map(m.fragmentTermStatsResultsTotal),
	}
}

// Handler 返回 Gin 处理函数
func (m *Metrics) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, m.GetSnapshot())
	}
}

// Middleware 返回用于记录请求指标的中间件
func (m *Metrics) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// 处理请求
		c.Next()

		// 记录指标
		duration := time.Since(start)
		m.RecordHTTPRequest(c.Request.Method, c.FullPath(), c.Writer.Status(), duration)
	}
}

func buildFragmentTermStatsRetryKey(labels FragmentTermStatsRetryLabels) string {
	return "operation=" + labels.Operation +
		",knowledge_code=" + labels.KnowledgeCode +
		",collection_name=" + labels.CollectionName +
		",document_code=" + labels.DocumentCode +
		",mysql_code=" + strconv.Itoa(labels.MySQLCode) +
		",stage=" + labels.Stage +
		",contention_hint=" + labels.ContentionHint +
		",target_scope=" + labels.TargetScope
}

func buildFragmentTermStatsResultKey(labels FragmentTermStatsResultLabels) string {
	return "operation=" + labels.Operation +
		",knowledge_code=" + labels.KnowledgeCode +
		",collection_name=" + labels.CollectionName +
		",document_code=" + labels.DocumentCode +
		",mysql_code=" + strconv.Itoa(labels.MySQLCode) +
		",stage=" + labels.Stage +
		",contention_hint=" + labels.ContentionHint +
		",target_scope=" + labels.TargetScope +
		",result=" + labels.Result
}

func cloneInt64Map(src map[string]int64) map[string]int64 {
	dst := make(map[string]int64, len(src))
	maps.Copy(dst, src)
	return dst
}
