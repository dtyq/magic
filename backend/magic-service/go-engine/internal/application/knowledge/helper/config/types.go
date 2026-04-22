// Package config 提供 knowledge application 层配置 DTO 与映射能力。
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"

	domainshared "magic/internal/domain/knowledge/shared"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

var errNilSharedConfigReceiver = errors.New("nil receiver")

// EmbeddingConfig 是应用层共享的 embedding 配置 DTO。
type EmbeddingConfig struct {
	ModelID string                     `json:"model_id,omitempty"`
	Extra   map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 解析 JSON 并保留未知字段。
func (c *EmbeddingConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("embedding config: %w", errNilSharedConfigReceiver)
	}

	raw := map[string]json.RawMessage{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, map[string]json.RawMessage{}, &raw); err != nil {
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

// MarshalJSON 输出 JSON 并保留未知字段。
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
	data, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("marshal embedding config: %w", err)
	}
	return data, nil
}

// VectorDBConfig 是应用层共享的向量库配置 DTO。
type VectorDBConfig struct {
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON 解析 JSON 并保留未知字段。
func (c *VectorDBConfig) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("vector db config: %w", errNilSharedConfigReceiver)
	}
	raw := map[string]json.RawMessage{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, map[string]json.RawMessage{}, &raw); err != nil {
		return fmt.Errorf("unmarshal vector db config: %w", err)
	}
	if len(raw) == 0 {
		c.Extra = nil
		return nil
	}
	c.Extra = raw
	return nil
}

// MarshalJSON 输出 JSON 并保留未知字段。
func (c *VectorDBConfig) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	if len(c.Extra) == 0 {
		return []byte("{}"), nil
	}
	data, err := json.Marshal(c.Extra)
	if err != nil {
		return nil, fmt.Errorf("marshal vector db config: %w", err)
	}
	return data, nil
}

func unmarshalCompatStruct[T any](data []byte, fieldName string, out *T) error {
	if out == nil {
		return fmt.Errorf("%s: %w", fieldName, errNilSharedConfigReceiver)
	}

	var decoded T
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, decoded, &decoded); err != nil {
		return fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	*out = decoded
	return nil
}

// RetrieveConfigDTO 检索配置 DTO。
type RetrieveConfigDTO struct {
	Version               int                      `json:"version,omitempty"`
	SearchMethod          string                   `json:"search_method,omitempty"`
	TopK                  int                      `json:"top_k"`
	ScoreThreshold        float64                  `json:"score_threshold"`
	ScoreThresholdEnabled bool                     `json:"score_threshold_enabled"`
	RerankingMode         string                   `json:"reranking_mode,omitempty"`
	RerankingEnable       bool                     `json:"reranking_enable"`
	Weights               *RetrieveWeightsDTO      `json:"weights,omitempty"`
	RerankingModel        *RerankingModelConfigDTO `json:"reranking_model,omitempty"`
	RerankEnabled         bool                     `json:"rerank_enabled,omitempty"`
	HybridAlpha           float64                  `json:"hybrid_alpha,omitempty"`
	HybridBeta            float64                  `json:"hybrid_beta,omitempty"`
	HybridTopKMultiplier  int                      `json:"hybrid_top_k_multiplier,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *RetrieveConfigDTO) UnmarshalJSON(data []byte) error {
	type alias RetrieveConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "retrieve config", &decoded); err != nil {
		return err
	}
	*c = RetrieveConfigDTO(decoded)
	return nil
}

// RetrieveWeightsDTO 检索权重配置 DTO。
type RetrieveWeightsDTO struct {
	VectorSetting  *VectorWeightSettingDTO  `json:"vector_setting,omitempty"`
	KeywordSetting *KeywordWeightSettingDTO `json:"keyword_setting,omitempty"`
	GraphSetting   *GraphWeightSettingDTO   `json:"graph_setting,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *RetrieveWeightsDTO) UnmarshalJSON(data []byte) error {
	type alias RetrieveWeightsDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "retrieve weights", &decoded); err != nil {
		return err
	}
	*c = RetrieveWeightsDTO(decoded)
	return nil
}

