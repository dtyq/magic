// Package repository 定义文档子域仓储契约。
package repository

import (
	"context"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
)

// KnowledgeBaseRuntimeSnapshot 表示 document 仓储确保默认文档时需要的最小知识库快照。
type KnowledgeBaseRuntimeSnapshot struct {
	Code             string
	OrganizationCode string
	Model            string
	VectorDB         string
	CreatedUID       string
	UpdatedUID       string
	RetrieveConfig   *shared.RetrieveConfig
	FragmentConfig   *shared.FragmentConfig
	EmbeddingConfig  *shared.EmbeddingConfig
}

// DefaultDocumentCode 返回知识库默认文档编码。
func (s *KnowledgeBaseRuntimeSnapshot) DefaultDocumentCode() string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(s.Code) + "-DEFAULT-DOC"
}

// KnowledgeBaseDocumentWriter 文档写仓储接口
type KnowledgeBaseDocumentWriter interface {
	// Save 保存文档
	Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error

	// Update 更新文档
	Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error

	// Delete 物理删除文档
	Delete(ctx context.Context, id int64) error

	// DeleteByKnowledgeBase 根据知识库物理删除所有文档
	DeleteByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error

	// DeleteByKnowledgeBaseAndCodes 根据知识库和文档编码批量物理删除文档
	DeleteByKnowledgeBaseAndCodes(ctx context.Context, knowledgeBaseCode string, codes []string) error

	// UpdateSyncStatus 更新同步状态
	UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error

	// EnsureDefaultDocument 为知识库获取或创建默认文档。
	EnsureDefaultDocument(ctx context.Context, kb *KnowledgeBaseRuntimeSnapshot) (*docentity.KnowledgeBaseDocument, bool, error)
}

// KnowledgeBaseDocumentIdentityReader 定义文档按身份读取能力。
type KnowledgeBaseDocumentIdentityReader interface {
	// FindByID 根据 ID 查询文档
	FindByID(ctx context.Context, id int64) (*docentity.KnowledgeBaseDocument, error)

	// FindByCode 根据 Code 查询文档
	FindByCode(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error)

	// FindByCodeAndKnowledgeBase 根据 Code 和知识库 Code 查询文档
	FindByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error)

	// FindByKnowledgeBaseAndThirdFile 根据知识库和第三方文件查询文档映射。
	FindByKnowledgeBaseAndThirdFile(ctx context.Context, knowledgeBaseCode, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error)

	// FindByKnowledgeBaseAndProjectFile 根据知识库和项目文件查询文档映射。
	FindByKnowledgeBaseAndProjectFile(ctx context.Context, knowledgeBaseCode string, projectFileID int64) (*docentity.KnowledgeBaseDocument, error)

	// FindByThirdFile 根据第三方文件信息查询文档
	FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error)
}

// KnowledgeBaseDocumentListingReader 定义文档列表与统计读取能力。
type KnowledgeBaseDocumentListingReader interface {
	// ListByThirdFileInOrg 按组织和第三方文件列出文档映射。
	ListByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error)

	// ListByProjectFileInOrg 按组织和项目文件列出全部关联文档。
	ListByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error)

	// ListByKnowledgeBaseAndProject 按知识库和项目列出文档。
	ListByKnowledgeBaseAndProject(ctx context.Context, knowledgeBaseCode string, projectID int64) ([]*docentity.KnowledgeBaseDocument, error)

	// List 分页查询文档列表
	List(ctx context.Context, query *DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error)

	// ListByKnowledgeBase 根据知识库查询文档列表
	ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error)

	// ListByKnowledgeBaseAndSourceBindingIDs 根据知识库和 source_binding_id 批量列出文档
	ListByKnowledgeBaseAndSourceBindingIDs(
		ctx context.Context,
		knowledgeBaseCode string,
		sourceBindingIDs []int64,
	) ([]*docentity.KnowledgeBaseDocument, error)

	// CountByKnowledgeBaseCodes 按知识库批量统计文档数量
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

// KnowledgeBaseDocumentSourceCallbackReader 定义来源回调热路径读取能力。
type KnowledgeBaseDocumentSourceCallbackReader interface {
	// ListRealtimeByThirdFileInOrg 按组织和第三方文件列出 enabled + realtime 绑定下的文档映射。
	ListRealtimeByThirdFileInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*docentity.KnowledgeBaseDocument, error)

	// HasRealtimeThirdFileDocumentInOrg 判断组织内第三方文件是否已有 enabled + realtime 绑定下的文档。
	HasRealtimeThirdFileDocumentInOrg(ctx context.Context, organizationCode, thirdPlatformType, thirdFileID string) (bool, error)

	// ListRealtimeByProjectFileInOrg 按组织和项目文件列出 enabled + realtime 绑定下的文档。
	ListRealtimeByProjectFileInOrg(ctx context.Context, organizationCode string, projectFileID int64) ([]*docentity.KnowledgeBaseDocument, error)

	// HasRealtimeProjectFileDocumentInOrg 判断组织内项目文件是否已有 enabled + realtime 绑定下的文档。
	HasRealtimeProjectFileDocumentInOrg(ctx context.Context, organizationCode string, projectFileID int64) (bool, error)
}

// KnowledgeBaseDocumentRepository 文档仓储接口。
type KnowledgeBaseDocumentRepository interface {
	KnowledgeBaseDocumentWriter
	KnowledgeBaseDocumentIdentityReader
	KnowledgeBaseDocumentListingReader
	KnowledgeBaseDocumentSourceCallbackReader
}

// DocumentQuery 文档查询条件
type DocumentQuery struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Name              string
	DocType           *int
	Enabled           *bool
	SyncStatus        *shared.SyncStatus
	Offset            int
	Limit             int
}
