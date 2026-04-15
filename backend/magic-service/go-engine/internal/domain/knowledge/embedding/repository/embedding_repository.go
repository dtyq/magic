// Package repository 定义 embedding 子域仓储接口。
package repository

import (
	"context"

	embentity "magic/internal/domain/knowledge/embedding/entity"
	sharedrepo "magic/internal/domain/knowledge/shared/repository"
	"magic/internal/pkg/ctxmeta"
)

// ErrNotFound 兼容透传共享仓储未找到错误。
var ErrNotFound = sharedrepo.ErrNotFound

// EmbeddingRepository 定义 embedding 向量化能力的 Repository 接口
// Domain 层通过此接口获取 embedding，而不直接依赖外部服务客户端
// Infrastructure 层负责实现此接口，可以使用 HTTP、gRPC 或其他方式
type EmbeddingRepository interface {
	// ComputeEmbedding 计算单个文本的 embedding 向量
	// businessParams 用于计费和追踪，可选参数
	ComputeEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)

	// ComputeBatchEmbeddings 批量计算多个文本的 embedding 向量
	// businessParams 用于计费和追踪，可选参数
	ComputeBatchEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)

	// ListProviders 获取可用的 embedding 模型提供商列表
	ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embentity.EmbeddingProvider, error)
}

// EmbeddingClient 定义文本向量化操作接口。
type EmbeddingClient interface {
	// GetEmbedding 返回单条文本输入的 embedding 向量。
	GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)

	// GetBatchEmbeddings 返回多条文本输入的 embedding 向量。
	GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)

	// SetAccessToken 更新用于认证的 access token。
	SetAccessToken(accessToken string)

	// ListProviders 返回可用的 embedding 提供方列表。
	ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embentity.EmbeddingProvider, error)
}

// EmbeddingDimensionResolver 嵌入维度解析器，用于获取模型向量维度。
type EmbeddingDimensionResolver interface {
	ResolveDimension(ctx context.Context, model string) (int64, error)
}

// EmbeddingCacheRepository 向量化缓存核心仓储接口。
type EmbeddingCacheRepository interface {
	FindByHash(ctx context.Context, textHash, model string) (*embentity.EmbeddingCache, error)
	FindByHashes(ctx context.Context, textHashes []string, model string) (map[string]*embentity.EmbeddingCache, error)
	Save(ctx context.Context, cache *embentity.EmbeddingCache) error
	SaveIfAbsent(ctx context.Context, text string, embedding []float64, model string) error
	SaveBatch(ctx context.Context, caches []*embentity.EmbeddingCache) error
	GetOrCreate(ctx context.Context, text string, embedding []float64, model string) (*embentity.EmbeddingCache, error)
	UpdateAccess(ctx context.Context, id int64) error
	Delete(ctx context.Context, id int64) error
	DeleteByHash(ctx context.Context, textHash string) error
	BatchDelete(ctx context.Context, ids []int64) error
}

// EmbeddingCacheAnalysisRepository 向量化缓存分析与维护仓储接口。
type EmbeddingCacheAnalysisRepository interface {
	FindExpiredCaches(ctx context.Context, criteria *embentity.EmbeddingCacheCleanupCriteria, offset, limit int) ([]*embentity.EmbeddingCache, error)
	CountExpiredCaches(ctx context.Context, criteria *embentity.EmbeddingCacheCleanupCriteria) (int64, error)
	CleanupExpiredCaches(ctx context.Context, criteria *embentity.EmbeddingCacheCleanupCriteria) (int64, error)
	GetCacheStatistics(ctx context.Context) (*embentity.EmbeddingCacheStatistics, error)
	GetCachesByModel(ctx context.Context, model string, offset, limit int) ([]*embentity.EmbeddingCache, error)
	CountByModel(ctx context.Context, model string) (int64, error)
	GetLeastAccessed(ctx context.Context, limit int) ([]*embentity.EmbeddingCache, error)
	SearchCaches(ctx context.Context, query *embentity.EmbeddingCacheQuery) ([]*embentity.EmbeddingCache, int64, error)
}
