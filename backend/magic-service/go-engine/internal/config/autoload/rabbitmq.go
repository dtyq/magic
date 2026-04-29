package autoload

// RabbitMQConfig 保存 RabbitMQ 连接与队列设置。
type RabbitMQConfig struct {
	Enabled        bool                         `json:"enabled"`
	Host           string                       `json:"host"`
	Port           int                          `json:"port"`
	Username       string                       `json:"username"`
	AuthValue      string                       `mapstructure:"password" json:"auth_value"`
	VHost          string                       `mapstructure:"vhost" json:"vhost"`
	Queues         RabbitMQQueuesConfig         `json:"queues"`
	DocumentResync RabbitMQDocumentResyncConfig `mapstructure:"documentResync" json:"document_resync"`
}

// RabbitMQQueuesConfig 保存 RabbitMQ 队列命名。
type RabbitMQQueuesConfig struct {
	Embedding      string `json:"embedding"`
	DocumentResync string `mapstructure:"documentResync" json:"document_resync"`
}

// RabbitMQDocumentResyncConfig 保存文档重向量化队列参数。
type RabbitMQDocumentResyncConfig struct {
	Enabled                      bool `json:"enabled"`
	ConsumerPrefetch             int  `mapstructure:"consumerPrefetch" json:"consumer_prefetch"`
	ConsumerConcurrency          int  `mapstructure:"consumerConcurrency" json:"consumer_concurrency"`
	TaskTimeoutSeconds           int  `mapstructure:"taskTimeoutSeconds" json:"task_timeout_seconds"`
	MQPublishTimeoutMillis       int  `mapstructure:"mqPublishTimeoutMillis" json:"mq_publish_timeout_millis"`
	MaxRequeueAttempts           int  `mapstructure:"maxRequeueAttempts" json:"max_requeue_attempts"`
	SourceCallbackGateTTLSeconds int  `mapstructure:"sourceCallbackGateTTLSeconds" json:"source_callback_gate_ttl_seconds"`
}
