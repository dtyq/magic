package embeddingcache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"magic/internal/domain/knowledge/embedding"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

type cleanupMask uint8

const (
	cleanupMaskAccess cleanupMask = 1 << iota
	cleanupMaskIdle
	cleanupMaskAge
)

type cleanupQueryPlan struct {
	mask             cleanupMask
	maxAccessCount   int32
	maxIdleBefore    time.Time
	maxCreatedBefore time.Time
	limit            int32
	offset           int32
}

var (
	errCleanupLimitNegative   = errors.New("cleanup limit must be >= 0")
	errCleanupOffsetNegative  = errors.New("cleanup offset must be >= 0")
	errUnsupportedCleanupMask = errors.New("unsupported cleanup mask")
)

// FindExpiredCaches 查找过期的缓存记录
func (repo *Repository) FindExpiredCaches(
	ctx context.Context,
	criteria *embedding.CacheCleanupCriteria,
	offset, limit int,
) ([]*embedding.Cache, error) {
	plan, hasConditions, err := buildCleanupQueryPlan(criteria, time.Now(), offset, limit)
	if err != nil {
		return nil, err
	}
	if !hasConditions {
		return []*embedding.Cache{}, nil
	}

	rows, err := repo.listExpiredCaches(ctx, plan)
	if err != nil {
		return nil, fmt.Errorf("failed to find expired caches: %w", err)
	}

	caches := make([]*embedding.Cache, 0, len(rows))
	for _, row := range rows {
		cache, err := sqlcCacheToEntity(row)
		if err != nil {
			return nil, err
		}
		caches = append(caches, cache)
	}
	return caches, nil
}

