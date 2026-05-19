package fragdomain_test

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragmentdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/memoryguard"
)

var (
	errVectorStoreBoom   = errors.New("vector store boom")
	errEmbeddingCalcBoom = errors.New("embedding calc boom")
	errFlowNotFound      = errors.New("not found")
	errDeleteByKnowledge = errors.New("delete by knowledge base failed")
)

func TestFragmentDomainServiceWriteAndReadWrappers(t *testing.T) {
	t.Parallel()
	fragment := &fragmodel.KnowledgeBaseFragment{ID: 1, DocumentCode: "DOC1"}
	repo := &flowFragmentRepoStub{
		findByIDResult:  fragment,
		findByIDsResult: []*fragmodel.KnowledgeBaseFragment{fragment},
	}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{})

	if err := svc.Save(context.Background(), fragment); err != nil {
		t.Fatalf("save failed: %v", err)
	}
	if err := svc.SaveBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{fragment}); err != nil {
		t.Fatalf("save batch failed: %v", err)
	}
	if err := svc.Update(context.Background(), fragment); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if err := svc.UpdateBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{fragment}); err != nil {
		t.Fatalf("update batch failed: %v", err)
	}
	if got, err := svc.Show(context.Background(), 1); err != nil || got != fragment {
		t.Fatalf("unexpected show result=%#v err=%v", got, err)
	}
	if got, err := svc.FindByIDs(context.Background(), []int64{1}); err != nil || len(got) != 1 || got[0] != fragment {
		t.Fatalf("unexpected find by ids result=%#v err=%v", got, err)
	}
}

func TestFragmentDomainServiceListAndBackfill(t *testing.T) {
	t.Parallel()
	fragment := &fragmodel.KnowledgeBaseFragment{ID: 1, KnowledgeCode: "KB1", DocumentCode: "DOC1"}
	repo := &flowFragmentRepoStub{
		listResult:             []*fragmodel.KnowledgeBaseFragment{fragment},
		listTotal:              1,
		listMissingResult:      []*fragmodel.KnowledgeBaseFragment{fragment},
		listByDocumentResult:   []*fragmodel.KnowledgeBaseFragment{fragment},
		listByDocumentTotal:    1,
		backfillRows:           2,
		countByKnowledgeBase:   5,
		countSyncedByKnowledge: 3,
	}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{})

	list, total, err := svc.List(context.Background(), &fragmodel.Query{KnowledgeCode: "KB1", Offset: 1, Limit: 2})
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result=%#v total=%d err=%v", list, total, err)
	}
	if repo.lastListQuery == nil || repo.lastListQuery.Offset != 1 || repo.lastListQuery.Limit != 2 {
		t.Fatalf("unexpected last list query: %#v", repo.lastListQuery)
	}

	missing, err := svc.ListMissingDocumentCode(context.Background(), fragmodel.MissingDocumentCodeQuery{KnowledgeCode: "KB1", Limit: 10})
	if err != nil || len(missing) != 1 {
		t.Fatalf("unexpected missing result=%#v err=%v", missing, err)
	}

	byDoc, totalByDoc, err := svc.ListByDocument(context.Background(), "KB1", "DOC1", 0, 10)
	if err != nil || totalByDoc != 1 || len(byDoc) != 1 {
		t.Fatalf("unexpected list by doc result=%#v total=%d err=%v", byDoc, totalByDoc, err)
	}

	rows, err := svc.BackfillDocumentCode(context.Background(), []int64{1, 2}, "DOC2")
	if err != nil || rows != 2 {
		t.Fatalf("unexpected backfill rows=%d err=%v", rows, err)
	}
}

func TestFragmentDomainServiceCounts(t *testing.T) {
	t.Parallel()
	repo := &flowFragmentRepoStub{
		countByKnowledgeBase:   5,
		countSyncedByKnowledge: 3,
	}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{})

	count, err := svc.CountByKnowledgeBase(context.Background(), "KB1")
	if err != nil || count != 5 {
		t.Fatalf("unexpected count=%d err=%v", count, err)
	}
	synced, err := svc.CountSyncedByKnowledgeBase(context.Background(), "KB1")
	if err != nil || synced != 3 {
		t.Fatalf("unexpected synced count=%d err=%v", synced, err)
	}

	totalCount, syncedCount, err := svc.CountStatsByKnowledgeBase(context.Background(), "KB1")
	if err != nil || totalCount != 5 || syncedCount != 3 {
		t.Fatalf("unexpected count stats total=%d synced=%d err=%v", totalCount, syncedCount, err)
	}
}

