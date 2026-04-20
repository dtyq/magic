package autoload

// EventsConfig 保存事件总线设置
type EventsConfig struct {
	WorkerCount int `json:"worker_count"`
	QueueSize   int `json:"queue_size"`
}
