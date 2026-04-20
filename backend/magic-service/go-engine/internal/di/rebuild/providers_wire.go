//go:build wireinject

package rebuild

import "github.com/google/wire"

// ProviderSet 聚合知识库重建相关的依赖注入集合。
var ProviderSet = wire.NewSet(
	ProvideKnowledgeRebuildResyncer,
	ProvideKnowledgeRebuildRunnerDeps,
	ProvideKnowledgeRebuildRunner,
	ProvideKnowledgeRebuildTriggerService,
	ProvideKnowledgeRebuildCleanupService,
)