func TestFragmentDomainServiceCountStatsFastPath(t *testing.T) {
	t.Parallel()
	repo := &flowFragmentRepoWithStatsStub{
		flowFragmentRepoStub: flowFragmentRepoStub{},
		total:                7,
		synced:               4,
	}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{})

	total, synced, err := svc.CountStatsByKnowledgeBase(context.Background(), "KB1")
	if err != nil || total != 7 || synced != 4 {
		t.Fatalf("unexpected count stats total=%d synced=%d err=%v", total, synced, err)
	}
}

func TestFragmentDomainServiceDeleteFlows(t *testing.T) {
	t.Parallel()
	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:            10,
		PointID:       "P1",
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
	}
	repo := &flowFragmentRepoStub{
		listByDocumentResult: []*fragmodel.KnowledgeBaseFragment{fragment},
		listByDocumentTotal:  1,
	}
	vectorMgmt := &flowVectorMgmtRepoStub{}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorMgmtRepo: vectorMgmt,
	})

	if err := svc.DeleteByDocument(context.Background(), "KB1", "DOC1"); err != nil {
		t.Fatalf("delete by document failed: %v", err)
	}
	if err := svc.DeleteByKnowledgeBase(context.Background(), "KB1"); err != nil {
		t.Fatalf("delete by knowledge base failed: %v", err)
	}
	if repo.deletedKnowledgeBase != "KB1" {
		t.Fatalf("expected delete by knowledge base KB1, got %q", repo.deletedKnowledgeBase)
	}

	if err := svc.DeletePointsByDocument(context.Background(), "collection_a", "ORG1", "KB1", "DOC1"); err != nil {
		t.Fatalf("delete points by document failed: %v", err)
	}
	if vectorMgmt.lastCollection != "collection_a" || vectorMgmt.lastFilter == nil {
		t.Fatalf("unexpected delete points by document state: %#v %#v", vectorMgmt.lastCollection, vectorMgmt.lastFilter)
	}

	if err := svc.Destroy(context.Background(), fragment, "collection_c"); err != nil {
		t.Fatalf("destroy failed: %v", err)
	}
	if len(repo.deletedIDs) != 1 || repo.deletedIDs[0] != 10 || len(vectorMgmt.deletedPointIDs) != 1 || vectorMgmt.deletedPointIDs[0] != "P1" {
		t.Fatalf("unexpected destroy state repo=%#v vector=%#v", repo, vectorMgmt)
	}
}

func TestFragmentDomainServiceDestroyBatchReturnsVectorDeleteError(t *testing.T) {
	t.Parallel()

	repo := &flowFragmentRepoStub{}
	vectorMgmt := &flowVectorMgmtRepoStub{deletePointErr: errVectorStoreBoom}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorMgmtRepo: vectorMgmt,
	})

	err := svc.DestroyBatch(context.Background(), []*fragmodel.KnowledgeBaseFragment{{
		ID:      10,
		PointID: "P1",
	}}, "collection_c")
	if !errors.Is(err, errVectorStoreBoom) {
		t.Fatalf("expected vector delete error, got %v", err)
	}
	if len(repo.deletedIDs) != 0 {
		t.Fatalf("expected fragment rows to stay intact after vector delete failure, got %#v", repo.deletedIDs)
	}
}

func TestFragmentDomainServiceDestroyBatchDeletesVectorPointsInBatches(t *testing.T) {
	t.Parallel()

	const fragmentCount = 600
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, fragmentCount)
	for i := range fragmentCount {
		id := int64(i + 1)
		fragments = append(fragments, &fragmodel.KnowledgeBaseFragment{
			ID:      id,
			PointID: "P" + strconv.FormatInt(id, 10),
		})
	}
	repo := &flowFragmentRepoStub{}
	vectorMgmt := &flowVectorMgmtRepoStub{}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorMgmtRepo: vectorMgmt,
	})

	if err := svc.DestroyBatch(context.Background(), fragments, "collection_c"); err != nil {
		t.Fatalf("destroy batch failed: %v", err)
	}
	if got := len(vectorMgmt.deletedPointBatches); got != 3 {
		t.Fatalf("expected 3 vector delete batches, got %d", got)
	}
	if len(vectorMgmt.deletedPointBatches[0]) != 256 ||
		len(vectorMgmt.deletedPointBatches[1]) != 256 ||
		len(vectorMgmt.deletedPointBatches[2]) != 88 {
		t.Fatalf("unexpected vector delete batch sizes: %d/%d/%d",
			len(vectorMgmt.deletedPointBatches[0]),
			len(vectorMgmt.deletedPointBatches[1]),
			len(vectorMgmt.deletedPointBatches[2]),
		)
	}
	if len(repo.deletedIDs) != fragmentCount {
		t.Fatalf("expected mysql fragments deleted after vector batches, got %d", len(repo.deletedIDs))
	}
}

