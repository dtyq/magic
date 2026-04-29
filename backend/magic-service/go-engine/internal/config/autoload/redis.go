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
}
