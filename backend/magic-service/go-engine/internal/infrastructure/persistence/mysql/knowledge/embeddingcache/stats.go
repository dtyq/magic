package embeddingcache

import (
	"context"
	"fmt"

	"magic/internal/domain/knowledge/embedding"
	"magic/pkg/convert"
)

// GetCacheStatistics 获取缓存统计信息
func (repo *Repository) GetCacheStatistics(ctx context.Context) (*embedding.CacheStatistics, error) {
	stats := &embedding.CacheStatistics{CachesByModel: make(map[string]int)}
	if err := repo.fillBasicStats(ctx, stats); err != nil {
		return nil, err
	}
	if err := repo.fillModelStats(ctx, stats); err != nil {
		return nil, err
	}
	if err := repo.fillStorageEstimate(ctx, stats); err != nil {
		return nil, err
	}
	return stats, nil
}

func (repo *Repository) fillBasicStats(ctx context.Context, stats *embedding.CacheStatistics) error {
	basicStats, err := repo.client.Q().BasicStats(ctx)
	if err != nil {
		return fmt.Errorf("failed to get basic cache statistics: %w", err)
	}
	totalCaches, err := convert.SafeInt64ToInt32(basicStats.TotalCaches, "total_caches")
	if err != nil {
		return fmt.Errorf("invalid total_caches: %w", err)
	}
	stats.TotalCaches = int(totalCaches)
	uniqueModels, err := convert.SafeInt64ToInt32(basicStats.UniqueModels, "unique_models")
	if err != nil {
		return fmt.Errorf("invalid unique_models: %w", err)
	}
	stats.UniqueModels = int(uniqueModels)
	totalAccessCount, err := convert.SafeInt64ToInt32(basicStats.TotalAccessCount, "total_access_count")
	if err != nil {
		return fmt.Errorf("invalid total_access_count: %w", err)
	}
	stats.TotalAccessCount = int(totalAccessCount)
	stats.AverageAccessCount = basicStats.AverageAccessCount
	if stats.TotalCaches == 0 {
		stats.OldestCache = nil
		stats.NewestCache = nil
		stats.LastAccessTime = nil
		return nil
	}
	oldest, err := convert.ParseTimePtr(basicStats.OldestCache)
	if err != nil {
		return fmt.Errorf("invalid oldest_cache: %w", err)
	}
	newest, err := convert.ParseTimePtr(basicStats.NewestCache)
	if err != nil {
		return fmt.Errorf("invalid newest_cache: %w", err)
	}
	lastAccess, err := convert.ParseTimePtr(basicStats.LastAccessTime)
	if err != nil {
		return fmt.Errorf("invalid last_access_time: %w", err)
	}
	stats.OldestCache = oldest
	stats.NewestCache = newest
	stats.LastAccessTime = lastAccess
	return nil
}

func (repo *Repository) fillModelStats(ctx context.Context, stats *embedding.CacheStatistics) error {
	modelStats, err := repo.client.Q().ModelStats(ctx)
	if err != nil {
		return fmt.Errorf("failed to get model statistics: %w", err)
	}
	for _, modelStat := range modelStats {
		count, err := convert.ParseInt(modelStat.Count)
		if err != nil {
			return fmt.Errorf("invalid model_stats.count (%T): %w", modelStat.Count, err)
		}
		stats.CachesByModel[modelStat.EmbeddingModel] = count
	}
	return nil
}

func (repo *Repository) fillStorageEstimate(ctx context.Context, stats *embedding.CacheStatistics) error {
	estimate, err := repo.client.Q().EstimateStorage(ctx)
	if err != nil {
		return fmt.Errorf("failed to estimate storage size: %w", err)
	}
	stats.StorageSizeBytes = estimate
	return nil
}