func TestBuildFragmentResyncPlanDeletesTrailingOldChunks(t *testing.T) {
	t.Parallel()

	oldFragments := make([]*fragmodel.KnowledgeBaseFragment, 0, 2406)
	for index := range 2406 {
		oldFragments = append(oldFragments, syncedResyncFragment(int64(index+1), index, "same-"+strconv.Itoa(index)))
	}
	newFragments := make([]*fragmodel.KnowledgeBaseFragment, 0, 1217)
	for index := range 1217 {
		newFragments = append(newFragments, syncedResyncFragment(0, index, "same-"+strconv.Itoa(index)))
	}

	plan, err := fragmentdomain.BuildFragmentResyncPlan(oldFragments, newFragments, false)
	if err != nil {
		t.Fatalf("build resync plan failed: %v", err)
	}
	if len(plan.Deleted) != 1189 {
		t.Fatalf("expected trailing old chunks 1217..2405 to be deleted, got %d", len(plan.Deleted))
	}
	minChunk, maxChunk := plan.Deleted[0].ChunkIndex, plan.Deleted[0].ChunkIndex
	for _, fragment := range plan.Deleted[1:] {
		if fragment.ChunkIndex < minChunk {
			minChunk = fragment.ChunkIndex
		}
		if fragment.ChunkIndex > maxChunk {
			maxChunk = fragment.ChunkIndex
		}
	}
	if minChunk != 1217 || maxChunk != 2405 {
		t.Fatalf("expected deleted chunk_index range 1217..2405, got %d..%d", minChunk, maxChunk)
	}
	if len(plan.Added) != 0 || len(plan.Changed) != 0 {
		t.Fatalf("expected unchanged overlap and only trailing deletes, got added=%d changed=%d", len(plan.Added), len(plan.Changed))
	}
}

func TestBuildFragmentResyncPlanUsesChunkIndexAndContentHashIdentity(t *testing.T) {
	t.Parallel()

	oldFragment := syncedResyncFragment(1, 0, "old")
	newDifferentContent := syncedResyncFragment(0, 0, "new")
	plan, err := fragmentdomain.BuildFragmentResyncPlan(
		[]*fragmodel.KnowledgeBaseFragment{oldFragment},
		[]*fragmodel.KnowledgeBaseFragment{newDifferentContent},
		false,
	)
	if err != nil {
		t.Fatalf("build resync plan failed: %v", err)
	}
	if len(plan.Deleted) != 1 || plan.Deleted[0] != oldFragment || len(plan.Added) != 1 {
		t.Fatalf("expected same chunk_index with different content_hash to delete old and add new, got %#v", plan)
	}

	newSameContent := syncedResyncFragment(0, 0, "old")
	plan, err = fragmentdomain.BuildFragmentResyncPlan(
		[]*fragmodel.KnowledgeBaseFragment{oldFragment},
		[]*fragmodel.KnowledgeBaseFragment{newSameContent},
		false,
	)
	if err != nil {
		t.Fatalf("build resync plan failed: %v", err)
	}
	if len(plan.Deleted) != 0 || len(plan.Added) != 0 || len(plan.Changed) != 0 {
		t.Fatalf("expected same chunk_index and content_hash to stay unchanged, got %#v", plan)
	}
}

func TestFragmentDomainServiceSyncFragment(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		PointID:          "P1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Content:          "hello world",
		Metadata:         map[string]any{},
		OrganizationCode: "ORG1",
	}
	repo := &flowFragmentRepoStub{}
	vectorData := &flowVectorDataRepoStub{}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{
		computeEmbedding: func(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error) {
			return []float64{0.1, 0.2}, nil
		},
	}, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo: vectorData,
	})

	if err := svc.SyncFragment(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragment, nil); err != nil {
		t.Fatalf("sync fragment failed: %v", err)
	}
	if fragment.SyncStatus != sharedentity.SyncStatusSynced || len(fragment.Vector) != 2 {
		t.Fatalf("unexpected fragment sync state: %#v", fragment)
	}
	if repo.updateVectorID != 1 || vectorData.lastPointID != "P1" {
		t.Fatalf("unexpected sync side effects repo=%#v vector=%#v", repo, vectorData)
	}
}

