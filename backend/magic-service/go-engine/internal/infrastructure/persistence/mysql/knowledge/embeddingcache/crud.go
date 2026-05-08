package embeddingcache

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	mysqlerr "github.com/go-sql-driver/mysql"

	"magic/internal/domain/knowledge/embedding"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/logkey"
	"magic/pkg/convert"
)

const mysqlDuplicateEntryErrorNumber uint16 = 1062

const (
	embeddingCacheInsertColumnCount = 10
	embeddingCacheInsertBatchPrefix = `INSERT IGNORE INTO embedding_cache (
text_hash, text_preview, text_length, embedding, embedding_model,
vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES `
)

// sqlcCacheToEntity 将 sqlc 生成的类型转换为领域实体
func sqlcCacheToEntity(cache mysqlsqlc.EmbeddingCache) (*embedding.Cache, error) {
	result := &embedding.Cache{
		ID:              cache.ID,
		TextHash:        cache.TextHash,
		TextPreview:     cache.TextPreview,
		TextLength:      int(cache.TextLength),
		EmbeddingModel:  cache.EmbeddingModel,
		VectorDimension: int(cache.VectorDimension),
		AccessCount:     int(cache.AccessCount),
		LastAccessedAt:  cache.LastAccessedAt,
		CreatedAt:       cache.CreatedAt,
		UpdatedAt:       cache.UpdatedAt,
	}
	if err := result.SetEmbeddingFromJSON(string(cache.Embedding)); err != nil {
		return nil, fmt.Errorf("failed to parse embedding JSON: %w", err)
	}
	return result, nil
}

// FindByHash 根据文本哈希和模型查找缓存
func (repo *Repository) FindByHash(ctx context.Context, textHash, model string) (*embedding.Cache, error) {
	sqlcCache, err := repo.client.Q().FindCacheByHash(ctx, mysqlsqlc.FindCacheByHashParams{
		TextHash:       textHash,
		EmbeddingModel: model,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCacheNotFound
		}
		return nil, fmt.Errorf("failed to find cache by hash: %w", err)
	}

	cache, err := sqlcCacheToEntity(sqlcCache)
	if err != nil {
		return nil, err
	}

	repo.updateAccessSynchronously(ctx, cache.ID)

	return cache, nil
}

