package knowledgebase_test

import (
	"context"
	"errors"
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/knowledgeroute"
)

const (
	testKnowledgeBaseCode       = "KB-1"
	routeResolverEffectiveModel = "text-embedding-3-large"
	customCollectionName        = "knowledge_custom"
	sharedCollectionName        = "shared_collection"
	aliasTargetCollectionName   = "magic_knowledge_20260317"
)

var (
	errVectorDeleteUnavailable = errors.New("qdrant unavailable")
	errStubNotImplemented      = errors.New("not implemented")
	errDeleteFragmentsFailed   = errors.New("delete fragments failed")
	errResolverShouldNotRun    = errors.New("resolver should not be called")
)

func TestKnowledgeBaseDomainServiceSaveCreatesCollectionWhenMissing(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{collectionExists: false}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection: customCollectionName,
		TargetModel:      "text-embedding-3-large",
	})
	kb := &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode, Name: "知识库"}

	if err := svc.Save(ctx, kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if repo.savedKB != kb {
		t.Fatal("expected repository Save to receive original knowledge base")
	}
	if resolver.lastModel != routeResolverEffectiveModel {
		t.Fatalf("expected resolver to use override model, got %q", resolver.lastModel)
	}
	if vectorRepo.createdCollection != customCollectionName || vectorRepo.createdVectorSize != 3072 {
		t.Fatalf("unexpected created collection: %#v", vectorRepo)
	}
	if vectorRepo.lastPayloadCollection != customCollectionName || len(vectorRepo.lastPayloadSpecs) == 0 {
		t.Fatalf("expected payload indexes on created collection, got %#v", vectorRepo)
	}
	if len(repo.upsertedMeta) != 1 {
		t.Fatalf("expected one collection meta upsert, got %d", len(repo.upsertedMeta))
	}
	if got := repo.upsertedMeta[0]; got.CollectionName != constants.KnowledgeBaseCollectionName || got.PhysicalCollectionName != customCollectionName || got.Model != routeResolverEffectiveModel || got.VectorDimension != 3072 {
		t.Fatalf("unexpected upserted meta: %+v", got)
	}
	if repo.getCollectionMetaCalls < 1 {
		t.Fatalf("expected collection meta to be read during initialization, got %d", repo.getCollectionMetaCalls)
	}
}

func TestKnowledgeBaseDomainServiceSaveUsesSelectorDefaultSparseBackend(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{
		defaultSelection: shared.SparseBackendSelection{
			Effective:   shared.SparseBackendClientBM25QdrantIDFV1,
			Reason:      shared.SparseBackendSelectionReasonCapabilityDefault,
			ProbeStatus: "failed",
		},
	}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, routeResolverEffectiveModel, "", testKnowledgeBaseDomainLogger())

	if err := svc.Save(context.Background(), &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode}); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if len(repo.upsertedMeta) != 1 {
		t.Fatalf("expected one collection meta upsert, got %d", len(repo.upsertedMeta))
	}
	if got := repo.upsertedMeta[0].SparseBackend; got != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected sparse backend %q, got %q", shared.SparseBackendClientBM25QdrantIDFV1, got)
	}
}

func TestKnowledgeBaseDomainServiceSaveRejectsVectorSizeMismatch(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{
		collectionExists: true,
		collectionInfo:   &shared.VectorCollectionInfo{Name: constants.KnowledgeBaseCollectionName, VectorSize: 1536},
	}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: "text-embedding-3-large",
	})
	err := svc.Save(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, knowledgebasedomain.ErrVectorSizeMismatch) {
		t.Fatalf("expected ErrVectorSizeMismatch, got %v", err)
	}
}

