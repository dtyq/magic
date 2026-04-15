package autoload

// RebuildConfig 保存知识库重建相关配置。
type RebuildConfig struct {
	MaxConcurrency int `json:"max_concurrency"`
}
