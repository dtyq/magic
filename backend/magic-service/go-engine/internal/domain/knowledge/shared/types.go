// Package shared 提供知识库领域共享内核。
package shared

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
)

// ErrNilReceiver 表示 JSON 反序列化时接收者为 nil。
var ErrNilReceiver = errors.New("nil receiver")

// 通用仓储错误。
var (
	ErrNotFound                       = errors.New("not found")
	ErrFragmentNotFound               = errors.New("fragment not found")
	ErrKnowledgeBaseNotFound          = errors.New("knowledge base not found")
	ErrKnowledgeBaseDisabled          = errors.New("knowledge base is disabled")
	ErrDocumentNotFound               = errors.New("document not found")
	ErrDocumentKnowledgeBaseRequired  = errors.New("document knowledge base code is required")
	ErrDocumentMappingConflict        = errors.New("third file maps to multiple documents")
	ErrUnsupportedThirdPlatformType   = errors.New("unsupported third platform type")
	ErrFragmentKnowledgeCodeRequired  = errors.New("fragment knowledge code is required")
	ErrFragmentDocumentCodeRequired   = errors.New("fragment document code is required")
	ErrFragmentMetadataFilterRequired = errors.New("fragment metadata filter is required")
	ErrFragmentWriteDisabled          = errors.New("知识库片段不支持单独创建、修改、删除或同步，请重新向量化整个文档")
)

// EmbeddingConfig 嵌入配置（最小字段集 + 兼容未知字段）。
type EmbeddingConfig struct {
	ModelID string                     `json:"model_id,omitempty"`
	Extra   map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 反序列化 embedding 配置并保留未知字段。
func (c *EmbeddingConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("embedding config: %w", ErrNilReceiver)
	}
	if isNullJSON(data) {
		c.ModelID = ""
		c.Extra = nil
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal embedding config: %w", err)
	}

	c.ModelID = ""
	c.Extra = nil
	if v, ok := raw["model_id"]; ok {
		if err := json.Unmarshal(v, &c.ModelID); err != nil {
			return fmt.Errorf("unmarshal embedding config model_id: %w", err)
		}
		delete(raw, "model_id")
	}
	if len(raw) > 0 {
		c.Extra = raw
	}
	return nil
}

// MarshalJSON 序列化 embedding 配置并回写扩展字段。
func (c *EmbeddingConfig) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	out := make(map[string]json.RawMessage, len(c.Extra)+1)
	maps.Copy(out, c.Extra)
	if c.ModelID != "" {
		b, err := json.Marshal(c.ModelID)
		if err != nil {
			return nil, fmt.Errorf("marshal embedding config model_id: %w", err)
		}
		out["model_id"] = b
	}
	if len(out) == 0 {
		return []byte("{}"), nil
	}
	b, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("marshal embedding config: %w", err)
	}
	return b, nil
}

// VectorDBConfig 向量数据库配置。
type VectorDBConfig struct {
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 反序列化向量库配置并保留原始扩展字段。
func (c *VectorDBConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("vector db config: %w", ErrNilReceiver)
	}
	if isNullJSON(data) {
		c.Extra = nil
		return nil
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal vector db config: %w", err)
	}
	if len(raw) == 0 {
		c.Extra = nil
		return nil
	}
	c.Extra = raw
	return nil
}

// MarshalJSON 序列化向量库配置。
func (c *VectorDBConfig) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	if len(c.Extra) == 0 {
		return []byte("{}"), nil
	}
	b, err := json.Marshal(c.Extra)
	if err != nil {
		return nil, fmt.Errorf("marshal vector db config: %w", err)
	}
	return b, nil
}

// StorageConfig 存储服务配置。
type StorageConfig struct {
	Endpoint  string `json:"endpoint"`
	Region    string `json:"region"`
	Identity  string `json:"identity"`
	Signature string `json:"signature"`
	Bucket    string `json:"bucket"`
	Type      string `json:"type"`
}

// OCRConfig OCR 服务配置。
type OCRConfig struct {
	Identity  string `json:"-"`
	Signature string `json:"-"`
	Region    string `json:"region"`
	Endpoint  string `json:"endpoint"`
}

func (c OCRConfig) String() string {
	return fmt.Sprintf(
		"OCRConfig{Region:%q Endpoint:%q CredentialsConfigured:%t}",
		c.Region,
		c.Endpoint,
		c.Identity != "" && c.Signature != "",
	)
}

