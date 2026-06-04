// Package vision 提供知识库视觉转文字外部能力实现。
package vision

import (
	"time"

	autoloadcfg "magic/internal/config/autoload"
)

const (
	defaultPDFRenderDPI          = 144
	defaultJPEGQuality           = 85
	defaultMaxPageImageBytes     = int64(6 * 1024 * 1024)
	defaultMaxModelRequestBytes  = int64(20 * 1024 * 1024)
	defaultModelTemperature      = 0
	defaultModelMaxTokens        = -1
	defaultRequestTimeoutSeconds = 300
)

// Config 保存知识库视觉理解运行参数。
type Config struct {
	PDFRenderDPI          int
	JPEGQuality           int
	MaxPageImageBytes     int64
	MaxModelRequestBytes  int64
	ModelTemperature      float64
	ModelMaxTokens        int
	RequestTimeoutSeconds int
}

// ConfigFromAutoload 将 autoload 配置转换为视觉理解运行配置。
func ConfigFromAutoload(cfg autoloadcfg.KnowledgeVisualUnderstandingConfig) Config {
	out := Config{
		PDFRenderDPI:          cfg.PDFRenderDPI,
		JPEGQuality:           cfg.JPEGQuality,
		MaxPageImageBytes:     cfg.MaxPageImageBytes,
		MaxModelRequestBytes:  cfg.MaxModelRequestBytes,
		ModelTemperature:      cfg.ModelTemperature,
		ModelMaxTokens:        cfg.ModelMaxTokens,
		RequestTimeoutSeconds: cfg.RequestTimeoutSeconds,
	}
	return normalizeConfig(out)
}

func normalizeConfig(cfg Config) Config {
	if cfg.PDFRenderDPI <= 0 {
		cfg.PDFRenderDPI = defaultPDFRenderDPI
	}
	if cfg.JPEGQuality <= 0 || cfg.JPEGQuality > maxJPEGQuality {
		cfg.JPEGQuality = defaultJPEGQuality
	}
	if cfg.MaxPageImageBytes <= 0 {
		cfg.MaxPageImageBytes = defaultMaxPageImageBytes
	}
	if cfg.MaxModelRequestBytes <= 0 {
		cfg.MaxModelRequestBytes = defaultMaxModelRequestBytes
	}
	if cfg.ModelMaxTokens == 0 {
		cfg.ModelMaxTokens = defaultModelMaxTokens
	}
	if cfg.RequestTimeoutSeconds <= 0 {
		cfg.RequestTimeoutSeconds = defaultRequestTimeoutSeconds
	}
	return cfg
}

func (c Config) requestTimeout() time.Duration {
	return time.Duration(normalizeConfig(c).RequestTimeoutSeconds) * time.Second
}
