package constants

import "time"

// 超时常量
const (
	// DefaultShutdownTimeout 表示默认服务关闭超时
	DefaultShutdownTimeout = 30 * time.Second
	// DefaultReadWriteTimeout 表示默认 HTTP 读写超时
	DefaultReadWriteTimeout = 20 * time.Second
	// DefaultIdleTimeout 表示默认 HTTP 空闲超时
	DefaultIdleTimeout = 30 * time.Second
)
