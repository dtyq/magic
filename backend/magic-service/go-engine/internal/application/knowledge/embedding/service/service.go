// Package embedapp 提供 embedding 应用服务实现。
package embedapp

import (
	"context"
	"errors"

	embeddto "magic/internal/application/knowledge/embedding/dto"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

var (
	// ErrEmbeddingComputeFailed 表示 embedding 计算执行失败。
	ErrEmbeddingComputeFailed = errors.New("embedding compute failed")
	// ErrEmbeddingProvidersListFailed 表示 embedding provider 查询失败。
	ErrEmbeddingProvidersListFailed = errors.New("embedding providers list failed")
)

// EmbeddingAppService 嵌入应用层服务
type EmbeddingAppService struct {
	embeddingClient EmbeddingProvider
	logger          *logging.SugaredLogger
	defaultModel    string
}

// EmbeddingProvider 定义 embedding 应用服务依赖的最小计算能力。
type EmbeddingProvider interface {
	GetEmbeddingWithMeta(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) (*embeddingdomain.Result, error)
	GetEmbeddingsWithMeta(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) (*embeddingdomain.BatchResult, error)
	GetProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error)
}

// NewEmbeddingAppService 创建嵌入应用层服务
func NewEmbeddingAppService(
	embeddingClient EmbeddingProvider,
	logger *logging.SugaredLogger,
	defaultModel string,
) *EmbeddingAppService {
	return &EmbeddingAppService{
		embeddingClient: embeddingClient,
		logger:          logger,
		defaultModel:    defaultModel,
	}
}

// Compute 计算单个文本嵌入
func (s *EmbeddingAppService) Compute(ctx context.Context, input *embeddto.ComputeEmbeddingInput) (*embeddto.ComputeEmbeddingOutput, error) {
	result, err := s.embeddingClient.GetEmbeddingWithMeta(ctx, input.Text, input.Model, input.BusinessParams)
	if err != nil {
		return nil, errors.Join(ErrEmbeddingComputeFailed, err)
	}

	return &embeddto.ComputeEmbeddingOutput{
		Embedding: result.Embedding,
		CacheHit:  result.CacheHit,
	}, nil
}

// ComputeBatch 批量计算文本嵌入
func (s *EmbeddingAppService) ComputeBatch(ctx context.Context, input *embeddto.ComputeBatchEmbeddingInput) (*embeddto.ComputeBatchEmbeddingOutput, error) {
	result, err := s.embeddingClient.GetEmbeddingsWithMeta(ctx, input.Texts, input.Model, input.BusinessParams)
	if err != nil {
		return nil, errors.Join(ErrEmbeddingComputeFailed, err)
	}

	return &embeddto.ComputeBatchEmbeddingOutput{
		Embeddings: result.Embeddings,
		CacheStats: embeddto.CacheStats{
			Total:    len(input.Texts),
			CacheHit: result.CacheHit,
		},
	}, nil
}

// ListProviders 获取可用的 embedding 模型提供商列表
func (s *EmbeddingAppService) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embeddingdomain.Provider, error) {
	providers, err := s.embeddingClient.GetProviders(ctx, businessParams)
	if err != nil {
		return nil, errors.Join(ErrEmbeddingProvidersListFailed, err)
	}
	return providers, nil
}
