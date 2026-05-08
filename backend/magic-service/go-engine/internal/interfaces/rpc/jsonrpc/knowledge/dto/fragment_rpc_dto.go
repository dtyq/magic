package dto

import (
	"encoding/json"
	"fmt"

	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

// 片段相关 DTO（接口层定义，不依赖领域层）

// CreateFragmentRequest 创建片段请求
type CreateFragmentRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	DocumentCode   string         `json:"document_code"`
	Content        string         `json:"content" validate:"required"`
	Metadata       map[string]any `json:"metadata"`
	BusinessID     string         `json:"business_id" validate:"required"`
	BusinessParams BusinessParams `json:"business_params"`
}

// CreateFragmentBatchRequest 批量创建片段请求
type CreateFragmentBatchRequest struct {
	DataIsolation  DataIsolation   `json:"data_isolation"`
	KnowledgeCode  string          `json:"knowledge_code" validate:"required"`
	DocumentCode   string          `json:"document_code" validate:"required"`
	Fragments      []FragmentInput `json:"fragments"`
	BusinessParams BusinessParams  `json:"business_params"`
}

// FragmentInput 片段输入
type FragmentInput struct {
	Content  string         `json:"content" validate:"required"`
	Metadata map[string]any `json:"metadata"`
}

// UpdateFragmentRequest 更新片段请求
type UpdateFragmentRequest struct {
	DataIsolation DataIsolation  `json:"data_isolation"`
	ID            int64          `json:"id" validate:"gt=0"`
	Content       string         `json:"content" validate:"required"`
	Metadata      map[string]any `json:"metadata"`
}

// ShowFragmentRequest 查询片段请求
type ShowFragmentRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	ID            int64         `json:"id" validate:"gt=0"`
	KnowledgeCode string        `json:"knowledge_code" validate:"required"`
	DocumentCode  string        `json:"document_code" validate:"required"`
}

// UnmarshalJSON 兼容 id 传字符串。
func (r *ShowFragmentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "show fragment request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	id, err := decodeRequestIDInt64Value(raw, "id")
	if err != nil {
		return err
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return err
	}
	documentCode, err := decodeRequestStringValue(raw, "document_code")
	if err != nil {
		return err
	}

	*r = ShowFragmentRequest{
		DataIsolation: dataIsolation,
		ID:            id,
		KnowledgeCode: knowledgeCode,
		DocumentCode:  documentCode,
	}
	return nil
}

// ListFragmentRequest 查询片段列表请求
type ListFragmentRequest struct {
	DataIsolation  DataIsolation `json:"data_isolation"`
	KnowledgeCode  string        `json:"knowledge_code" validate:"required"`
	DocumentCode   string        `json:"document_code" validate:"required"`
	Content        string        `json:"content"`
	SyncStatus     *int          `json:"sync_status"`
	Version        *int          `json:"version"`
	Page           PageParams    `json:"page"`
	AcceptEncoding string        `json:"accept_encoding,omitempty"`
}

// UnmarshalJSON 兼容顶层分页和字符串标量。
func (r *ListFragmentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "list fragment request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return err
	}
	documentCode, err := decodeRequestStringValue(raw, "document_code")
	if err != nil {
		return err
	}
	content, err := decodeRequestStringValue(raw, "content")
	if err != nil {
		return err
	}
	syncStatus, _, err := decodeRequestInt(raw, "sync_status")
	if err != nil {
		return err
	}
	version, _, err := decodeRequestInt(raw, "version")
	if err != nil {
		return err
	}
	acceptEncoding, err := decodeRequestStringValue(raw, "accept_encoding")
	if err != nil {
		return err
	}

	offset := 0
	limit := 0
	if pageField, ok := raw["page"]; ok && isJSONObjectPayload(pageField) && !pkgjsoncompat.IsEmptyObjectLikeJSON(pageField) {
		var page PageParams
		if err := json.Unmarshal(pageField, &page); err != nil {
			return fmt.Errorf("unmarshal page: %w", err)
		}
		offset = page.Offset
		limit = page.Limit
	} else {
		offset, limit, err = decodeRequestPageWindow(raw, 100)
		if err != nil {
			return err
		}
	}

	*r = ListFragmentRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCode:  knowledgeCode,
		DocumentCode:   documentCode,
		Content:        content,
		SyncStatus:     syncStatus,
		Version:        version,
		AcceptEncoding: acceptEncoding,
		Page: PageParams{
			Offset: offset,
			Limit:  limit,
		},
	}
	return nil
}