func TestKnowledgeBaseDomainServiceSaveUsesAliasTargetWhenPhysicalCollectionMissing(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{
		aliasExists: true,
		aliasTarget: aliasTargetCollectionName,
		collectionInfo: &shared.VectorCollectionInfo{
			Name:       aliasTargetCollectionName,
			VectorSize: 3072,
		},
	}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: "text-embedding-3-large",
	})
	kb := &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode, Name: "知识库"}

	if err := svc.Save(ctx, kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if vectorRepo.createdCollection != "" {
		t.Fatalf("expected alias-backed shared collection to skip CreateCollection, got %q", vectorRepo.createdCollection)
	}
	if vectorRepo.lastAliasName != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected alias lookup for %q, got %q", constants.KnowledgeBaseCollectionName, vectorRepo.lastAliasName)
	}
	if vectorRepo.lastCollectionInfoName != aliasTargetCollectionName {
		t.Fatalf("expected collection info to use alias target, got %q", vectorRepo.lastCollectionInfoName)
	}
	if vectorRepo.lastPayloadCollection != aliasTargetCollectionName || len(vectorRepo.lastPayloadSpecs) == 0 {
		t.Fatalf("expected payload indexes on alias target collection, got %#v", vectorRepo)
	}
	if len(repo.upsertedMeta) != 1 {
		t.Fatalf("expected one collection meta upsert, got %d", len(repo.upsertedMeta))
	}
	if got := repo.upsertedMeta[0]; got.CollectionName != constants.KnowledgeBaseCollectionName || got.PhysicalCollectionName != aliasTargetCollectionName {
		t.Fatalf("unexpected alias-backed collection meta: %+v", got)
	}
}

func TestKnowledgeBaseDomainServiceSaveRejectsAliasTargetVectorSizeMismatch(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{
		aliasExists: true,
		aliasTarget: aliasTargetCollectionName,
		collectionInfo: &shared.VectorCollectionInfo{
			Name:       aliasTargetCollectionName,
			VectorSize: 1536,
		},
	}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: "text-embedding-3-large",
	})
	err := svc.Save(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, knowledgebasedomain.ErrVectorSizeMismatch) {
		t.Fatalf("expected ErrVectorSizeMismatch, got %v", err)
	}
}

func TestKnowledgeBaseDomainServiceSaveUsesPreResolvedRouteWithoutReadingMeta(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{
		meta: sharedroute.CollectionMeta{
			CollectionName: "shared_collection",
			Model:          routeResolverEffectiveModel,
			Exists:         true,
		},
	}
	vectorRepo := &stubVectorDBManagementRepository{collectionExists: false}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())
	kb := &kbentity.KnowledgeBase{
		Code:  testKnowledgeBaseCode,
		Name:  "知识库",
		Model: routeResolverEffectiveModel,
		ResolvedRoute: &sharedroute.ResolvedRoute{
			LogicalCollectionName:  sharedCollectionName,
			PhysicalCollectionName: sharedCollectionName,
			VectorCollectionName:   sharedCollectionName,
			TermCollectionName:     sharedCollectionName,
			Model:                  routeResolverEffectiveModel,
		},
	}

	if err := svc.Save(context.Background(), kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if repo.getCollectionMetaCalls != 1 {
		t.Fatalf("expected one meta read for init check, got %d loads", repo.getCollectionMetaCalls)
	}
	if vectorRepo.createdCollection != sharedCollectionName {
		t.Fatalf("expected pre-resolved collection to be reused, got %q", vectorRepo.createdCollection)
	}
	if len(repo.upsertedMeta) != 0 {
		t.Fatalf("expected existing meta to skip upsert, got %d", len(repo.upsertedMeta))
	}
}

func TestKnowledgeBaseDomainServiceSaveSkipsCollectionMetaUpsertWhenMetaAlreadyExists(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{
		meta: sharedroute.CollectionMeta{
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: aliasTargetCollectionName,
			Model:                  routeResolverEffectiveModel,
			VectorDimension:        3072,
			Exists:                 true,
		},
	}
	vectorRepo := &stubVectorDBManagementRepository{
		aliasExists: true,
		aliasTarget: aliasTargetCollectionName,
		collectionInfo: &shared.VectorCollectionInfo{
			Name:       aliasTargetCollectionName,
			VectorSize: 3072,
		},
	}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: routeResolverEffectiveModel,
	})
	if err := svc.Save(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode, Name: "知识库"}); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if len(repo.upsertedMeta) != 0 {
		t.Fatalf("expected existing collection meta to skip upsert, got %+v", repo.upsertedMeta)
	}
	if repo.getCollectionMetaCalls < 1 {
		t.Fatalf("expected collection meta to be read, got %d", repo.getCollectionMetaCalls)
	}
}

