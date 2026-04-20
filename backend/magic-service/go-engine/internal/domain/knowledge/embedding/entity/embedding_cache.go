// Package entity 提供长期记忆和知识库的领域实体。
package entity

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"
)

var (

	// ErrTextHashEmpty 当 text_hash 为空时返回
	ErrTextHashEmpty = errors.New("text_hash cannot be empty")
	// ErrTextHashInvalidLength 当 text_hash 长度不是 64 个字符时返回
	ErrTextHashInvalidLength = errors.New("text_hash must be 64 characters (SHA256)")
	// ErrTextLengthInvalid 当 text_length 不为正数时返回
	ErrTextLengthInvalid = errors.New("text_length must be positive")
	// ErrEmbeddingEmpty 当 embedding 向量为空时返回
	ErrEmbeddingEmpty = errors.New("embedding cannot be empty")
	// ErrVectorDimensionMismatch 当向量维度与 embedding 长度不匹配时返回
	ErrVectorDimensionMismatch = errors.New("vector_dimension mismatch with embedding length")
	// ErrEmbeddingModelEmpty 当 embedding_model 为空时返回
	ErrEmbeddingModelEmpty = errors.New("embedding_model cannot be empty")
	// ErrAccessCountInvalid 当 access_count 为负数时返回
	ErrAccessCountInvalid = errors.New("access_count cannot be negative")
)

// Embedding 缓存实体的领域级常量
const (
	// SHA256HexLength 是 SHA256 摘要的十六进制长度
	SHA256HexLength = 64
	// textPreviewMaxRunes 是 text_preview 保留的最大字符数。
	textPreviewMaxRunes = 10

	// 默认清理标准常量
	DefaultMinAccessCount = 2
	DefaultBatchSize      = 1000

	// 字节大小辅助常量
	BytesPerMB = 1024 * 1024
	BytesPerGB = 1024 * 1024 * 1024
)

