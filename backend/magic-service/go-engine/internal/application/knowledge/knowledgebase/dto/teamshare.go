package dto

// TeamshareStartVectorInput 表示 Teamshare start-vector 输入。
type TeamshareStartVectorInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeID      string
}

// TeamshareManageableInput 表示 Teamshare manageable 输入。
type TeamshareManageableInput struct {
	OrganizationCode string
	UserID           string
}

// TeamshareManageableProgressInput 表示 Teamshare manageable-progress 输入。
type TeamshareManageableProgressInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeCodes   []string
}

// TeamshareStartVectorResult 表示 Teamshare start-vector 输出。
type TeamshareStartVectorResult struct {
	ID            string `json:"id"`
	KnowledgeCode string `json:"knowledge_code"`
}

// TeamshareKnowledgeProgressDTO 表示 Teamshare 知识库兼容输出。
type TeamshareKnowledgeProgressDTO struct {
	KnowledgeCode string `json:"knowledge_code"`
	KnowledgeType int    `json:"knowledge_type"`
	BusinessID    string `json:"business_id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	VectorStatus  int    `json:"vector_status"`
	ExpectedNum   int    `json:"expected_num"`
	CompletedNum  int    `json:"completed_num"`
}