func TestKnowledgeBaseDomainServiceSaveUsesCurrentActiveCollectionMetaDimension(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{
		meta: sharedroute.CollectionMeta{
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: constants.KnowledgeBaseCollectionName + "_active",
			Model:                  "doubao-embedding-vision",
			VectorDimension:        2048,
			Exists:                 true,
		},
	}
	vectorRepo := &stubVectorDBManagementRepository{
		aliasExists: true,
		aliasTarget: constants.KnowledgeBaseCollectionName + "_active",
		collectionInfo: &shared.VectorCollectionInfo{
			Name:       constants.KnowledgeBaseCollectionName + "_active",
			VectorSize: 2048,
		},
	}
	resolver := &stubEmbeddingDimensionResolver{err: errResolverShouldNotRun}
	svc := knowledgebasedomain.NewDomainService(
		repo,
		vectorRepo,
		resolver,
		"text-embedding-3-small",
		"",
		testKnowledgeBaseDomainLogger(),
	)

	kb := &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode, Name: "知识库"}
	if err := svc.Save(context.Background(), kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if resolver.lastModel != "" {
		t.Fatalf("expected current collection meta dimension to skip resolver, got model %q", resolver.lastModel)
	}
	if kb.Model != "doubao-embedding-vision" {
		t.Fatalf("expected knowledge base model to follow current collection meta, got %q", kb.Model)
	}
	if len(repo.upsertedMeta) != 0 {
		t.Fatalf("expected existing collection meta to skip upsert, got %+v", repo.upsertedMeta)
	}
}

func TestKnowledgeBaseDomainServiceDestroyDeletesVectorPointsThenRepositoryRow(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, nil, "", "", testKnowledgeBaseDomainLogger())
	kb := &kbentity.KnowledgeBase{ID: 7, Code: testKnowledgeBaseCode, OrganizationCode: "ORG-1"}

	if err := svc.Destroy(context.Background(), kb); err != nil {
		t.Fatalf("Destroy returned error: %v", err)
	}
	if repo.deletedID != 7 {
		t.Fatalf("expected repo delete id=7, got %d", repo.deletedID)
	}
	if vectorRepo.deletedCollection != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected default collection %q, got %q", constants.KnowledgeBaseCollectionName, vectorRepo.deletedCollection)
	}
	if vectorRepo.deletedFilter == nil || len(vectorRepo.deletedFilter.Must) != 2 {
		t.Fatalf("expected two delete filters, got %#v", vectorRepo.deletedFilter)
	}
	if vectorRepo.deletedFilter.Must[0].Key != constants.KnowledgeCodeField {
		t.Fatalf("expected knowledge code filter, got %#v", vectorRepo.deletedFilter.Must[0])
	}
	if vectorRepo.deletedFilter.Must[1].Key != constants.OrganizationCodeField {
		t.Fatalf("expected org code filter, got %#v", vectorRepo.deletedFilter.Must[1])
	}
}

func TestKnowledgeBaseDomainServiceDestroyStopsWhenVectorDeleteFails(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{deleteByFilterErr: errVectorDeleteUnavailable}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, nil, "", "", testKnowledgeBaseDomainLogger())

	err := svc.Destroy(context.Background(), &kbentity.KnowledgeBase{ID: 8, Code: "KB-2"})
	if err == nil || !errors.Is(err, errVectorDeleteUnavailable) {
		t.Fatalf("expected vector delete error, got %v", err)
	}
	if repo.deletedID != 0 {
		t.Fatalf("expected repository row to remain, got deleted id=%d", repo.deletedID)
	}
}

func TestKnowledgeBaseDomainServiceDestroyStopsWhenRepositoryDeleteFails(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{deleteErr: errDeleteFragmentsFailed}
	vectorRepo := &stubVectorDBManagementRepository{}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, nil, "", "", testKnowledgeBaseDomainLogger())

	err := svc.Destroy(context.Background(), &kbentity.KnowledgeBase{ID: 10, Code: "KB-10"})
	if err == nil || !errors.Is(err, repo.deleteErr) {
		t.Fatalf("expected repository delete error, got %v", err)
	}
	if repo.deletedID != 10 {
		t.Fatalf("expected knowledge base row delete to be attempted, got deleted id=%d", repo.deletedID)
	}
}

