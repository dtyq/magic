package autoload

// MySQLConfig 保存 MySQL DSN 的迁移/存储配置。
type MySQLConfig struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Database  string `json:"database"`
	Username  string `json:"username"`
	AuthValue string `mapstructure:"password" json:"auth_value"`
	Params    string `json:"params,omitempty"`
	// 连接池设置
	MaxOpenConns    int `json:"max_open_conns"`
	MaxIdleConns    int `json:"max_idle_conns"`
	ConnMaxLifetime int `json:"conn_max_lifetime"`

	// 日志设置
	LogSql bool `json:"log_sql"`
}
