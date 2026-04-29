package fragdomain

import (
	"context"
	"errors"
	"fmt"
	"time"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
)

type batchVectorWrite struct {
	pointIDs     []string
	denseVectors [][]float64
	sparseInputs []*fragmodel.SparseInput
	payloads     []fragmodel.FragmentPayload
}

// SyncFragment 同步片段到向量库（核心逻辑）
func (s *FragmentDomainService) SyncFragment(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	fragment *fragmodel.KnowledgeBaseFragment,
	businessParams *ctxmeta.BusinessParams,
) error {
	// fragment 写点只能命中统一运行时路由给出的目标集合；embedding 模型也必须与这次路由解析保持一致。
	resolvedRoute := fragmodel.ResolveRuntimeRoute(kb, s.defaultEmbeddingModel)
	collectionName := resolvedRoute.VectorCollectionName
	model := resolvedRoute.Model

	fragment.MarkSyncing()
	if err := s.repo.UpdateSyncStatus(ctx, fragment); err != nil {
		s.logger.KnowledgeWarnContext(ctx, "Failed to update sync status to syncing", "fragmentID", fragment.ID, "error", err)
	}

	if len(fragment.Vector) == 0 {
		retrievalText := s.retrievalSvc.BuildRetrievalTextFromFragment(fragment)
		embedding, err := s.embeddingSvc.GetEmbedding(ctx, retrievalText, model, businessParams)
		if err != nil {
			fragment.MarkSyncFailed(err.Error())
			_ = s.repo.UpdateSyncStatus(ctx, fragment)
			return fmt.Errorf("failed to compute embedding: %w", err)
		}
		fragment.SetVector(embedding)
		if fragment.Metadata != nil {
			fragment.Metadata["retrieval_text_version"] = fragretrieval.RetrievalTextVersionV1
		}

		if err := s.repo.UpdateVector(ctx, fragment.ID, embedding); err != nil {
			s.logger.KnowledgeWarnContext(ctx, "Failed to update vector", "fragmentID", fragment.ID, "error", err)
		}
	}

	payload := fragmetadata.BuildFragmentPayload(fragment)
	sparseInput := s.retrievalSvc.BuildSparseInputFromFragment(fragment, resolvedRoute.SparseBackend)
	if err := s.vectorDataRepo.StoreHybridPoint(ctx, collectionName, fragment.PointID, fragment.Vector, sparseInput, *payload); err != nil {
		fragment.MarkSyncFailed(err.Error())
		_ = s.repo.UpdateSyncStatus(ctx, fragment)
		return fmt.Errorf("failed to store point: %w", err)
	}

	fragment.MarkSynced()
	if err := s.repo.UpdateSyncStatus(ctx, fragment); err != nil {
		s.logger.KnowledgeWarnContext(ctx, "Failed to update sync status to synced", "fragmentID", fragment.ID, "error", err)
	}

	s.logger.DebugContext(ctx, "Fragment synced", "fragmentID", fragment.ID, "pointID", fragment.PointID)
	return nil
}

// SyncFragmentBatch 批量同步片段
func (s *FragmentDomainService) SyncFragmentBatch(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	fragments []*fragmodel.KnowledgeBaseFragment,
	businessParams *ctxmeta.BusinessParams,
) (err error) {
	if len(fragments) == 0 {
		return nil
	}

	trace := newBatchSyncTracer(s, fragmodel.SnapshotKnowledgeBase(kb))
	syncStartedAt := time.Now()
	// batch sync 与单片段 sync 共享同一套运行时路由语义，避免同批数据落到不同物理集合。
	resolvedRoute := fragmodel.ResolveRuntimeRoute(kb, s.defaultEmbeddingModel)
	collectionName := resolvedRoute.VectorCollectionName
	model := resolvedRoute.Model
	defer func() {
		trace.log(
			ctx,
			"sync_fragment_batch_total",
			syncStartedAt,
			err,
			"collection_name", collectionName,
			"model", model,
			"fragment_count", len(fragments),
		)
	}()

	s.markFragmentsSyncingWithTrace(ctx, trace, collectionName, fragments)

	if _, err = s.populateBatchEmbeddingsWithTrace(ctx, trace, collectionName, model, fragments, businessParams); err != nil {
		s.markFragmentsFailed(ctx, fragments, err.Error())
		return err
	}
	batch := s.buildBatchStorePayloadsWithTrace(ctx, trace, collectionName, fragments, resolvedRoute.SparseBackend)

	if err = s.storeBatchPointsWithTrace(ctx, trace, collectionName, model, fragments, batch); err != nil {
		s.markFragmentsFailed(ctx, fragments, err.Error())
		return err
	}
	s.markFragmentsSyncedWithTrace(ctx, trace, collectionName, fragments)

	s.logger.InfoContext(ctx, "Batch fragments synced", "count", len(fragments))
	return nil
}

