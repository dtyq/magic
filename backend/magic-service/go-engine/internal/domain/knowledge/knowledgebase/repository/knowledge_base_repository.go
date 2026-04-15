// Package repository 定义知识库领域的仓储接口
package repository

import (
	"context"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

// KnowledgeBaseRepository 知识库仓储接口
type KnowledgeBaseRepository interface {
	// Save 保存知识库
	Save(ctx context.Context, kb *kbentity.KnowledgeBase) error

	// Update 更新知识库
	Update(ctx context.Context, kb *kbentity.KnowledgeBase) error

	// FindByID 根据 ID 查询知识库
	FindByID(ctx context.Context, id int64) (*kbentity.KnowledgeBase, error)

	// FindByCode 根据 Code 查询知识库
	FindByCode(ctx context.Context, code string) (*kbentity.KnowledgeBase, error)

	// FindByCodeAndOrg 根据 Code 和组织查询知识库
	FindByCodeAndOrg(ctx context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error)

	// List 分页查询知识库列表
	List(ctx context.Context, query *KnowledgeBaseQuery) ([]*kbentity.KnowledgeBase, int64, error)

	// Delete 删除知识库
	Delete(ctx context.Context, id int64) error

	// UpdateSyncStatus 更新同步状态
	UpdateSyncStatus(ctx context.Context, id int64, status sharedentity.SyncStatus, message string) error

	// UpdateProgress 更新同步进度
	UpdateProgress(ctx context.Context, id int64, expectedNum, completedNum int) error
}

// KnowledgeBaseQuery 知识库查询条件
type KnowledgeBaseQuery struct {
	OrganizationCode string
	Name             string
	Type             *int
	Enabled          *bool
	SyncStatus       *sharedentity.SyncStatus
	Codes            []string
	BusinessIDs      []string
	Offset           int
	Limit            int
}