func TestFragmentDomainServiceDeleteByKnowledgeBaseReturnsRepoError(t *testing.T) {
	t.Parallel()

	svc := newFlowFragmentDomainService(
		&flowFragmentRepoStub{deleteByKnowledgeErr: errDeleteByKnowledge},
		&flowEmbeddingServiceStub{},
		fragmentdomain.FragmentDomainInfra{},
	)

	err := svc.DeleteByKnowledgeBase(context.Background(), "KB1")
	if !errors.Is(err, errDeleteByKnowledge) {
		t.Fatalf("expected delete by knowledge base error, got %v", err)
	}
}

func TestFragmentDomainServiceSyncFragmentFailure(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:            1,
		PointID:       "P1",
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		Content:       "hello world",
		Metadata:      map[string]any{},
	}
	svc := newFlowFragmentDomainService(&flowFragmentRepoStub{}, &flowEmbeddingServiceStub{
		computeEmbedding: func(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error) {
			return nil, errEmbeddingCalcBoom
		},
	}, fragmentdomain.FragmentDomainInfra{})
	if err := svc.SyncFragment(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragment, nil); !errors.Is(err, errEmbeddingCalcBoom) {
		t.Fatalf("expected embedding error, got %v", err)
	}

	fragment.Vector = []float64{0.1}
	vectorFailSvc := newFlowFragmentDomainService(&flowFragmentRepoStub{}, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo: &flowVectorDataRepoStub{storeHybridPointErr: errVectorStoreBoom},
	})
	if err := vectorFailSvc.SyncFragment(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragment, nil); !errors.Is(err, errVectorStoreBoom) {
		t.Fatalf("expected vector store error, got %v", err)
	}
}

func TestFragmentDomainServiceSyncFragmentBatch(t *testing.T) {
	t.Parallel()

	fragments := []*fragmodel.KnowledgeBaseFragment{
		{ID: 1, PointID: "P1", KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "alpha", Metadata: map[string]any{}},
		{ID: 2, PointID: "P2", KnowledgeCode: "KB1", DocumentCode: "DOC1", Content: "beta", Metadata: map[string]any{}},
	}
	repo := &flowFragmentRepoStub{}
	vectorData := &flowVectorDataRepoStub{}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{
		computeBatchEmbeddings: func(context.Context, []string, string, *ctxmeta.BusinessParams) ([][]float64, error) {
			return [][]float64{{0.1, 0.2}, {0.3, 0.4}}, nil
		},
	}, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo: vectorData,
	})

	if err := svc.SyncFragmentBatch(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragments, nil); err != nil {
		t.Fatalf("sync fragment batch failed: %v", err)
	}
	if len(repo.updatedStatusBatch) != 2 || len(vectorData.lastBatchPointIDs) != 2 || repo.updateSyncCalls != 0 {
		t.Fatalf("unexpected batch sync state repo=%#v vector=%#v", repo, vectorData)
	}
}

func TestFragmentDomainServiceSyncFragmentBatchChunksLargeDocument(t *testing.T) {
	t.Parallel()

	const (
		fragmentCount  = 2000
		batchSize      = 64
		wantBatchCalls = 32
	)

	fragments := makeFlowFragments(fragmentCount)
	repo := &flowFragmentRepoStub{}
	vectorData := &flowVectorDataRepoStub{}
	embeddingSvc := &flowEmbeddingServiceStub{
		computeBatchEmbeddings: func(_ context.Context, texts []string, _ string, _ *ctxmeta.BusinessParams) ([][]float64, error) {
			embeddings := make([][]float64, len(texts))
			for i := range embeddings {
				embeddings[i] = []float64{float64(i), 1}
			}
			return embeddings, nil
		},
	}
	svc := newFlowFragmentDomainService(repo, embeddingSvc, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo:        vectorData,
		SyncFragmentBatchSize: batchSize,
	})

	if err := svc.SyncFragmentBatch(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragments, nil); err != nil {
		t.Fatalf("sync fragment batch failed: %v", err)
	}

	if len(embeddingSvc.batchEmbeddingCallSizes) != wantBatchCalls {
		t.Fatalf("expected %d embedding calls, got %#v", wantBatchCalls, embeddingSvc.batchEmbeddingCallSizes)
	}
	if len(vectorData.batchPointIDCalls) != wantBatchCalls {
		t.Fatalf("expected %d vector store calls, got %d", wantBatchCalls, len(vectorData.batchPointIDCalls))
	}
	if len(vectorData.batchPayloadSizes) != wantBatchCalls {
		t.Fatalf("expected %d payload batches, got %#v", wantBatchCalls, vectorData.batchPayloadSizes)
	}
	for i, callSize := range embeddingSvc.batchEmbeddingCallSizes {
		if callSize > batchSize {
			t.Fatalf("embedding call %d used %d fragments, want <= %d", i, callSize, batchSize)
		}
	}
	for i, call := range vectorData.batchPointIDCalls {
		if len(call) > batchSize {
			t.Fatalf("vector store call %d used %d fragments, want <= %d", i, len(call), batchSize)
		}
	}
	if got := len(vectorData.batchPointIDCalls[wantBatchCalls-1]); got != 16 {
		t.Fatalf("expected final vector batch size 16, got %d", got)
	}
	if got := repo.statusBatchSizes[0]; got != batchSize {
		t.Fatalf("expected first status batch size %d, got %d", batchSize, got)
	}
}