// DestroyFragmentRequest 删除片段请求
type DestroyFragmentRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	ID            int64         `json:"id" validate:"gt=0"`
	KnowledgeCode string        `json:"knowledge_code" validate:"required"`
	DocumentCode  string        `json:"document_code" validate:"required"`
}

// UnmarshalJSON 兼容 id 传字符串。
func (r *DestroyFragmentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "destroy fragment request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	id, err := decodeRequestIDInt64Value(raw, "id")
	if err != nil {
		return err
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return err
	}
	documentCode, err := decodeRequestStringValue(raw, "document_code")
	if err != nil {
		return err
	}

	*r = DestroyFragmentRequest{
		DataIsolation: dataIsolation,
		ID:            id,
		KnowledgeCode: knowledgeCode,
		DocumentCode:  documentCode,
	}
	return nil
}

// SyncFragmentRequest 同步片段请求
type SyncFragmentRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	FragmentID     int64          `json:"fragment_id" validate:"gt=0"`
	BusinessParams BusinessParams `json:"business_params"`
}

// UnmarshalJSON 兼容 fragment_id 传字符串，并兼容旧协议使用 id 传片段主键。
func (r *SyncFragmentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "sync fragment request")
	if err != nil {
		return err
	}

	dataIsolation, knowledgeCode, businessParams, err := decodeFragmentSyncCommon(raw)
	if err != nil {
		return err
	}
	fragmentIDValue, fragmentIDProvided, err := decodeRequestIDInt64(raw, "fragment_id")
	if err != nil {
		return err
	}
	fragmentID := int64(0)
	if fragmentIDProvided && fragmentIDValue != nil {
		fragmentID = *fragmentIDValue
	} else {
		legacyID, err := decodeRequestIDInt64Value(raw, "id")
		if err != nil {
			return err
		}
		fragmentID = legacyID
	}

	*r = SyncFragmentRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCode:  knowledgeCode,
		FragmentID:     fragmentID,
		BusinessParams: businessParams,
	}
	return nil
}

// SyncFragmentBatchRequest 批量同步片段请求
type SyncFragmentBatchRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	FragmentIDs    []int64        `json:"fragment_ids"`
	BusinessParams BusinessParams `json:"business_params"`
}

// UnmarshalJSON 兼容 fragment_ids 中的字符串数字。
func (r *SyncFragmentBatchRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "sync fragment batch request")
	if err != nil {
		return err
	}

	dataIsolation, knowledgeCode, businessParams, err := decodeFragmentSyncCommon(raw)
	if err != nil {
		return err
	}
	fragmentIDs, err := decodeRequestIDInt64Slice(raw, "fragment_ids")
	if err != nil {
		return err
	}

	*r = SyncFragmentBatchRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCode:  knowledgeCode,
		FragmentIDs:    fragmentIDs,
		BusinessParams: businessParams,
	}
	return nil
}

func decodeFragmentSyncCommon(raw map[string]json.RawMessage) (DataIsolation, string, BusinessParams, error) {
	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return DataIsolation{}, "", BusinessParams{}, fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return DataIsolation{}, "", BusinessParams{}, err
	}
	var businessParams BusinessParams
	if field, ok := raw["business_params"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &businessParams); err != nil {
			return DataIsolation{}, "", BusinessParams{}, fmt.Errorf("unmarshal business_params: %w", err)
		}
	}
	return dataIsolation, knowledgeCode, businessParams, nil
}

// SimilarityRequest 相似度搜索请求
type SimilarityRequest struct {
	DataIsolation  DataIsolation      `json:"data_isolation"`
	KnowledgeCode  string             `json:"knowledge_code" validate:"required"`
	Query          string             `json:"query" validate:"required"`
	TopK           int                `json:"top_k"`
	ScoreThreshold float64            `json:"score_threshold"`
	Filters        *SimilarityFilters `json:"filters,omitempty"`
	Debug          bool               `json:"debug,omitempty"`
	BusinessParams BusinessParams     `json:"business_params"`
	AcceptEncoding string             `json:"accept_encoding,omitempty"`
}

