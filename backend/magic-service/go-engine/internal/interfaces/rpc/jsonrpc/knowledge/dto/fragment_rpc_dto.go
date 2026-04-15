package dto

import (
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
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

// ListFragmentRequest 查询片段列表请求
type ListFragmentRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	KnowledgeCode string        `json:"knowledge_code" validate:"required"`
	DocumentCode  string        `json:"document_code" validate:"required"`
	Content       string        `json:"content"`
	SyncStatus    *int          `json:"sync_status"`
	Version       *int          `json:"version"`
	Page          PageParams    `json:"page"`
}

// DestroyFragmentRequest 删除片段请求
type DestroyFragmentRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	ID            int64         `json:"id" validate:"gt=0"`
	KnowledgeCode string        `json:"knowledge_code" validate:"required"`
	DocumentCode  string        `json:"document_code" validate:"required"`
}

// SyncFragmentRequest 同步片段请求
type SyncFragmentRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	FragmentID     int64          `json:"fragment_id" validate:"gt=0"`
	BusinessParams BusinessParams `json:"business_params"`
}

// SyncFragmentBatchRequest 批量同步片段请求
type SyncFragmentBatchRequest struct {
	DataIsolation  DataIsolation  `json:"data_isolation"`
	KnowledgeCode  string         `json:"knowledge_code" validate:"required"`
	FragmentIDs    []int64        `json:"fragment_ids"`
	BusinessParams BusinessParams `json:"business_params"`
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

// SimilarityTimeRange 时间范围过滤（Unix 秒）。
type SimilarityTimeRange struct {
	StartUnix int64 `json:"start_unix,omitempty"`
	EndUnix   int64 `json:"end_unix,omitempty"`
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
	DocumentFile   *docfilehelper.DocumentFileDTO  `json:"document_file"`
	StrategyConfig *confighelper.StrategyConfigDTO `json:"strategy_config"`
	FragmentConfig *confighelper.FragmentConfigDTO `json:"fragment_config"`
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
