// Package dto 定义 embedding application 子域对外暴露的 DTO。
package dto

import "magic/internal/pkg/ctxmeta"

// ComputeEmbeddingInput 表示单文本 embedding 计算请求。
type ComputeEmbeddingInput struct {
	Text           string
	Model          string
	BusinessParams *ctxmeta.BusinessParams
}

// ComputeEmbeddingOutput 表示单文本 embedding 计算结果。
type ComputeEmbeddingOutput struct {
	Embedding []float64 `json:"embedding"`
	CacheHit  bool      `json:"cache_hit"`
}

// ComputeBatchEmbeddingInput 表示批量 embedding 计算请求。
type ComputeBatchEmbeddingInput struct {
	Texts          []string
	Model          string
	BusinessParams *ctxmeta.BusinessParams
}

// ComputeBatchEmbeddingOutput 表示批量 embedding 计算结果。
type ComputeBatchEmbeddingOutput struct {
	Embeddings [][]float64 `json:"embeddings"`
	CacheStats CacheStats  `json:"cache_stats"`
}

// CacheStats 表示批量计算中的缓存命中统计。
type CacheStats struct {
	Total    int `json:"total"`
	CacheHit int `json:"cache_hit"`
}
