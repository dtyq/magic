package autoload

// EmbeddingConfig 保存 embedding 模型配置。
type EmbeddingConfig struct {
	// Dimension 是 embedding 模型的向量维度
	// - dmeta-embedding: 1024（示例）
	// - text-embedding-3-small: 1536（示例）
	// - text-embedding-3-large: 3072（示例）
	Dimension int `json:"dimension"`
	// ClientType 指定使用哪种 embedding 客户端
	// - "php": 使用 PHP IPC 回调（调用 LLMAppService.embeddings）
	// - "openai": 直接调用兼容 OpenAI 的 API（默认）
	ClientType string `json:"client_type"`
	// RateLimitEnabled 控制 Go 侧 embedding compute 调用是否启用 Redis 全局限流。
	RateLimitEnabled bool `mapstructure:"rateLimitEnabled" json:"rate_limit_enabled"`
	// RateLimitQPS 是全局 embedding compute 请求速率。
	RateLimitQPS float64 `mapstructure:"rateLimitQPS" json:"rate_limit_qps"`
	// RateLimitBurst 是全局 embedding compute 令牌桶突发容量。
	RateLimitBurst int `mapstructure:"rateLimitBurst" json:"rate_limit_burst"`
	// RateLimitWaitTimeoutSeconds 是等待令牌的最大秒数。
	RateLimitWaitTimeoutSeconds int `mapstructure:"rateLimitWaitTimeoutSeconds" json:"rate_limit_wait_timeout_seconds"`
}

// EmbeddingClientType 是 embedding 客户端类型的强类型 DI Token
type EmbeddingClientType string

// EmbeddingDimension 是 embedding 维度的强类型 DI Token
type EmbeddingDimension int

// EmbeddingDefaultModel 是默认 embedding 模型的强类型 DI Token
type EmbeddingDefaultModel string

// EmbeddingBaseURL 是 embedding 服务 Base URL 的强类型 DI Token
type EmbeddingBaseURL string
