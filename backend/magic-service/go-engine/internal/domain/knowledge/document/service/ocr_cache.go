package document

import (
	"context"
	"errors"
	"time"
)

// ErrOCRCacheNotFound 表示 OCR 结果缓存未命中。
var ErrOCRCacheNotFound = errors.New("ocr cache not found")

// OCRResultCache 表示 OCR 结果缓存。
type OCRResultCache struct {
	ID             int64
	TextHash       string
	EmbeddingModel string
	Content        string
	FileType       string
	Etag           string
	LastModified   string
	ContentLength  string
	AccessCount    int
	LastAccessedAt time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// OCRResultCacheRepository 定义 OCR 结果缓存仓储。
type OCRResultCacheRepository interface {
	FindURLCache(ctx context.Context, textHash, model string) (*OCRResultCache, error)
	FindBytesCache(ctx context.Context, textHash, model string) (*OCRResultCache, error)
	UpsertURLCache(ctx context.Context, cache *OCRResultCache) error
	UpsertBytesCache(ctx context.Context, cache *OCRResultCache) error
	Touch(ctx context.Context, id int64) error
}
