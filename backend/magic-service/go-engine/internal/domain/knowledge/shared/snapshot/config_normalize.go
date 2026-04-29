package snapshot

import "magic/internal/domain/knowledge/shared"

// NormalizeKnowledgeBaseSnapshotConfigs 将空快照配置归一化为领域默认值。
func NormalizeKnowledgeBaseSnapshotConfigs(snapshot *KnowledgeBaseRuntimeSnapshot) *KnowledgeBaseRuntimeSnapshot {
	if snapshot == nil {
		return nil
	}
	if snapshot.RetrieveConfig == nil {
		snapshot.RetrieveConfig = shared.DefaultRetrieveConfig()
	}
	if snapshot.FragmentConfig == nil {
		snapshot.FragmentConfig = shared.DefaultFragmentConfig()
	}
	return snapshot
}
