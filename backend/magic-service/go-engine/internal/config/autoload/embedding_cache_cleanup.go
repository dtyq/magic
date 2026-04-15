package autoload

// EmbeddingCacheCleanupConfig 保存 embedding_cache 定时清理配置。
type EmbeddingCacheCleanupConfig struct {
	AutoCleanupEnabled bool `json:"auto_cleanup_enabled"`

	CleanupIntervalHours  int `json:"cleanup_interval_hours"`
	CleanupTimeoutMinutes int `json:"cleanup_timeout_minutes"`

	MinAccessCount       int `json:"min_access_count"`
	MaxIdleDurationHours int `json:"max_idle_duration_hours"`
	MaxCacheAgeHours     int `json:"max_cache_age_hours"`
	BatchSize            int `json:"batch_size"`
}
