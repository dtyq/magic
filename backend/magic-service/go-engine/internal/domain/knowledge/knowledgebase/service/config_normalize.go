package knowledgebase

import "magic/internal/domain/knowledge/shared"

// NormalizeKnowledgeBaseConfigs 将空知识库配置归一化为领域默认值。
func NormalizeKnowledgeBaseConfigs(kb *KnowledgeBase) *KnowledgeBase {
	if kb == nil {
		return nil
	}
	if kb.RetrieveConfig == nil {
		kb.RetrieveConfig = shared.DefaultRetrieveConfig()
	}
	if kb.FragmentConfig == nil {
		kb.FragmentConfig = shared.DefaultFragmentConfig()
	}
	return kb
}
