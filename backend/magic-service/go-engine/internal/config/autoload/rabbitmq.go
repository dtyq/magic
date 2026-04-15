package autoload

// RabbitMQConfig 保存 RabbitMQ 连接与队列设置。
type RabbitMQConfig struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Username           string `json:"username"`
	AuthValue          string `mapstructure:"password" json:"auth_value"`
	VHost              string `json:"vhost"`
	EmbeddingQueue     string `json:"embedding_queue"`
	MinIntervalSeconds int    `json:"min_interval_seconds"`
	MinEventsBetween   int    `json:"min_events_between"`
}
