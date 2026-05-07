// Package dto 定义 fragment application 子域对外暴露的 DTO。
package dto

import (
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	"magic/internal/pkg/ctxmeta"
)

// FragmentDTO 表示片段应用服务输出。
type FragmentDTO struct {
	ID                int64          `json:"id"`
	OrganizationCode  string         `json:"organization_code"`
	KnowledgeCode     string         `json:"knowledge_code"`
	KnowledgeBaseType string         `json:"-"`
	SourceType        *int           `json:"-"`
	Creator           string         `json:"creator"`
	Modifier          string         `json:"modifier"`
	DocumentCode      string         `json:"document_code"`
	BusinessID        string         `json:"business_id"`
	CreatedUID        string         `json:"created_uid"`
	UpdatedUID        string         `json:"updated_uid"`
	DocumentName      string         `json:"document_name"`
	DocumentType      int            `json:"document_type"`
	Content           string         `json:"content"`
	Metadata          map[string]any `json:"metadata"`
	SyncStatus        int            `json:"sync_status"`
	SyncStatusMessage string         `json:"sync_status_message"`
	PointID           string         `json:"point_id"`
	WordCount         int            `json:"word_count"`
	CreatedAt         string         `json:"created_at"`
	UpdatedAt         string         `json:"updated_at"`
}

