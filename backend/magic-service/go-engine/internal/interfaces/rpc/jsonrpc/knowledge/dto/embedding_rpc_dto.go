package dto

// 嵌入相关 DTO

// ComputeEmbeddingRequest 计算嵌入请求
type ComputeEmbeddingRequest struct {
	Text           string         `json:"text" validate:"required"`
	Model          string         `json:"model"`
	BusinessParams BusinessParams `json:"business_params"`
}

// ComputeEmbeddingResponse 计算嵌入响应
type ComputeEmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
	CacheHit  bool      `json:"cache_hit"`
}

// ComputeBatchEmbeddingRequest 批量计算嵌入请求
type ComputeBatchEmbeddingRequest struct {
	Texts          []string       `json:"texts"`
	Model          string         `json:"model"`
	BusinessParams BusinessParams `json:"business_params"`
}

// ComputeBatchEmbeddingResponse 批量计算嵌入响应
type ComputeBatchEmbeddingResponse struct {
	Embeddings [][]float64 `json:"embeddings"`
	CacheStats CacheStats  `json:"cache_stats"`
}

// CacheStats 缓存统计
type CacheStats struct {
	Total    int `json:"total"`
	CacheHit int `json:"cache_hit"`
}

// ListEmbeddingProvidersRequest 获取 Embedding Providers 请求
type ListEmbeddingProvidersRequest struct {
	BusinessParams BusinessParams `json:"business_params"`
}