// CountExpiredCaches 统计过期缓存的数量
func (repo *Repository) CountExpiredCaches(ctx context.Context, criteria *embedding.CacheCleanupCriteria) (int64, error) {
	plan, hasConditions, err := buildCleanupQueryPlan(criteria, time.Now(), 0, 1)
	if err != nil {
		return 0, err
	}
	if !hasConditions {
		return 0, nil
	}

	count, err := repo.countExpiredCaches(ctx, plan)
	if err != nil {
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

func (repo *Repository) findExpiredCacheIDs(
	ctx context.Context,
	criteria *embedding.CacheCleanupCriteria,
	offset, limit int,
) ([]int64, error) {
	plan, hasConditions, err := buildCleanupQueryPlan(criteria, time.Now(), offset, limit)
	if err != nil {
		return nil, err
	}
	if !hasConditions {
		return []int64{}, nil
	}

	ids, err := repo.listExpiredCacheIDs(ctx, plan)
	if err != nil {
		return nil, fmt.Errorf("failed to query expired cache ids: %w", err)
	}
	return ids, nil
}

func buildCleanupQueryPlan(
	criteria *embedding.CacheCleanupCriteria,
	now time.Time,
	offset, limit int,
) (cleanupQueryPlan, bool, error) {
	plan := cleanupQueryPlan{}
	if criteria == nil {
		return plan, false, nil
	}

	if criteria.MinAccessCount > 0 {
		maxAccessCount, err := convert.SafeIntToInt32(criteria.MinAccessCount, "min_access_count")
		if err != nil {
			return cleanupQueryPlan{}, false, fmt.Errorf("invalid min_access_count: %w", err)
		}
		plan.mask |= cleanupMaskAccess
		plan.maxAccessCount = maxAccessCount
	}
	if criteria.MaxIdleDuration > 0 {
		plan.mask |= cleanupMaskIdle
		plan.maxIdleBefore = now.Add(-criteria.MaxIdleDuration)
	}
	if criteria.MaxCacheAge > 0 {
		plan.mask |= cleanupMaskAge
		plan.maxCreatedBefore = now.Add(-criteria.MaxCacheAge)
	}
	if plan.mask == 0 {
		return cleanupQueryPlan{}, false, nil
	}
	if limit < 0 {
		return cleanupQueryPlan{}, false, errCleanupLimitNegative
	}
	if offset < 0 {
		return cleanupQueryPlan{}, false, errCleanupOffsetNegative
	}

	limit32, err := convert.SafeIntToInt32(limit, "limit")
	if err != nil {
		return cleanupQueryPlan{}, false, fmt.Errorf("invalid limit: %w", err)
	}
	offset32, err := convert.SafeIntToInt32(offset, "offset")
	if err != nil {
		return cleanupQueryPlan{}, false, fmt.Errorf("invalid offset: %w", err)
	}
	plan.limit = limit32
	plan.offset = offset32
	return plan, true, nil
}

type cleanupDispatcher struct {
	access          func() error
	idle            func() error
	age             func() error
	accessOrIdle    func() error
	accessOrAge     func() error
	idleOrAge       func() error
	accessIdleOrAge func() error
}

type cleanupLabels struct {
	access          string
	idle            string
	age             string
	accessOrIdle    string
	accessOrAge     string
	idleOrAge       string
	accessIdleOrAge string
}

type cleanupQueries[T any] struct {
	accessQuery          func(context.Context, cleanupQueryPlan) (T, error)
	idleQuery            func(context.Context, cleanupQueryPlan) (T, error)
	ageQuery             func(context.Context, cleanupQueryPlan) (T, error)
	accessOrIdleQuery    func(context.Context, cleanupQueryPlan) (T, error)
	accessOrAgeQuery     func(context.Context, cleanupQueryPlan) (T, error)
	idleOrAgeQuery       func(context.Context, cleanupQueryPlan) (T, error)
	accessIdleOrAgeQuery func(context.Context, cleanupQueryPlan) (T, error)
}

func dispatchCleanup(plan cleanupQueryPlan, dispatcher cleanupDispatcher) error {
	switch plan.mask {
	case cleanupMaskAccess:
		return dispatcher.access()
	case cleanupMaskIdle:
		return dispatcher.idle()
	case cleanupMaskAge:
		return dispatcher.age()
	case cleanupMaskAccess | cleanupMaskIdle:
		return dispatcher.accessOrIdle()
	case cleanupMaskAccess | cleanupMaskAge:
		return dispatcher.accessOrAge()
	case cleanupMaskIdle | cleanupMaskAge:
		return dispatcher.idleOrAge()
	case cleanupMaskAccess | cleanupMaskIdle | cleanupMaskAge:
		return dispatcher.accessIdleOrAge()
	default:
		return fmt.Errorf("%w: %d", errUnsupportedCleanupMask, plan.mask)
	}
}

func (repo *Repository) listExpiredCaches(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	var result []mysqlsqlc.EmbeddingCache
	err := executeCleanupSelection(
		ctx,
		plan,
		repo.expiredCacheQueries(),
		newCleanupCacheLabels(),
		func(rows []mysqlsqlc.EmbeddingCache) { result = rows },
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (repo *Repository) countExpiredCaches(ctx context.Context, plan cleanupQueryPlan) (int64, error) {
	var result int64
	err := dispatchCleanup(plan, cleanupDispatcher{
		access: func() error {
			count, err := repo.client.Q().CountExpiredCachesByAccess(ctx, plan.maxAccessCount)
			if err != nil {
				return fmt.Errorf("count expired caches by access: %w", err)
			}
			result = count
			return nil
		},
		idle: func() error {
			count, err := repo.client.Q().CountExpiredCachesByIdle(ctx, plan.maxIdleBefore)
			if err != nil {
				return fmt.Errorf("count expired caches by idle: %w", err)
			}
			result = count
			return nil
		},
		age: func() error {
			count, err := repo.client.Q().CountExpiredCachesByAge(ctx, plan.maxCreatedBefore)
			if err != nil {
				return fmt.Errorf("count expired caches by age: %w", err)
			}
			result = count
			return nil
		},
		accessOrIdle: func() error {
			count, err := repo.client.Q().CountExpiredCachesByAccessOrIdle(ctx, mysqlsqlc.CountExpiredCachesByAccessOrIdleParams{MaxAccessCount: plan.maxAccessCount, MaxIdleBefore: plan.maxIdleBefore})
			if err != nil {
				return fmt.Errorf("count expired caches by access or idle: %w", err)
			}
			result = count
			return nil
		},
		accessOrAge: func() error {
			count, err := repo.client.Q().CountExpiredCachesByAccessOrAge(ctx, mysqlsqlc.CountExpiredCachesByAccessOrAgeParams{MaxAccessCount: plan.maxAccessCount, MaxCreatedBefore: plan.maxCreatedBefore})
			if err != nil {
				return fmt.Errorf("count expired caches by access or age: %w", err)
			}
			result = count
			return nil
		},
		idleOrAge: func() error {
			count, err := repo.client.Q().CountExpiredCachesByIdleOrAge(ctx, mysqlsqlc.CountExpiredCachesByIdleOrAgeParams{MaxIdleBefore: plan.maxIdleBefore, MaxCreatedBefore: plan.maxCreatedBefore})
			if err != nil {
				return fmt.Errorf("count expired caches by idle or age: %w", err)
			}
			result = count
			return nil
		},
		accessIdleOrAge: func() error {
			count, err := repo.client.Q().CountExpiredCachesByAccessOrIdleOrAge(ctx, mysqlsqlc.CountExpiredCachesByAccessOrIdleOrAgeParams{MaxAccessCount: plan.maxAccessCount, MaxIdleBefore: plan.maxIdleBefore, MaxCreatedBefore: plan.maxCreatedBefore})
			if err != nil {
				return fmt.Errorf("count expired caches by access or idle or age: %w", err)
			}
			result = count
			return nil
		},
	})
	if err != nil {
		return 0, err
	}
	return result, nil
}

func (repo *Repository) listExpiredCacheIDs(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	var result []int64
	err := executeCleanupSelection(
		ctx,
		plan,
		repo.expiredCacheIDQueries(),
		newCleanupCacheIDLabels(),
		func(ids []int64) { result = ids },
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func executeCleanupSelection[T any](
	ctx context.Context,
	plan cleanupQueryPlan,
	queries cleanupQueries[T],
	labels cleanupLabels,
	set func(T),
) error {
	return dispatchCleanup(plan, cleanupDispatcher{
		access: func() error {
			value, err := queries.accessQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.access, err)
			}
			set(value)
			return nil
		},
		idle: func() error {
			value, err := queries.idleQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.idle, err)
			}
			set(value)
			return nil
		},
		age: func() error {
			value, err := queries.ageQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.age, err)
			}
			set(value)
			return nil
		},
		accessOrIdle: func() error {
			value, err := queries.accessOrIdleQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.accessOrIdle, err)
			}
			set(value)
			return nil
		},
		accessOrAge: func() error {
			value, err := queries.accessOrAgeQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.accessOrAge, err)
			}
			set(value)
			return nil
		},
		idleOrAge: func() error {
			value, err := queries.idleOrAgeQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.idleOrAge, err)
			}
			set(value)
			return nil
		},
		accessIdleOrAge: func() error {
			value, err := queries.accessIdleOrAgeQuery(ctx, plan)
			if err != nil {
				return fmt.Errorf("%s: %w", labels.accessIdleOrAge, err)
			}
			set(value)
			return nil
		},
	})
}

