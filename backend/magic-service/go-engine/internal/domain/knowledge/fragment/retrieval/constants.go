package retrieval

import (
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

const (
	// DefaultDenseVectorName 表示默认稠密向量名称。
	DefaultDenseVectorName = shared.DefaultDenseVectorName
	// DefaultSparseVectorName 表示默认稀疏向量名称。
	DefaultSparseVectorName = shared.DefaultSparseVectorName
	// DefaultSparseModelName 表示默认稀疏模型名称。
	DefaultSparseModelName = shared.DefaultSparseModelName
	// SparseBackendClientBM25QdrantIDFV1 表示客户端 BM25 稀疏后端。
	SparseBackendClientBM25QdrantIDFV1 = shared.SparseBackendClientBM25QdrantIDFV1
	// SparseBackendQdrantBM25ZHV1 表示中文 BM25 稀疏后端。
	SparseBackendQdrantBM25ZHV1 = shared.SparseBackendQdrantBM25ZHV1

	// MetadataFallbackFlagsKey 表示 metadata 回填标记字段。
	MetadataFallbackFlagsKey = fragmetadata.MetadataFallbackFlagsKey

	// ParsedDocumentSourceText 表示文本解析来源。
	ParsedDocumentSourceText = parseddocument.SourceText
	// ParsedDocumentSourceTabular 表示表格解析来源。
	ParsedDocumentSourceTabular = parseddocument.SourceTabular
	// ParsedBlockTypeTableRow 表示表格行块。
	ParsedBlockTypeTableRow = parseddocument.BlockTypeTableRow
	// ParsedBlockTypeTableSummary 表示表格摘要块。
	ParsedBlockTypeTableSummary = parseddocument.BlockTypeTableSummary
	// ParsedMetaSourceFormat 表示解析源格式 metadata 键。
	ParsedMetaSourceFormat = parseddocument.MetaSourceFormat
	// ParsedMetaFileName 表示源文件名 metadata 键。
	ParsedMetaFileName = parseddocument.MetaFileName
	// ParsedMetaChunkType 表示块类型 metadata 键。
	ParsedMetaChunkType = parseddocument.MetaChunkType
	// ParsedMetaSheetName 表示 sheet 名 metadata 键。
	ParsedMetaSheetName = parseddocument.MetaSheetName
	// ParsedMetaSheetHidden 表示隐藏 sheet metadata 键。
	ParsedMetaSheetHidden = parseddocument.MetaSheetHidden
	// ParsedMetaTableID 表示表格 ID metadata 键。
	ParsedMetaTableID = parseddocument.MetaTableID
	// ParsedMetaTableTitle 表示表格标题 metadata 键。
	ParsedMetaTableTitle = parseddocument.MetaTableTitle
	// ParsedMetaRowIndex 表示行号 metadata 键。
	ParsedMetaRowIndex = parseddocument.MetaRowIndex
	// ParsedMetaRowSubchunkIndex 表示行子块序号 metadata 键。
	ParsedMetaRowSubchunkIndex = parseddocument.MetaRowSubchunkIndex
	// ParsedMetaPrimaryKeys 表示主键集合 metadata 键。
	ParsedMetaPrimaryKeys = parseddocument.MetaPrimaryKeys
	// ParsedMetaPrimaryKeyHeaders 表示主键列头 metadata 键。
	ParsedMetaPrimaryKeyHeaders = parseddocument.MetaPrimaryKeyHeaders
	// ParsedMetaHeaderPaths 表示字段路径 metadata 键。
	ParsedMetaHeaderPaths = parseddocument.MetaHeaderPaths
	// ParsedMetaCellRefs 表示单元格引用 metadata 键。
	ParsedMetaCellRefs = parseddocument.MetaCellRefs
	// ParsedMetaHasFormula 表示公式标记 metadata 键。
	ParsedMetaHasFormula = parseddocument.MetaHasFormula
	// ParsedMetaTableRowCount 表示表格行数 metadata 键。
	ParsedMetaTableRowCount = parseddocument.MetaTableRowCount
	// ParsedMetaFields 表示字段列表 metadata 键。
	ParsedMetaFields = parseddocument.MetaFields
)

func cloneMetadata(metadata map[string]any) map[string]any {
	return fragmetadata.CloneMetadata(metadata)
}

// NormalizeSparseBackend 归一化稀疏检索后端配置。
func NormalizeSparseBackend(backend string) string {
	return shared.NormalizeSparseBackend(backend)
}

// IsSupportedSparseBackend 判断当前稀疏后端是否受支持。
func IsSupportedSparseBackend(backend string) bool {
	return shared.IsSupportedSparseBackend(backend)
}
