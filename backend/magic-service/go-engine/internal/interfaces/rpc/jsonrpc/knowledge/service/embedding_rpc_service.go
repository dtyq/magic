package service

import (
	"context"
	"fmt"

	embeddto "magic/internal/application/knowledge/embedding/dto"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	"magic/internal/pkg/ctxmeta"
)

type embeddingApplicationService interface {
	Compute(ctx context.Context, input *embeddto.ComputeEmbeddingInput) (*embeddto.ComputeEmbeddingOutput, error)
	ComputeBatch(ctx context.Context, input *embeddto.ComputeBatchEmbeddingInput) (*embeddto.ComputeBatchEmbeddingOutput, error)
	ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) (any, error)
}

type concreteEmbeddingApplicationService struct {
	service *embeddingapp.EmbeddingAppService
}

func (s concreteEmbeddingApplicationService) Compute(ctx context.Context, input *embeddto.ComputeEmbeddingInput) (*embeddto.ComputeEmbeddingOutput, error) {
	result, err := s.service.Compute(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("compute embedding: %w", err)
	}
	return result, nil
}

func (s concreteEmbeddingApplicationService) ComputeBatch(ctx context.Context, input *embeddto.ComputeBatchEmbeddingInput) (*embeddto.ComputeBatchEmbeddingOutput, error) {
	result, err := s.service.ComputeBatch(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("compute batch embedding: %w", err)
	}
	return result, nil
}

func (s concreteEmbeddingApplicationService) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) (any, error) {
	result, err := s.service.ListProviders(ctx, businessParams)
	if err != nil {
		return nil, fmt.Errorf("list embedding providers: %w", err)
	}
	return result, nil
}

// EmbeddingRPCService 嵌入 RPC 处理器
type EmbeddingRPCService struct {
	appService embeddingApplicationService
	logger     *logging.SugaredLogger
}

// NewEmbeddingRPCService 创建嵌入处理器
func NewEmbeddingRPCService(
	appService *embeddingapp.EmbeddingAppService,
	logger *logging.SugaredLogger,
) *EmbeddingRPCService {
	return NewEmbeddingRPCServiceWithDependencies(concreteEmbeddingApplicationService{service: appService}, logger)
}

// NewEmbeddingRPCServiceWithDependencies 创建支持接口替身的嵌入处理器。
func NewEmbeddingRPCServiceWithDependencies(
	appService embeddingApplicationService,
	logger *logging.SugaredLogger,
) *EmbeddingRPCService {
	return &EmbeddingRPCService{
		appService: appService,
		logger:     logger,
	}
}

// ==================== 新的强类型 RPC 方法 ====================

// ComputeRPC 计算单个文本嵌入（RPC 版本）
func (h *EmbeddingRPCService) ComputeRPC(ctx context.Context, req *dto.ComputeEmbeddingRequest) (*embeddto.ComputeEmbeddingOutput, error) {
	input := &embeddto.ComputeEmbeddingInput{
		Text:  req.Text,
		Model: req.Model,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	}

	result, err := h.appService.Compute(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to compute embedding", "error", err)
		return nil, mapBusinessError(err)
	}

	return result, nil
}

// ComputeBatchRPC 批量计算文本嵌入（RPC 版本）
func (h *EmbeddingRPCService) ComputeBatchRPC(ctx context.Context, req *dto.ComputeBatchEmbeddingRequest) (*embeddto.ComputeBatchEmbeddingOutput, error) {
	input := &embeddto.ComputeBatchEmbeddingInput{
		Texts: req.Texts,
		Model: req.Model,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	}

	result, err := h.appService.ComputeBatch(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to compute batch embeddings", "error", err)
		return nil, mapBusinessError(err)
	}

	return result, nil
}

// ListProvidersRPC 获取嵌入模型提供商列表（RPC 版本）
func (h *EmbeddingRPCService) ListProvidersRPC(ctx context.Context, req *dto.ListEmbeddingProvidersRequest) (any, error) {
	businessParams := &ctxmeta.BusinessParams{
		OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
		UserID:           req.BusinessParams.UserID,
		BusinessID:       req.BusinessParams.BusinessID,
	}

	providers, err := h.appService.ListProviders(ctx, businessParams)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to list embedding providers", "error", err)
		return nil, mapBusinessError(err)
	}

	return providers, nil
}