// GoString 返回不包含 OCR 凭据的调试字符串。
func (c OCRConfig) GoString() string {
	return c.String()
}

// LogValue 返回不包含 OCR 凭据的结构化日志值。
func (c OCRConfig) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("region", c.Region),
		slog.String("endpoint", c.Endpoint),
		slog.Bool("credentials_configured", c.Identity != "" && c.Signature != ""),
	)
}

// SyncStatus 同步状态枚举。
type SyncStatus int

const (
	// SyncStatusPending 表示等待同步。
	SyncStatusPending SyncStatus = 0
	// SyncStatusSynced 表示同步成功。
	SyncStatusSynced SyncStatus = 1
	// SyncStatusSyncFailed 表示同步失败。
	SyncStatusSyncFailed SyncStatus = 2
	// SyncStatusSyncing 表示正在同步。
	SyncStatusSyncing SyncStatus = 3
	// SyncStatusDeleted 表示已删除。
	SyncStatusDeleted SyncStatus = 4
	// SyncStatusDeleteFailed 表示删除失败。
	SyncStatusDeleteFailed SyncStatus = 5
	// SyncStatusRebuilding 表示正在重建。
	SyncStatusRebuilding SyncStatus = 6
)

func (s SyncStatus) String() string {
	switch s {
	case SyncStatusPending:
		return "pending"
	case SyncStatusSyncing:
		return "syncing"
	case SyncStatusSynced:
		return "synced"
	case SyncStatusSyncFailed:
		return "sync_failed"
	case SyncStatusDeleted:
		return "deleted"
	case SyncStatusDeleteFailed:
		return "delete_failed"
	case SyncStatusRebuilding:
		return "rebuilding"
	default:
		return "unknown"
	}
}

// RetrieveConfig 检索配置，与 PHP RetrieveConfig 字段对齐。
type RetrieveConfig struct {
	Version               int                   `json:"version,omitempty"`
	SearchMethod          string                `json:"search_method,omitempty"`
	TopK                  int                   `json:"top_k"`
	ScoreThreshold        float64               `json:"score_threshold"`
	ScoreThresholdEnabled bool                  `json:"score_threshold_enabled"`
	RerankingMode         string                `json:"reranking_mode,omitempty"`
	RerankingEnable       bool                  `json:"reranking_enable"`
	Weights               *RetrieveWeights      `json:"weights,omitempty"`
	RerankingModel        *RerankingModelConfig `json:"reranking_model,omitempty"`
	RerankEnabled         bool                  `json:"rerank_enabled,omitempty"`
	HybridAlpha           float64               `json:"hybrid_alpha,omitempty"`
	HybridBeta            float64               `json:"hybrid_beta,omitempty"`
	HybridTopKMultiplier  int                   `json:"hybrid_top_k_multiplier,omitempty"`
}

// RetrieveWeights 描述检索阶段各召回通道的权重配置。
type RetrieveWeights struct {
	VectorSetting  *VectorWeightSetting  `json:"vector_setting,omitempty"`
	KeywordSetting *KeywordWeightSetting `json:"keyword_setting,omitempty"`
	GraphSetting   *GraphWeightSetting   `json:"graph_setting,omitempty"`
}

// VectorWeightSetting 描述向量召回的权重与模型配置。
type VectorWeightSetting struct {
	VectorWeight          float64 `json:"vector_weight"`
	EmbeddingModelName    string  `json:"embedding_model_name"`
	EmbeddingProviderName string  `json:"embedding_provider_name"`
}

// KeywordWeightSetting 描述关键词召回权重配置。
type KeywordWeightSetting struct {
	KeywordWeight float64 `json:"keyword_weight"`
}

// GraphWeightSetting 描述图召回权重配置。
type GraphWeightSetting struct {
	RelationWeight    float64 `json:"relation_weight"`
	MaxDepth          int     `json:"max_depth"`
	IncludeProperties bool    `json:"include_properties"`
	Timeout           float64 `json:"timeout,omitempty"`
	RetryCount        int     `json:"retry_count,omitempty"`
}

// RerankingModelConfig 描述重排模型配置。
type RerankingModelConfig struct {
	RerankingModelName    string `json:"reranking_model_name,omitempty"`
	RerankingProviderName string `json:"reranking_provider_name,omitempty"`
}

// FragmentMode 表示片段切分模式。
type FragmentMode int

