// Package ocrcache 基于 embedding_cache 表提供 OCR 结果缓存仓储。
package ocrcache

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

const (
	textPreviewMaxRunes = 10
)

var errRepositoryUnavailable = errors.New("ocr cache repository unavailable")

type cachePayload struct {
	Content       string `json:"content"`
	FileType      string `json:"file_type"`
	Etag          string `json:"etag,omitempty"`
	LastModified  string `json:"last_modified,omitempty"`
	ContentLength string `json:"content_length,omitempty"`
}

// Repository 基于 embedding_cache 表实现 OCR 结果缓存。
type Repository struct {
	client *mysqlclient.SQLCClient
	logger *logging.SugaredLogger
}

// NewRepository 创建 OCR 结果缓存仓储。
func NewRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *Repository {
	return &Repository{client: client, logger: logger}
}

// FindURLCache 根据 hash 和模型查询 URL OCR 缓存。
func (repo *Repository) FindURLCache(
	ctx context.Context,
	textHash, model string,
) (*docentity.OCRResultCache, error) {
	return repo.find(ctx, textHash, model)
}

// FindBytesCache 根据 hash 和模型查询字节流 OCR 缓存。
func (repo *Repository) FindBytesCache(
	ctx context.Context,
	textHash, model string,
) (*docentity.OCRResultCache, error) {
	return repo.find(ctx, textHash, model)
}

// UpsertURLCache 写入或覆盖 URL OCR 缓存。
func (repo *Repository) UpsertURLCache(ctx context.Context, cache *docentity.OCRResultCache) error {
	return repo.upsert(ctx, cache)
}

// UpsertBytesCache 写入或覆盖字节流 OCR 缓存。
func (repo *Repository) UpsertBytesCache(ctx context.Context, cache *docentity.OCRResultCache) error {
	return repo.upsert(ctx, cache)
}

// Touch 更新缓存访问统计。
func (repo *Repository) Touch(ctx context.Context, id int64) error {
	if repo == nil || repo.client == nil || id <= 0 {
		return nil
	}
	if err := repo.client.Q().UpdateAccessByID(ctx, id); err != nil {
		return fmt.Errorf("touch ocr cache: %w", err)
	}
	return nil
}

func (repo *Repository) find(
	ctx context.Context,
	textHash, model string,
) (*docentity.OCRResultCache, error) {
	if repo == nil || repo.client == nil {
		return nil, errRepositoryUnavailable
	}

	sqlcCache, err := repo.client.Q().FindCacheByHash(ctx, mysqlsqlc.FindCacheByHashParams{
		TextHash:       textHash,
		EmbeddingModel: model,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, docrepo.ErrOCRCacheNotFound
		}
		return nil, fmt.Errorf("find ocr cache: %w", err)
	}
	cache, err := sqlcCacheToEntity(sqlcCache)
	if err != nil {
		return nil, err
	}
	return cache, nil
}

func (repo *Repository) upsert(ctx context.Context, cache *docentity.OCRResultCache) error {
	if repo == nil || repo.client == nil || cache == nil {
		return nil
	}

	now := time.Now()
	payload, err := json.Marshal(cachePayload{
		Content:       cache.Content,
		FileType:      cache.FileType,
		Etag:          cache.Etag,
		LastModified:  cache.LastModified,
		ContentLength: cache.ContentLength,
	})
	if err != nil {
		return fmt.Errorf("marshal ocr cache payload: %w", err)
	}
	textLength, err := convert.SafeIntToInt32(len(cache.Content), "text_length")
	if err != nil {
		return fmt.Errorf("convert text_length: %w", err)
	}

	if _, err := repo.client.Q().UpsertOCRCache(ctx, mysqlsqlc.UpsertOCRCacheParams{
		TextHash:        cache.TextHash,
		TextPreview:     buildTextPreview(cache.Content),
		TextLength:      textLength,
		Embedding:       payload,
		EmbeddingModel:  cache.EmbeddingModel,
		VectorDimension: 0,
		AccessCount:     1,
		LastAccessedAt:  now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}); err != nil {
		return fmt.Errorf("upsert ocr cache: %w", err)
	}
	return nil
}

func sqlcCacheToEntity(sqlcCache mysqlsqlc.EmbeddingCache) (*docentity.OCRResultCache, error) {
	var payload cachePayload
	if err := json.Unmarshal(sqlcCache.Embedding, &payload); err != nil {
		return nil, fmt.Errorf("unmarshal ocr cache payload: %w", err)
	}
	return &docentity.OCRResultCache{
		ID:             sqlcCache.ID,
		TextHash:       sqlcCache.TextHash,
		EmbeddingModel: sqlcCache.EmbeddingModel,
		Content:        payload.Content,
		FileType:       payload.FileType,
		Etag:           payload.Etag,
		LastModified:   payload.LastModified,
		ContentLength:  payload.ContentLength,
		AccessCount:    int(sqlcCache.AccessCount),
		LastAccessedAt: sqlcCache.LastAccessedAt,
		CreatedAt:      sqlcCache.CreatedAt,
		UpdatedAt:      sqlcCache.UpdatedAt,
	}, nil
}

func buildTextPreview(content string) string {
	if utf8.RuneCountInString(content) <= textPreviewMaxRunes {
		return content
	}
	runes := []rune(content)
	return string(runes[:textPreviewMaxRunes])
}
