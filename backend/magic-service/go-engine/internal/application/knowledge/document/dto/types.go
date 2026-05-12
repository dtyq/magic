// Package dto 定义 document application 子域对外暴露的 DTO。
package dto

import (
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

// DocumentDTO 表示文档应用服务输出。
type DocumentDTO struct {
	ID                int64  `json:"id"`
	OrganizationCode  string `json:"organization_code"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	KnowledgeBaseType string `json:"knowledge_base_type"`
	SourceType        *int   `json:"source_type,omitempty"`
	SourceBindingID   int64  `json:"source_binding_id"`
	SourceItemID      int64  `json:"source_item_id"`
	ProjectID         int64  `json:"project_id"`
	ProjectFileID     int64  `json:"project_file_id"`
	AutoAdded         bool   `json:"auto_added"`
	CreatedUID        string `json:"created_uid"`
	UpdatedUID        string `json:"updated_uid"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Code              string `json:"code"`
	Enabled           bool   `json:"enabled"`
	// DocType 是应用内部精确文件/文档类型，来源于 knowledge_base_documents.doc_type。
	// 主 HTTP API 响应顶层 doc_type 会在 RPC 兼容投影层转换为前端契约的知识库来源类型。
	DocType           int                             `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config,omitempty"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	ThirdPlatformType string                          `json:"third_platform_type"`
	ThirdFileID       string                          `json:"third_file_id"`
	SyncStatus        int                             `json:"sync_status"`
	SyncTimes         int                             `json:"sync_times"`
	SyncStatusMessage string                          `json:"sync_status_message"`
	EmbeddingModel    string                          `json:"embedding_model"`
	VectorDB          string                          `json:"vector_db"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig   *confighelper.EmbeddingConfig   `json:"embedding_config"`
	VectorDBConfig    *confighelper.VectorDBConfig    `json:"vector_db_config"`
	WordCount         int                             `json:"word_count"`
	CreatedAt         string                          `json:"created_at"`
	UpdatedAt         string                          `json:"updated_at"`
}

// OriginalFileLinkDTO 表示文档原始文件访问链接。
type OriginalFileLinkDTO struct {
	Available bool   `json:"available"`
	URL       string `json:"url"`
	Name      string `json:"name"`
	Key       string `json:"key"`
	Type      string `json:"type"`
}

// CreateDocumentInput 表示创建文档请求。
type CreateDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	KnowledgeBaseType string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	AutoAdded         bool
	Name              string
	Description       string
	DocType           int
	DocMetadata       map[string]any
	StrategyConfig    *confighelper.StrategyConfigDTO
	DocumentFile      *docfilehelper.DocumentFileDTO
	ThirdPlatformType string
	ThirdFileID       string
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *confighelper.RetrieveConfigDTO
	FragmentConfig    *confighelper.FragmentConfigDTO
	EmbeddingConfig   *confighelper.EmbeddingConfig
	VectorDBConfig    *confighelper.VectorDBConfig
	AutoSync          bool
	// Deprecated: 文档向量化始终异步调度，该字段不再触发同步等待。
	WaitForSyncResult bool
}

// UpdateDocumentInput 表示更新文档请求。
type UpdateDocumentInput struct {
	OrganizationCode  string
	UserID            string
	Code              string
	KnowledgeBaseCode string
	KnowledgeBaseType string
	Name              string
	Description       string
	Enabled           *bool
	DocType           *int
	DocMetadata       map[string]any
	StrategyConfig    *confighelper.StrategyConfigDTO
	DocumentFile      *docfilehelper.DocumentFileDTO
	RetrieveConfig    *confighelper.RetrieveConfigDTO
	FragmentConfig    *confighelper.FragmentConfigDTO
	WordCount         *int
	// Deprecated: 文档向量化始终异步调度，该字段不再触发同步等待。
	WaitForSyncResult bool
}

// ListDocumentInput 表示查询文档列表请求。
type ListDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	Name              string
	DocType           *int
	Enabled           *bool
	SyncStatus        *int
	Offset            int
	Limit             int
}

// GetDocumentsByThirdFileIDInput 表示按第三方文件查询文档请求。
type GetDocumentsByThirdFileIDInput struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	ThirdPlatformType string
	ThirdFileID       string
}

// ReVectorizedByThirdFileIDInput 表示按第三方文件触发重向量化请求。
type ReVectorizedByThirdFileIDInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	ThirdPlatformType             string
	ThirdFileID                   string
	ThirdKnowledgeID              string
}

// NotifyProjectFileChangeInput 表示按项目文件触发同步请求。
type NotifyProjectFileChangeInput struct {
	ProjectFileID    int64
	OrganizationCode string
	ProjectID        int64
	Status           string
}
