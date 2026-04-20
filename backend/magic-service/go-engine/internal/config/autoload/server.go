package autoload

// ServerConfig 保存 HTTP 服务设置。
type ServerConfig struct {
	Enabled      *bool   `json:"enabled"`
	Host         string  `json:"host"`
	Port         int     `json:"port"`
	Mode         RunMode `json:"mode,omitempty"`
	BasePath     string  `json:"base_path"`
	Env          string  `json:"env"` // 环境：dev、staging、production 等
	PprofEnabled bool    `json:"pprof_enabled"`
}

// RunMode 表示服务运行模式
type RunMode string

const (
	// RunModeDebug 表示开发环境调试模式
	RunModeDebug RunMode = "debug"
)
