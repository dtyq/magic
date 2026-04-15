// Package persistence 提供仓储的基础设施层实现
package persistence

import (
	"context"
	"fmt"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/external"
	"magic/internal/pkg/ctxmeta"
)

// EmbeddingRepository 实现 domain 层定义的 EmbeddingRepository 接口
// 这是 Infrastructure 层的具体实现，封装了对外部 embedding 服务的调用
type EmbeddingRepository struct {
	embeddingService *external.EmbeddingService
}

// NewEmbeddingRepository 创建 EmbeddingRepository 实例
func NewEmbeddingRepository(embeddingService *external.EmbeddingService) *EmbeddingRepository {
	return &EmbeddingRepository{
		embeddingService: embeddingService,
	}
}

// ComputeEmbedding 计算单个文本的 embedding 向量
func (r *EmbeddingRepository) ComputeEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	v, err := r.embeddingService.GetEmbedding(ctx, text, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("compute embedding: %w", err)
	}
	return v, nil
}

// ComputeBatchEmbeddings 批量计算多个文本的 embedding 向量
func (r *EmbeddingRepository) ComputeBatchEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	v, err := r.embeddingService.GetBatchEmbeddings(ctx, texts, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("compute batch embeddings: %w", err)
	}
	return v, nil
}

// ListProviders 获取可用的 embedding 模型提供商列表
// 代理调用 Infrastructure 层的 EmbeddingService
func (r *EmbeddingRepository) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	providers, err := r.embeddingService.ListProviders(ctx, businessParams)
	if err != nil {
		return nil, fmt.Errorf("list providers: %w", err)
	}
	return providers, nil
}
