package retrieval

import (
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

// KnowledgeBaseFragment 复用片段领域实体。
type KnowledgeBaseFragment = fragmodel.KnowledgeBaseFragment

// FragmentPayload 复用片段向量 payload 结构。
type FragmentPayload = fragmodel.FragmentPayload

// SimilarityResult 复用相似度检索结果结构。
type SimilarityResult = fragmodel.SimilarityResult

// Query 复用片段查询条件。
type Query = fragmodel.Query

// DocumentKey 复用知识库文档键。
type DocumentKey = fragmodel.DocumentKey

// MissingDocumentCodeQuery 复用缺失文档编码的查询条件。
type MissingDocumentCodeQuery = fragmodel.MissingDocumentCodeQuery

// VectorFilter 复用共享向量检索过滤条件。
type VectorFilter = shared.VectorFilter

// FieldFilter 复用共享字段过滤条件。
type FieldFilter = shared.FieldFilter

// Match 复用共享字段匹配条件。
type Match = shared.Match

// Range 复用共享字段范围条件。
type Range = shared.Range

// SparseVector 复用共享稀疏向量结构。
type SparseVector = shared.SparseVector

// SparseDocument 复用共享稀疏文本结构。
type SparseDocument = shared.SparseDocument

// SparseInput 复用共享 sparse 写入输入。
type SparseInput = shared.SparseInput

// DenseSearchRequest 复用共享稠密检索请求。
type DenseSearchRequest = shared.DenseSearchRequest

// SparseSearchRequest 复用共享稀疏检索请求。
type SparseSearchRequest = shared.SparseSearchRequest

// VectorSearchResult 复用共享向量检索结果。
type VectorSearchResult[T any] = shared.VectorSearchResult[T]

// KnowledgeBaseFragmentReader 复用片段读仓储契约。
type KnowledgeBaseFragmentReader = fragmodel.KnowledgeBaseFragmentReader

// VectorDBDataRepository 复用共享向量库数据仓储契约。
type VectorDBDataRepository[T any] = shared.VectorDBDataRepository[T]

const (
	// DefaultDenseVectorName 表示默认稠密向量名称。
	DefaultDenseVectorName = shared.DefaultDenseVectorName
	// DefaultSparseVectorName 表示默认稀疏向量名称。
	DefaultSparseVectorName = shared.DefaultSparseVectorName
	// DefaultSparseModelName 表示默认 Qdrant BM25 模型名称。
	DefaultSparseModelName = shared.DefaultSparseModelName
	// SparseBackendClientBM25QdrantIDFV1 表示客户端构造 sparse vector、Qdrant 负责 IDF 的后端版本。
	SparseBackendClientBM25QdrantIDFV1 = shared.SparseBackendClientBM25QdrantIDFV1
	// SparseBackendQdrantBM25ZHV1 表示中文优先的 Qdrant BM25 后端版本。
	SparseBackendQdrantBM25ZHV1 = shared.SparseBackendQdrantBM25ZHV1

	// FragmentSemanticMetadataContractVersionV1 表示片段语义 metadata v1 契约版本。
	FragmentSemanticMetadataContractVersionV1 = fragmetadata.FragmentSemanticMetadataContractVersionV1
	// MetadataContractVersionKey 表示 metadata 契约版本字段。
	MetadataContractVersionKey = fragmetadata.MetadataContractVersionKey
	// MetadataFallbackFlagsKey 表示 metadata 回填标记字段。
	MetadataFallbackFlagsKey = fragmetadata.MetadataFallbackFlagsKey

	// ParsedDocumentSourceText 表示普通文本解析结果。
	ParsedDocumentSourceText = parseddocument.SourceText
	// ParsedDocumentSourceTabular 表示表格解析结果。
	ParsedDocumentSourceTabular = parseddocument.SourceTabular
	// ParsedBlockTypeTableRow 表示表格行块。
	ParsedBlockTypeTableRow = parseddocument.BlockTypeTableRow
	// ParsedBlockTypeTableSummary 表示表格汇总块。
	ParsedBlockTypeTableSummary = parseddocument.BlockTypeTableSummary
	// ParsedMetaSourceFormat 标记解析源格式。
	ParsedMetaSourceFormat = parseddocument.MetaSourceFormat
	// ParsedMetaFileName 标记源文件名。
	ParsedMetaFileName = parseddocument.MetaFileName
	// ParsedMetaChunkType 标记块类型。
	ParsedMetaChunkType = parseddocument.MetaChunkType
	// ParsedMetaSheetName 标记 sheet 名称。
	ParsedMetaSheetName = parseddocument.MetaSheetName
	// ParsedMetaSheetHidden 标记 sheet 是否隐藏。
	ParsedMetaSheetHidden = parseddocument.MetaSheetHidden
	// ParsedMetaTableID 标记表格 ID。
	ParsedMetaTableID = parseddocument.MetaTableID
	// ParsedMetaTableTitle 标记表格标题。
	ParsedMetaTableTitle = parseddocument.MetaTableTitle
	// ParsedMetaRowIndex 标记行号。
	ParsedMetaRowIndex = parseddocument.MetaRowIndex
	// ParsedMetaRowSubchunkIndex 标记行分块序号。
	ParsedMetaRowSubchunkIndex = parseddocument.MetaRowSubchunkIndex
	// ParsedMetaPrimaryKeys 标记主键集合。
	ParsedMetaPrimaryKeys = parseddocument.MetaPrimaryKeys
	// ParsedMetaPrimaryKeyHeaders 标记主键表头集合。
	ParsedMetaPrimaryKeyHeaders = parseddocument.MetaPrimaryKeyHeaders
	// ParsedMetaHeaderPaths 标记表头路径集合。
	ParsedMetaHeaderPaths = parseddocument.MetaHeaderPaths
	// ParsedMetaCellRefs 标记单元格引用集合。
	ParsedMetaCellRefs = parseddocument.MetaCellRefs
	// ParsedMetaHasFormula 标记是否包含公式。
	ParsedMetaHasFormula = parseddocument.MetaHasFormula
	// ParsedMetaTableRowCount 标记表格行数。
	ParsedMetaTableRowCount = parseddocument.MetaTableRowCount
	// ParsedMetaFields 标记字段集合。
	ParsedMetaFields = parseddocument.MetaFields
)

func cloneMetadata(metadata map[string]any) map[string]any {
	return fragmetadata.CloneMetadata(metadata)
}

// NormalizeSparseBackend 复用 shared kernel 的 sparse backend 归一化规则。
func NormalizeSparseBackend(backend string) string {
	return shared.NormalizeSparseBackend(backend)
}

// IsSupportedSparseBackend 复用 shared kernel 的 sparse backend 支持集判断。
func IsSupportedSparseBackend(backend string) bool {
	return shared.IsSupportedSparseBackend(backend)
}
