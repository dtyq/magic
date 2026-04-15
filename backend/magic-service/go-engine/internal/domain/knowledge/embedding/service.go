// Package embedding 提供知识库嵌入领域服务。
package embedding

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/logkey"
)

// ErrContentEmpty 当 content 为空时返回
var ErrContentEmpty = errors.New("content cannot be empty")

var (
	// ErrNilContext 当调用方传入 nil context 时返回。
	ErrNilContext = errors.New("context cannot be nil")
	// ErrInvalidBatchEmbeddingResultLength 表示批量 embedding 返回长度与请求不一致。
	ErrInvalidBatchEmbeddingResultLength = errors.New("invalid batch embedding result length")
	// ErrEmbeddingComputeFailed 表示 embedding 计算失败。
	ErrEmbeddingComputeFailed = errors.New("embedding compute failed")
	// ErrEmbeddingProvidersListFailed 表示 embedding provider 查询失败。
	ErrEmbeddingProvidersListFailed = errors.New("embedding providers list failed")
)

// 缓存操作的超时常量
const (
	cacheWriteTimeout      = 5 * time.Second
	batchCacheWriteTimeout = 10 * time.Second
)

// Result 封装单条 embedding 结果和缓存命中信息。
type Result struct {
	Embedding []float64
	CacheHit  bool
}

// BatchResult 封装批量 embedding 结果和缓存命中信息。
type BatchResult struct {
	Embeddings [][]float64
	CacheHit   int
}

// ContentLoader 定义内容加载能力
// 负责从外部源（URL、文件等）加载内容
type ContentLoader interface {
	// LoadFromURL 从 URL 加载内容
	LoadFromURL(ctx context.Context, url string) (string, error)
}

// DomainService 实现计算和缓存 embedding 的领域逻辑。
type DomainService struct {
	cacheRepo     CacheRepository
	analysisRepo  CacheAnalysisRepository
	embeddingRepo Repository // 通过 Repository 抽象，而非直接依赖客户端
	logger        *logging.SugaredLogger
}

// NewDomainService 创建 DomainService 的新实例。
func NewDomainService(
	cacheRepo CacheRepository,
	analysisRepo CacheAnalysisRepository,
	embeddingRepo Repository, // 依赖 Repository 接口
	logger *logging.SugaredLogger,
) *DomainService {
	return &DomainService{
		cacheRepo:     cacheRepo,
		analysisRepo:  analysisRepo,
		embeddingRepo: embeddingRepo,
		logger:        logger,
	}
}

// NewEmbeddingDomainService 兼容旧构造函数名称。
func NewEmbeddingDomainService(
	cacheRepo CacheRepository,
	analysisRepo CacheAnalysisRepository,
	embeddingRepo Repository,
	logger *logging.SugaredLogger,
) *DomainService {
	return NewDomainService(cacheRepo, analysisRepo, embeddingRepo, logger)
}

// GetEmbedding 获取单个文本的 embedding（优先从缓存）
func (s *DomainService) GetEmbedding(
	ctx context.Context,
	text string,
	model string,
	businessParams *ctxmeta.BusinessParams,
) ([]float64, error) {
	result, err := s.GetEmbeddingWithMeta(ctx, text, model, businessParams)
	if err != nil {
		return nil, err
	}
	return result.Embedding, nil
}

// GetEmbeddingWithMeta 获取单个文本 embedding，并返回缓存命中信息。
func (s *DomainService) GetEmbeddingWithMeta(
	ctx context.Context,
	text string,
	model string,
	businessParams *ctxmeta.BusinessParams,
) (*Result, error) {
	if ctx == nil {
		return nil, ErrNilContext
	}

	textHash := s.hashText(text)

	// 1. 尝试从缓存获取
	cached, err := s.cacheRepo.FindByHash(ctx, textHash, model)
	if err != nil {
		s.logger.WarnContext(ctx, "Failed to query cache", logkey.Error, err)
	} else if cached != nil {
		return &Result{
			Embedding: cached.Embedding,
			CacheHit:  true,
		}, nil
	}

	// 2. 缓存未命中，通过 Repository 计算 embedding
	embedding, err := s.embeddingRepo.ComputeEmbedding(ctx, text, model, businessParams)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to compute embedding: %w", ErrEmbeddingComputeFailed, err)
	}

	// 3. 异步保存到缓存
	go s.asyncSaveToCache(ctx, text, embedding, model)

	return &Result{
		Embedding: embedding,
		CacheHit:  false,
	}, nil
}

