package docapp

import documentdomain "magic/internal/domain/knowledge/document/service"

const (
	// SyncModeCreate 表示创建后的首次同步。
	SyncModeCreate = documentdomain.SyncModeCreate
	// SyncModeResync 表示重同步。
	SyncModeResync = documentdomain.SyncModeResync
)

// SyncDocumentInput 是文档同步应用层输入。
type SyncDocumentInput = documentdomain.SyncDocumentInput

// ThirdFileRevectorizeInput 是第三方文件重向量化应用层输入。
type ThirdFileRevectorizeInput = documentdomain.ThirdFileRevectorizeInput
