package entity

import "time"

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
