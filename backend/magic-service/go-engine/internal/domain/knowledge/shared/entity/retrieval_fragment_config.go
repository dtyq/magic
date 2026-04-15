package entity

import (
	"encoding/json"
	"fmt"
)

// RetrieveConfig 检索配置，与 PHP RetrieveConfig 字段完全对齐。
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

// RetrieveWeights 检索权重配置，与 PHP weights 字段对齐。
type RetrieveWeights struct {
	VectorSetting  *VectorWeightSetting  `json:"vector_setting,omitempty"`
	KeywordSetting *KeywordWeightSetting `json:"keyword_setting,omitempty"`
	GraphSetting   *GraphWeightSetting   `json:"graph_setting,omitempty"`
}

// VectorWeightSetting 向量检索权重配置。
type VectorWeightSetting struct {
	VectorWeight          float64 `json:"vector_weight"`
	EmbeddingModelName    string  `json:"embedding_model_name"`
	EmbeddingProviderName string  `json:"embedding_provider_name"`
}

// KeywordWeightSetting 关键词检索权重配置。
type KeywordWeightSetting struct {
	KeywordWeight float64 `json:"keyword_weight"`
}

// GraphWeightSetting 图检索权重配置。
type GraphWeightSetting struct {
	RelationWeight    float64 `json:"relation_weight"`
	MaxDepth          int     `json:"max_depth"`
	IncludeProperties bool    `json:"include_properties"`
	Timeout           float64 `json:"timeout,omitempty"`
	RetryCount        int     `json:"retry_count,omitempty"`
}

// RerankingModelConfig 重排序模型配置，与 PHP reranking_model 字段对齐。
type RerankingModelConfig struct {
	RerankingModelName    string `json:"reranking_model_name,omitempty"`
	RerankingProviderName string `json:"reranking_provider_name,omitempty"`
}

// FragmentMode 片段模式。
type FragmentMode int

const (
	// FragmentModeCustom 自定义模式。
	FragmentModeCustom FragmentMode = 1
	// FragmentModeAuto 自动模式。
	FragmentModeAuto FragmentMode = 2
	// FragmentModeHierarchy 层级分段。
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

// FragmentConfig 片段配置。
type FragmentConfig struct {
	Mode      FragmentMode             `json:"mode"`
	Normal    *NormalFragmentConfig    `json:"normal,omitempty"`
	Hierarchy *HierarchyFragmentConfig `json:"hierarchy,omitempty"`
}

// NormalFragmentConfig 普通分段配置。
type NormalFragmentConfig struct {
	TextPreprocessRule []int        `json:"text_preprocess_rule"`
	SegmentRule        *SegmentRule `json:"segment_rule"`
}

// SegmentRule 分段规则。
type SegmentRule struct {
	Separator        string `json:"separator"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     int    `json:"chunk_overlap"`
	ChunkOverlapUnit string `json:"chunk_overlap_unit"`
}

// HierarchyFragmentConfig 层级分段配置。
type HierarchyFragmentConfig struct {
	MaxLevel           int   `json:"max_level,omitempty"`
	TextPreprocessRule []int `json:"text_preprocess_rule"`
	KeepHierarchyInfo  bool  `json:"keep_hierarchy_info,omitempty"`
}

// UnmarshalJSON 自定义反序列化，实现对老结构的向下兼容。
func (fc *FragmentConfig) UnmarshalJSON(data []byte) error {
	type alias FragmentConfig
	aux := &struct {
		ChunkSize        *int    `json:"chunk_size,omitempty"`
		ChunkOverlap     *int    `json:"chunk_overlap,omitempty"`
		ChunkOverlapUnit *string `json:"chunk_overlap_unit,omitempty"`
		Separator        *string `json:"separator,omitempty"`
		*alias
	}{
		alias: (*alias)(fc),
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
