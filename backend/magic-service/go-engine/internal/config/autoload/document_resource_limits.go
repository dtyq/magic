package autoload

// DocumentResourceLimitsConfig 保存文档同步资源限制配置。
type DocumentResourceLimitsConfig struct {
	MaxSourceBytes           int64 `json:"max_source_bytes"`
	MaxTabularRows           int64 `json:"max_tabular_rows"`
	MaxTabularCells          int64 `json:"max_tabular_cells"`
	MaxPlainTextChars        int64 `json:"max_plain_text_chars"`
	MaxParsedBlocks          int64 `json:"max_parsed_blocks"`
	MaxFragmentsPerDocument  int64 `json:"max_fragments_per_document"`
	SyncMemorySoftLimitBytes int64 `json:"sync_memory_soft_limit_bytes"`
}