func TestKnowledgeBaseDomainServiceShowListAndUpdateWrapRepository(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{ID: 9, Code: "KB-9", OrganizationCode: "ORG-9"}
	repo := &stubKnowledgeBaseRepository{
		findByCodeResp:       kb,
		findByCodeAndOrgResp: kb,
		listResp:             []*kbentity.KnowledgeBase{kb},
		listTotal:            1,
	}
	svc := knowledgebasedomain.NewDomainService(repo, &stubVectorDBManagementRepository{}, nil, "", "", testKnowledgeBaseDomainLogger())

	if _, err := svc.Show(context.Background(), "KB-9"); err != nil {
		t.Fatalf("Show returned error: %v", err)
	}
	if _, err := svc.ShowByCodeAndOrg(context.Background(), "KB-9", "ORG-9"); err != nil {
		t.Fatalf("ShowByCodeAndOrg returned error: %v", err)
	}
	if _, total, err := svc.List(context.Background(), &kbrepository.Query{OrganizationCode: "ORG-9"}); err != nil || total != 1 {
		t.Fatalf("List returned total=%d err=%v", total, err)
	}
	if err := svc.Update(context.Background(), kb); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
}

func TestKnowledgeBaseDomainServiceEnsureCollectionExistsAndStatusUpdates(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{collectionExists: false}
	resolver := &stubEmbeddingDimensionResolver{dimension: 1024}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: "text-embedding-3-small",
	})
	if err := svc.EnsureCollectionExists(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode}); err != nil {
		t.Fatalf("EnsureCollectionExists returned error: %v", err)
	}
	if err := svc.UpdateSyncStatus(context.Background(), &kbentity.KnowledgeBase{ID: 11, SyncStatus: shared.SyncStatusSyncing, SyncStatusMessage: "running"}); err != nil {
		t.Fatalf("UpdateSyncStatus returned error: %v", err)
	}
	if err := svc.UpdateProgress(context.Background(), &kbentity.KnowledgeBase{ID: 11, ExpectedNum: 10, CompletedNum: 6}); err != nil {
		t.Fatalf("UpdateProgress returned error: %v", err)
	}
	if repo.updatedSyncStatusID != 11 || repo.updatedProgressID != 11 {
		t.Fatalf("expected status/progress updates to hit repository, got %#v", repo)
	}
}

func TestKnowledgeBaseDomainServiceResolveRuntimeRouteUsesMeta(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{
		meta: sharedroute.CollectionMeta{
			CollectionName:  "shared_collection",
			Model:           "text-embedding-3-large",
			VectorDimension: 3072,
			Exists:          true,
		},
	}
	svc := knowledgebasedomain.NewDomainService(repo, &stubVectorDBManagementRepository{}, nil, "", "", testKnowledgeBaseDomainLogger())

	route := svc.ResolveRuntimeRoute(context.Background(), &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if route.LogicalCollectionName != "shared_collection" || route.VectorCollectionName != "shared_collection" || route.Model != "text-embedding-3-large" {
		t.Fatalf("unexpected route: %+v", route)
	}
}

func TestKnowledgeBaseDomainServiceResolveRuntimeRouteDowngradesUnsupportedSparseBackend(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{
		meta: sharedroute.CollectionMeta{
			CollectionName:  sharedCollectionName,
			Model:           routeResolverEffectiveModel,
			VectorDimension: 3072,
			SparseBackend:   shared.SparseBackendQdrantBM25ZHV1,
			Exists:          true,
		},
	}
	vectorRepo := &stubVectorDBManagementRepository{
		selections: map[string]shared.SparseBackendSelection{
			shared.SparseBackendQdrantBM25ZHV1: {
				Requested:      shared.SparseBackendQdrantBM25ZHV1,
				Effective:      shared.SparseBackendClientBM25QdrantIDFV1,
				Reason:         shared.SparseBackendSelectionReasonQueryPointsUnsupported,
				ProbeStatus:    "ready",
				QuerySupported: false,
			},
		},
	}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, nil, "", "", testKnowledgeBaseDomainLogger())

	route := svc.ResolveRuntimeRoute(context.Background(), &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if route.SparseBackend != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected sparse backend %q, got %+v", shared.SparseBackendClientBM25QdrantIDFV1, route)
	}
}