// EmbeddingCache 向量化结果缓存实体
// 用于缓存文本片段的向量化结果，避免重复计算，节省成本
// 该实体为多组织共享，不需要组织隔离
type EmbeddingCache struct {
	ID              int64     `json:"id" db:"id"`                             // 自增主键
	TextHash        string    `json:"text_hash" db:"text_hash"`               // 文本内容的SHA256哈希值
	TextPreview     string    `json:"text_preview" db:"text_preview"`         // 文本预览，最多保留前 10 个字符
	TextLength      int       `json:"text_length" db:"text_length"`           // 原始文本长度
	Embedding       []float64 `json:"embedding" db:"embedding"`               // 向量化结果
	EmbeddingModel  string    `json:"embedding_model" db:"embedding_model"`   // 使用的嵌入模型名称
	VectorDimension int       `json:"vector_dimension" db:"vector_dimension"` // 向量维度
	AccessCount     int       `json:"access_count" db:"access_count"`         // 累计访问次数
	LastAccessedAt  time.Time `json:"last_accessed_at" db:"last_accessed_at"` // 最后访问时间
	CreatedAt       time.Time `json:"created_at" db:"created_at"`             // 创建时间
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`             // 更新时间
}

// NewEmbeddingCache 创建新的向量化缓存实体
func NewEmbeddingCache(text string, embedding []float64, model string) *EmbeddingCache {
	textHash := generateTextHash(text)
	textPreview := generateTextPreview(text)

	return &EmbeddingCache{
		TextHash:        textHash,
		TextPreview:     textPreview,
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

// generateTextHash 生成文本的SHA256哈希值
func generateTextHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])
}

// generateTextPreview 生成文本预览，最多保留前 10 个字符。
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

// IncrementAccess 增加访问计数并更新访问时间
func (e *EmbeddingCache) IncrementAccess() {
	e.AccessCount++
	e.LastAccessedAt = time.Now()
	e.UpdatedAt = time.Now()
}

// IsExpired 判断缓存是否过期（基于最后访问时间）
func (e *EmbeddingCache) IsExpired(expiredAfter time.Duration) bool {
	return time.Since(e.LastAccessedAt) > expiredAfter
}

// GetEmbeddingAsJSON 获取向量化结果的JSON格式（用于数据库存储）
func (e *EmbeddingCache) GetEmbeddingAsJSON() (string, error) {
	embeddingJSON, err := json.Marshal(e.Embedding)
	if err != nil {
		return "", fmt.Errorf("failed to marshal embedding to JSON: %w", err)
	}
	return string(embeddingJSON), nil
}

// SetEmbeddingFromJSON 从JSON格式设置向量化结果（用于数据库读取）
func (e *EmbeddingCache) SetEmbeddingFromJSON(jsonStr string) error {
	var embedding []float64
	if err := json.Unmarshal([]byte(jsonStr), &embedding); err != nil {
		return fmt.Errorf("failed to unmarshal embedding from JSON: %w", err)
	}
	e.Embedding = embedding
	e.VectorDimension = len(embedding)
	return nil
}

// Validate 验证缓存实体的有效性
func (e *EmbeddingCache) Validate() error {
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

// EmbeddingCacheCleanupCriteria 缓存清理标准
type EmbeddingCacheCleanupCriteria struct {
	MinAccessCount  int           // 最小访问次数，低于此值可被清理
	MaxIdleDuration time.Duration // 最大空闲时间，超过此时间未访问可被清理
	MaxCacheAge     time.Duration // 最大缓存年龄，超过此时间的缓存可被清理
	BatchSize       int           // 批量清理的大小
}

// DefaultCleanupCriteria 默认清理标准
func DefaultCleanupCriteria() *EmbeddingCacheCleanupCriteria {
	return &EmbeddingCacheCleanupCriteria{
		MinAccessCount:  DefaultMinAccessCount, // 访问次数少于2次
		MaxIdleDuration: 30 * 24 * time.Hour,   // 30天未访问
		MaxCacheAge:     90 * 24 * time.Hour,   // 90天以上的缓存
		BatchSize:       DefaultBatchSize,      // 每次批量清理1000条
	}
}

// ShouldCleanup 判断是否应该被清理
func (e *EmbeddingCache) ShouldCleanup(criteria *EmbeddingCacheCleanupCriteria) bool {
	now := time.Now()

	// 检查访问次数
	if e.AccessCount < criteria.MinAccessCount {
		return true
	}

	// 检查空闲时间
	if now.Sub(e.LastAccessedAt) > criteria.MaxIdleDuration {
		return true
	}

	// 检查缓存年龄
	if now.Sub(e.CreatedAt) > criteria.MaxCacheAge {
		return true
	}

	return false
}

// EmbeddingCacheStatistics 缓存统计信息
type EmbeddingCacheStatistics struct {
	TotalCaches        int            `json:"total_caches"`         // 总缓存数量
	TotalAccessCount   int            `json:"total_access_count"`   // 总访问次数
	AverageAccessCount float64        `json:"average_access_count"` // 平均访问次数
	UniqueModels       int            `json:"unique_models"`        // 使用的模型数量
	CachesByModel      map[string]int `json:"caches_by_model"`      // 按模型分组的缓存数量
	OldestCache        *time.Time     `json:"oldest_cache"`         // 最老的缓存时间
	NewestCache        *time.Time     `json:"newest_cache"`         // 最新的缓存时间
	LastAccessTime     *time.Time     `json:"last_access_time"`     // 最后访问时间
	StorageSizeBytes   int64          `json:"storage_size_bytes"`   // 存储大小（估算，保持 int64）
}

// EmbeddingCacheQuery 缓存查询条件
type EmbeddingCacheQuery struct {
	Model           string                `json:"model,omitempty"`            // 模型筛选
	MinAccessCount  *int                  `json:"min_access_count,omitempty"` // 最小访问次数
	MaxAccessCount  *int                  `json:"max_access_count,omitempty"` // 最大访问次数
	CreatedAfter    *time.Time            `json:"created_after,omitempty"`    // 创建时间下限
	CreatedBefore   *time.Time            `json:"created_before,omitempty"`   // 创建时间上限
	AccessedAfter   *time.Time            `json:"accessed_after,omitempty"`   // 访问时间下限
	AccessedBefore  *time.Time            `json:"accessed_before,omitempty"`  // 访问时间上限
	MinTextLength   *int                  `json:"min_text_length,omitempty"`  // 最小文本长度
	MaxTextLength   *int                  `json:"max_text_length,omitempty"`  // 最大文本长度
	VectorDimension *int                  `json:"vector_dimension,omitempty"` // 向量维度
	OrderBy         EmbeddingCacheOrderBy `json:"order_by,omitempty"`         // 排序字段
	OrderDirection  SortDirection         `json:"order_direction,omitempty"`  // 排序方向 (ASC/DESC)
	Offset          int                   `json:"offset"`                     // 偏移量
	Limit           int                   `json:"limit"`                      // 限制数量
}

// SortDirection 是排序顺序的安全枚举
type SortDirection string

const (
	// SortAsc 指定升序
	SortAsc SortDirection = "ASC"
	// SortDesc 指定降序
	SortDesc SortDirection = "DESC"
)

// EmbeddingCacheOrderBy 是允许的排序字段的白名单
type EmbeddingCacheOrderBy string

const (
	// EmbeddingCacheOrderByID 按主键排序
	EmbeddingCacheOrderByID EmbeddingCacheOrderBy = "id"
	// EmbeddingCacheOrderByCreatedAt 按创建时间排序
	EmbeddingCacheOrderByCreatedAt EmbeddingCacheOrderBy = "created_at"
	// EmbeddingCacheOrderByUpdatedAt 按更新时间排序
	EmbeddingCacheOrderByUpdatedAt EmbeddingCacheOrderBy = "updated_at"
	// EmbeddingCacheOrderByLastAccessedAt 按最后访问时间排序
	EmbeddingCacheOrderByLastAccessedAt EmbeddingCacheOrderBy = "last_accessed_at"
	// EmbeddingCacheOrderByAccessCount 按访问次数排序
	EmbeddingCacheOrderByAccessCount EmbeddingCacheOrderBy = "access_count"
	// EmbeddingCacheOrderByTextLength 按文本长度排序
	EmbeddingCacheOrderByTextLength EmbeddingCacheOrderBy = "text_length"
	// EmbeddingCacheOrderByVectorDimension 按向量维度排序
	EmbeddingCacheOrderByVectorDimension EmbeddingCacheOrderBy = "vector_dimension"
)

// IsValid 检查排序字段是否在白名单内
func (o EmbeddingCacheOrderBy) IsValid() bool {
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
