// Package external 提供外部服务集成的 HTTP 客户端。
package external

import (
	"context"
	"fmt"
	"strings"
	"time"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/ratelimit"
)

const (
	defaultEmbeddingRateLimitKey  = "embedding:compute"
	defaultEmbeddingRateLimitWait = 10 * time.Second
)

// EmbeddingRateLimiter 描述 embedding compute 需要的通用限流能力。
type EmbeddingRateLimiter interface {
	Wait(ctx context.Context, key string, timeout time.Duration) (ratelimit.Result, error)
}

// EmbeddingRateLimitConfig 描述 embedding compute 限流配置。
type EmbeddingRateLimitConfig struct {
	Key         string
	WaitTimeout time.Duration
}

// EmbeddingService 包装 EmbeddingClient，提供服务层接口
type EmbeddingService struct {
	client       embedding.Client
	defaultModel string
	rateLimiter  EmbeddingRateLimiter
	rateLimit    EmbeddingRateLimitConfig
}

// NewEmbeddingService 创建新的 embedding 服务
func NewEmbeddingService(client embedding.Client, defaultModel string) *EmbeddingService {
	return &EmbeddingService{
		client:       client,
		defaultModel: defaultModel,
	}
}

// SetRateLimiter 注入可选的 embedding compute 限流器。
func (s *EmbeddingService) SetRateLimiter(limiter EmbeddingRateLimiter, config EmbeddingRateLimitConfig) {
	if s == nil {
		return
	}
	s.rateLimiter = limiter
	s.rateLimit = normalizeEmbeddingRateLimitConfig(config)
}

// GetEmbedding 实现 embedding 服务接口
func (s *EmbeddingService) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if model == "" {
		model = s.defaultModel
	}

	if err := s.waitRateLimit(ctx); err != nil {
		return nil, fmt.Errorf("get embedding: %w", err)
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

	if err := s.waitRateLimit(ctx); err != nil {
		return nil, fmt.Errorf("get batch embeddings: %w", err)
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

func (s *EmbeddingService) waitRateLimit(ctx context.Context) error {
	if s == nil || s.rateLimiter == nil {
		return nil
	}
	config := normalizeEmbeddingRateLimitConfig(s.rateLimit)
	if _, err := s.rateLimiter.Wait(ctx, config.Key, config.WaitTimeout); err != nil {
		return fmt.Errorf("wait embedding rate limit token: %w", err)
	}
	return nil
}

func normalizeEmbeddingRateLimitConfig(config EmbeddingRateLimitConfig) EmbeddingRateLimitConfig {
	if strings.TrimSpace(config.Key) == "" {
		config.Key = defaultEmbeddingRateLimitKey
	}
	if config.WaitTimeout <= 0 {
		config.WaitTimeout = defaultEmbeddingRateLimitWait
	}
	return config
}
