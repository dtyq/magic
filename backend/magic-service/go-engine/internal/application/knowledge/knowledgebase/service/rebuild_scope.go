package kbapp

// RebuildScopeMode 表示知识库重建准备的作用域。
type RebuildScopeMode string

const (
	// RebuildScopeModeAll 表示全部知识库。
	RebuildScopeModeAll RebuildScopeMode = "all"
	// RebuildScopeModeOrganization 表示组织级。
	RebuildScopeModeOrganization RebuildScopeMode = "organization"
	// RebuildScopeModeKnowledgeBase 表示单知识库级。
	RebuildScopeModeKnowledgeBase RebuildScopeMode = "knowledge_base"
	// RebuildScopeModeDocument 表示单文档级。
	RebuildScopeModeDocument RebuildScopeMode = "document"
)

// RebuildScope 描述一次重建准备请求的业务范围。
type RebuildScope struct {
	Mode              RebuildScopeMode
	OrganizationCode  string
	KnowledgeBaseCode string
	DocumentCode      string
	UserID            string
}
