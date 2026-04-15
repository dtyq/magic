package model

import (
	"context"

	"magic/internal/domain/knowledge/shared"
)

const (
	// DefaultDenseVectorName 表示默认 dense named vector 名称。
	DefaultDenseVectorName = shared.DefaultDenseVectorName
	// DefaultSparseVectorName 表示默认 sparse named vector 名称。
	DefaultSparseVectorName = shared.DefaultSparseVectorName
	// DefaultSparseModelName 表示默认 Qdrant BM25 模型名称。
	DefaultSparseModelName = shared.DefaultSparseModelName
	// SparseBackendClientBM25QdrantIDFV1 表示客户端构造 sparse vector、Qdrant 负责 IDF 的后端版本。
	SparseBackendClientBM25QdrantIDFV1 = shared.SparseBackendClientBM25QdrantIDFV1
	// SparseBackendQdrantBM25ZHV1 表示中文优先的 Qdrant BM25 后端版本。
	SparseBackendQdrantBM25ZHV1 = shared.SparseBackendQdrantBM25ZHV1
)

// Query 片段查询条件。
type Query struct {
	KnowledgeCode string
	DocumentCode  string
	BusinessID    string
	Content       string
	SyncStatus    *shared.SyncStatus
	Offset        int
	Limit         int
}

// DocumentKey 表示知识库内唯一文档键。
type DocumentKey struct {
	KnowledgeCode string
	DocumentCode  string
}

// MissingDocumentCodeQuery 查询 document_code 为空的历史片段条件。
type MissingDocumentCodeQuery struct {
	OrganizationCode string
	KnowledgeCode    string
	StartID          int64
	Limit            int
}

// VectorFilter 复用共享向量过滤条件。
type VectorFilter = shared.VectorFilter

// FieldFilter 复用共享字段过滤条件。
type FieldFilter = shared.FieldFilter

// Match 复用共享字段匹配条件。
type Match = shared.Match

// Range 复用共享字段范围条件。
type Range = shared.Range

// VectorCollectionInfo 复用共享向量集合信息。
type VectorCollectionInfo = shared.VectorCollectionInfo

// SparseVector 复用共享稀疏向量结构。
type SparseVector = shared.SparseVector

// SparseDocument 复用共享稀疏文本结构。
type SparseDocument = shared.SparseDocument

// SparseInput 复用共享 sparse 写入输入。
type SparseInput = shared.SparseInput

// DenseSearchRequest 复用共享 dense 检索请求。
type DenseSearchRequest = shared.DenseSearchRequest

// SparseSearchRequest 复用共享 sparse 检索请求。
type SparseSearchRequest = shared.SparseSearchRequest

// VectorSearchResult 复用共享向量搜索结果。
type VectorSearchResult[T any] = shared.VectorSearchResult[T]

// KnowledgeBaseFragmentSaver 片段保存接口。
type KnowledgeBaseFragmentSaver interface {
	Save(ctx context.Context, fragment *KnowledgeBaseFragment) error
	SaveBatch(ctx context.Context, fragments []*KnowledgeBaseFragment) error
}

// KnowledgeBaseFragmentUpdater 片段更新接口。
type KnowledgeBaseFragmentUpdater interface {
	Update(ctx context.Context, fragment *KnowledgeBaseFragment) error
	UpdateBatch(ctx context.Context, fragments []*KnowledgeBaseFragment) error
	UpdateSyncStatus(ctx context.Context, fragment *KnowledgeBaseFragment) error
	UpdateVector(ctx context.Context, id int64, vector []float64) error
	BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error)
}

// KnowledgeBaseFragmentDeleter 片段删除接口。
type KnowledgeBaseFragmentDeleter interface {
	Delete(ctx context.Context, id int64) error
	DeleteByIDs(ctx context.Context, ids []int64) error
	DeleteByDocument(ctx context.Context, knowledgeCode, documentCode string) error
	DeleteByKnowledgeBase(ctx context.Context, knowledgeCode string) error
}

// KnowledgeBaseFragmentWriter 片段写仓储接口。
type KnowledgeBaseFragmentWriter interface {
	KnowledgeBaseFragmentSaver
	KnowledgeBaseFragmentUpdater
	KnowledgeBaseFragmentDeleter
}

// KnowledgeBaseFragmentReader 片段读仓储接口。
type KnowledgeBaseFragmentReader interface {
	FindByID(ctx context.Context, id int64) (*KnowledgeBaseFragment, error)
	FindByPointID(ctx context.Context, knowledgeCode, documentCode, pointID string) (*KnowledgeBaseFragment, error)
	FindByIDs(ctx context.Context, ids []int64) ([]*KnowledgeBaseFragment, error)
	List(ctx context.Context, query *Query) ([]*KnowledgeBaseFragment, int64, error)
	ListByDocument(ctx context.Context, knowledgeCode, documentCode string, offset, limit int) ([]*KnowledgeBaseFragment, int64, error)
	ListByKnowledgeBase(ctx context.Context, knowledgeCode string, offset, limit int) ([]*KnowledgeBaseFragment, int64, error)
	ListPendingSync(ctx context.Context, knowledgeCode string, limit int) ([]*KnowledgeBaseFragment, error)
	CountByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
	CountSyncedByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error)
	ListMissingDocumentCode(ctx context.Context, query MissingDocumentCodeQuery) ([]*KnowledgeBaseFragment, error)
}

// KnowledgeBaseFragmentRepository 片段仓储接口。
type KnowledgeBaseFragmentRepository interface {
	KnowledgeBaseFragmentWriter
	KnowledgeBaseFragmentReader
}

// VectorDBCollectionRepository 复用共享集合管理契约。
type VectorDBCollectionRepository = shared.VectorDBCollectionRepository

// VectorDBAliasRepository 复用共享 alias 管理契约。
type VectorDBAliasRepository = shared.VectorDBAliasRepository

// VectorDBPointDeletionRepository 复用共享点删除契约。
type VectorDBPointDeletionRepository = shared.VectorDBPointDeletionRepository

// VectorDBManagementRepository 复用共享向量管理契约。
type VectorDBManagementRepository = shared.VectorDBManagementRepository

// VectorDBDataRepository 复用共享向量数据契约。
type VectorDBDataRepository[T any] = shared.VectorDBDataRepository[T]

// VectorDimensionMismatchError 复用共享向量维度不匹配错误。
type VectorDimensionMismatchError = shared.VectorDimensionMismatchError

// NormalizeSparseBackend 归一化 sparse backend 标识。
func NormalizeSparseBackend(backend string) string {
	return shared.NormalizeSparseBackend(backend)
}
