package autoload

// KnowledgeVisualUnderstandingConfig 保存知识库视觉理解运行配置。
type KnowledgeVisualUnderstandingConfig struct {
	PDFRenderDPI          int     `mapstructure:"pdfRenderDPI" json:"pdf_render_dpi"`
	JPEGQuality           int     `mapstructure:"jpegQuality" json:"jpeg_quality"`
	MaxPageImageBytes     int64   `mapstructure:"maxPageImageBytes" json:"max_page_image_bytes"`
	MaxModelRequestBytes  int64   `mapstructure:"maxModelRequestBytes" json:"max_model_request_bytes"`
	ModelTemperature      float64 `mapstructure:"modelTemperature" json:"model_temperature"`
	ModelMaxTokens        int     `mapstructure:"modelMaxTokens" json:"model_max_tokens"`
	RequestTimeoutSeconds int     `mapstructure:"requestTimeoutSeconds" json:"request_timeout_seconds"`
}
