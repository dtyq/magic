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

func unmarshalCompatRawObject(data []byte, fieldName string) (map[string]json.RawMessage, error) {
	raw := map[string]json.RawMessage{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, map[string]json.RawMessage{}, &raw); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return raw, nil
}

func decodeCompatStringField(raw map[string]json.RawMessage, key string) (string, error) {
	field, ok := raw[key]
	if !ok {
		return "", nil
	}
	if pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		return "", nil
	}

	var value string
	if err := json.Unmarshal(field, &value); err != nil {
		return "", fmt.Errorf("unmarshal %s: %w", key, err)
	}
	return value, nil
}

func decodeCompatIntField(raw map[string]json.RawMessage, key string) (int, error) {
	field, ok := raw[key]
	if !ok {
		return 0, nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalInt(field, key)
	if err != nil {
		return 0, fmt.Errorf("decode %s: %w", key, err)
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeCompatFloat64Field(raw map[string]json.RawMessage, key string) (float64, error) {
	field, ok := raw[key]
	if !ok {
		return 0, nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalFloat64(field, key)
	if err != nil {
		return 0, fmt.Errorf("decode %s: %w", key, err)
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeCompatBoolField(raw map[string]json.RawMessage, key string) (bool, error) {
	field, ok := raw[key]
	if !ok {
		return false, nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalBool(field, key)
	if err != nil {
		return false, fmt.Errorf("decode %s: %w", key, err)
	}
	if value == nil {
		return false, nil
	}
	return *value, nil
}

func decodeCompatIntSliceField(raw map[string]json.RawMessage, key string) ([]int, error) {
	field, ok := raw[key]
	if !ok || pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		return nil, nil
	}

	var values []int
	if err := json.Unmarshal(field, &values); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", key, err)
	}
	return values, nil
}

func decodeCompatOptionalObjectField[T any](raw map[string]json.RawMessage, key string) (*T, bool, error) {
	field, ok := raw[key]
	if !ok {
		return nil, false, nil
	}
	if pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		var zero T
		return &zero, true, nil
	}
	value, err := pkgjsoncompat.UnmarshalObjectPtrOrNil[T](field)
	if err != nil {
		return nil, false, fmt.Errorf("decode %s: %w", key, err)
	}
	return value, true, nil
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
	raw, err := unmarshalCompatRawObject(data, "retrieve config")
	if err != nil {
		return err
	}

	version, err := decodeCompatIntField(raw, "version")
	if err != nil {
		return err
	}
	searchMethod, err := decodeCompatStringField(raw, "search_method")
	if err != nil {
		return err
	}
	topK, err := decodeCompatIntField(raw, "top_k")
	if err != nil {
		return err
	}
	scoreThreshold, err := decodeCompatFloat64Field(raw, "score_threshold")
	if err != nil {
		return err
	}
	scoreThresholdEnabled, err := decodeCompatBoolField(raw, "score_threshold_enabled")
	if err != nil {
		return err
	}
	rerankingMode, err := decodeCompatStringField(raw, "reranking_mode")
	if err != nil {
		return err
	}
	rerankingEnable, err := decodeCompatBoolField(raw, "reranking_enable")
	if err != nil {
		return err
	}
	weights, _, err := decodeCompatOptionalObjectField[RetrieveWeightsDTO](raw, "weights")
	if err != nil {
		return err
	}
	rerankingModel, _, err := decodeCompatOptionalObjectField[RerankingModelConfigDTO](raw, "reranking_model")
	if err != nil {
		return err
	}
	rerankEnabled, err := decodeCompatBoolField(raw, "rerank_enabled")
	if err != nil {
		return err
	}
	hybridAlpha, err := decodeCompatFloat64Field(raw, "hybrid_alpha")
	if err != nil {
		return err
	}
	hybridBeta, err := decodeCompatFloat64Field(raw, "hybrid_beta")
	if err != nil {
		return err
	}
	hybridTopKMultiplier, err := decodeCompatIntField(raw, "hybrid_top_k_multiplier")
	if err != nil {
		return err
	}

	*c = RetrieveConfigDTO{
		Version:               version,
		SearchMethod:          searchMethod,
		TopK:                  topK,
		ScoreThreshold:        scoreThreshold,
		ScoreThresholdEnabled: scoreThresholdEnabled,
		RerankingMode:         rerankingMode,
		RerankingEnable:       rerankingEnable,
		Weights:               weights,
		RerankingModel:        rerankingModel,
		RerankEnabled:         rerankEnabled,
		HybridAlpha:           hybridAlpha,
		HybridBeta:            hybridBeta,
		HybridTopKMultiplier:  hybridTopKMultiplier,
	}
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
	raw, err := unmarshalCompatRawObject(data, "vector weight setting")
	if err != nil {
		return err
	}

	vectorWeight, err := decodeCompatFloat64Field(raw, "vector_weight")
	if err != nil {
		return err
	}
	embeddingModelName, err := decodeCompatStringField(raw, "embedding_model_name")
	if err != nil {
		return err
	}
	embeddingProviderName, err := decodeCompatStringField(raw, "embedding_provider_name")
	if err != nil {
		return err
	}

	*c = VectorWeightSettingDTO{
		VectorWeight:          vectorWeight,
		EmbeddingModelName:    embeddingModelName,
		EmbeddingProviderName: embeddingProviderName,
	}
	return nil
}

// KeywordWeightSettingDTO 关键词检索权重配置 DTO。
type KeywordWeightSettingDTO struct {
	KeywordWeight float64 `json:"keyword_weight"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *KeywordWeightSettingDTO) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalCompatRawObject(data, "keyword weight setting")
	if err != nil {
		return err
	}

	keywordWeight, err := decodeCompatFloat64Field(raw, "keyword_weight")
	if err != nil {
		return err
	}
	*c = KeywordWeightSettingDTO{KeywordWeight: keywordWeight}
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
	raw, err := unmarshalCompatRawObject(data, "graph weight setting")
	if err != nil {
		return err
	}

	relationWeight, err := decodeCompatFloat64Field(raw, "relation_weight")
	if err != nil {
		return err
	}
	maxDepth, err := decodeCompatIntField(raw, "max_depth")
	if err != nil {
		return err
	}
	includeProperties, err := decodeCompatBoolField(raw, "include_properties")
	if err != nil {
		return err
	}
	timeout, err := decodeCompatFloat64Field(raw, "timeout")
	if err != nil {
		return err
	}
	retryCount, err := decodeCompatIntField(raw, "retry_count")
	if err != nil {
		return err
	}

	*c = GraphWeightSettingDTO{
		RelationWeight:    relationWeight,
		MaxDepth:          maxDepth,
		IncludeProperties: includeProperties,
		Timeout:           timeout,
		RetryCount:        retryCount,
	}
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
	raw, err := unmarshalCompatRawObject(data, "strategy config")
	if err != nil {
		return err
	}

	parsingType, err := decodeCompatIntField(raw, "parsing_type")
	if err != nil {
		return err
	}
	imageExtraction, err := decodeCompatBoolField(raw, "image_extraction")
	if err != nil {
		return err
	}
	tableExtraction, err := decodeCompatBoolField(raw, "table_extraction")
	if err != nil {
		return err
	}
	imageOCR, err := decodeCompatBoolField(raw, "image_ocr")
	if err != nil {
		return err
	}

	*c = StrategyConfigDTO{
		ParsingType:     parsingType,
		ImageExtraction: imageExtraction,
		TableExtraction: tableExtraction,
		ImageOCR:        imageOCR,
	}
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
	raw, err := unmarshalCompatRawObject(data, "fragment config")
	if err != nil {
		return err
	}

	mode, err := decodeCompatIntField(raw, "mode")
	if err != nil {
		return err
	}
	normal, _, err := decodeCompatOptionalObjectField[NormalFragmentConfigDTO](raw, "normal")
	if err != nil {
		return err
	}
	hierarchy, _, err := decodeCompatOptionalObjectField[HierarchyFragmentConfigDTO](raw, "hierarchy")
	if err != nil {
		return err
	}

	*c = FragmentConfigDTO{
		Mode:      mode,
		Normal:    normal,
		Hierarchy: hierarchy,
	}
	return nil
}

// NormalFragmentConfigDTO 普通分段配置 DTO。
type NormalFragmentConfigDTO struct {
	TextPreprocessRule []int           `json:"text_preprocess_rule"`
	SegmentRule        *SegmentRuleDTO `json:"segment_rule"`
}

// UnmarshalJSON 兼容历史空对象脏值。
func (c *NormalFragmentConfigDTO) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalCompatRawObject(data, "normal fragment config")
	if err != nil {
		return err
	}

	textPreprocessRule, err := decodeCompatIntSliceField(raw, "text_preprocess_rule")
	if err != nil {
		return err
	}
	segmentRule, _, err := decodeCompatOptionalObjectField[SegmentRuleDTO](raw, "segment_rule")
	if err != nil {
		return err
	}

	*c = NormalFragmentConfigDTO{
		TextPreprocessRule: textPreprocessRule,
		SegmentRule:        segmentRule,
	}
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
	raw, err := unmarshalCompatRawObject(data, "segment rule")
	if err != nil {
		return err
	}

	separator, err := decodeCompatStringField(raw, "separator")
	if err != nil {
		return err
	}
	chunkSize, err := decodeCompatIntField(raw, "chunk_size")
	if err != nil {
		return err
	}
	chunkOverlap, err := decodeCompatIntField(raw, "chunk_overlap")
	if err != nil {
		return err
	}
	chunkOverlapUnit, err := decodeCompatStringField(raw, "chunk_overlap_unit")
	if err != nil {
		return err
	}

	*c = SegmentRuleDTO{
		Separator:        separator,
		ChunkSize:        chunkSize,
		ChunkOverlap:     chunkOverlap,
		ChunkOverlapUnit: chunkOverlapUnit,
	}
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
	raw, err := unmarshalCompatRawObject(data, "hierarchy fragment config")
	if err != nil {
		return err
	}

	maxLevel, err := decodeCompatIntField(raw, "max_level")
	if err != nil {
		return err
	}
	textPreprocessRule, err := decodeCompatIntSliceField(raw, "text_preprocess_rule")
	if err != nil {
		return err
	}
	keepHierarchyInfo, err := decodeCompatBoolField(raw, "keep_hierarchy_info")
	if err != nil {
		return err
	}

	*c = HierarchyFragmentConfigDTO{
		MaxLevel:           maxLevel,
		TextPreprocessRule: textPreprocessRule,
		KeepHierarchyInfo:  keepHierarchyInfo,
	}
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