func (repo *Repository) expiredCacheQueries() cleanupQueries[[]mysqlsqlc.EmbeddingCache] {
	return cleanupQueries[[]mysqlsqlc.EmbeddingCache]{
		accessQuery:          repo.queryExpiredCachesByAccess,
		idleQuery:            repo.queryExpiredCachesByIdle,
		ageQuery:             repo.queryExpiredCachesByAge,
		accessOrIdleQuery:    repo.queryExpiredCachesByAccessOrIdle,
		accessOrAgeQuery:     repo.queryExpiredCachesByAccessOrAge,
		idleOrAgeQuery:       repo.queryExpiredCachesByIdleOrAge,
		accessIdleOrAgeQuery: repo.queryExpiredCachesByAccessOrIdleOrAge,
	}
}

func (repo *Repository) expiredCacheIDQueries() cleanupQueries[[]int64] {
	return cleanupQueries[[]int64]{
		accessQuery:          repo.queryExpiredCacheIDsByAccess,
		idleQuery:            repo.queryExpiredCacheIDsByIdle,
		ageQuery:             repo.queryExpiredCacheIDsByAge,
		accessOrIdleQuery:    repo.queryExpiredCacheIDsByAccessOrIdle,
		accessOrAgeQuery:     repo.queryExpiredCacheIDsByAccessOrAge,
		idleOrAgeQuery:       repo.queryExpiredCacheIDsByIdleOrAge,
		accessIdleOrAgeQuery: repo.queryExpiredCacheIDsByAccessOrIdleOrAge,
	}
}

func newCleanupCacheLabels() cleanupLabels {
	return cleanupLabels{
		access:          "list expired caches by access",
		idle:            "list expired caches by idle",
		age:             "list expired caches by age",
		accessOrIdle:    "list expired caches by access or idle",
		accessOrAge:     "list expired caches by access or age",
		idleOrAge:       "list expired caches by idle or age",
		accessIdleOrAge: "list expired caches by access or idle or age",
	}
}

