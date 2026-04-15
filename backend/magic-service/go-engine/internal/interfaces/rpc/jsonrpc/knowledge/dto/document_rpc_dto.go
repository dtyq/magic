package dto

import (
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

// CreateDocumentRequest 创建文档请求
type CreateDocumentRequest struct {
	OrganizationCode  string                          `json:"organization_code" validate:"required"`
	UserID            string                          `json:"user_id" validate:"required"`
	KnowledgeBaseCode string                          `json:"knowledge_base_code" validate:"required"`
	Name              string                          `json:"name" validate:"required"`
	Description       string                          `json:"description"`
	DocType           int                             `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	ThirdPlatformType string                          `json:"third_platform_type"`
	ThirdFileID       string                          `json:"third_file_id"`
	EmbeddingModel    string                          `json:"embedding_model"`
	VectorDB          string                          `json:"vector_db"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig   *confighelper.EmbeddingConfig   `json:"embedding_config"`
	VectorDBConfig    *confighelper.VectorDBConfig    `json:"vector_db_config"`
}

// UpdateDocumentRequest 更新文档请求
type UpdateDocumentRequest struct {
	OrganizationCode  string                          `json:"organization_code" validate:"required"`
	UserID            string                          `json:"user_id" validate:"required"`
	Code              string                          `json:"code" validate:"required"`
	KnowledgeBaseCode string                          `json:"knowledge_base_code" validate:"required"`
	Name              string                          `json:"name"`
	Description       string                          `json:"description"`
	Enabled           *bool                           `json:"enabled"`
	DocType           *int                            `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	WordCount         *int                            `json:"word_count"`
}

// ShowDocumentRequest 查询文档详情请求
type ShowDocumentRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// GetOriginalFileLinkRequest 获取文档原始文件访问链接请求。
type GetOriginalFileLinkRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// ListDocumentRequest 查询文档列表请求
type ListDocumentRequest struct {
	OrganizationCode  string `json:"organization_code" validate:"required"`
	KnowledgeBaseCode string `json:"knowledge_base_code" validate:"required"`
	Name              string `json:"name"`
	DocType           *int   `json:"doc_type"`
	Enabled           *bool  `json:"enabled"`
	SyncStatus        *int   `json:"sync_status"`
	Page              struct {
		Offset int `json:"offset" validate:"min=0"`
		Limit  int `json:"limit" validate:"min=1"`
	} `json:"page"`
}

// GetDocumentsByThirdFileIdRequest 按第三方文件查询文档请求。
type GetDocumentsByThirdFileIdRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
	ThirdPlatformType string        `json:"third_platform_type" validate:"required"`
	ThirdFileID       string        `json:"third_file_id" validate:"required"`
}

// DestroyDocumentRequest 删除文档请求
type DestroyDocumentRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// SyncDocumentRequest 同步文档请求
type SyncDocumentRequest struct {
	DataIsolation     DataIsolation  `json:"data_isolation"`
	KnowledgeBaseCode string         `json:"knowledge_base_code" validate:"required"`
	Code              string         `json:"code" validate:"required"`
	Mode              string         `json:"mode"`
	Async             bool           `json:"async"`
	Sync              bool           `json:"sync"`
	BusinessParams    BusinessParams `json:"business_params"`
}

// ReVectorizedByThirdFileIdRequest 按第三方文件触发重向量化请求
type ReVectorizedByThirdFileIdRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	ThirdPlatformType string        `json:"third_platform_type" validate:"required"`
	ThirdFileID       string        `json:"third_file_id" validate:"required"`
}

// NotifyProjectFileChangeRequest 按项目文件触发重同步请求。
type NotifyProjectFileChangeRequest struct {
	ProjectFileID int64 `json:"project_file_id" validate:"gt=0"`
}

// CountByKnowledgeBaseCodesRequest 按知识库批量统计文档数量请求
type CountByKnowledgeBaseCodesRequest struct {
	DataIsolation      DataIsolation `json:"data_isolation"`
	KnowledgeBaseCodes []string      `json:"knowledge_base_codes"`
}

// OriginalFileLinkResponse 获取文档原始文件访问链接响应。
type OriginalFileLinkResponse struct {
	Available bool   `json:"available"`
	URL       string `json:"url"`
	Name      string `json:"name"`
	Key       string `json:"key"`
	Type      string `json:"type"`
}
