package constants

import "time"

// 锁键与时长
const (
	// MagicAccessTokenInitLockKey 表示 Magic 访问令牌初始化锁的键
	MagicAccessTokenInitLockKey = "magic_access_token_init"
	// MagicAccessTokenInitLockTimeout 表示初始化锁的超时时间
	MagicAccessTokenInitLockTimeout = 30 * time.Second
	// EmbeddingCacheCleanupJobLockKey 表示 embedding cache 定时清理任务的全局锁键。
	EmbeddingCacheCleanupJobLockKey = "job:embedding_cache_cleanup"
)
