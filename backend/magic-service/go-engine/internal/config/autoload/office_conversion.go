package autoload

// OfficeConversionConfig 保存旧 Office 格式转换配置。
type OfficeConversionConfig struct {
	Enabled        *bool  `json:"enabled"`
	Command        string `json:"command"`
	TimeoutSeconds int    `mapstructure:"timeoutSeconds" json:"timeout_seconds"`
	MaxInputBytes  int64  `mapstructure:"maxInputBytes" json:"max_input_bytes"`
	MaxOutputBytes int64  `mapstructure:"maxOutputBytes" json:"max_output_bytes"`
	MaxConcurrent  int64  `mapstructure:"maxConcurrent" json:"max_concurrent"`
}
