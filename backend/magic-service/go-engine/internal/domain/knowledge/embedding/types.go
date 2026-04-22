package embedding

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"magic/internal/pkg/ctxmeta"
)

var (
	// ErrTextHashEmpty 表示文本哈希为空。
	ErrTextHashEmpty = errors.New("text_hash cannot be empty")
	// ErrTextHashInvalidLength 表示文本哈希长度不符合 SHA256 十六进制长度。
	ErrTextHashInvalidLength = errors.New("text_hash must be 64 characters (SHA256)")
	// ErrTextLengthInvalid 表示文本长度非法。
	ErrTextLengthInvalid = errors.New("text_length must be positive")
	// ErrEmbeddingEmpty 表示向量结果为空。
	ErrEmbeddingEmpty = errors.New("embedding cannot be empty")
	// ErrVectorDimensionMismatch 表示向量维度与实际 embedding 长度不一致。
	ErrVectorDimensionMismatch = errors.New("vector_dimension mismatch with embedding length")
	// ErrEmbeddingModelEmpty 表示模型标识为空。
	ErrEmbeddingModelEmpty = errors.New("embedding_model cannot be empty")
	// ErrAccessCountInvalid 表示访问次数为负数。
	ErrAccessCountInvalid = errors.New("access_count cannot be negative")
)

const (
	// SHA256HexLength 是 SHA256 十六进制字符串长度。
	SHA256HexLength = 64
	// textPreviewMaxRunes 是 text_preview 保留的最大字符数。
	textPreviewMaxRunes = 10
	// DefaultMinAccessCount 是默认最小访问次数阈值。
	DefaultMinAccessCount = 2
	// DefaultBatchSize 是默认批量处理大小。
	DefaultBatchSize = 1000
	// BytesPerMB 表示每 MB 的字节数。
	BytesPerMB = 1024 * 1024
	// BytesPerGB 表示每 GB 的字节数。
	BytesPerGB = 1024 * 1024 * 1024
)

