package knowledgebase

import "strings"

// AgentBinding 表示知识库与外部对象的绑定关系。
type AgentBinding struct {
	KnowledgeBaseCode string
	BindType          BindingType
	BindID            string
	OrganizationCode  string
	CreatedUID        string
	UpdatedUID        string
}

// NormalizeBindID 统一清洗绑定对象 ID。
func NormalizeBindID(bindID string) string {
	return strings.TrimSpace(bindID)
}
