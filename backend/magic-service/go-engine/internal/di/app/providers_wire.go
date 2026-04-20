//go:build wireinject

package app

import (
	"github.com/google/wire"

	diknowledge "magic/internal/di/knowledge"
)

// ProviderSet 包含应用层的依赖注入集合。
var ProviderSet = wire.NewSet(
	ProvideEmbeddingDefaultModel,
	ProvideQdrantConfig,
	ProvideEmbeddingCacheCleanupService,
	diknowledge.ProvideEmbeddingDomainService,
	diknowledge.ProvideKnowledgeBaseDomainConfig,
	diknowledge.ProvideKnowledgeBaseDomainService,
	diknowledge.ProvideFragmentRetrievalSegmenterProvider,
	diknowledge.ProvideFragmentDomainInfra,
	diknowledge.ProvideFragmentDomainService,
	diknowledge.ProvideDocumentDomainService,
	diknowledge.ProvideThirdPlatformProviderRegistry,
	diknowledge.ProvideKnowledgeBaseCoordinatorDeps,
	diknowledge.ProvideKnowledgeBaseBindingDeps,
	diknowledge.ProvideKnowledgeBasePortDeps,
	diknowledge.ProvideKnowledgeBaseAppDeps,
	diknowledge.ProvideKnowledgeBaseDocumentFlowDeps,
	diknowledge.ProvideKnowledgeBaseAppService,
	diknowledge.ProvideFragmentAppRuntimeDeps,
	diknowledge.ProvideFragmentAppDeps,
	diknowledge.ProvideFragmentAppService,
	diknowledge.ProvideEmbeddingAppService,
	diknowledge.ProvideDocumentAppDeps,
	diknowledge.ProvideDocumentAppRuntimeDeps,
	diknowledge.ProvideDocumentAppService,
)
