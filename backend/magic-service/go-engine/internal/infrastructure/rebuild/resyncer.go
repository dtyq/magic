// Package rebuild 提供知识库重建基础设施适配器。
package rebuild

import (
	"context"
	"fmt"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

const defaultSystemUserID = "system"

// Override 描述文档重建期间的目标覆盖配置。
type Override struct {
	TargetCollection     string
	TargetTermCollection string
	TargetModel          string
	TargetSparseBackend  string
}

// DocumentSyncer 定义文档重同步执行能力。
type DocumentSyncer interface {
	SyncDocument(
		ctx context.Context,
		organizationCode string,
		knowledgeBaseCode string,
		documentCode string,
		userID string,
		override Override,
	) error
}

// AppDocumentResyncer 基于同步接口执行文档重同步。
type AppDocumentResyncer struct {
	syncer DocumentSyncer
}

// NewAppDocumentResyncer 创建文档重同步器。
func NewAppDocumentResyncer(syncer DocumentSyncer) *AppDocumentResyncer {
	return &AppDocumentResyncer{syncer: syncer}
}

// Resync 触发单个文档的重同步。
func (r *AppDocumentResyncer) Resync(ctx context.Context, task domainrebuild.DocumentTask) error {
	userID := task.UserID
	if userID == "" {
		userID = defaultSystemUserID
	}
	if err := r.syncer.SyncDocument(
		ctx,
		task.OrganizationCode,
		task.KnowledgeBaseCode,
		task.DocumentCode,
		userID,
		Override{
			TargetCollection:     task.TargetCollection,
			TargetTermCollection: task.TargetTermCollection,
			TargetModel:          task.TargetModel,
			TargetSparseBackend:  task.TargetSparseBackend,
		},
	); err != nil {
		return fmt.Errorf("resync document %s/%s: %w", task.KnowledgeBaseCode, task.DocumentCode, err)
	}
	return nil
}
