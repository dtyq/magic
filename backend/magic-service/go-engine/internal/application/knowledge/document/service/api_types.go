package docapp

import documentdomain "magic/internal/domain/knowledge/document/service"

const (
	// SyncModeCreate 表示创建后的首次同步。
	SyncModeCreate = documentdomain.SyncModeCreate
	// SyncModeResync 表示重同步。
	SyncModeResync = documentdomain.SyncModeResync
	// RevectorizeSourceSingleDocumentManual 表示单文档手动重向量化。
	RevectorizeSourceSingleDocumentManual = documentdomain.RevectorizeSourceSingleDocumentManual
	// RevectorizeSourceThirdFileBroadcast 表示 third-file 广播。
	RevectorizeSourceThirdFileBroadcast = documentdomain.RevectorizeSourceThirdFileBroadcast
	// RevectorizeSourceProjectFileNotify 表示项目文件变更通知。
	RevectorizeSourceProjectFileNotify = documentdomain.RevectorizeSourceProjectFileNotify
	// RevectorizeSourceTeamshareKnowledgeStartVector 表示 Teamshare 单知识库批量重向量化。
	RevectorizeSourceTeamshareKnowledgeStartVector = documentdomain.RevectorizeSourceTeamshareKnowledgeStartVector
)

// ErrManagedDocumentSingleDeleteNotAllowed 表示项目/企业来源知识库不支持单文档删除。
var ErrManagedDocumentSingleDeleteNotAllowed = documentdomain.ErrManagedDocumentSingleDeleteNotAllowed

// SyncDocumentInput 是文档同步应用层输入。
type SyncDocumentInput = documentdomain.SyncDocumentInput

// ThirdFileRevectorizeInput 是第三方文件重向量化应用层输入。
type ThirdFileRevectorizeInput = documentdomain.ThirdFileRevectorizeInput
