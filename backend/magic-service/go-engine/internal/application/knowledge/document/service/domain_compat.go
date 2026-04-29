package docapp

import (
	"errors"
	"fmt"
	"maps"

	docentity "magic/internal/domain/knowledge/document/entity"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

var (
	errKnowledgeBaseNil                 = errors.New("knowledge base is nil")
	errResolvedRouteMissingAfterBinding = errors.New("resolved route missing after binding")
	errResolvedRouteBindingMismatch     = errors.New("resolved route binding mismatch")
)

type resolvedRouteBindingMismatchError struct {
	expected sharedroute.ResolvedRoute
	actual   *sharedroute.ResolvedRoute
}

func (e *resolvedRouteBindingMismatchError) Error() string {
	if e == nil || e.actual == nil {
		return errResolvedRouteBindingMismatch.Error()
	}
	return fmt.Sprintf(
		"%s: expected(vector=%q term=%q model=%q sparse_backend=%q) actual(vector=%q term=%q model=%q sparse_backend=%q)",
		errResolvedRouteBindingMismatch.Error(),
		e.expected.VectorCollectionName,
		e.expected.TermCollectionName,
		e.expected.Model,
		e.expected.SparseBackend,
		e.actual.VectorCollectionName,
		e.actual.TermCollectionName,
		e.actual.Model,
		e.actual.SparseBackend,
	)
}

func knowledgeBaseSnapshotFromDomain(kb *kbentity.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		Name:             kb.Name,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   shared.CloneRetrieveConfig(kb.RetrieveConfig),
		FragmentConfig:   shared.CloneFragmentConfig(kb.FragmentConfig),
		EmbeddingConfig:  shared.CloneEmbeddingConfig(kb.EmbeddingConfig),
		ResolvedRoute:    sharedroute.CloneResolvedRoute(kb.ResolvedRoute),
	})
}

func fragDocumentFromDomain(doc *docentity.KnowledgeBaseDocument) *fragmodel.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	return &fragmodel.KnowledgeBaseDocument{
		KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
			OrganizationCode:  doc.OrganizationCode,
			KnowledgeBaseCode: doc.KnowledgeBaseCode,
			Name:              doc.Name,
			Code:              doc.Code,
			DocType:           doc.DocType,
			DocMetadata:       cloneDocumentMetadata(doc.DocMetadata),
			FragmentConfig:    shared.CloneFragmentConfig(doc.FragmentConfig),
			UpdatedUID:        doc.UpdatedUID,
		},
		DocumentFile:      cloneFragDocumentFileFromDomain(doc.DocumentFile),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    shared.CloneRetrieveConfig(doc.RetrieveConfig),
		EmbeddingConfig:   shared.CloneEmbeddingConfig(doc.EmbeddingConfig),
		WordCount:         doc.WordCount,
		CreatedUID:        doc.CreatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
	}
}

func cloneKnowledgeBaseWithResolvedRoute(
	kb *kbentity.KnowledgeBase,
	route sharedroute.ResolvedRoute,
) (*kbentity.KnowledgeBase, error) {
	if kb == nil {
		return nil, errKnowledgeBaseNil
	}

	cloned := *kb
	cloned.RetrieveConfig = shared.CloneRetrieveConfig(kb.RetrieveConfig)
	cloned.FragmentConfig = shared.CloneFragmentConfig(kb.FragmentConfig)
	cloned.EmbeddingConfig = shared.CloneEmbeddingConfig(kb.EmbeddingConfig)
	cloned.ResolvedRoute = sharedroute.CloneResolvedRoute(kb.ResolvedRoute)
	cloned.ApplyResolvedRoute(route)
	if cloned.ResolvedRoute == nil {
		return nil, errResolvedRouteMissingAfterBinding
	}
	if cloned.ResolvedRoute.VectorCollectionName != route.VectorCollectionName ||
		cloned.ResolvedRoute.TermCollectionName != route.TermCollectionName ||
		cloned.ResolvedRoute.Model != route.Model ||
		cloned.ResolvedRoute.SparseBackend != route.SparseBackend {
		return nil, errors.Join(
			errResolvedRouteBindingMismatch,
			&resolvedRouteBindingMismatchError{
				expected: route,
				actual:   cloned.ResolvedRoute,
			},
		)
	}
	return &cloned, nil
}

func cloneDocumentMetadata(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return nil
	}
	return maps.Clone(metadata)
}

func cloneFragDocumentFileFromDomain(file *docentity.File) *fragmodel.DocumentFile {
	if file == nil {
		return nil
	}
	return &fragmodel.DocumentFile{
		Type:            file.Type,
		Name:            file.Name,
		URL:             file.URL,
		FileKey:         file.FileKey,
		Size:            file.Size,
		Extension:       file.Extension,
		ThirdID:         file.ThirdID,
		SourceType:      file.SourceType,
		ThirdFileType:   file.ThirdFileType,
		KnowledgeBaseID: file.KnowledgeBaseID,
	}
}
