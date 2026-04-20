package retrieval

import (
	"context"
	"reflect"
	"strings"

	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
)

type knowledgeBaseRuntimeSnapshot = sharedsnapshot.KnowledgeBaseRuntimeSnapshot

func snapshotKnowledgeBase(value any) knowledgeBaseRuntimeSnapshot {
	var snapshot knowledgeBaseRuntimeSnapshot
	root := indirectValue(reflect.ValueOf(value))
	if !root.IsValid() {
		return snapshot
	}
	snapshot.Code = fieldString(root, "Code")
	snapshot.Name = fieldString(root, "Name")
	snapshot.OrganizationCode = fieldString(root, "OrganizationCode")
	snapshot.Model = fieldString(root, "Model")
	snapshot.RetrieveConfig = fieldRetrieveConfig(root, "RetrieveConfig")
	snapshot.EmbeddingConfig = fieldEmbeddingConfig(root, "EmbeddingConfig")
	snapshot.ResolvedRoute = fieldResolvedRoute(root, "ResolvedRoute")
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&snapshot)
	return snapshot
}

func resolveRuntimeRoute(
	ctx context.Context,
	metaReader any,
	sparseBackendSelector shared.SparseBackendSelector,
	logger *logging.SugaredLogger,
	kb knowledgeBaseRuntimeSnapshot,
	defaultEmbeddingModel string,
) sharedroute.ResolvedRoute {
	if reader, ok := metaReader.(sharedroute.CollectionMetaReader); ok {
		route := sharedroute.ResolveRuntimeRoute(ctx, reader, logger, kb.CollectionName(), defaultEmbeddingModel)
		selection := shared.ResolveSparseBackendSelection(sparseBackendSelector, route.SparseBackend)
		if selection.Effective != "" {
			route.SparseBackend = selection.Effective
		}
		return route
	}
	route := sharedroute.ResolveRuntimeRoute(ctx, nil, logger, kb.CollectionName(), defaultEmbeddingModel)
	selection := shared.ResolveSparseBackendSelection(sparseBackendSelector, route.SparseBackend)
	if selection.Effective != "" {
		route.SparseBackend = selection.Effective
	}
	return route
}

func indirectValue(value reflect.Value) reflect.Value {
	for value.IsValid() && value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return reflect.Value{}
		}
		value = value.Elem()
	}
	return value
}

func fieldValue(root reflect.Value, name string) reflect.Value {
	if !root.IsValid() || root.Kind() != reflect.Struct {
		return reflect.Value{}
	}
	return root.FieldByName(name)
}

func fieldString(root reflect.Value, name string) string {
	value := fieldValue(root, name)
	if !value.IsValid() || value.Kind() != reflect.String {
		return ""
	}
	return strings.TrimSpace(value.String())
}

func fieldRetrieveConfig(root reflect.Value, name string) *shared.RetrieveConfig {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*shared.RetrieveConfig)
	if !ok {
		return nil
	}
	return result
}

func fieldEmbeddingConfig(root reflect.Value, name string) *shared.EmbeddingConfig {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*shared.EmbeddingConfig)
	if !ok {
		return nil
	}
	return result
}

func fieldResolvedRoute(root reflect.Value, name string) *sharedroute.ResolvedRoute {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*sharedroute.ResolvedRoute)
	if !ok {
		return nil
	}
	return result
}