// GetEmbeddings 批量获取 embeddings（优先从缓存，缓存未命中部分计算后写入缓存）
func (s *DomainService) GetEmbeddings(
	ctx context.Context,
	texts []string,
	model string,
	businessParams *ctxmeta.BusinessParams,
) ([][]float64, error) {
	result, err := s.GetEmbeddingsWithMeta(ctx, texts, model, businessParams)
	if err != nil {
		return nil, err
	}
	return result.Embeddings, nil
}

// GetEmbeddingsWithMeta 批量获取 embeddings，并返回缓存命中条目数。
func (s *DomainService) GetEmbeddingsWithMeta(
	ctx context.Context,
	texts []string,
	model string,
	businessParams *ctxmeta.BusinessParams,
) (*BatchResult, error) {
	if ctx == nil {
		return nil, ErrNilContext
	}

	if len(texts) == 0 {
		return &BatchResult{
			Embeddings: [][]float64{},
			CacheHit:   0,
		}, nil
	}

	// 1. 构建唯一 hash 列表（用于批量查缓存）
	textHashes := s.buildUniqueTextHashes(texts)

	// 2. 批量查询缓存
	cachedMap, err := s.cacheRepo.FindByHashes(ctx, textHashes, model)
	if err != nil {
		s.logger.WarnContext(ctx, "Failed to query cache batch", logkey.Error, err)
		cachedMap = make(map[string]*Cache)
	}

	// 3. 区分缓存命中和未命中（未命中按 hash 去重计算，按条目数统计命中）
	result := make([][]float64, len(texts))
	missingTextByHash := make(map[string]string)
	missingIndicesByHash := make(map[string][]int)
	missingHashes := make([]string, 0)
	cacheHitCount := 0
	for i, text := range texts {
		textHash := s.hashText(text)
		cached, found := cachedMap[textHash]

		if found {
			result[i] = cached.Embedding
			cacheHitCount++
		} else {
			if _, ok := missingTextByHash[textHash]; !ok {
				missingTextByHash[textHash] = text
				missingHashes = append(missingHashes, textHash)
			}
			missingIndicesByHash[textHash] = append(missingIndicesByHash[textHash], i)
		}
	}

	// 4. 批量计算缺失的 embeddings
	if len(missingHashes) > 0 {
		missingTexts := make([]string, len(missingHashes))
		for i, hash := range missingHashes {
			missingTexts[i] = missingTextByHash[hash]
		}
		embeddings, err := s.embeddingRepo.ComputeBatchEmbeddings(ctx, missingTexts, model, businessParams)
		if err != nil {
			return nil, fmt.Errorf("%w: failed to batch compute embeddings: %w", ErrEmbeddingComputeFailed, err)
		}
		if len(embeddings) != len(missingTexts) {
			return nil, fmt.Errorf("%w: got %d, want %d", ErrInvalidBatchEmbeddingResultLength, len(embeddings), len(missingTexts))
		}

		// 填充结果（按 hash 回填到所有对应条目）
		for idx, hash := range missingHashes {
			embedding := embeddings[idx]
			for _, resultIdx := range missingIndicesByHash[hash] {
				result[resultIdx] = embedding
			}
		}

		// 5. 异步批量保存到缓存
		go s.asyncSaveBatchToCache(ctx, missingTexts, embeddings, model)
	}

	return &BatchResult{
		Embeddings: result,
		CacheHit:   cacheHitCount,
	}, nil
}

// hashText 计算文本的 SHA256 哈希
func (s *DomainService) hashText(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])
}

