package retrieval

import (
	"context"

	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
)

func resolveRuntimeRoute(
	ctx context.Context,
	metaReader sharedroute.CollectionMetaReader,
	sparseBackendSelector shared.SparseBackendSelector,
	logger *logging.SugaredLogger,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	defaultEmbeddingModel string,
) sharedroute.ResolvedRoute {
	kbSnapshot := sharedsnapshot.CloneKnowledgeBaseRuntimeSnapshot(kb)
	if kbSnapshot == nil {
		kbSnapshot = &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{}
	}
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kbSnapshot)

	route := sharedroute.ResolveRuntimeRoute(
		ctx,
		metaReader,
		logger,
		kbSnapshot.CollectionName(),
		defaultEmbeddingModel,
	)
	selection := shared.ResolveSparseBackendSelection(sparseBackendSelector, route.SparseBackend)
	if selection.Effective != "" {
		route.SparseBackend = selection.Effective
	}
	return route
}
