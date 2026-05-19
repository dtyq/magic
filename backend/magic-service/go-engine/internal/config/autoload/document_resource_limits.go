package autoload

// DocumentResourceLimitsConfig 保存文档同步资源限制配置。
type DocumentResourceLimitsConfig struct {
	MaxSourceBytes              int64 `json:"max_source_bytes"`
	MaxTabularRows              int64 `json:"max_tabular_rows"`
	MaxTabularCells             int64 `json:"max_tabular_cells"`
	MaxPlainTextChars           int64 `json:"max_plain_text_chars"`
	MaxParsedBlocks             int64 `json:"max_parsed_blocks"`
	MaxFragmentsPerDocument     int64 `json:"max_fragments_per_document"`
	MaxPDFPages                 int64 `mapstructure:"maxPDFPages" json:"max_pdf_pages"`
	MaxArchiveUncompressedBytes int64 `mapstructure:"maxArchiveUncompressedBytes" json:"max_archive_uncompressed_bytes"`
	MaxArchiveEntryBytes        int64 `mapstructure:"maxArchiveEntryBytes" json:"max_archive_entry_bytes"`
	MaxEmbeddedAssetBytes       int64 `mapstructure:"maxEmbeddedAssetBytes" json:"max_embedded_asset_bytes"`
	MaxPresentationSlides       int64 `mapstructure:"maxPresentationSlides" json:"max_presentation_slides"`
	SyncFragmentBatchSize       int   `mapstructure:"syncFragmentBatchSize" json:"sync_fragment_batch_size"`
	SyncMemorySoftLimitBytes    int64 `json:"sync_memory_soft_limit_bytes"`
}