func TestFragmentDomainServiceSyncFragmentBatchWaitsBetweenBatchesOnMemoryPressure(t *testing.T) {
	t.Parallel()

	reader := &flowMemoryReaderStub{
		snapshots: []flowMemorySnapshot{
			{current: 60, limit: 100},
			{current: 40, limit: 100},
		},
	}
	vectorData := &flowVectorDataRepoStub{}
	svc := newFlowFragmentDomainService(&flowFragmentRepoStub{}, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo:        vectorData,
		SyncFragmentBatchSize: 1,
		MemoryReader:          reader,
		MemoryPollInterval:    time.Nanosecond,
	})

	if err := svc.SyncFragmentBatch(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, makeFlowFragments(2), nil); err != nil {
		t.Fatalf("sync fragment batch failed: %v", err)
	}
	if reader.calls != 2 {
		t.Fatalf("expected memory admission to wait for high then low waterline, got %d reads", reader.calls)
	}
	if len(vectorData.batchPointIDCalls) != 2 {
		t.Fatalf("expected both batches to sync after memory resumes, got %d calls", len(vectorData.batchPointIDCalls))
	}
}

func TestFragmentDomainServiceSyncFragmentBatchStopsAfterFailedBatch(t *testing.T) {
	t.Parallel()

	repo := &flowFragmentRepoStub{}
	vectorData := &flowVectorDataRepoStub{storeHybridPointsErrOnCall: 2}
	svc := newFlowFragmentDomainService(repo, &flowEmbeddingServiceStub{}, fragmentdomain.FragmentDomainInfra{
		VectorDataRepo:        vectorData,
		SyncFragmentBatchSize: 2,
	})
	fragments := makeFlowFragments(5)

	err := svc.SyncFragmentBatch(context.Background(), &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:  "KB1",
		Model: "text-embedding-3-small",
	}, fragments, nil)
	if !errors.Is(err, errVectorStoreBoom) {
		t.Fatalf("expected vector store error, got %v", err)
	}
	if len(vectorData.batchPointIDCalls) != 2 {
		t.Fatalf("expected sync to stop after second batch failure, got %d store calls", len(vectorData.batchPointIDCalls))
	}
	if fragments[0].SyncStatus != sharedentity.SyncStatusSynced || fragments[1].SyncStatus != sharedentity.SyncStatusSynced {
		t.Fatalf("expected first batch synced, got %v %v", fragments[0].SyncStatus, fragments[1].SyncStatus)
	}
	if fragments[2].SyncStatus != sharedentity.SyncStatusSyncFailed || fragments[3].SyncStatus != sharedentity.SyncStatusSyncFailed {
		t.Fatalf("expected failed batch marked failed, got %v %v", fragments[2].SyncStatus, fragments[3].SyncStatus)
	}
	if fragments[4].SyncStatus != sharedentity.SyncStatusPending {
		t.Fatalf("expected later batch untouched, got %v", fragments[4].SyncStatus)
	}
}

func newFlowFragmentDomainService(
	repo fragmodel.KnowledgeBaseFragmentRepository,
	embeddingSvc fragmentdomain.EmbeddingService,
	infra fragmentdomain.FragmentDomainInfra,
) *fragmentdomain.FragmentDomainService {
	logger := logging.New()
	infra.Logger = logger
	if embeddingSvc == nil {
		embeddingSvc = &flowEmbeddingServiceStub{}
	}
	return fragmentdomain.NewFragmentDomainService(repo, embeddingSvc, infra)
}

