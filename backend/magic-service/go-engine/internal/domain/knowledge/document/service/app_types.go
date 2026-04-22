package document

import (
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

// CreateManagedDocumentInput 表示跨应用编排创建文档时的最小领域输入。
type CreateManagedDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	AutoAdded         bool
	Name              string
	Description       string
	DocType           int
	DocMetadata       map[string]any
	DocumentFile      *File
	ThirdPlatformType string
	ThirdFileID       string
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	VectorDBConfig    *shared.VectorDBConfig
	AutoSync          bool
}

// SyncDocumentInput 表示文档同步调度输入。
type SyncDocumentInput struct {
	OrganizationCode                  string
	KnowledgeBaseCode                 string
	Code                              string
	Mode                              string
	Async                             bool
	BusinessParams                    *ctxmeta.BusinessParams
	RebuildOverride                   *knowledgeroute.RebuildOverride
	SourceOverride                    *SourceOverride
	SingleDocumentThirdPlatformResync bool
}

// ThirdFileRevectorizeInput 表示第三方文件重向量化调度输入。
type ThirdFileRevectorizeInput struct {
	OrganizationCode  string
	UserID            string
	ThirdPlatformType string
	ThirdFileID       string
}

// ResolvedSourceSnapshot 表示一次源内容解析结果的稳定快照。
type ResolvedSourceSnapshot struct {
	Content            string
	ContentHash        string
	DocType            int
	DocumentFile       map[string]any
	Source             string
	FetchedAtUnixMilli int64
}