func (s *FragmentDomainService) populateBatchEmbeddings(ctx context.Context, model string, fragments []*fragmodel.KnowledgeBaseFragment, businessParams *ctxmeta.BusinessParams) (int, error) {
	textsToEmbed, fragmentsNeedingEmbedding := s.collectEmbeddingTargets(fragments)
	if len(textsToEmbed) == 0 {
		return 0, nil
	}

	embeddings, err := s.embeddingSvc.GetEmbeddings(ctx, textsToEmbed, model, businessParams)
	if err != nil {
		return 0, fmt.Errorf("failed to compute batch embeddings: %w", err)
	}
	for i, fragment := range fragmentsNeedingEmbedding {
		fragment.SetVector(embeddings[i])
		if fragment.Metadata != nil {
			fragment.Metadata["retrieval_text_version"] = fragretrieval.RetrievalTextVersionV1
		}
	}
	return len(textsToEmbed), nil
}

func (s *FragmentDomainService) collectEmbeddingTargets(
	fragments []*fragmodel.KnowledgeBaseFragment,
) ([]string, []*fragmodel.KnowledgeBaseFragment) {
	textsToEmbed := make([]string, 0, len(fragments))
	fragmentsNeedingEmbedding := make([]*fragmodel.KnowledgeBaseFragment, 0, len(fragments))
	for _, fragment := range fragments {
		if len(fragment.Vector) != 0 {
			continue
		}
		textsToEmbed = append(textsToEmbed, s.retrievalSvc.BuildRetrievalTextFromFragment(fragment))
		fragmentsNeedingEmbedding = append(fragmentsNeedingEmbedding, fragment)
	}
	return textsToEmbed, fragmentsNeedingEmbedding
}

func (s *FragmentDomainService) markFragmentsSyncingWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	fragments []*fragmodel.KnowledgeBaseFragment,
) {
	startedAt := time.Now()
	s.markFragmentsSyncing(ctx, fragments)
	trace.log(
		ctx,
		"mark_fragments_syncing",
		startedAt,
		nil,
		"collection_name", collectionName,
		"fragment_count", len(fragments),
	)
}

func (s *FragmentDomainService) populateBatchEmbeddingsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	model string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	businessParams *ctxmeta.BusinessParams,
) (int, error) {
	startedAt := time.Now()
	embeddedCount, err := s.populateBatchEmbeddings(ctx, model, fragments, businessParams)
	trace.log(
		ctx,
		"populate_batch_embeddings",
		startedAt,
		err,
		"collection_name", collectionName,
		"model", model,
		"embedding_count", embeddedCount,
		"fragment_count", len(fragments),
	)
	return embeddedCount, err
}

func (s *FragmentDomainService) buildBatchStorePayloadsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	sparseBackend string,
) batchVectorWrite {
	startedAt := time.Now()
	batch := s.buildBatchStorePayloads(fragments, sparseBackend)
	trace.log(
		ctx,
		"build_batch_store_payloads",
		startedAt,
		nil,
		"collection_name", collectionName,
		"fragment_count", len(batch.pointIDs),
	)
	return batch
}

func (s *FragmentDomainService) storeBatchPointsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	model string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	batch batchVectorWrite,
) error {
	startedAt := time.Now()
	err := s.storeBatchPoints(ctx, model, fragments, collectionName, batch)
	trace.log(
		ctx,
		"store_batch_points",
		startedAt,
		err,
		"collection_name", collectionName,
		"fragment_count", len(batch.pointIDs),
	)
	return err
}

func (s *FragmentDomainService) markFragmentsSyncedWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	fragments []*fragmodel.KnowledgeBaseFragment,
) {
	startedAt := time.Now()
	s.markFragmentsSynced(ctx, fragments)
	trace.log(
		ctx,
		"mark_fragments_synced",
		startedAt,
		nil,
		"collection_name", collectionName,
		"fragment_count", len(fragments),
	)
}

func (s *FragmentDomainService) buildBatchStorePayloads(fragments []*fragmodel.KnowledgeBaseFragment, sparseBackend string) batchVectorWrite {
	pointIDs := make([]string, len(fragments))
	denseVectors := make([][]float64, len(fragments))
	sparseInputs := make([]*fragmodel.SparseInput, len(fragments))
	payloads := make([]fragmodel.FragmentPayload, len(fragments))
	for i, fragment := range fragments {
		pointIDs[i] = fragment.PointID
		denseVectors[i] = fragment.Vector
		sparseInputs[i] = s.retrievalSvc.BuildSparseInputFromFragment(fragment, sparseBackend)
		payloads[i] = *fragmetadata.BuildFragmentPayload(fragment)
	}
	return batchVectorWrite{
		pointIDs:     pointIDs,
		denseVectors: denseVectors,
		sparseInputs: sparseInputs,
		payloads:     payloads,
	}
}

