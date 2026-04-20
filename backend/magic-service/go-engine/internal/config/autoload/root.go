// Package autoload 定义应用配置结构与类型。
package autoload

// Config 是应用的根配置。
type Config struct {
	Server                ServerConfig                `json:"server"`
	Qdrant                QdrantConfig                `json:"qdrant"`
	Rebuild               RebuildConfig               `json:"rebuild"`
	MySQL                 MySQLConfig                 `json:"mysql"`
	Redis                 RedisConfig                 `json:"redis"`
	Logging               LoggingConfig               `json:"logging"`
	Events                EventsConfig                `json:"events"`
	Security              SecurityConfig              `json:"security"`
	IPC                   IPCConfig                   `json:"ipc"`
	RabbitMQ              RabbitMQConfig              `json:"rabbitmq"`
	Embedding             EmbeddingConfig             `json:"embedding"`
	EmbeddingCacheCleanup EmbeddingCacheCleanupConfig `json:"embedding_cache_cleanup"`
	MagicModelGateway     MagicModelGatewayConfig     `json:"magic_model_gateway"`
	OCR                   OCRConfig                   `json:"ocr"`
	Storage               StorageConfig               `json:"storage"`
}

// LoggingConfig 提供应用日志设置。
type LoggingConfig struct {
	Level  LogLevel  `json:"level"`  // 见 LogLevel 常量
	Format LogFormat `json:"format"` // 见 LogFormat 常量
}

// LogLevel 枚举支持的日志级别。
type LogLevel string

const (
	// LogLevelInfo 是通用运行事件的默认级别。
	LogLevelInfo LogLevel = "info"
)

// LogFormat 枚举支持的日志格式。
type LogFormat string

const (
	// LogFormatJSON 输出 JSON 结构化日志。
	LogFormatJSON LogFormat = "json"
	// LogFormatText 输出可读文本日志。
	LogFormatText LogFormat = "text"
	// LogFormatMagic 输出与 PHP magic-service 对齐的文本日志格式。
	LogFormatMagic LogFormat = "magic"
)