func makeFlowFragments(count int) []*fragmodel.KnowledgeBaseFragment {
	fragments := make([]*fragmodel.KnowledgeBaseFragment, count)
	for i := range count {
		id := int64(i + 1)
		fragments[i] = &fragmodel.KnowledgeBaseFragment{
			ID:            id,
			PointID:       "P" + strconv.Itoa(i+1),
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			Content:       "content",
			Metadata:      map[string]any{},
		}
	}
	return fragments
}

func syncedResyncFragment(id int64, chunkIndex int, hash string) *fragmodel.KnowledgeBaseFragment {
	return &fragmodel.KnowledgeBaseFragment{
		ID:           id,
		PointID:      "point-" + strconv.Itoa(chunkIndex),
		Content:      "content-" + hash,
		ContentHash:  hash,
		ChunkIndex:   chunkIndex,
		Metadata:     map[string]any{"chunk_index": chunkIndex, "content_hash": hash},
		SyncStatus:   sharedentity.SyncStatusSynced,
		SplitVersion: "v1",
	}
}

type flowEmbeddingServiceStub struct {
	computeEmbedding        func(context.Context, string, string, *ctxmeta.BusinessParams) ([]float64, error)
	computeBatchEmbeddings  func(context.Context, []string, string, *ctxmeta.BusinessParams) ([][]float64, error)
	batchEmbeddingCallSizes []int
}

func (s *flowEmbeddingServiceStub) GetEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	if s.computeEmbedding == nil {
		return []float64{0.1}, nil
	}
	return s.computeEmbedding(ctx, text, model, businessParams)
}

func (s *flowEmbeddingServiceStub) GetEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	s.batchEmbeddingCallSizes = append(s.batchEmbeddingCallSizes, len(texts))
	if s.computeBatchEmbeddings == nil {
		return make([][]float64, len(texts)), nil
	}
	return s.computeBatchEmbeddings(ctx, texts, model, businessParams)
}

type flowFragmentRepoStub struct {
	findByIDResult         *fragmodel.KnowledgeBaseFragment
	findByIDErr            error
	findByIDsResult        []*fragmodel.KnowledgeBaseFragment
	findByIDsErr           error
	listResult             []*fragmodel.KnowledgeBaseFragment
	listTotal              int64
	listErr                error
	listMissingResult      []*fragmodel.KnowledgeBaseFragment
	listMissingErr         error
	listByDocumentResult   []*fragmodel.KnowledgeBaseFragment
	listByDocumentTotal    int64
	listByDocumentErr      error
	backfillRows           int64
	backfillErr            error
	countByKnowledgeBase   int64
	countByKnowledgeErr    error
	countSyncedByKnowledge int64
	countSyncedErr         error
	deleteErr              error
	deleteByDocumentErr    error
	deleteByKnowledgeErr   error
	updateSyncStatusErr    error
	updateVectorErr        error
	lastListQuery          *fragmodel.Query
	deletedID              int64
	deletedIDs             []int64
	deletedKnowledgeBase   string
	updateVectorID         int64
	updateVector           []float64
	updateSyncCalls        int
	updateBatchCalls       int
	updatedStatusBatch     []*fragmodel.KnowledgeBaseFragment
	statusBatchSizes       []int
}

func (*flowFragmentRepoStub) Save(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	return nil
}

func (*flowFragmentRepoStub) SaveBatch(context.Context, []*fragmodel.KnowledgeBaseFragment) error {
	return nil
}

func (*flowFragmentRepoStub) Update(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	return nil
}

func (s *flowFragmentRepoStub) UpdateBatch(context.Context, []*fragmodel.KnowledgeBaseFragment) error {
	s.updateBatchCalls++
	return nil
}

func (s *flowFragmentRepoStub) Delete(_ context.Context, id int64) error {
	s.deletedID = id
	return s.deleteErr
}

func (s *flowFragmentRepoStub) DeleteByIDs(_ context.Context, ids []int64) error {
	s.deletedIDs = append([]int64(nil), ids...)
	if len(ids) == 1 {
		s.deletedID = ids[0]
	}
	return s.deleteErr
}

func (s *flowFragmentRepoStub) DeleteByDocument(context.Context, string, string) error {
	return s.deleteByDocumentErr
}