func TestKnowledgeBaseDomainServiceResolveRuntimeRouteFallsBackToDefaultModel(t *testing.T) {
	t.Parallel()

	svc := knowledgebasedomain.NewDomainService(
		&stubKnowledgeBaseRepository{},
		&stubVectorDBManagementRepository{},
		nil,
		routeResolverEffectiveModel,
		"",
		testKnowledgeBaseDomainLogger(),
	)

	route := svc.ResolveRuntimeRoute(context.Background(), &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if route.VectorCollectionName != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected default collection %q, got %+v", constants.KnowledgeBaseCollectionName, route)
	}
	if route.Model != routeResolverEffectiveModel {
		t.Fatalf("expected default model %q, got %+v", routeResolverEffectiveModel, route)
	}
}

func TestKnowledgeBaseDomainServiceResolveVectorDimensionErrors(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	svcWithoutResolver := knowledgebasedomain.NewDomainService(repo, &stubVectorDBManagementRepository{}, nil, "", "", testKnowledgeBaseDomainLogger())
	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{TargetModel: "text-embedding-3-large"})
	if err := svcWithoutResolver.EnsureCollectionExists(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode}); !errors.Is(err, knowledgebasedomain.ErrResolverNotConfigured) {
		t.Fatalf("expected ErrResolverNotConfigured, got %v", err)
	}

	svcInvalidDim := knowledgebasedomain.NewDomainService(repo, &stubVectorDBManagementRepository{}, &stubEmbeddingDimensionResolver{dimension: 0}, "", "", testKnowledgeBaseDomainLogger())
	err := svcInvalidDim.EnsureCollectionExists(ctx, &kbentity.KnowledgeBase{Code: testKnowledgeBaseCode})
	if err == nil || !errors.Is(err, knowledgebasedomain.ErrInvalidEmbeddingDimension) {
		t.Fatalf("expected ErrInvalidEmbeddingDimension, got %v", err)
	}
}

func TestKnowledgeBaseDomainServiceResolveRuntimeRouteFallsBackToDefaultCollection(t *testing.T) {
	t.Parallel()

	svc := knowledgebasedomain.NewDomainService(&stubKnowledgeBaseRepository{}, &stubVectorDBManagementRepository{}, nil, "", "", testKnowledgeBaseDomainLogger())
	if got := svc.ResolveRuntimeRoute(context.Background(), nil).VectorCollectionName; got != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected default collection %q, got %q", constants.KnowledgeBaseCollectionName, got)
	}
}

type stubKnowledgeBaseRepository struct {
	savedKB   *kbentity.KnowledgeBase
	updatedKB *kbentity.KnowledgeBase

	findByCodeResp       *kbentity.KnowledgeBase
	findByCodeErr        error
	findByCodeAndOrgResp *kbentity.KnowledgeBase
	findByCodeAndOrgErr  error
	listResp             []*kbentity.KnowledgeBase
	listTotal            int64
	listErr              error

	deletedID              int64
	deleteErr              error
	updatedSyncStatusID    int64
	updatedProgressID      int64
	meta                   sharedroute.CollectionMeta
	metaErr                error
	getCollectionMetaCalls int
	upsertedMeta           []sharedroute.CollectionMeta
}

func (s *stubKnowledgeBaseRepository) Save(_ context.Context, kb *kbentity.KnowledgeBase) error {
	s.savedKB = kb
	return nil
}

func (s *stubKnowledgeBaseRepository) Update(_ context.Context, kb *kbentity.KnowledgeBase) error {
	s.updatedKB = kb
	return nil
}

func (s *stubKnowledgeBaseRepository) FindByID(context.Context, int64) (*kbentity.KnowledgeBase, error) {
	return nil, errStubNotImplemented
}

func (s *stubKnowledgeBaseRepository) FindByCode(_ context.Context, _ string) (*kbentity.KnowledgeBase, error) {
	if s.findByCodeErr != nil {
		return nil, s.findByCodeErr
	}
	return s.findByCodeResp, nil
}

func (s *stubKnowledgeBaseRepository) FindByCodeAndOrg(_ context.Context, _, _ string) (*kbentity.KnowledgeBase, error) {
	if s.findByCodeAndOrgErr != nil {
		return nil, s.findByCodeAndOrgErr
	}
	return s.findByCodeAndOrgResp, nil
}

func (s *stubKnowledgeBaseRepository) List(_ context.Context, _ *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	return s.listResp, s.listTotal, s.listErr
}

func (s *stubKnowledgeBaseRepository) Delete(_ context.Context, id int64) error {
	s.deletedID = id
	return s.deleteErr
}

