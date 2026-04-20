package document

// AttachedDocumentInput 描述知识库创建时附带文档输入。
type AttachedDocumentInput struct {
	Name              string
	DocumentFile      *File
	ThirdPlatformType string
	ThirdFileID       string
}

// AttachedDocumentCreatePlan 描述附带文档的创建与同步计划。
type AttachedDocumentCreatePlan struct {
	CreateInput  CreateManagedDocumentInput
	SyncTemplate SyncDocumentInput
}