func (s *flowFragmentRepoStub) DeleteByDocumentCodes(_ context.Context, _ string, _ []string) error {
	return s.deleteByDocumentErr
}

func (s *flowFragmentRepoStub) DeleteByKnowledgeBase(_ context.Context, knowledgeCode string) error {
	s.deletedKnowledgeBase = knowledgeCode
	return s.deleteByKnowledgeErr
}

func (s *flowFragmentRepoStub) UpdateSyncStatus(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	s.updateSyncCalls++
	return s.updateSyncStatusErr
}

func (s *flowFragmentRepoStub) UpdateVector(_ context.Context, id int64, vector []float64) error {
	s.updateVectorID = id
	s.updateVector = append([]float64(nil), vector...)
	return s.updateVectorErr
}

func (s *flowFragmentRepoStub) BackfillDocumentCode(context.Context, []int64, string) (int64, error) {
	return s.backfillRows, s.backfillErr
}

func (s *flowFragmentRepoStub) FindByID(context.Context, int64) (*fragmodel.KnowledgeBaseFragment, error) {
	return s.findByIDResult, s.findByIDErr
}

func (*flowFragmentRepoStub) FindByPointIDs(context.Context, []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return nil, errFlowNotFound
}

func (s *flowFragmentRepoStub) FindByIDs(context.Context, []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return s.findByIDsResult, s.findByIDsErr
}

func (s *flowFragmentRepoStub) List(_ context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *flowFragmentRepoStub) ListByDocument(context.Context, string, string, int, int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return s.listByDocumentResult, s.listByDocumentTotal, s.listByDocumentErr
}

func (s *flowFragmentRepoStub) ListByDocumentAfterID(context.Context, string, string, int64, int) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return s.listByDocumentResult, s.listByDocumentErr
}

func (*flowFragmentRepoStub) ListByKnowledgeBase(context.Context, string, int, int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return nil, 0, nil
}

func (*flowFragmentRepoStub) ListPendingSync(context.Context, string, int) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return nil, nil
}

func (s *flowFragmentRepoStub) CountByKnowledgeBase(context.Context, string) (int64, error) {
	return s.countByKnowledgeBase, s.countByKnowledgeErr
}

func (s *flowFragmentRepoStub) CountSyncedByKnowledgeBase(context.Context, string) (int64, error) {
	return s.countSyncedByKnowledge, s.countSyncedErr
}

func (s *flowFragmentRepoStub) ListMissingDocumentCode(context.Context, fragmodel.MissingDocumentCodeQuery) ([]*fragmodel.KnowledgeBaseFragment, error) {
	return s.listMissingResult, s.listMissingErr
}

func (s *flowFragmentRepoStub) UpdateSyncStatusBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	s.updatedStatusBatch = append([]*fragmodel.KnowledgeBaseFragment(nil), fragments...)
	s.statusBatchSizes = append(s.statusBatchSizes, len(fragments))
	return nil
}

type flowFragmentRepoWithStatsStub struct {
	flowFragmentRepoStub
	total  int64
	synced int64
	err    error
}

func (s *flowFragmentRepoWithStatsStub) CountStatsByKnowledgeBase(context.Context, string) (int64, int64, error) {
	return s.total, s.synced, s.err
}

type flowVectorMgmtRepoStub struct {
	lastCollection      string
	lastFilter          *fragmodel.VectorFilter
	deletePointsErr     error
	deletedPointID      string
	deletedPointIDs     []string
	deletedPointBatches [][]string
	deletePointErr      error
}

func (*flowVectorMgmtRepoStub) CreateCollection(context.Context, string, int64) error { return nil }
func (*flowVectorMgmtRepoStub) CollectionExists(context.Context, string) (bool, error) {
	return true, nil
}

func (*flowVectorMgmtRepoStub) GetCollectionInfo(context.Context, string) (*fragmodel.VectorCollectionInfo, error) {
	return &fragmodel.VectorCollectionInfo{}, nil
}

func (*flowVectorMgmtRepoStub) EnsurePayloadIndexes(context.Context, string, []shared.PayloadIndexSpec) error {
	return nil
}