func (s *stubKnowledgeBaseRepository) UpdateSyncStatus(_ context.Context, id int64, _ shared.SyncStatus, _ string) error {
	s.updatedSyncStatusID = id
	return nil
}

func (s *stubKnowledgeBaseRepository) UpdateProgress(_ context.Context, id int64, _, _ int) error {
	s.updatedProgressID = id
	return nil
}

func (s *stubKnowledgeBaseRepository) GetCollectionMeta(context.Context) (sharedroute.CollectionMeta, error) {
	s.getCollectionMetaCalls++
	return s.meta, s.metaErr
}

func (s *stubKnowledgeBaseRepository) UpsertCollectionMeta(_ context.Context, meta sharedroute.CollectionMeta) error {
	s.upsertedMeta = append(s.upsertedMeta, meta)
	return nil
}

type stubVectorDBManagementRepository struct {
	collectionExists bool
	collectionInfo   *shared.VectorCollectionInfo
	aliasTarget      string
	aliasExists      bool
	defaultSelection shared.SparseBackendSelection
	selections       map[string]shared.SparseBackendSelection

	createdCollection      string
	createdVectorSize      int64
	lastAliasName          string
	lastCollectionInfoName string
	lastPayloadCollection  string
	lastPayloadSpecs       []shared.PayloadIndexSpec

	deletedCollection string
	deletedFilter     *shared.VectorFilter
	deleteByFilterErr error
}

func (s *stubVectorDBManagementRepository) CreateCollection(_ context.Context, name string, vectorSize int64) error {
	s.createdCollection = name
	s.createdVectorSize = vectorSize
	return nil
}

func (s *stubVectorDBManagementRepository) CollectionExists(context.Context, string) (bool, error) {
	return s.collectionExists, nil
}

func (s *stubVectorDBManagementRepository) GetCollectionInfo(_ context.Context, name string) (*shared.VectorCollectionInfo, error) {
	s.lastCollectionInfoName = name
	return s.collectionInfo, nil
}

func (s *stubVectorDBManagementRepository) EnsurePayloadIndexes(_ context.Context, name string, specs []shared.PayloadIndexSpec) error {
	s.lastPayloadCollection = name
	s.lastPayloadSpecs = append([]shared.PayloadIndexSpec(nil), specs...)
	return nil
}

func (s *stubVectorDBManagementRepository) GetAliasTarget(_ context.Context, alias string) (string, bool, error) {
	s.lastAliasName = alias
	return s.aliasTarget, s.aliasExists, nil
}

func (*stubVectorDBManagementRepository) EnsureAlias(context.Context, string, string) error {
	return nil
}

func (*stubVectorDBManagementRepository) SwapAliasAtomically(context.Context, string, string, string) error {
	return nil
}

func (*stubVectorDBManagementRepository) DeleteAlias(context.Context, string) error {
	return nil
}

func (*stubVectorDBManagementRepository) ListCollections(context.Context) ([]string, error) {
	return nil, nil
}

func (s *stubVectorDBManagementRepository) DeleteCollection(context.Context, string) error {
	return nil
}

func (s *stubVectorDBManagementRepository) DeletePoint(context.Context, string, string) error {
	return nil
}

func (s *stubVectorDBManagementRepository) DeletePoints(context.Context, string, []string) error {
	return nil
}

func (s *stubVectorDBManagementRepository) DeletePointsByFilter(_ context.Context, collection string, filter *shared.VectorFilter) error {
	s.deletedCollection = collection
	s.deletedFilter = filter
	return s.deleteByFilterErr
}

func (s *stubVectorDBManagementRepository) DefaultSparseBackend() shared.SparseBackendSelection {
	if s.defaultSelection.Effective != "" {
		return s.defaultSelection
	}
	return shared.ResolveSparseBackendSelection(nil, "")
}

func (s *stubVectorDBManagementRepository) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	if selection, ok := s.selections[requested]; ok {
		return selection
	}
	return shared.ResolveSparseBackendSelection(nil, requested)
}

type stubEmbeddingDimensionResolver struct {
	dimension int64
	err       error
	lastModel string
}

func (s *stubEmbeddingDimensionResolver) ResolveDimension(_ context.Context, model string) (int64, error) {
	s.lastModel = model
	if s.err != nil {
		return 0, s.err
	}
	return s.dimension, nil
}

func testKnowledgeBaseDomainLogger() *logging.SugaredLogger {
	return logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
}
