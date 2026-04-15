// Package entity 定义文档子域实体。
package entity

import (
	"time"

	"github.com/google/uuid"

	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

// KnowledgeBaseDocument 知识库文档实体
type KnowledgeBaseDocument struct {
	ID                int64                         `json:"id"`
	OrganizationCode  string                        `json:"organization_code"`
	KnowledgeBaseCode string                        `json:"knowledge_base_code"`
	SourceBindingID   int64                         `json:"source_binding_id"`
	SourceItemID      int64                         `json:"source_item_id"`
	ProjectID         int64                         `json:"project_id"`
	ProjectFileID     int64                         `json:"project_file_id"`
	AutoAdded         bool                          `json:"auto_added"`
	Name              string                        `json:"name"`
	Description       string                        `json:"description"`
	Code              string                        `json:"code"`
	Enabled           bool                          `json:"enabled"`
	DocType           int                           `json:"doc_type"`
	DocMetadata       map[string]any                `json:"doc_metadata"`
	DocumentFile      *DocumentFile                 `json:"document_file"`
	ThirdPlatformType string                        `json:"third_platform_type"`
	ThirdFileID       string                        `json:"third_file_id"`
	SyncStatus        sharedentity.SyncStatus       `json:"sync_status"`
	SyncTimes         int                           `json:"sync_times"`
	SyncStatusMessage string                        `json:"sync_status_message"`
	EmbeddingModel    string                        `json:"embedding_model"`
	VectorDB          string                        `json:"vector_db"`
	RetrieveConfig    *sharedentity.RetrieveConfig  `json:"retrieve_config"`
	FragmentConfig    *sharedentity.FragmentConfig  `json:"fragment_config"`
	EmbeddingConfig   *sharedentity.EmbeddingConfig `json:"embedding_config"`
	VectorDBConfig    *sharedentity.VectorDBConfig  `json:"vector_db_config"`
	WordCount         int                           `json:"word_count"`
	CreatedUID        string                        `json:"created_uid"`
	UpdatedUID        string                        `json:"updated_uid"`
	CreatedAt         time.Time                     `json:"created_at"`
	UpdatedAt         time.Time                     `json:"updated_at"`
	DeletedAt         *time.Time                    `json:"deleted_at"`
}

// NewDocument 创建文档实体
func NewDocument(knowledgeBaseCode, name, code string, docType DocType, createdUID, organizationCode string) *KnowledgeBaseDocument {
	if code == "" {
		code = uuid.New().String()
	}
	now := time.Now()
	// 默认值
	return &KnowledgeBaseDocument{
		OrganizationCode:  organizationCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		Name:              name,
		Code:              code,
		DocType:           int(docType),
		Enabled:           true,
		SyncStatus:        sharedentity.SyncStatusPending,
		CreatedUID:        createdUID,
		UpdatedUID:        createdUID,
		CreatedAt:         now,
		UpdatedAt:         now,
		DocMetadata:       make(map[string]any),
		EmbeddingConfig:   &sharedentity.EmbeddingConfig{},
		VectorDBConfig:    &sharedentity.VectorDBConfig{},
	}
}

// DocumentFile 文档文件信息
type DocumentFile struct {
	Type       string `json:"type"`
	Name       string `json:"name"`
	URL        string `json:"url"`
	Size       int64  `json:"size"`
	Extension  string `json:"extension"`
	ThirdID    string `json:"third_id"`
	SourceType string `json:"source_type"`
}

// DocType 文档类型枚举
type DocType int

const (
	// DocTypeText 文本类型
	DocTypeText DocType = 1
	// DocTypeFile 文件类型
	DocTypeFile DocType = 2
	// DocTypeURL URL 类型
	DocTypeURL DocType = 3
)