const (
	// FragmentModeCustom 表示自定义切分模式。
	FragmentModeCustom FragmentMode = 1
	// FragmentModeAuto 表示自动切分模式。
	FragmentModeAuto FragmentMode = 2
	// FragmentModeHierarchy 表示层级切分模式。
	FragmentModeHierarchy FragmentMode = 3
	// FragmentModeNormal 保留旧命名兼容，语义等同于自定义模式。
	FragmentModeNormal FragmentMode = FragmentModeCustom
)

const (
	// ChunkOverlapUnitAbsolute 表示 chunk_overlap 按绝对长度解释。
	ChunkOverlapUnitAbsolute = "absolute"
	// ChunkOverlapUnitPercent 表示 chunk_overlap 按百分比解释。
	ChunkOverlapUnitPercent = "percent"
)

// FragmentConfig 描述文档切片配置。
type FragmentConfig struct {
	Mode      FragmentMode             `json:"mode"`
	Normal    *NormalFragmentConfig    `json:"normal,omitempty"`
	Hierarchy *HierarchyFragmentConfig `json:"hierarchy,omitempty"`
}

// NormalFragmentConfig 描述普通切片模式配置。
type NormalFragmentConfig struct {
	TextPreprocessRule []int        `json:"text_preprocess_rule"`
	SegmentRule        *SegmentRule `json:"segment_rule"`
}

// SegmentRule 描述文本切分规则。
type SegmentRule struct {
	Separator        string `json:"separator"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     int    `json:"chunk_overlap"`
	ChunkOverlapUnit string `json:"chunk_overlap_unit"`
}

// HierarchyFragmentConfig 描述层级切片模式配置。
type HierarchyFragmentConfig struct {
	MaxLevel           int   `json:"max_level,omitempty"`
	TextPreprocessRule []int `json:"text_preprocess_rule"`
	KeepHierarchyInfo  bool  `json:"keep_hierarchy_info,omitempty"`
}

// UnmarshalJSON 兼容历史平铺字段并反序列化切片配置。
func (fc *FragmentConfig) UnmarshalJSON(data []byte) error {
	type fragmentConfigAlias FragmentConfig
	aux := &struct {
		ChunkSize        *int    `json:"chunk_size,omitempty"`
		ChunkOverlap     *int    `json:"chunk_overlap,omitempty"`
		ChunkOverlapUnit *string `json:"chunk_overlap_unit,omitempty"`
		Separator        *string `json:"separator,omitempty"`
		*fragmentConfigAlias
	}{
		fragmentConfigAlias: (*fragmentConfigAlias)(fc),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return fmt.Errorf("unmarshal fragment config: %w", err)
	}
	if fc.Mode == 0 {
		switch {
		case aux.ChunkSize != nil, aux.ChunkOverlap != nil, aux.ChunkOverlapUnit != nil, aux.Separator != nil, fc.Normal != nil:
			fc.Mode = FragmentModeCustom
		default:
			fc.Mode = FragmentModeAuto
		}
	}
	fc.applyLegacyFields(aux.ChunkSize, aux.ChunkOverlap, aux.ChunkOverlapUnit, aux.Separator)
	return nil
}

func (fc *FragmentConfig) applyLegacyFields(
	chunkSize, chunkOverlap *int,
	chunkOverlapUnit, separator *string,
) {
	if chunkSize == nil && chunkOverlap == nil && chunkOverlapUnit == nil && separator == nil {
		return
	}
	if fc.Normal == nil {
		fc.Normal = &NormalFragmentConfig{
			TextPreprocessRule: []int{},
			SegmentRule:        &SegmentRule{},
		}
	} else if fc.Normal.SegmentRule == nil {
		fc.Normal.SegmentRule = &SegmentRule{}
	}
	if chunkSize != nil {
		fc.Normal.SegmentRule.ChunkSize = *chunkSize
	}
	if chunkOverlap != nil {
		fc.Normal.SegmentRule.ChunkOverlap = *chunkOverlap
	}
	if chunkOverlapUnit != nil {
		fc.Normal.SegmentRule.ChunkOverlapUnit = *chunkOverlapUnit
	}
	if separator != nil {
		fc.Normal.SegmentRule.Separator = *separator
	}
}

func isNullJSON(data []byte) bool {
	trimmed := bytes.TrimSpace(data)
	return len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null"))
}
