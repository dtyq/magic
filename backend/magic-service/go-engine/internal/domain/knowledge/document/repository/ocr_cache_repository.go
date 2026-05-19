package repository

import (
	"context"
	"errors"

	docentity "magic/internal/domain/knowledge/document/entity"
)

// ErrOCRCacheNotFound 表示 OCR 结果缓存未命中。
var ErrOCRCacheNotFound = errors.New("ocr cache not found")

// OCRResultCacheRepository 定义 OCR 结果缓存仓储。
type OCRResultCacheRepository interface {
	FindURLCache(ctx context.Context, textHash, model string) (*docentity.OCRResultCache, error)
	FindBytesCache(ctx context.Context, textHash, model string) (*docentity.OCRResultCache, error)
	UpsertURLCache(ctx context.Context, cache *docentity.OCRResultCache) error
	UpsertBytesCache(ctx context.Context, cache *docentity.OCRResultCache) error
	Touch(ctx context.Context, id int64) error
}