func newCleanupCacheIDLabels() cleanupLabels {
	return cleanupLabels{
		access:          "list expired cache ids by access",
		idle:            "list expired cache ids by idle",
		age:             "list expired cache ids by age",
		accessOrIdle:    "list expired cache ids by access or idle",
		accessOrAge:     "list expired cache ids by access or age",
		idleOrAge:       "list expired cache ids by idle or age",
		accessIdleOrAge: "list expired cache ids by access or idle or age",
	}
}

func (repo *Repository) queryExpiredCachesByAccess(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByAccess(ctx, mysqlsqlc.ListExpiredCachesByAccessParams{
		MaxAccessCount: plan.maxAccessCount,
		Limit:          plan.limit,
		Offset:         plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by access: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByIdle(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByIdle(ctx, mysqlsqlc.ListExpiredCachesByIdleParams{
		MaxIdleBefore: plan.maxIdleBefore,
		Limit:         plan.limit,
		Offset:        plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by idle: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByAge(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByAge(ctx, mysqlsqlc.ListExpiredCachesByAgeParams{
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by age: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByAccessOrIdle(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByAccessOrIdle(ctx, mysqlsqlc.ListExpiredCachesByAccessOrIdleParams{
		MaxAccessCount: plan.maxAccessCount,
		MaxIdleBefore:  plan.maxIdleBefore,
		Limit:          plan.limit,
		Offset:         plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by access or idle: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByAccessOrAge(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByAccessOrAge(ctx, mysqlsqlc.ListExpiredCachesByAccessOrAgeParams{
		MaxAccessCount:   plan.maxAccessCount,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by access or age: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByIdleOrAge(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByIdleOrAge(ctx, mysqlsqlc.ListExpiredCachesByIdleOrAgeParams{
		MaxIdleBefore:    plan.maxIdleBefore,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by idle or age: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCachesByAccessOrIdleOrAge(ctx context.Context, plan cleanupQueryPlan) ([]mysqlsqlc.EmbeddingCache, error) {
	rows, err := repo.client.Q().ListExpiredCachesByAccessOrIdleOrAge(ctx, mysqlsqlc.ListExpiredCachesByAccessOrIdleOrAgeParams{
		MaxAccessCount:   plan.maxAccessCount,
		MaxIdleBefore:    plan.maxIdleBefore,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired caches by access or idle or age: %w", err)
	}
	return rows, nil
}

func (repo *Repository) queryExpiredCacheIDsByAccess(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByAccess(ctx, mysqlsqlc.ListExpiredCacheIDsByAccessParams{
		MaxAccessCount: plan.maxAccessCount,
		Limit:          plan.limit,
		Offset:         plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by access: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByIdle(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByIdle(ctx, mysqlsqlc.ListExpiredCacheIDsByIdleParams{
		MaxIdleBefore: plan.maxIdleBefore,
		Limit:         plan.limit,
		Offset:        plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by idle: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByAge(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByAge(ctx, mysqlsqlc.ListExpiredCacheIDsByAgeParams{
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by age: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByAccessOrIdle(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByAccessOrIdle(ctx, mysqlsqlc.ListExpiredCacheIDsByAccessOrIdleParams{
		MaxAccessCount: plan.maxAccessCount,
		MaxIdleBefore:  plan.maxIdleBefore,
		Limit:          plan.limit,
		Offset:         plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by access or idle: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByAccessOrAge(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByAccessOrAge(ctx, mysqlsqlc.ListExpiredCacheIDsByAccessOrAgeParams{
		MaxAccessCount:   plan.maxAccessCount,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by access or age: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByIdleOrAge(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByIdleOrAge(ctx, mysqlsqlc.ListExpiredCacheIDsByIdleOrAgeParams{
		MaxIdleBefore:    plan.maxIdleBefore,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by idle or age: %w", err)
	}
	return ids, nil
}

func (repo *Repository) queryExpiredCacheIDsByAccessOrIdleOrAge(ctx context.Context, plan cleanupQueryPlan) ([]int64, error) {
	ids, err := repo.client.Q().ListExpiredCacheIDsByAccessOrIdleOrAge(ctx, mysqlsqlc.ListExpiredCacheIDsByAccessOrIdleOrAgeParams{
		MaxAccessCount:   plan.maxAccessCount,
		MaxIdleBefore:    plan.maxIdleBefore,
		MaxCreatedBefore: plan.maxCreatedBefore,
		Limit:            plan.limit,
		Offset:           plan.offset,
	})
	if err != nil {
		return nil, fmt.Errorf("query expired cache ids by access or idle or age: %w", err)
	}
	return ids, nil
}
