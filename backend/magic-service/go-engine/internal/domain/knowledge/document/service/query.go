package document

import "magic/internal/domain/knowledge/shared"

// Query 文档查询条件。
type Query struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Name              string
	DocType           *int
	Enabled           *bool
	SyncStatus        *shared.SyncStatus
	Offset            int
	Limit             int
}
