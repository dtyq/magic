package autoload

// RedisConfig 保存 Redis 连接与锁相关设置。
type RedisConfig struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Username           string `json:"username"`
	AuthValue          string `mapstructure:"password" json:"auth_value"`
	DB                 int    `json:"db"`
	LockPrefix         string `json:"lock_prefix"`
	LockTTLSeconds     int    `json:"lock_ttl_seconds"`
	SpinIntervalMillis int    `json:"spin_interval_millis"`
	SpinMaxRetries     int    `json:"spin_max_retries"`
	// 连接池设置
	PoolSize        int `json:"pool_size"`
	MinIdleConns    int `json:"min_idle_conns"`
	ConnMaxIdleTime int `json:"conn_max_idle_time"`
	ConnMaxLifetime int `json:"conn_max_lifetime"`
	PoolTimeout     int `json:"pool_timeout"`
	// SocketIOCleanupAllowedPrefixes 追加允许清理的 Socket.IO Redis 前缀。
	SocketIOCleanupAllowedPrefixes  []string `mapstructure:"socketioCleanupAllowedPrefixes" json:"socketio_cleanup_allowed_prefixes"`
	SocketIOCleanupCountMax         int64    `mapstructure:"socketioCleanupCountMax" json:"socketio_cleanup_count_max"`
	SocketIOCleanupHeartbeatSeconds int      `mapstructure:"socketioCleanupHeartbeatSeconds" json:"socketio_cleanup_heartbeat_seconds"`
	SocketIOCleanupStaleSeconds     int      `mapstructure:"socketioCleanupStaleSeconds" json:"socketio_cleanup_stale_seconds"`
	SocketIOCleanupStateTTLSeconds  int      `mapstructure:"socketioCleanupStateTTLSeconds" json:"socketio_cleanup_state_ttl_seconds"`
}
