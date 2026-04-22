// Package external 提供外部服务集成的 HTTP 客户端。
package external

import (
	"context"
	"fmt"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/pkg/ctxmeta"
)

// EmbeddingService 包装 EmbeddingClient，提供服务层接口
type EmbeddingService struct {
	client       embedding.Client
	defaultModel string
}

// NewEmbeddingService 创建新的 embedding 服务
func NewEmbeddingService(client embedding.Client, defaultModel string) *EmbeddingService {
	return &EmbeddingService{
		client:       client,
		defaultModel: defaultModel,
	}
}

// GetEmbedding 实现 embedding 服务接口
func (s *EmbeddingService) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if model == "" {
		model = s.defaultModel
	}

	v, err := s.client.GetEmbedding(ctx, input, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("get embedding: %w", err)
	}
	return v, nil
}

// GetBatchEmbeddings 实现 embedding 服务接口
func (s *EmbeddingService) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	if model == "" {
		model = s.defaultModel
	}

	v, err := s.client.GetBatchEmbeddings(ctx, inputs, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("get batch embeddings: %w", err)
	}
	return v, nil
}

// ListProviders 实现 embedding 服务接口
func (s *EmbeddingService) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	providers, err := s.client.ListProviders(ctx, businessParams)
	if err != nil {
		return nil, fmt.Errorf("list providers: %w", err)
	}
	return providers, nil
}