// VectorWeightSettingDTO 向量检索权重配置 DTO。
type VectorWeightSettingDTO struct {
	VectorWeight          float64 `json:"vector_weight"`
	EmbeddingModelName    string  `json:"embedding_model_name"`
	EmbeddingProviderName string  `json:"embedding_provider_name"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *VectorWeightSettingDTO) UnmarshalJSON(data []byte) error {
	type alias VectorWeightSettingDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "vector weight setting", &decoded); err != nil {
		return err
	}
	*c = VectorWeightSettingDTO(decoded)
	return nil
}

// KeywordWeightSettingDTO 关键词检索权重配置 DTO。
type KeywordWeightSettingDTO struct {
	KeywordWeight float64 `json:"keyword_weight"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *KeywordWeightSettingDTO) UnmarshalJSON(data []byte) error {
	type alias KeywordWeightSettingDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "keyword weight setting", &decoded); err != nil {
		return err
	}
	*c = KeywordWeightSettingDTO(decoded)
	return nil
}

// GraphWeightSettingDTO 图检索权重配置 DTO。
type GraphWeightSettingDTO struct {
	RelationWeight    float64 `json:"relation_weight"`
	MaxDepth          int     `json:"max_depth"`
	IncludeProperties bool    `json:"include_properties"`
	Timeout           float64 `json:"timeout,omitempty"`
	RetryCount        int     `json:"retry_count,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *GraphWeightSettingDTO) UnmarshalJSON(data []byte) error {
	type alias GraphWeightSettingDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "graph weight setting", &decoded); err != nil {
		return err
	}
	*c = GraphWeightSettingDTO(decoded)
	return nil
}

// RerankingModelConfigDTO 重排序模型配置 DTO。
type RerankingModelConfigDTO struct {
	RerankingModelName    string `json:"reranking_model_name,omitempty"`
	RerankingProviderName string `json:"reranking_provider_name,omitempty"`
}

// UnmarshalJSON 兼容 PHP 将空对象重编码成空数组的场景。
func (c *RerankingModelConfigDTO) UnmarshalJSON(data []byte) error {
	type alias RerankingModelConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "reranking model config", &decoded); err != nil {
		return err
	}
	*c = RerankingModelConfigDTO(decoded)
	return nil
}

// StrategyConfigDTO 文档解析策略 DTO。
type StrategyConfigDTO struct {
	ParsingType     int  `json:"parsing_type"`
	ImageExtraction bool `json:"image_extraction"`
	TableExtraction bool `json:"table_extraction"`
	ImageOCR        bool `json:"image_ocr"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *StrategyConfigDTO) UnmarshalJSON(data []byte) error {
	type alias StrategyConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "strategy config", &decoded); err != nil {
		return err
	}
	*c = StrategyConfigDTO(decoded)
	return nil
}

// FragmentConfigDTO 片段配置 DTO。
type FragmentConfigDTO struct {
	Mode      int                         `json:"mode"`
	Normal    *NormalFragmentConfigDTO    `json:"normal,omitempty"`
	Hierarchy *HierarchyFragmentConfigDTO `json:"hierarchy,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *FragmentConfigDTO) UnmarshalJSON(data []byte) error {
	type alias FragmentConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "fragment config", &decoded); err != nil {
		return err
	}
	*c = FragmentConfigDTO(decoded)
	return nil
}

// NormalFragmentConfigDTO 普通分段配置 DTO。
type NormalFragmentConfigDTO struct {
	TextPreprocessRule []int           `json:"text_preprocess_rule"`
	SegmentRule        *SegmentRuleDTO `json:"segment_rule"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *NormalFragmentConfigDTO) UnmarshalJSON(data []byte) error {
	type alias NormalFragmentConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "normal fragment config", &decoded); err != nil {
		return err
	}
	*c = NormalFragmentConfigDTO(decoded)
	return nil
}

// SegmentRuleDTO 分段规则 DTO。
type SegmentRuleDTO struct {
	Separator        string `json:"separator"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     int    `json:"chunk_overlap"`
	ChunkOverlapUnit string `json:"chunk_overlap_unit,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *SegmentRuleDTO) UnmarshalJSON(data []byte) error {
	type alias SegmentRuleDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "segment rule", &decoded); err != nil {
		return err
	}
	*c = SegmentRuleDTO(decoded)
	return nil
}