// Cache 表示 embedding 结果缓存实体。
type Cache struct {
	ID              int64     `json:"id" db:"id"`
	TextHash        string    `json:"text_hash" db:"text_hash"`
	TextPreview     string    `json:"text_preview" db:"text_preview"`
	TextLength      int       `json:"text_length" db:"text_length"`
	Embedding       []float64 `json:"embedding" db:"embedding"`
	EmbeddingModel  string    `json:"embedding_model" db:"embedding_model"`
	VectorDimension int       `json:"vector_dimension" db:"vector_dimension"`
	AccessCount     int       `json:"access_count" db:"access_count"`
	LastAccessedAt  time.Time `json:"last_accessed_at" db:"last_accessed_at"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// NewEmbeddingCache 根据原文和向量结果构造缓存实体。
func NewEmbeddingCache(text string, embedding []float64, model string) *Cache {
	textHash := generateTextHash(text)
	return &Cache{
		TextHash:        textHash,
		TextPreview:     generateTextPreview(text),
		TextLength:      len(text),
		Embedding:       embedding,
		EmbeddingModel:  model,
		VectorDimension: len(embedding),
		AccessCount:     1,
		LastAccessedAt:  time.Now(),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

func generateTextHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])
}

func generateTextPreview(text string) string {
	if text == "" {
		return ""
	}

	if utf8.RuneCountInString(text) <= textPreviewMaxRunes {
		return text
	}

	runes := []rune(text)
	return string(runes[:textPreviewMaxRunes])
}

// IncrementAccess 增加访问计数并刷新访问时间。
func (e *Cache) IncrementAccess() {
	e.AccessCount++
	e.LastAccessedAt = time.Now()
	e.UpdatedAt = time.Now()
}

// IsExpired 判断缓存是否超过给定的闲置时长。
func (e *Cache) IsExpired(expiredAfter time.Duration) bool {
	return time.Since(e.LastAccessedAt) > expiredAfter
}

// GetEmbeddingAsJSON 将向量序列化为 JSON 字符串。
func (e *Cache) GetEmbeddingAsJSON() (string, error) {
	embeddingJSON, err := json.Marshal(e.Embedding)
	if err != nil {
		return "", fmt.Errorf("failed to marshal embedding to JSON: %w", err)
	}
	return string(embeddingJSON), nil
}

// SetEmbeddingFromJSON 从 JSON 字符串恢复向量并刷新维度信息。
func (e *Cache) SetEmbeddingFromJSON(jsonStr string) error {
	var embedding []float64
	if err := json.Unmarshal([]byte(jsonStr), &embedding); err != nil {
		return fmt.Errorf("failed to unmarshal embedding from JSON: %w", err)
	}
	e.Embedding = embedding
	e.VectorDimension = len(embedding)
	return nil
}

// Validate 校验缓存实体的核心字段是否合法。
func (e *Cache) Validate() error {
	if e.TextHash == "" {
		return ErrTextHashEmpty
	}
	if len(e.TextHash) != SHA256HexLength {
		return ErrTextHashInvalidLength
	}
	if e.TextLength <= 0 {
		return ErrTextLengthInvalid
	}
	if len(e.Embedding) == 0 {
		return ErrEmbeddingEmpty
	}
	if e.VectorDimension != len(e.Embedding) {
		return ErrVectorDimensionMismatch
	}
	if e.EmbeddingModel == "" {
		return ErrEmbeddingModelEmpty
	}
	if e.AccessCount < 0 {
		return ErrAccessCountInvalid
	}
	return nil
}

// CacheCleanupCriteria 描述缓存清理任务的筛选条件。
type CacheCleanupCriteria struct {
	MinAccessCount  int
	MaxIdleDuration time.Duration
	MaxCacheAge     time.Duration
	BatchSize       int
}

// DefaultCleanupCriteria 返回默认的缓存清理策略。
func DefaultCleanupCriteria() *CacheCleanupCriteria {
	return &CacheCleanupCriteria{
		MinAccessCount:  DefaultMinAccessCount,
		MaxIdleDuration: 30 * 24 * time.Hour,
		MaxCacheAge:     90 * 24 * time.Hour,
		BatchSize:       DefaultBatchSize,
	}
}

// ShouldCleanup 判断当前缓存是否满足清理条件。
func (e *Cache) ShouldCleanup(criteria *CacheCleanupCriteria) bool {
	now := time.Now()
	return e.AccessCount < criteria.MinAccessCount ||
		now.Sub(e.LastAccessedAt) > criteria.MaxIdleDuration ||
		now.Sub(e.CreatedAt) > criteria.MaxCacheAge
}

// CacheStatistics 表示缓存聚合统计结果。
type CacheStatistics struct {
	TotalCaches        int            `json:"total_caches"`
	TotalAccessCount   int            `json:"total_access_count"`
	AverageAccessCount float64        `json:"average_access_count"`
	UniqueModels       int            `json:"unique_models"`
	CachesByModel      map[string]int `json:"caches_by_model"`
	OldestCache        *time.Time     `json:"oldest_cache"`
	NewestCache        *time.Time     `json:"newest_cache"`
	LastAccessTime     *time.Time     `json:"last_access_time"`
	StorageSizeBytes   int64          `json:"storage_size_bytes"`
}

// CacheQuery 描述缓存搜索的过滤与排序条件。
type CacheQuery struct {
	Model           string        `json:"model,omitempty"`
	MinAccessCount  *int          `json:"min_access_count,omitempty"`
	MaxAccessCount  *int          `json:"max_access_count,omitempty"`
	CreatedAfter    *time.Time    `json:"created_after,omitempty"`
	CreatedBefore   *time.Time    `json:"created_before,omitempty"`
	AccessedAfter   *time.Time    `json:"accessed_after,omitempty"`
	AccessedBefore  *time.Time    `json:"accessed_before,omitempty"`
	MinTextLength   *int          `json:"min_text_length,omitempty"`
	MaxTextLength   *int          `json:"max_text_length,omitempty"`
	VectorDimension *int          `json:"vector_dimension,omitempty"`
	OrderBy         CacheOrderBy  `json:"order_by,omitempty"`
	OrderDirection  SortDirection `json:"order_direction,omitempty"`
	Offset          int           `json:"offset"`
	Limit           int           `json:"limit"`
}

// SortDirection 表示排序方向。
type SortDirection string

// CacheOrderBy 表示缓存列表可选的排序字段。
type CacheOrderBy string

const (
	// SortAsc 表示升序排序。
	SortAsc SortDirection = "ASC"
	// SortDesc 表示降序排序。
	SortDesc SortDirection = "DESC"

	// EmbeddingCacheOrderByID 表示按主键排序。
	EmbeddingCacheOrderByID CacheOrderBy = "id"
	// EmbeddingCacheOrderByCreatedAt 表示按创建时间排序。
	EmbeddingCacheOrderByCreatedAt CacheOrderBy = "created_at"
	// EmbeddingCacheOrderByUpdatedAt 表示按更新时间排序。
	EmbeddingCacheOrderByUpdatedAt CacheOrderBy = "updated_at"
	// EmbeddingCacheOrderByLastAccessedAt 表示按最后访问时间排序。
	EmbeddingCacheOrderByLastAccessedAt CacheOrderBy = "last_accessed_at"
	// EmbeddingCacheOrderByAccessCount 表示按访问次数排序。
	EmbeddingCacheOrderByAccessCount CacheOrderBy = "access_count"
	// EmbeddingCacheOrderByTextLength 表示按文本长度排序。
	EmbeddingCacheOrderByTextLength CacheOrderBy = "text_length"
	// EmbeddingCacheOrderByVectorDimension 表示按向量维度排序。
	EmbeddingCacheOrderByVectorDimension CacheOrderBy = "vector_dimension"
)

// IsValid 判断排序字段是否在支持列表内。
func (o CacheOrderBy) IsValid() bool {
	switch o {
	case EmbeddingCacheOrderByID,
		EmbeddingCacheOrderByCreatedAt,
		EmbeddingCacheOrderByUpdatedAt,
		EmbeddingCacheOrderByLastAccessedAt,
		EmbeddingCacheOrderByAccessCount,
		EmbeddingCacheOrderByTextLength,
		EmbeddingCacheOrderByVectorDimension:
		return true
	default:
		return false
	}
}

// Provider 表示 embedding 服务提供方。
type Provider struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Models []Model `json:"models"`
}

// Model 表示提供方下可选的模型信息。
type Model struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	ModelID string `json:"model_id"`
	Icon    string `json:"icon"`
}

// CacheRepository 定义缓存实体的读写仓储能力。
type CacheRepository interface {
	FindByHash(ctx context.Context, textHash, model string) (*Cache, error)
	FindByHashes(ctx context.Context, textHashes []string, model string) (map[string]*Cache, error)
	Save(ctx context.Context, cache *Cache) error
	SaveIfAbsent(ctx context.Context, text string, embedding []float64, model string) error
	SaveBatch(ctx context.Context, caches []*Cache) error
	GetOrCreate(ctx context.Context, text string, embedding []float64, model string) (*Cache, error)
	UpdateAccess(ctx context.Context, id int64) error
	Delete(ctx context.Context, id int64) error
	DeleteByHash(ctx context.Context, textHash string) error
	BatchDelete(ctx context.Context, ids []int64) error
}

// CacheAnalysisRepository 定义缓存分析与清理相关仓储能力。
type CacheAnalysisRepository interface {
	FindExpiredCaches(ctx context.Context, criteria *CacheCleanupCriteria, offset, limit int) ([]*Cache, error)
	CountExpiredCaches(ctx context.Context, criteria *CacheCleanupCriteria) (int64, error)
	CleanupExpiredCaches(ctx context.Context, criteria *CacheCleanupCriteria) (int64, error)
	GetCacheStatistics(ctx context.Context) (*CacheStatistics, error)
	GetCachesByModel(ctx context.Context, model string, offset, limit int) ([]*Cache, error)
	CountByModel(ctx context.Context, model string) (int64, error)
	GetLeastAccessed(ctx context.Context, limit int) ([]*Cache, error)
	SearchCaches(ctx context.Context, query *CacheQuery) ([]*Cache, int64, error)
}

// Repository 定义 embedding 应用使用的领域仓储能力。
type Repository interface {
	ComputeEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
	ComputeBatchEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)
	ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*Provider, error)
}

// Client 定义外部 embedding 服务客户端能力。
type Client interface {
	GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
	GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)
	SetAccessToken(accessToken string)
	ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*Provider, error)
}

// DimensionResolver 定义模型向量维度解析能力。
type DimensionResolver interface {
	ResolveDimension(ctx context.Context, model string) (int64, error)
}
