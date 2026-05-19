package autoload

// OCRConfig 火山引擎 OCR 配置
type OCRConfig struct {
	Region                      string  `json:"region"`
	Endpoint                    string  `json:"endpoint"`
	MaxOCRPerFile               int     `mapstructure:"maxPerFile" json:"max_ocr_per_file"`
	RateLimitEnabled            bool    `mapstructure:"rateLimitEnabled" json:"rate_limit_enabled"`
	RateLimitQPS                float64 `mapstructure:"rateLimitQPS" json:"rate_limit_qps"`
	RateLimitBurst              int     `mapstructure:"rateLimitBurst" json:"rate_limit_burst"`
	RateLimitWaitTimeoutSeconds int     `mapstructure:"rateLimitWaitTimeoutSeconds" json:"rate_limit_wait_timeout_seconds"`
}