// HierarchyFragmentConfigDTO 层级分段配置 DTO。
type HierarchyFragmentConfigDTO struct {
	MaxLevel           int   `json:"max_level,omitempty"`
	TextPreprocessRule []int `json:"text_preprocess_rule"`
	KeepHierarchyInfo  bool  `json:"keep_hierarchy_info,omitempty"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *HierarchyFragmentConfigDTO) UnmarshalJSON(data []byte) error {
	type alias HierarchyFragmentConfigDTO
	var decoded alias
	if err := unmarshalCompatStruct(data, "hierarchy fragment config", &decoded); err != nil {
		return err
	}
	*c = HierarchyFragmentConfigDTO(decoded)
	return nil
}

// FragmentConfigOutputDTO 片段配置输出 DTO。
type FragmentConfigOutputDTO struct {
	Mode      int                            `json:"mode"`
	Normal    *NormalFragmentConfigOutputDTO `json:"normal,omitempty"`
	Hierarchy *HierarchyFragmentConfigDTO    `json:"hierarchy,omitempty"`
}

// NormalFragmentConfigOutputDTO 普通分段配置输出 DTO。
type NormalFragmentConfigOutputDTO struct {
	TextPreprocessRule []int                 `json:"text_preprocess_rule"`
	SegmentRule        *SegmentRuleOutputDTO `json:"segment_rule"`
}

// SegmentRuleOutputDTO 分段规则输出 DTO。
type SegmentRuleOutputDTO struct {
	Separator        string `json:"separator"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     int    `json:"chunk_overlap"`
	ChunkOverlapUnit string `json:"chunk_overlap_unit"`
}