// UnmarshalJSON 兼容 top_k/debug/score_threshold 传字符串。
func (r *SimilarityRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "similarity request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return err
	}
	query, err := decodeRequestStringValue(raw, "query")
	if err != nil {
		return err
	}
	topK, err := decodeRequestIntValue(raw, "top_k")
	if err != nil {
		return err
	}
	scoreThreshold, err := decodeRequestFloat64Value(raw, "score_threshold")
	if err != nil {
		return err
	}
	debug, _, err := decodeRequestBoolPHPTruth(raw, "debug")
	if err != nil {
		return err
	}
	acceptEncoding, err := decodeRequestStringValue(raw, "accept_encoding")
	if err != nil {
		return err
	}
	var filters *SimilarityFilters
	if field, ok := raw["filters"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &filters); err != nil {
			return fmt.Errorf("unmarshal filters: %w", err)
		}
	}
	var businessParams BusinessParams
	if field, ok := raw["business_params"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &businessParams); err != nil {
			return fmt.Errorf("unmarshal business_params: %w", err)
		}
	}

	*r = SimilarityRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCode:  knowledgeCode,
		Query:          query,
		TopK:           topK,
		ScoreThreshold: scoreThreshold,
		Filters:        filters,
		Debug:          dereferenceBool(debug),
		BusinessParams: businessParams,
		AcceptEncoding: acceptEncoding,
	}
	return nil
}

// RuntimeSimilarityRequest flow/teamshare runtime 多知识库相似度搜索请求。
type RuntimeSimilarityRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCodes []string       `json:"knowledge_codes" validate:"required,min=1"`
	Query          string         `json:"query" validate:"required"`
	Question       string         `json:"question"`
	TopK           int            `json:"top_k"`
	ScoreThreshold *float64       `json:"score_threshold,omitempty"`
	MetadataFilter JSONObject     `json:"metadata_filter,omitempty"`
	Debug          bool           `json:"debug,omitempty"`
	BusinessParams BusinessParams `json:"business_params"`
}

// UnmarshalJSON 兼容 top_k/debug/score_threshold 传字符串。
func (r *RuntimeSimilarityRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "runtime similarity request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeCodes, err := decodeRequestStringSlice(raw, "knowledge_codes")
	if err != nil {
		return err
	}
	query, err := decodeRequestStringValue(raw, "query")
	if err != nil {
		return err
	}
	question, err := decodeRequestStringValue(raw, "question")
	if err != nil {
		return err
	}
	topK, err := decodeRequestIntValue(raw, "top_k")
	if err != nil {
		return err
	}
	scoreThresholdValue, scoreThresholdProvided, err := decodeRequestFloat64(raw, "score_threshold")
	if err != nil {
		return err
	}
	var scoreThreshold *float64
	if scoreThresholdProvided {
		scoreThreshold = &scoreThresholdValue
	}
	debug, _, err := decodeRequestBoolPHPTruth(raw, "debug")
	if err != nil {
		return err
	}
	var metadataFilter JSONObject
	if field, ok := raw["metadata_filter"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &metadataFilter); err != nil {
			return fmt.Errorf("unmarshal metadata_filter: %w", err)
		}
	}
	var businessParams BusinessParams
	if field, ok := raw["business_params"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &businessParams); err != nil {
			return fmt.Errorf("unmarshal business_params: %w", err)
		}
	}

	*r = RuntimeSimilarityRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCodes: knowledgeCodes,
		Query:          query,
		Question:       question,
		TopK:           topK,
		ScoreThreshold: scoreThreshold,
		MetadataFilter: metadataFilter,
		Debug:          dereferenceBool(debug),
		BusinessParams: businessParams,
	}
	return nil
}

// AgentSimilarityRequest 数字员工维度相似度搜索请求。
type AgentSimilarityRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	AgentCode     string        `json:"agent_code" validate:"required"`
	Query         string        `json:"query" validate:"required"`
}

// SimilarityFilters 相似度搜索可选过滤条件。
type SimilarityFilters struct {
	DocumentCodes []string             `json:"document_codes,omitempty"`
	DocumentTypes []int                `json:"document_types,omitempty"`
	SectionPaths  []string             `json:"section_paths,omitempty"`
	SectionLevels []int                `json:"section_levels,omitempty"`
	Tags          []string             `json:"tags,omitempty"`
	TimeRange     *SimilarityTimeRange `json:"time_range,omitempty"`
}

// UnmarshalJSON 兼容过滤条件中的整型切片和时间范围字符串数值。
func (f *SimilarityFilters) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "similarity filters")
	if err != nil {
		return err
	}

	documentCodes, err := decodeRequestStringSlice(raw, "document_codes")
	if err != nil {
		return err
	}
	documentTypes, err := decodeRequestIntSlice(raw, "document_types")
	if err != nil {
		return err
	}
	sectionPaths, err := decodeRequestStringSlice(raw, "section_paths")
	if err != nil {
		return err
	}
	sectionLevels, err := decodeRequestIntSlice(raw, "section_levels")
	if err != nil {
		return err
	}
	tags, err := decodeRequestStringSlice(raw, "tags")
	if err != nil {
		return err
	}

	var timeRange *SimilarityTimeRange
	if field, ok := raw["time_range"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &timeRange); err != nil {
			return fmt.Errorf("unmarshal time_range: %w", err)
		}
	}

	*f = SimilarityFilters{
		DocumentCodes: documentCodes,
		DocumentTypes: documentTypes,
		SectionPaths:  sectionPaths,
		SectionLevels: sectionLevels,
		Tags:          tags,
		TimeRange:     timeRange,
	}
	return nil
}