func (*flowVectorMgmtRepoStub) GetAliasTarget(context.Context, string) (string, bool, error) {
	return "", false, nil
}
func (*flowVectorMgmtRepoStub) EnsureAlias(context.Context, string, string) error { return nil }
func (*flowVectorMgmtRepoStub) SwapAliasAtomically(context.Context, string, string, string) error {
	return nil
}
func (*flowVectorMgmtRepoStub) DeleteAlias(context.Context, string) error         { return nil }
func (*flowVectorMgmtRepoStub) ListCollections(context.Context) ([]string, error) { return nil, nil }
func (*flowVectorMgmtRepoStub) DeleteCollection(context.Context, string) error    { return nil }
func (s *flowVectorMgmtRepoStub) DeletePoint(_ context.Context, collection, pointID string) error {
	s.lastCollection = collection
	s.deletedPointID = pointID
	return s.deletePointErr
}

func (s *flowVectorMgmtRepoStub) DeletePoints(_ context.Context, collection string, pointIDs []string) error {
	s.lastCollection = collection
	s.deletedPointIDs = append([]string(nil), pointIDs...)
	s.deletedPointBatches = append(s.deletedPointBatches, append([]string(nil), pointIDs...))
	if len(pointIDs) == 1 {
		s.deletedPointID = pointIDs[0]
	}
	return s.deletePointErr
}

func (s *flowVectorMgmtRepoStub) DeletePointsByFilter(_ context.Context, collection string, filter *fragmodel.VectorFilter) error {
	s.lastCollection = collection
	s.lastFilter = filter
	return s.deletePointsErr
}

type flowVectorDataRepoStub struct {
	lastCollection             string
	lastPointID                string
	lastBatchPointIDs          []string
	batchPointIDCalls          [][]string
	batchPayloadSizes          []int
	storeHybridPointErr        error
	storeHybridPointsErr       error
	storeHybridPointsErrOnCall int
}

func (*flowVectorDataRepoStub) StorePoint(context.Context, string, string, []float64, fragmodel.FragmentPayload) error {
	return nil
}

func (s *flowVectorDataRepoStub) StoreHybridPoint(_ context.Context, collection, pointID string, _ []float64, _ *fragmodel.SparseInput, _ fragmodel.FragmentPayload) error {
	s.lastCollection = collection
	s.lastPointID = pointID
	return s.storeHybridPointErr
}

func (*flowVectorDataRepoStub) StorePoints(context.Context, string, []string, [][]float64, []fragmodel.FragmentPayload) error {
	return nil
}

func (s *flowVectorDataRepoStub) StoreHybridPoints(_ context.Context, collection string, pointIDs []string, _ [][]float64, _ []*fragmodel.SparseInput, payloads []fragmodel.FragmentPayload) error {
	s.lastCollection = collection
	s.lastBatchPointIDs = append([]string(nil), pointIDs...)
	s.batchPointIDCalls = append(s.batchPointIDCalls, append([]string(nil), pointIDs...))
	s.batchPayloadSizes = append(s.batchPayloadSizes, len(payloads))
	if s.storeHybridPointsErrOnCall > 0 && len(s.batchPointIDCalls) == s.storeHybridPointsErrOnCall {
		return errVectorStoreBoom
	}
	return s.storeHybridPointsErr
}

func (*flowVectorDataRepoStub) SetPayloadByPointIDs(context.Context, string, map[string]map[string]any) error {
	return nil
}

func (*flowVectorDataRepoStub) Search(context.Context, string, []float64, int, float64) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return nil, nil
}

func (*flowVectorDataRepoStub) ListExistingPointIDs(context.Context, string, []string) (map[string]struct{}, error) {
	return map[string]struct{}{}, nil
}

func (*flowVectorDataRepoStub) SearchWithFilter(context.Context, string, []float64, int, float64, *fragmodel.VectorFilter) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return nil, nil
}

func (*flowVectorDataRepoStub) SearchDenseWithFilter(context.Context, fragmodel.DenseSearchRequest) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return nil, nil
}

func (*flowVectorDataRepoStub) SearchSparseWithFilter(context.Context, fragmodel.SparseSearchRequest) ([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], error) {
	return nil, nil
}

type flowMemorySnapshot struct {
	current int64
	limit   int64
	err     error
}

type flowMemoryReaderStub struct {
	snapshots []flowMemorySnapshot
	calls     int
}

func (s *flowMemoryReaderStub) Read() (int64, int64, error) {
	if len(s.snapshots) == 0 {
		return 0, 0, memoryguard.ErrMemoryPressure
	}
	index := s.calls
	if index >= len(s.snapshots) {
		index = len(s.snapshots) - 1
	}
	s.calls++
	snapshot := s.snapshots[index]
	return snapshot.current, snapshot.limit, snapshot.err
}