// FragmentListItemDTO 表示对外暴露的片段列表项。
type FragmentListItemDTO struct {
	ID                int64  `json:"id"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	KnowledgeCode     string `json:"knowledge_code"`
	OrganizationCode  string `json:"organization_code"`
	Creator           string `json:"creator"`
	Modifier          string `json:"modifier"`
	CreatedUID        string `json:"created_uid"`
	UpdatedUID        string `json:"updated_uid"`
	DocumentCode      string `json:"document_code"`
	BusinessID        string `json:"business_id"`
	DocumentName      string `json:"document_name"`
	DocumentType      int    `json:"document_type"`
	KnowledgeBaseType string `json:"-"`
	SourceType        *int   `json:"-"`
	// DocType 是历史兼容字段；RPC 兼容响应层会基于 KnowledgeBaseType/SourceType
	// 重新投影顶层 doc_type。DocumentType 继续表示内部精确文件类型。
	DocType           int            `json:"doc_type"`
	Content           string         `json:"content"`
	Metadata          map[string]any `json:"metadata"`
	SyncStatus        int            `json:"sync_status"`
	SyncStatusMessage string         `json:"sync_status_message"`
	Score             float64        `json:"score"`
	WordCount         int            `json:"word_count"`
	PointID           string         `json:"point_id"`
	CreatedAt         string         `json:"created_at"`
	UpdatedAt         string         `json:"updated_at"`
	Version           int            `json:"version"`
}

// DocumentNodeDTO 表示结构化文档节点。
type DocumentNodeDTO struct {
	ID       int    `json:"id"`
	Parent   int    `json:"parent"`
	Children []int  `json:"children"`
	Text     string `json:"text"`
	Level    int    `json:"level"`
	Type     string `json:"type"`
}

// FragmentPageResultDTO 表示片段分页结果。
type FragmentPageResultDTO struct {
	Page          int                    `json:"page"`
	Total         int64                  `json:"total"`
	List          []*FragmentListItemDTO `json:"list"`
	DocumentNodes []DocumentNodeDTO      `json:"document_nodes,omitempty"`
}

// SimilarityResultDTO 表示相似度检索输出。
type SimilarityResultDTO struct {
	ID                int64          `json:"id"`
	CitationID        string         `json:"citation_id,omitempty"`
	Content           string         `json:"content"`
	Score             float64        `json:"score"`
	WordCount         int            `json:"word_count"`
	Metadata          map[string]any `json:"metadata"`
	KnowledgeBaseCode string         `json:"knowledge_base_code"`
	KnowledgeCode     string         `json:"knowledge_code"`
	DocumentCode      string         `json:"document_code"`
	DocumentName      string         `json:"document_name"`
	DocumentType      int            `json:"document_type"`
	KnowledgeBaseType string         `json:"-"`
	SourceType        *int           `json:"-"`
	// DocType 是历史兼容字段；RPC 兼容响应层会基于 KnowledgeBaseType/SourceType
	// 重新投影顶层 doc_type。DocumentType 继续表示内部精确文件类型。
	DocType    int    `json:"doc_type"`
	BusinessID string `json:"business_id"`
}

// AgentSimilarityResultDTO 表示数字员工维度的知识检索结果。
type AgentSimilarityResultDTO struct {
	QueryUsed   string                 `json:"query_used"`
	HitCount    int                    `json:"hit_count"`
	ContextText string                 `json:"context_text"`
	Hits        []*SimilarityResultDTO `json:"hits"`
}

// CreateFragmentInput 表示创建片段请求。
type CreateFragmentInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeCode    string
	DocumentCode     string
	BusinessID       string
	Content          string
	Metadata         map[string]any
}

// ListFragmentInput 表示片段列表查询请求。
type ListFragmentInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeCode    string
	DocumentCode     string
	Content          string
	SyncStatus       *int
	Offset           int
	Limit            int
}

// SyncFragmentInput 表示片段同步请求。
type SyncFragmentInput struct {
	OrganizationCode string
	KnowledgeCode    string
	FragmentID       int64
	BusinessParams   *ctxmeta.BusinessParams
}

// SimilarityInput 表示片段相似度检索请求。
type SimilarityInput struct {
	OrganizationCode string
	KnowledgeCode    string
	Query            string
	TopK             int
	ScoreThreshold   float64
	BusinessParams   *ctxmeta.BusinessParams
	Filters          *SimilarityFilterInput
	Debug            bool
}

// RuntimeSimilarityInput 表示 flow/teamshare runtime 多知识库检索请求。
type RuntimeSimilarityInput struct {
	OrganizationCode string
	KnowledgeCodes   []string
	Query            string
	Question         string
	TopK             int
	ScoreThreshold   *float64
	MetadataFilter   map[string]any
	Debug            bool
	BusinessParams   *ctxmeta.BusinessParams
}

// RuntimeCreateFragmentInput 表示 flow/teamshare runtime 片段写入请求。
type RuntimeCreateFragmentInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeCode    string
	DocumentCode     string
	Content          string
	Metadata         map[string]any
	BusinessID       string
	CompatID         int64
	BusinessParams   *ctxmeta.BusinessParams
}

// RuntimeDestroyByBusinessIDInput 表示按 business_id 批量删除请求。
type RuntimeDestroyByBusinessIDInput struct {
	OrganizationCode string
	KnowledgeCode    string
	BusinessID       string
}

// RuntimeDestroyByMetadataFilterInput 表示按 metadata filter 批量删除请求。
type RuntimeDestroyByMetadataFilterInput struct {
	OrganizationCode string
	KnowledgeCode    string
	MetadataFilter   map[string]any
}

// AgentSimilarityInput 表示数字员工维度片段相似度检索请求。
type AgentSimilarityInput struct {
	OrganizationCode string
	UserID           string
	AgentCode        string
	Query            string
	BusinessParams   *ctxmeta.BusinessParams
}

// SimilarityFilterInput 表示片段相似度过滤条件。
type SimilarityFilterInput struct {
	DocumentCodes []string                  `json:"document_codes"`
	DocumentTypes []int                     `json:"document_types"`
	SectionPaths  []string                  `json:"section_paths"`
	SectionLevels []int                     `json:"section_levels"`
	Tags          []string                  `json:"tags"`
	TimeRange     *SimilarityTimeRangeInput `json:"time_range"`
}

// SimilarityTimeRangeInput 表示相似度过滤中的时间范围。
type SimilarityTimeRangeInput struct {
	StartUnix int64 `json:"start_unix"`
	EndUnix   int64 `json:"end_unix"`
}

// PreviewFragmentInput 表示片段预览请求。
type PreviewFragmentInput struct {
	OrganizationCode string
	UserID           string
	DocumentCode     string
	DocumentFile     *docfilehelper.DocumentFileDTO
	StrategyConfig   *confighelper.StrategyConfigDTO
	FragmentConfig   *confighelper.FragmentConfigDTO
}