func (s *FragmentDomainService) storeBatchPoints(
	ctx context.Context,
	model string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	collectionName string,
	batch batchVectorWrite,
) error {
	if err := s.vectorDataRepo.StoreHybridPoints(ctx, collectionName, batch.pointIDs, batch.denseVectors, batch.sparseInputs, batch.payloads); err != nil {
		s.logBatchDimensionMismatch(ctx, model, collectionName, fragments, err)
		return fmt.Errorf("failed to store points: %w", err)
	}
	return nil
}

func (s *FragmentDomainService) logBatchDimensionMismatch(ctx context.Context, model, collectionName string, fragments []*fragmodel.KnowledgeBaseFragment, err error) {
	var dimErr *fragmodel.VectorDimensionMismatchError
	if !errors.As(err, &dimErr) {
		return
	}
	documentCode := ""
	if dimErr.Index >= 0 && dimErr.Index < len(fragments) {
		documentCode = fragments[dimErr.Index].DocumentCode
	}
	s.logger.KnowledgeErrorContext(
		ctx,
		"Vector dimension mismatch while syncing fragments",
		"knowledge_base_code", resolveBatchKnowledgeCode(fragments),
		"document_code", documentCode,
		"model", model,
		"collection", collectionName,
		"expected_dim", dimErr.Expected,
		"actual_dim", dimErr.Actual,
		"mismatch_index", dimErr.Index,
	)
}

func resolveBatchKnowledgeCode(fragments []*fragmodel.KnowledgeBaseFragment) string {
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		if code := fragment.KnowledgeCode; code != "" {
			return code
		}
	}
	return ""
}

func (s *FragmentDomainService) markFragmentsSynced(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) {
	if len(fragments) == 0 {
		return
	}

	updatedAt := time.Now()
	for _, fragment := range fragments {
		fragment.MarkSynced()
		fragment.UpdatedAt = updatedAt
	}

	batchUpdater, ok := s.repo.(fragmentSyncStatusBatchUpdater)
	if ok {
		err := batchUpdater.UpdateSyncStatusBatch(ctx, fragments)
		if err == nil {
			return
		}
		s.logger.KnowledgeWarnContext(ctx, "Failed to batch update fragment sync status", "count", len(fragments), "error", err)
	}

	for _, fragment := range fragments {
		if err := s.repo.UpdateSyncStatus(ctx, fragment); err != nil {
			s.logger.KnowledgeWarnContext(ctx, "Failed to update sync status", "fragmentID", fragment.ID, "error", err)
		}
	}
}

func (s *FragmentDomainService) markFragmentsSyncing(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) {
	if len(fragments) == 0 {
		return
	}

	for _, fragment := range fragments {
		fragment.MarkSyncing()
	}
	if batchUpdater, ok := s.repo.(fragmentSyncStatusBatchUpdater); ok {
		if err := batchUpdater.UpdateSyncStatusBatch(ctx, fragments); err == nil {
			return
		}
		s.logger.KnowledgeWarnContext(ctx, "Failed to batch update fragment sync status to syncing", "count", len(fragments))
	}
	for _, fragment := range fragments {
		if err := s.repo.UpdateSyncStatus(ctx, fragment); err != nil {
			s.logger.KnowledgeWarnContext(ctx, "Failed to update fragment sync status to syncing", "fragmentID", fragment.ID, "error", err)
		}
	}
}

func (s *FragmentDomainService) markFragmentsFailed(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment, message string) {
	if len(fragments) == 0 {
		return
	}

	for _, fragment := range fragments {
		fragment.MarkSyncFailed(message)
	}
	if batchUpdater, ok := s.repo.(fragmentSyncStatusBatchUpdater); ok {
		if err := batchUpdater.UpdateSyncStatusBatch(ctx, fragments); err == nil {
			return
		}
		s.logger.KnowledgeWarnContext(ctx, "Failed to batch update fragment sync status to failed", "count", len(fragments))
	}
	for _, fragment := range fragments {
		if err := s.repo.UpdateSyncStatus(ctx, fragment); err != nil {
			s.logger.KnowledgeWarnContext(ctx, "Failed to update fragment sync status to failed", "fragmentID", fragment.ID, "error", err)
		}
	}
}
