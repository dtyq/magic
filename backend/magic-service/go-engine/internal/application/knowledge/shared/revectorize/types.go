package revectorize

// TeamshareStartInput 表示 Teamshare start-vector 的最小业务输入。
//
// 这类 DTO 放在 shared/revectorize，而不是放在某个单独 app 下面，
// 是因为它表达的是“知识库级批量重向量化”这个用例自己的共享语言。
// knowledgebase app 和 revectorize app 都会接触这组数据，但不应该互相依赖彼此的 app 私有类型。
type TeamshareStartInput struct {
	OrganizationCode string
	UserID           string
	KnowledgeID      string
}

// TeamshareStartResult 表示 Teamshare start-vector 的最小业务输出。
//
// 这里只保留这条用例真正需要跨边界返回的字段，避免 revectorize app
// 直接暴露 knowledgebase app 的内部 DTO，后续任一 app 调整都不会把另外一侧一并耦合进去。
type TeamshareStartResult struct {
	ID            string
	KnowledgeCode string
}

// ManagedDocument 描述知识库 prepare 之后需要参与批量重向量化的最小文档视图。
//
// 这里故意只暴露 document code。
// revectorize app 只需要知道“这次要调度哪些文档”，不应该知道 document app 的更多内部结构。
type ManagedDocument struct {
	Code string
}

// SaveProcessInput 表示知识库重向量化过程中需要落库的进度输入。
//
// 这组字段属于知识库级进度的稳定最小集合。
// 把它收敛在 shared 里，是为了让 revectorize app 和 knowledgebase app
// 围绕同一份进度语义协作，而不是互相引用对方的应用层入参。
type SaveProcessInput struct {
	OrganizationCode string
	UserID           string
	Code             string
	ExpectedNum      int
	CompletedNum     int
}
