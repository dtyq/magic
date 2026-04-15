// Package repository 定义文档子域仓储契约。
package repository

import (
	"context"

	docentity "magic/internal/domain/knowledge/document/entity"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

// KnowledgeBaseRuntimeSnapshot 表示 document 仓储确保默认文档时需要的最小知识库快照。
type KnowledgeBaseRuntimeSnapshot struct {
	Code             string
	OrganizationCode string
	Model            string
	VectorDB         string
	CreatedUID       string
	UpdatedUID       string
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

	// UpdateSyncStatus 更新同步状态
	UpdateSyncStatus(ctx context.Context, id int64, status sharedentity.SyncStatus, message string) error

	// EnsureDefaultDocument 为知识库获取或创建默认文档。
	EnsureDefaultDocument(ctx context.Context, kb *KnowledgeBaseRuntimeSnapshot) (*docentity.KnowledgeBaseDocument, bool, error)
}

// KnowledgeBaseDocumentReader 文档读仓储接口
type KnowledgeBaseDocumentReader interface {
	// FindByID 根据 ID 查询文档
	FindByID(ctx context.Context, id int64) (*docentity.KnowledgeBaseDocument, error)

	// FindByCode 根据 Code 查询文档
	FindByCode(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error)

	// FindByCodeAndKnowledgeBase 根据 Code 和知识库 Code 查询文档
	FindByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error)

	// FindByThirdFile 根据第三方文件信息查询文档
	FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error)

	// List 分页查询文档列表
	List(ctx context.Context, query *DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error)

	// ListByKnowledgeBase 根据知识库查询文档列表
	ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error)

	// CountByKnowledgeBaseCodes 按知识库批量统计文档数量
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

// KnowledgeBaseDocumentRepository 文档仓储接口
type KnowledgeBaseDocumentRepository interface {
	KnowledgeBaseDocumentWriter
	KnowledgeBaseDocumentReader
}

// DocumentQuery 文档查询条件
type DocumentQuery struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Name              string
	DocType           *int
	Enabled           *bool
	SyncStatus        *sharedentity.SyncStatus
	Offset            int
	Limit             int
}
