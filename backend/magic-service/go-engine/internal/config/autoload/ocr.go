package autoload

// OCRConfig 火山引擎 OCR 配置
type OCRConfig struct {
	Identity      string `mapstructure:"accessKey" json:"identity"`
	Signature     string `mapstructure:"secretKey" json:"signature"`
	Region        string `json:"region"`
	Endpoint      string `json:"endpoint"`
	MaxOCRPerFile int    `mapstructure:"maxPerFile" json:"max_ocr_per_file"`
}