// SimilarityTimeRange 时间范围过滤（Unix 秒）。
type SimilarityTimeRange struct {
	StartUnix int64 `json:"start_unix,omitempty"`
	EndUnix   int64 `json:"end_unix,omitempty"`
}

// UnmarshalJSON 兼容 start_unix/end_unix 传字符串。
func (r *SimilarityTimeRange) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "similarity time range")
	if err != nil {
		return err
	}

	startUnix, err := decodeRequestInt64Value(raw, "start_unix")
	if err != nil {
		return err
	}
	endUnix, err := decodeRequestInt64Value(raw, "end_unix")
	if err != nil {
		return err
	}

	*r = SimilarityTimeRange{
		StartUnix: startUnix,
		EndUnix:   endUnix,
	}
	return nil
}

// PreviewFragmentRequest 片段预览请求（解析+切片，不落库）。
//
// 这里的 document_file 是 preview transport contract，不是持久化 document_file 的强类型子集。
// 调用方应尽量原样透传，Go 再统一解释：
//   - external: 直接按 URL / key 解析
//   - third_platform: 走第三方 resolver
//   - project_file: 合法输入，通常先由 original-file-link 换成临时 URL，再按普通 URL 解析
//
// 因此上游不应该因为收到 project_file 就自行改写为 third_platform 或做业务分流。
type PreviewFragmentRequest struct {
	DataIsolation  DataIsolation                   `json:"data_isolation"`
	DocumentCode   string                          `json:"document_code,omitempty"`
	DocumentFile   *docfilehelper.DocumentFileDTO  `json:"document_file"`
	StrategyConfig *confighelper.StrategyConfigDTO `json:"strategy_config"`
	FragmentConfig *confighelper.FragmentConfigDTO `json:"fragment_config"`
	AcceptEncoding string                          `json:"accept_encoding,omitempty"`
}

// RuntimeCreateFragmentRequest flow/teamshare runtime 片段写入请求。
type RuntimeCreateFragmentRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	DocumentCode   string         `json:"document_code"`
	Content        string         `json:"content" validate:"required"`
	Metadata       map[string]any `json:"metadata"`
	BusinessID     string         `json:"business_id"`
	ID             int64          `json:"id"`
	BusinessParams BusinessParams `json:"business_params"`
}

// UnmarshalJSON 兼容 id 传字符串。
func (r *RuntimeCreateFragmentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "runtime create fragment request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeCode, err := decodeRequestStringValue(raw, "knowledge_code")
	if err != nil {
		return err
	}
	documentCode, err := decodeRequestStringValue(raw, "document_code")
	if err != nil {
		return err
	}
	content, err := decodeRequestStringValue(raw, "content")
	if err != nil {
		return err
	}
	businessID, err := decodeRequestStringValue(raw, "business_id")
	if err != nil {
		return err
	}
	id, err := decodeRequestInt64Value(raw, "id")
	if err != nil {
		return err
	}
	var metadata map[string]any
	if field, ok := raw["metadata"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &metadata); err != nil {
			return fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	var businessParams BusinessParams
	if field, ok := raw["business_params"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &businessParams); err != nil {
			return fmt.Errorf("unmarshal business_params: %w", err)
		}
	}

	*r = RuntimeCreateFragmentRequest{
		DataIsolation:  dataIsolation,
		KnowledgeCode:  knowledgeCode,
		DocumentCode:   documentCode,
		Content:        content,
		Metadata:       metadata,
		BusinessID:     businessID,
		ID:             id,
		BusinessParams: businessParams,
	}
	return nil
}

// RuntimeDestroyByBusinessIDRequest flow/teamshare runtime 按 business_id 批量删除请求。
type RuntimeDestroyByBusinessIDRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	KnowledgeCode string        `json:"knowledge_code" validate:"required"`
	BusinessID    string        `json:"business_id" validate:"required"`
}

// RuntimeDestroyByMetadataFilterRequest flow/teamshare runtime 按 metadata filter 批量删除请求。
type RuntimeDestroyByMetadataFilterRequest struct {
	DataIsolation  DataIsolation `json:"data_isolation"`
	KnowledgeCode  string        `json:"knowledge_code" validate:"required"`
	MetadataFilter JSONObject    `json:"metadata_filter,omitempty"`
}
