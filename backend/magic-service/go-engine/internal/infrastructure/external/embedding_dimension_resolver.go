package external

import (
	"context"
	"errors"
	"fmt"
	"strings"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/pkg/ctxmeta"
)

var (
	// ErrMissingDimension 表示既无法从模型或实际 embedding 推断维度，也没有配置兜底值。
	ErrMissingDimension = errors.New("embedding.dimension fallback is required when model dimension cannot be resolved")
	// ErrServiceUnavailable 表示 embedding 服务不可用。
	ErrServiceUnavailable = errors.New("embedding dimension not configured and embedding service unavailable")
	// ErrEmptyEmbedding 表示返回的 embedding 为空。
	ErrEmptyEmbedding = errors.New("resolve embedding dimension: empty embedding")
)

// EmbeddingDimensionResolver 嵌入维度解析器：优先使用配置，否则通过 embedding 返回值探测。
type EmbeddingDimensionResolver struct {
	cfg              *autoloadcfg.Config
	embeddingService *EmbeddingService
}

// NewEmbeddingDimensionResolver 创建解析器。
func NewEmbeddingDimensionResolver(cfg *autoloadcfg.Config, embeddingService *EmbeddingService) *EmbeddingDimensionResolver {
	return &EmbeddingDimensionResolver{
		cfg:              cfg,
		embeddingService: embeddingService,
	}
}

// ResolveDimension 返回指定模型的向量维度。
// 优先级：模型内置维度 > 实际 embedding probe > 配置 fallback。
func (r *EmbeddingDimensionResolver) ResolveDimension(ctx context.Context, model string) (int64, error) {
	targetModel := r.resolveTargetModel(model)
	if knownDim, ok := knownModelDimension(targetModel); ok {
		return knownDim, nil
	}

	probedDim, probeErr := r.resolveProbeDimension(ctx, targetModel)
	if probeErr == nil && probedDim > 0 {
		return probedDim, nil
	}

	if fallbackDim := r.resolveFallbackDimension(); fallbackDim > 0 {
		return fallbackDim, nil
	}

	if probeErr != nil {
		return 0, probeErr
	}
	return 0, ErrMissingDimension
}

func (r *EmbeddingDimensionResolver) resolveTargetModel(model string) string {
	targetModel := strings.TrimSpace(model)
	if targetModel == "" && r.cfg != nil {
		targetModel = r.cfg.MagicModelGateway.DefaultEmbeddingModel
	}
	if targetModel == "" {
		targetModel = "text-embedding-3-small"
	}
	return targetModel
}

func (r *EmbeddingDimensionResolver) resolveProbeDimension(ctx context.Context, model string) (int64, error) {
	if r.embeddingService == nil {
		return 0, ErrServiceUnavailable
	}

	businessParams, _ := ctxmeta.BusinessParamsFromContext(ctx)
	embedding, err := r.embeddingService.GetEmbedding(ctx, "dimension-probe", model, businessParams)
	if err != nil {
		return 0, fmt.Errorf("resolve embedding dimension: %w", err)
	}
	if len(embedding) == 0 {
		return 0, ErrEmptyEmbedding
	}
	return int64(len(embedding)), nil
}

func (r *EmbeddingDimensionResolver) resolveFallbackDimension() int64 {
	if r == nil || r.cfg == nil || r.cfg.Embedding.Dimension <= 0 {
		return 0
	}
	return int64(r.cfg.Embedding.Dimension)
}

func normalizeEmbeddingModelName(model string) string {
	return strings.ToLower(strings.TrimSpace(model))
}

func knownModelDimension(model string) (int64, bool) {
	switch normalizeEmbeddingModelName(model) {
	case "text-embedding-3-small":
		return knowledgebase.VectorSize3Small, true
	case "text-embedding-3-large":
		return knowledgebase.VectorSize3Large, true
	case "dmeta-embedding":
		return knowledgebase.VectorSizeDMeta, true
	default:
		return 0, false
	}
}
