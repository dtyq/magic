package embeddingcache

import (
	"context"
	"fmt"

	sq "github.com/Masterminds/squirrel"

	"magic/internal/domain/knowledge/embedding"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	"magic/internal/pkg/logkey"
	"magic/pkg/convert"
)

// SearchCaches 根据查询条件搜索缓存
func (repo *Repository) SearchCaches(ctx context.Context, query *embedding.CacheQuery) ([]*embedding.Cache, int64, error) {
	conds := buildSearchConditions(query)
	orderBy := buildOrderBy(query)

	countBuilder := sq.Select("COUNT(*)").
		From("embedding_cache").
		PlaceholderFormat(sq.Question)

	if len(conds) > 0 {
		countBuilder = countBuilder.Where(conds)
	}

	countSQL, countArgs, err := countBuilder.ToSql()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build count query: %w", err)
	}

	var total int64
	row := repo.client.QueryRowContext(ctx, countSQL, countArgs...)
	if err := row.Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	limitU64, err := convert.SafeIntToUint64(query.Limit, "limit")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid limit: %w", err)
	}
	offsetU64, err := convert.SafeIntToUint64(query.Offset, "offset")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid offset: %w", err)
	}

	dataBuilder := sq.Select("id", "text_hash", "text_preview", "text_length", "embedding", "embedding_model",
		"vector_dimension", "access_count", "last_accessed_at", "created_at", "updated_at").
		From("embedding_cache").
		OrderBy(orderBy).
		Limit(limitU64).
		Offset(offsetU64).
		PlaceholderFormat(sq.Question)

	if len(conds) > 0 {
		dataBuilder = dataBuilder.Where(conds)
	}

	dataSQL, dataArgs, err := dataBuilder.ToSql()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build data query: %w", err)
	}

	rows, err := repo.client.QueryContext(ctx, dataSQL, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute search query: %w", err)
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
			return nil, 0, fmt.Errorf("failed to scan cache row: %w", err)
		}
		caches = append(caches, cache)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("rows error: %w", err)
	}

	return caches, total, nil
}

// buildSearchConditions 根据查询参数构建 WHERE 条件
func buildSearchConditions(query *embedding.CacheQuery) sq.And {
	conds := sq.And{}

	if query.Model != "" {
		conds = append(conds, sq.Eq{"embedding_model": query.Model})
	}
	if query.MinAccessCount != nil {
		conds = append(conds, sq.GtOrEq{"access_count": *query.MinAccessCount})
	}
	if query.MaxAccessCount != nil {
		conds = append(conds, sq.LtOrEq{"access_count": *query.MaxAccessCount})
	}
	if query.CreatedAfter != nil {
		conds = append(conds, sq.GtOrEq{"created_at": *query.CreatedAfter})
	}
	if query.CreatedBefore != nil {
		conds = append(conds, sq.LtOrEq{"created_at": *query.CreatedBefore})
	}
	if query.AccessedAfter != nil {
		conds = append(conds, sq.GtOrEq{"last_accessed_at": *query.AccessedAfter})
	}
	if query.AccessedBefore != nil {
		conds = append(conds, sq.LtOrEq{"last_accessed_at": *query.AccessedBefore})
	}
	if query.MinTextLength != nil {
		conds = append(conds, sq.GtOrEq{"text_length": *query.MinTextLength})
	}
	if query.MaxTextLength != nil {
		conds = append(conds, sq.LtOrEq{"text_length": *query.MaxTextLength})
	}
	if query.VectorDimension != nil {
		conds = append(conds, sq.Eq{"vector_dimension": *query.VectorDimension})
	}

	return conds
}

// buildOrderBy 根据查询参数构建 ORDER BY 子句
func buildOrderBy(query *embedding.CacheQuery) string {
	return newEmbeddingCacheOrderWhitelist().Clause(query.OrderBy, query.OrderDirection == embedding.SortAsc)
}

func newEmbeddingCacheOrderWhitelist() knowledgeShared.OrderWhitelist[embedding.CacheOrderBy] {
	return knowledgeShared.NewOrderWhitelist("id", map[embedding.CacheOrderBy]string{
		embedding.EmbeddingCacheOrderByID:              "id",
		embedding.EmbeddingCacheOrderByCreatedAt:       "created_at",
		embedding.EmbeddingCacheOrderByUpdatedAt:       "updated_at",
		embedding.EmbeddingCacheOrderByLastAccessedAt:  "last_accessed_at",
		embedding.EmbeddingCacheOrderByAccessCount:     "access_count",
		embedding.EmbeddingCacheOrderByTextLength:      "text_length",
		embedding.EmbeddingCacheOrderByVectorDimension: "vector_dimension",
	})
}