// FindByHashes 批量根据文本哈希和模型查找缓存
func (repo *Repository) FindByHashes(ctx context.Context, textHashes []string, model string) (map[string]*embedding.Cache, error) {
	result := make(map[string]*embedding.Cache)
	if len(textHashes) == 0 {
		return result, nil
	}

	uniqueHashes := make([]string, 0, len(textHashes))
	seen := make(map[string]struct{}, len(textHashes))
	for _, hash := range textHashes {
		if _, ok := seen[hash]; ok {
			continue
		}
		seen[hash] = struct{}{}
		uniqueHashes = append(uniqueHashes, hash)
	}

	sqlcCaches, err := repo.client.Q().FindCachesByHashes(ctx, mysqlsqlc.FindCachesByHashesParams{
		TextHashes:     uniqueHashes,
		EmbeddingModel: model,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find caches by hashes: %w", err)
	}

	for _, sqlcCache := range sqlcCaches {
		cache, err := sqlcCacheToEntity(sqlcCache)
		if err != nil {
			return nil, err
		}
		result[cache.TextHash] = cache
	}

	ids := make([]int64, 0, len(result))
	for _, cache := range result {
		if cache.ID <= 0 {
			continue
		}
		ids = append(ids, cache.ID)
	}
	repo.updateAccessBatchSynchronously(ctx, ids)

	return result, nil
}

// Save 保存新的缓存记录
func (repo *Repository) Save(ctx context.Context, cache *embedding.Cache) error {
	if err := cache.Validate(); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	params, err := buildInsertEmbeddingCacheParams(cache)
	if err != nil {
		return err
	}

	res, err := repo.client.Q().InsertEmbeddingCache(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to save embedding cache: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get inserted ID: %w", err)
	}
	cache.ID = id
	return nil
}

// SaveBatch 批量保存新的缓存记录
func (repo *Repository) SaveBatch(ctx context.Context, caches []*embedding.Cache) error {
	return repo.saveBatchNow(ctx, caches)
}

func (repo *Repository) saveBatchNow(ctx context.Context, caches []*embedding.Cache) error {
	if len(caches) == 0 {
		return nil
	}

	tx, err := repo.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	rows := make([]embeddingCacheInsertRow, len(caches))
	for i, cache := range caches {
		if err = cache.Validate(); err != nil {
			return fmt.Errorf("validation failed: %w", err)
		}
		row, buildErr := buildEmbeddingCacheInsertRow(cache)
		if buildErr != nil {
			return buildErr
		}
		rows[i] = row
	}

	maxRows := knowledgeShared.MaxBulkInsertRows(embeddingCacheInsertColumnCount)
	for start := 0; start < len(rows); start += maxRows {
		end := min(start+maxRows, len(rows))
		chunk := rows[start:end]

		if _, execErr := repo.client.ExecTxContext(
			ctx,
			tx,
			buildEmbeddingCacheInsertBatchSQL(len(chunk)),
			flattenEmbeddingCacheInsertArgs(chunk)...,
		); execErr != nil {
			return fmt.Errorf("failed to save cache batch chunk: %w", execErr)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// GetOrCreate 获取或创建缓存
func (repo *Repository) GetOrCreate(ctx context.Context, text string, vector []float64, model string) (*embedding.Cache, error) {
	cache := embedding.NewEmbeddingCache(text, vector, model)
	return getOrCreateCache(ctx, cache, model, repo.FindByHash, repo.Save)
}

// SaveIfAbsent 以 INSERT IGNORE 的方式幂等写入缓存。
func (repo *Repository) SaveIfAbsent(ctx context.Context, text string, vector []float64, model string) error {
	return repo.saveIfAbsentNow(ctx, text, vector, model)
}

func (repo *Repository) saveIfAbsentNow(ctx context.Context, text string, vector []float64, model string) error {
	cache := embedding.NewEmbeddingCache(text, vector, model)
	if err := cache.Validate(); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	params, err := buildInsertEmbeddingCacheIgnoreParams(cache)
	if err != nil {
		return err
	}

	if _, err := repo.client.Q().InsertEmbeddingCacheIgnore(ctx, params); err != nil {
		return fmt.Errorf("failed to save embedding cache if absent: %w", err)
	}
	return nil
}

// UpdateAccess 更新访问统计
func (repo *Repository) UpdateAccess(ctx context.Context, id int64) error {
	if err := repo.client.Q().UpdateAccessByID(ctx, id); err != nil {
		return fmt.Errorf("failed to update access statistics: %w", err)
	}
	return nil
}

func (repo *Repository) updateAccessBatch(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	if err := repo.client.Q().UpdateAccessByIDs(ctx, ids); err != nil {
		return fmt.Errorf("failed to update access statistics in batch: %w", err)
	}
	return nil
}

func (repo *Repository) updateAccessSynchronously(ctx context.Context, id int64) {
	if repo == nil || id <= 0 {
		return
	}
	err := repo.UpdateAccess(ctx, id)
	if err == nil {
		return
	}
	if repo.logger != nil {
		repo.logger.KnowledgeWarnContext(ctx, "failed to update embedding cache access synchronously", logkey.ID, id, logkey.Error, err)
	}
}

func (repo *Repository) updateAccessBatchSynchronously(ctx context.Context, ids []int64) {
	if repo == nil || len(ids) == 0 {
		return
	}
	err := repo.updateAccessBatch(ctx, ids)
	if err == nil {
		return
	}
	if repo.logger != nil {
		repo.logger.KnowledgeWarnContext(ctx, "failed to update embedding cache access synchronously in batch", "batch_size", len(ids), logkey.Error, err)
	}
}

// Delete 删除指定的缓存记录
func (repo *Repository) Delete(ctx context.Context, id int64) error {
	rows, err := repo.client.Q().DeleteCacheByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete cache: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("%w: %d", ErrCacheNotFoundByID, id)
	}

	return nil
}

// DeleteByHash 根据哈希删除缓存记录
func (repo *Repository) DeleteByHash(ctx context.Context, textHash string) error {
	rows, err := repo.client.Q().DeleteCacheByHash(ctx, textHash)
	if err != nil {
		return fmt.Errorf("failed to delete cache by hash: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("%w: %s", ErrCacheNotFoundByHash, textHash)
	}

	return nil
}

// BatchDelete 批量删除缓存记录
func (repo *Repository) BatchDelete(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	affected, err := repo.client.Q().DeleteCachesByIDs(ctx, ids)
	if err != nil {
		return fmt.Errorf("failed to batch delete caches: %w", err)
	}

	if affected == 0 {
		return ErrNoCachesDeleted
	}

	return nil
}

func buildInsertEmbeddingCacheParams(cache *embedding.Cache) (mysqlsqlc.InsertEmbeddingCacheParams, error) {
	embeddingJSON, err := cache.GetEmbeddingAsJSON()
	if err != nil {
		return mysqlsqlc.InsertEmbeddingCacheParams{}, fmt.Errorf("failed to serialize embedding: %w", err)
	}
	textLength32, err := convert.SafeIntToInt32(cache.TextLength, "text_length")
	if err != nil {
		return mysqlsqlc.InsertEmbeddingCacheParams{}, fmt.Errorf("text_length overflow: %w", err)
	}
	vectorDim32, err := convert.SafeIntToInt32(cache.VectorDimension, "vector_dimension")
	if err != nil {
		return mysqlsqlc.InsertEmbeddingCacheParams{}, fmt.Errorf("vector_dimension overflow: %w", err)
	}
	accessCount32, err := convert.SafeIntToInt32(cache.AccessCount, "access_count")
	if err != nil {
		return mysqlsqlc.InsertEmbeddingCacheParams{}, fmt.Errorf("access_count overflow: %w", err)
	}
	return mysqlsqlc.InsertEmbeddingCacheParams{
		TextHash:        cache.TextHash,
		TextPreview:     cache.TextPreview,
		TextLength:      textLength32,
		Embedding:       []byte(embeddingJSON),
		EmbeddingModel:  cache.EmbeddingModel,
		VectorDimension: vectorDim32,
		AccessCount:     accessCount32,
		LastAccessedAt:  cache.LastAccessedAt,
		CreatedAt:       cache.CreatedAt,
		UpdatedAt:       cache.UpdatedAt,
	}, nil
}

func buildInsertEmbeddingCacheIgnoreParams(cache *embedding.Cache) (mysqlsqlc.InsertEmbeddingCacheIgnoreParams, error) {
	params, err := buildInsertEmbeddingCacheParams(cache)
	if err != nil {
		return mysqlsqlc.InsertEmbeddingCacheIgnoreParams{}, err
	}
	return mysqlsqlc.InsertEmbeddingCacheIgnoreParams(params), nil
}

type embeddingCacheInsertRow struct {
	args [embeddingCacheInsertColumnCount]any
}

func buildEmbeddingCacheInsertRow(cache *embedding.Cache) (embeddingCacheInsertRow, error) {
	params, err := buildInsertEmbeddingCacheParams(cache)
	if err != nil {
		return embeddingCacheInsertRow{}, err
	}
	return embeddingCacheInsertRow{
		args: [embeddingCacheInsertColumnCount]any{
			params.TextHash,
			params.TextPreview,
			params.TextLength,
			params.Embedding,
			params.EmbeddingModel,
			params.VectorDimension,
			params.AccessCount,
			params.LastAccessedAt,
			params.CreatedAt,
			params.UpdatedAt,
		},
	}, nil
}

func buildEmbeddingCacheInsertBatchSQL(rowCount int) string {
	return knowledgeShared.BuildBulkInsertSQL(embeddingCacheInsertBatchPrefix, "", embeddingCacheInsertColumnCount, rowCount)
}

func flattenEmbeddingCacheInsertArgs(rows []embeddingCacheInsertRow) []any {
	args := make([]any, 0, len(rows)*embeddingCacheInsertColumnCount)
	for _, row := range rows {
		args = append(args, row.args[:]...)
	}
	return args
}

func isDuplicateEntryError(err error) bool {
	var mysqlErr *mysqlerr.MySQLError
	if !errors.As(err, &mysqlErr) {
		return false
	}

	return mysqlErr.Number == mysqlDuplicateEntryErrorNumber
}

func getOrCreateCache(
	ctx context.Context,
	cache *embedding.Cache,
	model string,
	findByHash func(context.Context, string, string) (*embedding.Cache, error),
	save func(context.Context, *embedding.Cache) error,
) (*embedding.Cache, error) {
	existingCache, err := findByHash(ctx, cache.TextHash, model)
	if err == nil && existingCache != nil {
		return existingCache, nil
	}
	if err != nil && !errors.Is(err, ErrCacheNotFound) {
		return nil, fmt.Errorf("failed to find existing cache: %w", err)
	}

	if saveErr := save(ctx, cache); saveErr == nil {
		return cache, nil
	} else if !isDuplicateEntryError(saveErr) {
		return nil, fmt.Errorf("failed to create new cache: %w", saveErr)
	}

	existingCache, err = findByHash(ctx, cache.TextHash, model)
	if err != nil {
		return nil, fmt.Errorf("failed to read cache after duplicate insert: %w", err)
	}
	if existingCache == nil {
		return nil, ErrCacheNotFound
	}
	return existingCache, nil
}
