// Package repository 定义知识库外部数据接入领域的持久化端口。
package repository

import (
	"context"

	ingestionentity "magic/internal/domain/knowledge/ingestion/entity"
)

// CleanedDocumentWriteResult 表示一次 cleaned document 写入结果。
type CleanedDocumentWriteResult struct {
	Item    *ingestionentity.Item
	Changed bool
}

// CleanedContentResult 表示 resolver 读取到的清洗正文。
type CleanedContentResult struct {
	Item    *ingestionentity.Item
	Content *ingestionentity.ItemContent
}

// ListEnabledSourcesQuery 表示按 provider 分页查询启用 source 的条件。
type ListEnabledSourcesQuery struct {
	OrganizationCode string
	Provider         string
	Limit            int32
	Offset           int32
}

// ListItemsBySourceAndStatusQuery 表示按来源和状态分页查询 item 的条件。
type ListItemsBySourceAndStatusQuery struct {
	OrganizationCode string
	Provider         string
	SourceCode       string
	Statuses         []string
	AfterID          int64
	Limit            int32
	Offset           int32
}

// SourceStore 定义数据源配置持久化能力。
type SourceStore interface {
	UpsertSource(ctx context.Context, source ingestionentity.Source) (*ingestionentity.Source, error)
	GetSourceByCode(ctx context.Context, organizationCode, provider, sourceCode string) (*ingestionentity.Source, error)
	ListEnabledSources(ctx context.Context, query ListEnabledSourcesQuery) ([]*ingestionentity.Source, error)
	CountEnabledSources(ctx context.Context, query ListEnabledSourcesQuery) (int64, error)
	TryAcquireSourceSync(ctx context.Context, organizationCode, provider, sourceCode string) (bool, error)
	ReleaseSourceSync(ctx context.Context, organizationCode, provider, sourceCode, status, reason string) error
	UpdateSourceSyncStatus(ctx context.Context, source ingestionentity.Source) error
}

// RunStore 定义同步 run 持久化能力。
type RunStore interface {
	InsertRun(ctx context.Context, run ingestionentity.Run) (*ingestionentity.Run, error)
	FinishRun(ctx context.Context, run ingestionentity.Run) error
}

// ItemStore 定义接入 item 持久化能力。
type ItemStore interface {
	UpsertCleanedDocument(ctx context.Context, document ingestionentity.CleanedDocument) (CleanedDocumentWriteResult, error)
	UpsertFailedDocument(ctx context.Context, document ingestionentity.FailedDocument) (*ingestionentity.Item, error)
	GetItemByRef(ctx context.Context, organizationCode, provider, sourceCode, itemRef string) (*ingestionentity.Item, error)
	ListItemsByRefs(
		ctx context.Context,
		organizationCode string,
		provider string,
		sourceCode string,
		itemRefs []string,
	) ([]*ingestionentity.Item, error)
	ListItemsBySourceAndStatus(ctx context.Context, query ListItemsBySourceAndStatusQuery) ([]*ingestionentity.Item, error)
	CountItemsBySourceAndStatus(ctx context.Context, query ListItemsBySourceAndStatusQuery) (int64, error)
	MarkItemFailed(ctx context.Context, organizationCode, provider, sourceCode, itemRef, reason string) error
}

// ContentStore 定义 cleaned content 读取能力。
type ContentStore interface {
	GetCleanedContent(ctx context.Context, organizationCode, provider, sourceCode, itemRef string) (*CleanedContentResult, error)
}
