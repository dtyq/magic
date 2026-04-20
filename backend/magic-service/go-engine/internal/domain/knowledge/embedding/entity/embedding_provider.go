package entity

// EmbeddingProvider 表示 embedding 模型提供方
type EmbeddingProvider struct {
	ID     string           `json:"id"`
	Name   string           `json:"name"`
	Models []EmbeddingModel `json:"models"`
}

// EmbeddingModel 表示 embedding 模型
type EmbeddingModel struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	ModelID string `json:"model_id"`
	Icon    string `json:"icon"`
}
