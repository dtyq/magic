// Package repository 定义知识库领域的稳定仓储契约。
package repository

import (
	"context"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
)

// Query 知识库查询条件。
type Query struct {
	OrganizationCode  string
	Name              string
	Type              *int
	KnowledgeBaseType *kbentity.Type
	Enabled           *bool
	SyncStatus        *shared.SyncStatus
	Codes             []string
	BusinessIDs       []string
	Offset            int
	Limit             int
}

// Repository 知识库仓储接口。
type Repository interface {
	Save(ctx context.Context, kb *kbentity.KnowledgeBase) error
	Update(ctx context.Context, kb *kbentity.KnowledgeBase) error
	FindByID(ctx context.Context, id int64) (*kbentity.KnowledgeBase, error)
	FindByCode(ctx context.Context, code string) (*kbentity.KnowledgeBase, error)
	FindByCodeAndOrg(ctx context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error)
	List(ctx context.Context, query *Query) ([]*kbentity.KnowledgeBase, int64, error)
	Delete(ctx context.Context, id int64) error
	UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error
	UpdateProgress(ctx context.Context, id int64, expectedNum, completedNum int) error
}
