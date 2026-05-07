package snapshot

import (
	"maps"

	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

// CloneKnowledgeBaseRuntimeSnapshot 复制知识库运行时快照，避免下游整理配置和路由时把上游快照改脏。
//
// 这一组 clone helper 用来保护跨子域传递的快照数据。
//
// shared snapshot 在业务上是给别的子域消费的稳定投影，不是让下游继续拿原对象改。
// 后面的链路还会做默认值归一化、路由整理、文档 metadata 补充；如果这里直接把原引用往下传，
// 很容易把 app 层投下来的快照一起改脏。
//
// 这里的策略也是按业务需要来，不是做通用递归 deep copy：
// 配置、路由、文件快照按结构复制；DocMetadata 只隔离顶层 map，避免常见的共享引用问题。
func CloneKnowledgeBaseRuntimeSnapshot(snapshot *KnowledgeBaseRuntimeSnapshot) *KnowledgeBaseRuntimeSnapshot {
	if snapshot == nil {
		return nil
	}

	cloned := *snapshot
	cloned.RetrieveConfig = shared.CloneRetrieveConfig(snapshot.RetrieveConfig)
	cloned.FragmentConfig = shared.CloneFragmentConfig(snapshot.FragmentConfig)
	cloned.EmbeddingConfig = shared.CloneEmbeddingConfig(snapshot.EmbeddingConfig)
	cloned.ResolvedRoute = sharedroute.CloneResolvedRoute(snapshot.ResolvedRoute)
	return &cloned
}

// CloneKnowledgeDocumentSnapshot 复制文档快照，避免后面补文档 metadata 或 fragment 配置时回头改脏上游快照。
//
// 这里的 DocMetadata 只做顶层 map 隔离，目的是解决当前业务里最常见的共享可变数据问题，
// 不承诺对所有嵌套值做通用递归 deep copy。
func CloneKnowledgeDocumentSnapshot(snapshot *KnowledgeDocumentSnapshot) *KnowledgeDocumentSnapshot {
	if snapshot == nil {
		return nil
	}

	cloned := *snapshot
	if len(snapshot.DocMetadata) > 0 {
		cloned.DocMetadata = maps.Clone(snapshot.DocMetadata)
	}
	cloned.FragmentConfig = shared.CloneFragmentConfig(snapshot.FragmentConfig)
	return &cloned
}

// CloneDocumentFile 复制文档文件快照，避免下游整理字段时把上游传下来的文件信息改脏。
//
// DocumentFile 现在是扁平结构，按结构体复制就够，不需要额外做通用 deep copy。
func CloneDocumentFile(file *DocumentFile) *DocumentFile {
	if file == nil {
		return nil
	}
	cloned := *file
	return &cloned
}
