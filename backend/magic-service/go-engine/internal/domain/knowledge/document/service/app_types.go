package document

import (
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

const (
	// RevectorizeSourceSingleDocumentManual 表示后台手动触发的单文档重向量化。
	RevectorizeSourceSingleDocumentManual = "single_document_manual"
	// RevectorizeSourceThirdFileBroadcast 表示第三方文件变动广播。
	RevectorizeSourceThirdFileBroadcast = "third_file_broadcast"
	// RevectorizeSourceProjectFileNotify 表示项目文件变更通知。
	RevectorizeSourceProjectFileNotify = "project_file_notify"
	// RevectorizeSourceTeamshareKnowledgeStartVector 表示 Teamshare 单知识库批量重向量化。
	RevectorizeSourceTeamshareKnowledgeStartVector = "teamshare_knowledge_start_vector"
)

// CreateManagedDocumentInput 表示跨应用编排创建文档时的最小领域输入。
type CreateManagedDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	Code              string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	AutoAdded         bool
	Name              string
	Description       string
	DocType           int
	DocMetadata       map[string]any
	DocumentFile      *docentity.File
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
	OrganizationCode  string
	KnowledgeBaseCode string
	Code              string
	Mode              string
	Async             bool
	BusinessParams    *ctxmeta.BusinessParams
	RebuildOverride   *knowledgeroute.RebuildOverride
	SourceOverride    *SourceOverride
	RevectorizeSource string
	// SingleDocumentThirdPlatformResync 用来把任务固定在“当前文档”作用域。
	// third-file 变更 fan-out 之后发出来的 document_sync 必须带上这个标记，
	// 否则 consumer 看到 third-platform 文档时又会重定向回广播入口，形成回环。
	SingleDocumentThirdPlatformResync bool
	RevectorizeSessionID              string
}

// ThirdFileRevectorizeInput 表示第三方文件重向量化调度输入。
type ThirdFileRevectorizeInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	ThirdPlatformType             string
	ThirdFileID                   string
	ThirdKnowledgeID              string
}

// ResolvedSourceSnapshot 表示一次源内容解析结果的稳定快照。
type ResolvedSourceSnapshot struct {
	Content            string
	ContentHash        string
	DocType            int
	DocumentFile       map[string]any
	ParsedDocument     *parseddocument.ParsedDocument
	Source             string
	FetchedAtUnixMilli int64
}

// NormalizeRevectorizeSource 规整文档同步请求携带的重向量化来源。
func NormalizeRevectorizeSource(source string) string {
	return strings.TrimSpace(source)
}

// RevectorizeSourceAllowsThirdFileBroadcast 判断当前来源是否允许借 third-file 链路扩散目标集合。
func RevectorizeSourceAllowsThirdFileBroadcast(source string) bool {
	switch NormalizeRevectorizeSource(source) {
	case "",
		RevectorizeSourceThirdFileBroadcast:
		return true
	default:
		return false
	}
}

// RevectorizeSourcePrefersSingleDocumentThirdPlatformResync 判断当前来源是否应坚持单文档 third-platform 重同步。
func RevectorizeSourcePrefersSingleDocumentThirdPlatformResync(source string) bool {
	switch NormalizeRevectorizeSource(source) {
	case RevectorizeSourceSingleDocumentManual,
		RevectorizeSourceTeamshareKnowledgeStartVector:
		return true
	default:
		return false
	}
}