// SegmentRuleNullableOverlapDTO 分段规则输出 DTO。
type SegmentRuleNullableOverlapDTO struct {
	Separator        string `json:"separator"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     *int   `json:"chunk_overlap"`
	ChunkOverlapUnit string `json:"chunk_overlap_unit"`
}

// CloneEmbeddingConfigWithModel 克隆并覆盖 embedding 模型。
func CloneEmbeddingConfigWithModel(cfg *EmbeddingConfig, model string) *EmbeddingConfig {
	if cfg == nil && model == "" {
		return nil
	}

	cloned := &EmbeddingConfig{}
	if cfg != nil {
		*cloned = *cfg
		if len(cfg.Extra) > 0 {
			cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
			for key, value := range cfg.Extra {
				cloned.Extra[key] = append(json.RawMessage(nil), value...)
			}
		}
	}
	cloned.ModelID = model
	return cloned
}

// EmbeddingConfigDTOToEntity 将应用层 embedding 配置 DTO 转为领域对象。
func EmbeddingConfigDTOToEntity(cfg *EmbeddingConfig) *domainshared.EmbeddingConfig {
	if cfg == nil {
		return nil
	}
	cloned := &domainshared.EmbeddingConfig{ModelID: cfg.ModelID}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		for key, value := range cfg.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return cloned
}

// EmbeddingConfigEntityToDTO 将领域层 embedding 配置转为应用 DTO。
func EmbeddingConfigEntityToDTO(cfg *domainshared.EmbeddingConfig) *EmbeddingConfig {
	if cfg == nil {
		return nil
	}
	cloned := &EmbeddingConfig{ModelID: cfg.ModelID}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		for key, value := range cfg.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return cloned
}

// VectorDBConfigDTOToEntity 将应用层向量库配置 DTO 转为领域对象。
func VectorDBConfigDTOToEntity(cfg *VectorDBConfig) *domainshared.VectorDBConfig {
	if cfg == nil {
		return nil
	}
	cloned := &domainshared.VectorDBConfig{}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		for key, value := range cfg.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return cloned
}

// VectorDBConfigEntityToDTO 将领域层向量库配置转为应用 DTO。
func VectorDBConfigEntityToDTO(cfg *domainshared.VectorDBConfig) *VectorDBConfig {
	if cfg == nil {
		return nil
	}
	cloned := &VectorDBConfig{}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		for key, value := range cfg.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return cloned
}

// RetrieveConfigDTOToEntity 将应用层检索配置 DTO 转为领域对象。
func RetrieveConfigDTOToEntity(cfg *RetrieveConfigDTO) *domainshared.RetrieveConfig {
	if cfg == nil {
		return nil
	}
	result := &domainshared.RetrieveConfig{
		Version:               cfg.Version,
		SearchMethod:          cfg.SearchMethod,
		TopK:                  cfg.TopK,
		ScoreThreshold:        cfg.ScoreThreshold,
		ScoreThresholdEnabled: cfg.ScoreThresholdEnabled,
		RerankingMode:         cfg.RerankingMode,
		RerankingEnable:       cfg.RerankingEnable,
		RerankEnabled:         cfg.RerankEnabled,
		HybridAlpha:           cfg.HybridAlpha,
		HybridBeta:            cfg.HybridBeta,
		HybridTopKMultiplier:  cfg.HybridTopKMultiplier,
	}
	if cfg.Weights != nil {
		result.Weights = &domainshared.RetrieveWeights{}
		if cfg.Weights.VectorSetting != nil {
			result.Weights.VectorSetting = &domainshared.VectorWeightSetting{
				VectorWeight:          cfg.Weights.VectorSetting.VectorWeight,
				EmbeddingModelName:    cfg.Weights.VectorSetting.EmbeddingModelName,
				EmbeddingProviderName: cfg.Weights.VectorSetting.EmbeddingProviderName,
			}
		}
		if cfg.Weights.KeywordSetting != nil {
			result.Weights.KeywordSetting = &domainshared.KeywordWeightSetting{
				KeywordWeight: cfg.Weights.KeywordSetting.KeywordWeight,
			}
		}
		if cfg.Weights.GraphSetting != nil {
			result.Weights.GraphSetting = &domainshared.GraphWeightSetting{
				RelationWeight:    cfg.Weights.GraphSetting.RelationWeight,
				MaxDepth:          cfg.Weights.GraphSetting.MaxDepth,
				IncludeProperties: cfg.Weights.GraphSetting.IncludeProperties,
				Timeout:           cfg.Weights.GraphSetting.Timeout,
				RetryCount:        cfg.Weights.GraphSetting.RetryCount,
			}
		}
	}
	if cfg.RerankingModel != nil {
		result.RerankingModel = &domainshared.RerankingModelConfig{
			RerankingModelName:    cfg.RerankingModel.RerankingModelName,
			RerankingProviderName: cfg.RerankingModel.RerankingProviderName,
		}
	}
	return result
}

// RetrieveConfigEntityToDTO 将领域层检索配置转为应用 DTO。
func RetrieveConfigEntityToDTO(cfg *domainshared.RetrieveConfig) *RetrieveConfigDTO {
	if cfg == nil {
		return nil
	}
	result := &RetrieveConfigDTO{
		Version:               cfg.Version,
		SearchMethod:          cfg.SearchMethod,
		TopK:                  cfg.TopK,
		ScoreThreshold:        cfg.ScoreThreshold,
		ScoreThresholdEnabled: cfg.ScoreThresholdEnabled,
		RerankingMode:         cfg.RerankingMode,
		RerankingEnable:       cfg.RerankingEnable,
		RerankEnabled:         cfg.RerankEnabled,
		HybridAlpha:           cfg.HybridAlpha,
		HybridBeta:            cfg.HybridBeta,
		HybridTopKMultiplier:  cfg.HybridTopKMultiplier,
	}
	if cfg.Weights != nil {
		result.Weights = &RetrieveWeightsDTO{}
		if cfg.Weights.VectorSetting != nil {
			result.Weights.VectorSetting = &VectorWeightSettingDTO{
				VectorWeight:          cfg.Weights.VectorSetting.VectorWeight,
				EmbeddingModelName:    cfg.Weights.VectorSetting.EmbeddingModelName,
				EmbeddingProviderName: cfg.Weights.VectorSetting.EmbeddingProviderName,
			}
		}
		if cfg.Weights.KeywordSetting != nil {
			result.Weights.KeywordSetting = &KeywordWeightSettingDTO{
				KeywordWeight: cfg.Weights.KeywordSetting.KeywordWeight,
			}
		}
		if cfg.Weights.GraphSetting != nil {
			result.Weights.GraphSetting = &GraphWeightSettingDTO{
				RelationWeight:    cfg.Weights.GraphSetting.RelationWeight,
				MaxDepth:          cfg.Weights.GraphSetting.MaxDepth,
				IncludeProperties: cfg.Weights.GraphSetting.IncludeProperties,
				Timeout:           cfg.Weights.GraphSetting.Timeout,
				RetryCount:        cfg.Weights.GraphSetting.RetryCount,
			}
		}
	}
	if cfg.RerankingModel != nil {
		result.RerankingModel = &RerankingModelConfigDTO{
			RerankingModelName:    cfg.RerankingModel.RerankingModelName,
			RerankingProviderName: cfg.RerankingModel.RerankingProviderName,
		}
	}
	return result
}
