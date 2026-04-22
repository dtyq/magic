package docapp

import (
	"errors"
	"fmt"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
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

func knowledgeBaseSnapshotFromDomain(kb *knowledgebasedomain.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
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
		RetrieveConfig:   kb.RetrieveConfig,
		FragmentConfig:   kb.FragmentConfig,
		EmbeddingConfig:  kb.EmbeddingConfig,
		ResolvedRoute:    kb.ResolvedRoute,
	})
}

func cloneKnowledgeBaseWithResolvedRoute(
	kb *knowledgebasedomain.KnowledgeBase,
	route sharedroute.ResolvedRoute,
) (*knowledgebasedomain.KnowledgeBase, error) {
	if kb == nil {
		return nil, errKnowledgeBaseNil
	}

	cloned := *kb
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
