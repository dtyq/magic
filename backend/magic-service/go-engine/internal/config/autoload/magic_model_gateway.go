package autoload

// MagicModelGatewayConfig 存储 Magic 模型网关配置
type MagicModelGatewayConfig struct {
	// BaseURL 是模型网关服务的基础 URL
	BaseURL string `json:"base_url"`
	// DefaultEmbeddingModel 是默认使用的 embedding 模型
	DefaultEmbeddingModel string `json:"default_embedding_model"`
	// MagicAccessToken 是访问令牌
	MagicAccessToken string `json:"magic_access_token"`
}
