package embeddingcache

import (
	"context"
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/pkg/logkey"
	"magic/pkg/convert"
)

// FindExpiredCaches 查找过期的缓存记录
func (repo *Repository) FindExpiredCaches(ctx context.Context, criteria *embedding.CacheCleanupCriteria, offset, limit int) ([]*embedding.Cache, error) {
	now := time.Now()
	orConds := sq.Or{}

	if criteria.MinAccessCount > 0 {
		orConds = append(orConds, sq.Lt{"access_count": criteria.MinAccessCount})
	}

	if criteria.MaxIdleDuration > 0 {
		idleThreshold := now.Add(-criteria.MaxIdleDuration)
		orConds = append(orConds, sq.Lt{"last_accessed_at": idleThreshold})
	}

	if criteria.MaxCacheAge > 0 {
		ageThreshold := now.Add(-criteria.MaxCacheAge)
		orConds = append(orConds, sq.Lt{"created_at": ageThreshold})
	}

	if len(orConds) == 0 {
		return []*embedding.Cache{}, nil
	}

	limitU64, err := convert.SafeIntToUint64(limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}
	offsetU64, err := convert.SafeIntToUint64(offset, "offset")
	if err != nil {
		return nil, fmt.Errorf("invalid offset: %w", err)
	}

	query := sq.Select("id", "text_hash", "text_preview", "text_length", "embedding", "embedding_model",
		"vector_dimension", "access_count", "last_accessed_at", "created_at", "updated_at").
		From("embedding_cache").
		Where(orConds).
		OrderBy("last_accessed_at ASC", "access_count ASC").
		Limit(limitU64).
		Offset(offsetU64).
		PlaceholderFormat(sq.Question)

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build find expired caches query: %w", err)
	}

	rows, err := repo.client.QueryContext(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to find expired caches: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			repo.logger.WarnContext(ctx, "failed to close rows", logkey.Error, closeErr)
		}
	}()

	var caches []*embedding.Cache
	for rows.Next() {
		cache, err := scanCacheRow(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cache row: %w", err)
		}
		caches = append(caches, cache)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}
	return caches, nil
}

// CountExpiredCaches 统计过期缓存的数量
func (repo *Repository) CountExpiredCaches(ctx context.Context, criteria *embedding.CacheCleanupCriteria) (int64, error) {
	now := time.Now()
	orConds := sq.Or{}

	if criteria.MinAccessCount > 0 {
		orConds = append(orConds, sq.Lt{"access_count": criteria.MinAccessCount})
	}

	if criteria.MaxIdleDuration > 0 {
		idleThreshold := now.Add(-criteria.MaxIdleDuration)
		orConds = append(orConds, sq.Lt{"last_accessed_at": idleThreshold})
	}

	if criteria.MaxCacheAge > 0 {
		ageThreshold := now.Add(-criteria.MaxCacheAge)
		orConds = append(orConds, sq.Lt{"created_at": ageThreshold})
	}

	if len(orConds) == 0 {
		return 0, nil
	}

	query := sq.Select("COUNT(*)").
		From("embedding_cache").
		Where(orConds).
		PlaceholderFormat(sq.Question)

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return 0, fmt.Errorf("failed to build count expired caches query: %w", err)
	}

	var count int64
	row := repo.client.QueryRowContext(ctx, sqlStr, args...)
	if err := row.Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count expired caches: %w", err)
	}

	return count, nil
}

// CleanupExpiredCaches 清理过期缓存
func (repo *Repository) CleanupExpiredCaches(ctx context.Context, criteria *embedding.CacheCleanupCriteria) (int64, error) {
	batchSize := criteria.BatchSize
	if batchSize <= 0 {
		batchSize = 1000
	}

	var totalDeleted int64

	for {
		ids, err := repo.findExpiredCacheIDs(ctx, criteria, 0, batchSize)
		if err != nil {
			return totalDeleted, fmt.Errorf("failed to find expired cache ids: %w", err)
		}

		if len(ids) == 0 {
			break
		}

		if err := repo.BatchDelete(ctx, ids); err != nil {
			return totalDeleted, fmt.Errorf("failed to batch delete expired caches: %w", err)
		}

		totalDeleted += int64(len(ids))
		if len(ids) < batchSize {
			break
		}
	}

	return totalDeleted, nil
}

func (repo *Repository) findExpiredCacheIDs(ctx context.Context, criteria *embedding.CacheCleanupCriteria, offset, limit int) ([]int64, error) {
	now := time.Now()
	sqlStr, args, hasConditions, err := buildFindExpiredCacheIDsQuery(criteria, now, offset, limit)
	if err != nil {
		return nil, err
	}
	if !hasConditions {
		return []int64{}, nil
	}

	rows, err := repo.client.QueryContext(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query expired cache ids: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			repo.logger.WarnContext(ctx, "failed to close rows", logkey.Error, closeErr)
		}
	}()

	ids := make([]int64, 0, limit)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan expired cache id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return ids, nil
}

func buildFindExpiredCacheIDsQuery(
	criteria *embedding.CacheCleanupCriteria,
	now time.Time,
	offset, limit int,
) (string, []any, bool, error) {
	orConds := sq.Or{}

	if criteria.MinAccessCount > 0 {
		orConds = append(orConds, sq.Lt{"access_count": criteria.MinAccessCount})
	}
	if criteria.MaxIdleDuration > 0 {
		orConds = append(orConds, sq.Lt{"last_accessed_at": now.Add(-criteria.MaxIdleDuration)})
	}
	if criteria.MaxCacheAge > 0 {
		orConds = append(orConds, sq.Lt{"created_at": now.Add(-criteria.MaxCacheAge)})
	}
	if len(orConds) == 0 {
		return "", nil, false, nil
	}

	limitU64, err := convert.SafeIntToUint64(limit, "limit")
	if err != nil {
		return "", nil, false, fmt.Errorf("invalid limit: %w", err)
	}
	offsetU64, err := convert.SafeIntToUint64(offset, "offset")
	if err != nil {
		return "", nil, false, fmt.Errorf("invalid offset: %w", err)
	}

	query := sq.Select("id").
		From("embedding_cache").
		Where(orConds).
		OrderBy("last_accessed_at ASC", "access_count ASC", "id ASC").
		Limit(limitU64).
		Offset(offsetU64).
		PlaceholderFormat(sq.Question)

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return "", nil, false, fmt.Errorf("failed to build find expired cache ids query: %w", err)
	}

	return sqlStr, args, true, nil
}
