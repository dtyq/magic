// Package entity 定义文档子域实体。
package entity

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/filetype"
)

// KnowledgeBaseDocument 知识库文档实体
type KnowledgeBaseDocument struct {
	ID                int64                   `json:"id"`
	OrganizationCode  string                  `json:"organization_code"`
	KnowledgeBaseCode string                  `json:"knowledge_base_code"`
	SourceBindingID   int64                   `json:"source_binding_id"`
	SourceItemID      int64                   `json:"source_item_id"`
	ProjectID         int64                   `json:"project_id"`
	ProjectFileID     int64                   `json:"project_file_id"`
	AutoAdded         bool                    `json:"auto_added"`
	Name              string                  `json:"name"`
	Description       string                  `json:"description"`
	Code              string                  `json:"code"`
	Enabled           bool                    `json:"enabled"`
	DocType           int                     `json:"doc_type"`
	DocMetadata       map[string]any          `json:"doc_metadata"`
	DocumentFile      *File                   `json:"document_file"`
	ThirdPlatformType string                  `json:"third_platform_type"`
	ThirdFileID       string                  `json:"third_file_id"`
	SyncStatus        shared.SyncStatus       `json:"sync_status"`
	SyncTimes         int                     `json:"sync_times"`
	SyncStatusMessage string                  `json:"sync_status_message"`
	EmbeddingModel    string                  `json:"embedding_model"`
	VectorDB          string                  `json:"vector_db"`
	RetrieveConfig    *shared.RetrieveConfig  `json:"retrieve_config"`
	FragmentConfig    *shared.FragmentConfig  `json:"fragment_config"`
	EmbeddingConfig   *shared.EmbeddingConfig `json:"embedding_config"`
	VectorDBConfig    *shared.VectorDBConfig  `json:"vector_db_config"`
	WordCount         int                     `json:"word_count"`
	CreatedUID        string                  `json:"created_uid"`
	UpdatedUID        string                  `json:"updated_uid"`
	CreatedAt         time.Time               `json:"created_at"`
	UpdatedAt         time.Time               `json:"updated_at"`
	DeletedAt         *time.Time              `json:"deleted_at"`
}

// NewDocument 创建文档实体
func NewDocument(knowledgeBaseCode, name, code string, docType InputKind, createdUID, organizationCode string) *KnowledgeBaseDocument {
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
		SyncStatus:        shared.SyncStatusPending,
		CreatedUID:        createdUID,
		UpdatedUID:        createdUID,
		CreatedAt:         now,
		UpdatedAt:         now,
		DocMetadata:       make(map[string]any),
		EmbeddingConfig:   &shared.EmbeddingConfig{},
		VectorDBConfig:    &shared.VectorDBConfig{},
	}
}

// UpdatePatch 描述文档允许更新的领域字段。
type UpdatePatch struct {
	Name           *string
	Description    *string
	Enabled        *bool
	DocType        *int
	DocMetadata    map[string]any
	DocumentFile   *File
	RetrieveConfig *shared.RetrieveConfig
	FragmentConfig *shared.FragmentConfig
	WordCount      *int
	UpdatedUID     string
}

// File 文档文件信息。
type File struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	URL             string `json:"url"`
	FileKey         string `json:"file_key"`
	Size            int64  `json:"size"`
	Extension       string `json:"extension"`
	ThirdID         string `json:"third_id"`
	SourceType      string `json:"source_type"`
	ThirdFileType   string `json:"third_file_type"`
	KnowledgeBaseID string `json:"knowledge_base_id"`
}

// InputKind 表示进入解析/同步链路时的输入形态。
//
// 这组三态在文档领域内统一称为 DocumentInputKind，只区分 text/file/url，
// 不等同于 knowledge_base_documents.doc_type。
type InputKind int

const (
	// DocumentInputKindText 文本类型
	DocumentInputKindText InputKind = 1
	// DocumentInputKindFile 文件类型
	DocumentInputKindFile InputKind = 2
	// DocumentInputKindURL URL 类型
	DocumentInputKindURL InputKind = 3
)

// DocumentFile 保留旧命名兼容。
type DocumentFile = File

// BelongsToOrganization 判断文档是否属于指定组织。
func (d *KnowledgeBaseDocument) BelongsToOrganization(organizationCode string) bool {
	if d == nil || organizationCode == "" {
		return true
	}
	return d.OrganizationCode == organizationCode
}

// ApplyUpdate 应用文档领域更新。
func (d *KnowledgeBaseDocument) ApplyUpdate(patch UpdatePatch) {
	if d == nil {
		return
	}
	renameApplied := false
	if patch.Name != nil && *patch.Name != "" {
		renameApplied = true
		d.Name = *patch.Name
	}
	if patch.Description != nil && *patch.Description != "" {
		d.Description = *patch.Description
	}
	if patch.Enabled != nil {
		d.Enabled = *patch.Enabled
	}
	if patch.DocType != nil {
		d.DocType = *patch.DocType
	}
	if patch.DocMetadata != nil {
		d.DocMetadata = patch.DocMetadata
	}
	if patch.DocumentFile != nil {
		d.DocumentFile = patch.DocumentFile
	}
	if renameApplied {
		d.applyCanonicalDocumentName()
	}
	if patch.RetrieveConfig != nil {
		d.RetrieveConfig = patch.RetrieveConfig
	}
	if patch.FragmentConfig != nil {
		d.FragmentConfig = patch.FragmentConfig
	}
	if patch.WordCount != nil {
		d.WordCount = *patch.WordCount
	}
	if patch.UpdatedUID != "" {
		d.UpdatedUID = patch.UpdatedUID
	}
}

func (d *KnowledgeBaseDocument) applyCanonicalDocumentName() {
	if d == nil {
		return
	}

	if d.DocumentFile != nil {
		d.DocumentFile.Name = d.Name
		if ext := filetype.ExtractExtension(d.Name); ext != "" {
			d.DocumentFile.Extension = ext
		}
	}

	if d.DocumentFile == nil && !documentMetadataHasFileName(d.DocMetadata) {
		return
	}
	if d.DocMetadata == nil {
		d.DocMetadata = make(map[string]any, 1)
	}
	d.DocMetadata[parseddocument.MetaFileName] = d.Name
}

func documentMetadataHasFileName(metadata map[string]any) bool {
	if len(metadata) == 0 {
		return false
	}
	_, ok := metadata[parseddocument.MetaFileName]
	return ok
}

// MarkSyncing 标记文档进入同步中。
func (d *KnowledgeBaseDocument) MarkSyncing() {
	if d == nil {
		return
	}
	d.SyncStatus = shared.SyncStatusSyncing
	d.SyncStatusMessage = ""
	d.SyncTimes++
	d.UpdatedAt = time.Now()
}

// MarkSynced 标记文档同步完成。
func (d *KnowledgeBaseDocument) MarkSynced(wordCount int) {
	if d == nil {
		return
	}
	d.SyncStatus = shared.SyncStatusSynced
	d.SyncStatusMessage = ""
	d.WordCount = max(0, wordCount)
	d.UpdatedAt = time.Now()
}

// MarkSyncFailed 标记文档同步失败。
func (d *KnowledgeBaseDocument) MarkSyncFailed(message string) {
	if d == nil {
		return
	}
	d.SyncStatus = shared.SyncStatusSyncFailed
	d.SyncStatusMessage = strings.TrimSpace(message)
	d.UpdatedAt = time.Now()
}