func (s *DomainService) buildUniqueTextHashes(texts []string) []string {
	textHashes := make([]string, 0, len(texts))
	seen := make(map[string]struct{}, len(texts))
	for _, text := range texts {
		h := s.hashText(text)
		if _, ok := seen[h]; ok {
			continue
		}
		seen[h] = struct{}{}
		textHashes = append(textHashes, h)
	}

	return textHashes
}

// asyncSaveToCache 异步保存单个缓存
func (s *DomainService) asyncSaveToCache(parentCtx context.Context, text string, embedding []float64, model string) {
	// 保留上下文 value，同时避免请求取消导致缓存写入被中断。
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parentCtx), cacheWriteTimeout)
	defer cancel()

	if err := s.cacheRepo.SaveIfAbsent(ctx, text, embedding, model); err != nil {
		s.logger.WarnContext(ctx, "Failed to save cache", logkey.Error, err)
	}
}

// asyncSaveBatchToCache 异步批量保存缓存
func (s *DomainService) asyncSaveBatchToCache(parentCtx context.Context, texts []string, embeddings [][]float64, model string) {
	// 保留上下文 value，同时避免请求取消导致缓存写入被中断。
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parentCtx), batchCacheWriteTimeout)
	defer cancel()

	caches := make([]*Cache, len(texts))

	for i, text := range texts {
		caches[i] = NewEmbeddingCache(text, embeddings[i], model)
	}

	if err := s.cacheRepo.SaveBatch(ctx, caches); err != nil {
		s.logger.WarnContext(ctx, "Failed to save cache batch", logkey.Error, err)
	}
}

// GetCacheStatistics 获取缓存统计信息
func (s *DomainService) GetCacheStatistics(ctx context.Context) (*CacheStatistics, error) {
	stats, err := s.analysisRepo.GetCacheStatistics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get cache statistics: %w", err)
	}
	return stats, nil
}

// CleanupExpiredCaches 清理过期缓存
func (s *DomainService) CleanupExpiredCaches(ctx context.Context, criteria *CacheCleanupCriteria) (int64, error) {
	count, err := s.analysisRepo.CleanupExpiredCaches(ctx, criteria)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired caches: %w", err)
	}
	return count, nil
}

// SearchCaches 根据条件搜索缓存
func (s *DomainService) SearchCaches(ctx context.Context, query *CacheQuery) ([]*Cache, int64, error) {
	caches, total, err := s.analysisRepo.SearchCaches(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search caches: %w", err)
	}
	return caches, total, nil
}

// GetCachesByModel 根据模型获取缓存
func (s *DomainService) GetCachesByModel(ctx context.Context, model string, offset, limit int) ([]*Cache, error) {
	caches, err := s.analysisRepo.GetCachesByModel(ctx, model, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get caches by model: %w", err)
	}
	return caches, nil
}

// DeleteCacheByHash 根据 hash 删除缓存
func (s *DomainService) DeleteCacheByHash(ctx context.Context, textHash string) error {
	if err := s.cacheRepo.DeleteByHash(ctx, textHash); err != nil {
		return fmt.Errorf("failed to delete cache by hash: %w", err)
	}
	return nil
}

// BatchDeleteCaches 批量删除缓存
func (s *DomainService) BatchDeleteCaches(ctx context.Context, ids []int64) error {
	if err := s.cacheRepo.BatchDelete(ctx, ids); err != nil {
		return fmt.Errorf("failed to batch delete caches: %w", err)
	}
	return nil
}

// GetLeastAccessedCaches 获取访问最少的缓存
func (s *DomainService) GetLeastAccessedCaches(ctx context.Context, limit int) ([]*Cache, error) {
	caches, err := s.analysisRepo.GetLeastAccessed(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get least accessed caches: %w", err)
	}
	return caches, nil
}

// GetProviders 获取可用的 embedding 模型提供商列表
// 直接从 Repository 获取，不做缓存
func (s *DomainService) GetProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*Provider, error) {
	providers, err := s.embeddingRepo.ListProviders(ctx, businessParams)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to get providers: %w", ErrEmbeddingProvidersListFailed, err)
	}
	return providers, nil
}
