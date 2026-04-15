package document

import (
	"context"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"

	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/filetype"
)

// KnowledgeBaseDocument 知识库文档实体。
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
	KnowledgeBaseID string `json:"knowledge_base_id"`
}

const (
	// SyncModeCreate 表示创建后首次同步。
	SyncModeCreate = "create"
	// SyncModeResync 表示重同步。
	SyncModeResync = "resync"
)

// SourceOverride 表示同步时直接注入的已解析文档内容。
type SourceOverride struct {
	Content            string
	DocType            int
	DocumentFile       map[string]any
	Source             string
	ContentHash        string
	FetchedAtUnixMilli int64
}

// ResolveSyncMode 解析文档同步模式，空值默认创建同步。
func ResolveSyncMode(mode string) string {
	if strings.TrimSpace(mode) == "" {
		return SyncModeCreate
	}
	return mode
}

// ShouldCleanupBeforeSync 判断同步前是否需要先清理旧片段。
func ShouldCleanupBeforeSync(mode string) bool {
	return ResolveSyncMode(mode) != SyncModeResync
}

// DocType 文档类型枚举。
type DocType int

const (
	// DocTypeText 表示纯文本类型文档。
	DocTypeText DocType = 1
	// DocTypeFile 表示文件类型文档。
	DocTypeFile DocType = 2
	// DocTypeURL 表示链接类型文档。
	DocTypeURL DocType = 3
)

// NewDocument 创建一个具备默认同步配置的知识库文档实体。
func NewDocument(
	knowledgeBaseCode string,
	name string,
	code string,
	docType DocType,
	createdUID string,
	organizationCode string,
) *KnowledgeBaseDocument {
	if code == "" {
		code = uuid.New().String()
	}
	now := time.Now()
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
	d.DocMetadata[ParsedMetaFileName] = d.Name
}

func documentMetadataHasFileName(metadata map[string]any) bool {
	if len(metadata) == 0 {
		return false
	}
	_, ok := metadata[ParsedMetaFileName]
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

// KnowledgeBaseDocumentWriter 定义文档写入侧仓储能力。
type KnowledgeBaseDocumentWriter interface {
	Save(ctx context.Context, doc *KnowledgeBaseDocument) error
	Update(ctx context.Context, doc *KnowledgeBaseDocument) error
	Delete(ctx context.Context, id int64) error
	DeleteByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error
	UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error
	EnsureDefaultDocument(ctx context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) (*KnowledgeBaseDocument, bool, error)
}

// KnowledgeBaseDocumentIdentityReader 定义文档按身份读取能力。
type KnowledgeBaseDocumentIdentityReader interface {
	FindByID(ctx context.Context, id int64) (*KnowledgeBaseDocument, error)
	FindByCode(ctx context.Context, code string) (*KnowledgeBaseDocument, error)
	FindByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*KnowledgeBaseDocument, error)
	FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*KnowledgeBaseDocument, error)
	FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*KnowledgeBaseDocument, error)
}

// KnowledgeBaseDocumentListingReader 定义文档列表与统计读取能力。
type KnowledgeBaseDocumentListingReader interface {
	ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*KnowledgeBaseDocument, error)
	ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*KnowledgeBaseDocument, error)
	ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*KnowledgeBaseDocument, error)
	List(ctx context.Context, query *Query) ([]*KnowledgeBaseDocument, int64, error)
	ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*KnowledgeBaseDocument, int64, error)
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

// KnowledgeBaseDocumentReader 聚合文档读取侧仓储能力。
type KnowledgeBaseDocumentReader interface {
	KnowledgeBaseDocumentIdentityReader
	KnowledgeBaseDocumentListingReader
}

// KnowledgeBaseDocumentRepository 聚合知识库文档读写仓储能力。
type KnowledgeBaseDocumentRepository interface {
	KnowledgeBaseDocumentWriter
	KnowledgeBaseDocumentReader
}

// Parser 定义文档解析器能力。
type Parser interface {
	Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error)
	Supports(fileType string) bool
	NeedsResolvedURL() bool
}

// ParserWithOptions 定义支持解析选项的解析器能力。
type ParserWithOptions interface {
	Parser
	ParseWithOptions(ctx context.Context, fileURL string, file io.Reader, fileType string, options ParseOptions) (string, error)
}

// FileFetcher 定义文档源文件读取能力。
type FileFetcher interface {
	Fetch(ctx context.Context, path string) (io.ReadCloser, error)
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
	Stat(ctx context.Context, path string) error
}

// FileUploader 定义文档文件上传能力。
type FileUploader interface {
	Upload(ctx context.Context, path string, data io.Reader) error
}

// OCRClient 定义 OCR 解析能力。
type OCRClient interface {
	OCR(ctx context.Context, fileURL, fileType string) (string, error)
	OCRBytes(ctx context.Context, data []byte, fileType string) (string, error)
}

// StructuredDocumentParser 定义可返回结构化文档的解析器能力。
type StructuredDocumentParser interface {
	Parser
	ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*ParsedDocument, error)
}

// StructuredDocumentParserWithOptions 定义支持解析选项的结构化解析器能力。
type StructuredDocumentParserWithOptions interface {
	StructuredDocumentParser
	ParseDocumentWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options ParseOptions,
	) (*ParsedDocument, error)
}
