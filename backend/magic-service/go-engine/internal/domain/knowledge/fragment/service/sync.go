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
	"magic/internal/pkg/memoryguard"
	"magic/internal/pkg/memoryprobe"
)

const (
	defaultSyncFragmentBatchSize              = 64
	fragmentBatchMemoryGuardLogKeyword        = "knowledge_document_memory_guard"
	fragmentBatchMemoryGuardCgroupRatio       = 0.50
	fragmentBatchMemoryGuardCgroupResumeRatio = 0.45
	fragmentBatchMemoryGuardSoftResumeRatio   = 0.90
	fragmentBatchMemoryGuardPollInterval      = time.Second
	fragmentBatchMemoryAdmissionStage         = "sync_fragment_batch_admission"
	fragmentBatchLogFieldCount                = 22
)

type batchVectorWrite struct {
	pointIDs     []string
	denseVectors [][]float64
	sparseInputs []*fragmodel.SparseInput
	payloads     []fragmodel.FragmentPayload
}

type fragmentBatchLogMeta struct {
	batchIndex    int
	batchSize     int
	fragmentCount int
	documentCode  string
}

type fragmentBatchSyncRuntime struct {
	collectionName string
	model          string
	sparseBackend  string
	businessParams *ctxmeta.BusinessParams
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
			"batch_size", s.effectiveSyncFragmentBatchSize(),
			"batch_count", fragmentBatchCount(len(fragments), s.effectiveSyncFragmentBatchSize()),
		)
	}()

	batchSize := s.effectiveSyncFragmentBatchSize()
	runtime := fragmentBatchSyncRuntime{
		collectionName: collectionName,
		model:          model,
		sparseBackend:  resolvedRoute.SparseBackend,
		businessParams: businessParams,
	}
	for batchStart, batchIndex := 0, 1; batchStart < len(fragments); batchStart, batchIndex = batchStart+batchSize, batchIndex+1 {
		batchEnd := min(batchStart+batchSize, len(fragments))
		batchFragments := fragments[batchStart:batchEnd]
		meta := newFragmentBatchLogMeta(batchIndex, batchFragments, len(fragments))
		if batchIndex > 1 {
			if err = s.waitFragmentBatchMemoryAdmission(ctx, meta); err != nil {
				return err
			}
		}
		if err = s.syncFragmentBatchChunk(ctx, trace, runtime, batchFragments, meta); err != nil {
			return err
		}
	}

	s.logger.InfoContext(
		ctx,
		"Batch fragments synced",
		"count", len(fragments),
		"batch_size", batchSize,
		"batch_count", fragmentBatchCount(len(fragments), batchSize),
	)
	return nil
}

func (s *FragmentDomainService) syncFragmentBatchChunk(
	ctx context.Context,
	trace *batchSyncTracer,
	runtime fragmentBatchSyncRuntime,
	fragments []*fragmodel.KnowledgeBaseFragment,
	meta fragmentBatchLogMeta,
) error {
	s.markFragmentsSyncingWithTrace(ctx, trace, runtime.collectionName, fragments, meta)

	if _, err := s.populateBatchEmbeddingsWithTrace(ctx, trace, runtime, fragments, meta); err != nil {
		s.markFragmentsFailed(ctx, fragments, err.Error())
		return err
	}
	batch := s.buildBatchStorePayloadsWithTrace(ctx, trace, runtime, fragments, meta)

	if err := s.storeBatchPointsWithTrace(ctx, trace, runtime, fragments, batch, meta); err != nil {
		s.markFragmentsFailed(ctx, fragments, err.Error())
		return err
	}
	s.markFragmentsSyncedWithTrace(ctx, trace, runtime.collectionName, fragments, meta)
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
	meta fragmentBatchLogMeta,
) {
	startedAt := time.Now()
	s.markFragmentsSyncing(ctx, fragments)
	trace.log(
		ctx,
		"mark_fragments_syncing",
		startedAt,
		nil,
		s.fragmentBatchLogFields(ctx, "mark_fragments_syncing", meta,
			"collection_name", collectionName,
		)...,
	)
}

func (s *FragmentDomainService) populateBatchEmbeddingsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	runtime fragmentBatchSyncRuntime,
	fragments []*fragmodel.KnowledgeBaseFragment,
	meta fragmentBatchLogMeta,
) (int, error) {
	trace.logStart(
		ctx,
		"populate_batch_embeddings",
		s.fragmentBatchLogFields(ctx, "populate_batch_embeddings", meta,
			"collection_name", runtime.collectionName,
			"model", runtime.model,
		)...,
	)
	startedAt := time.Now()
	embeddedCount, err := s.populateBatchEmbeddings(ctx, runtime.model, fragments, runtime.businessParams)
	trace.log(
		ctx,
		"populate_batch_embeddings",
		startedAt,
		err,
		s.fragmentBatchLogFields(ctx, "populate_batch_embeddings", meta,
			"collection_name", runtime.collectionName,
			"model", runtime.model,
			"embedding_count", embeddedCount,
		)...,
	)
	return embeddedCount, err
}

func (s *FragmentDomainService) buildBatchStorePayloadsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	runtime fragmentBatchSyncRuntime,
	fragments []*fragmodel.KnowledgeBaseFragment,
	meta fragmentBatchLogMeta,
) batchVectorWrite {
	trace.logStart(
		ctx,
		"build_batch_store_payloads",
		s.fragmentBatchLogFields(ctx, "build_batch_store_payloads", meta,
			"collection_name", runtime.collectionName,
		)...,
	)
	startedAt := time.Now()
	batch := s.buildBatchStorePayloads(fragments, runtime.sparseBackend)
	trace.log(
		ctx,
		"build_batch_store_payloads",
		startedAt,
		nil,
		s.fragmentBatchLogFields(ctx, "build_batch_store_payloads", meta,
			"collection_name", runtime.collectionName,
		)...,
	)
	return batch
}

func (s *FragmentDomainService) storeBatchPointsWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	runtime fragmentBatchSyncRuntime,
	fragments []*fragmodel.KnowledgeBaseFragment,
	batch batchVectorWrite,
	meta fragmentBatchLogMeta,
) error {
	trace.logStart(
		ctx,
		"store_batch_points",
		s.fragmentBatchLogFields(ctx, "store_batch_points", meta,
			"collection_name", runtime.collectionName,
			"model", runtime.model,
		)...,
	)
	startedAt := time.Now()
	err := s.storeBatchPoints(ctx, runtime.model, fragments, runtime.collectionName, batch)
	trace.log(
		ctx,
		"store_batch_points",
		startedAt,
		err,
		s.fragmentBatchLogFields(ctx, "store_batch_points", meta,
			"collection_name", runtime.collectionName,
			"model", runtime.model,
		)...,
	)
	return err
}

func (s *FragmentDomainService) markFragmentsSyncedWithTrace(
	ctx context.Context,
	trace *batchSyncTracer,
	collectionName string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	meta fragmentBatchLogMeta,
) {
	startedAt := time.Now()
	s.markFragmentsSynced(ctx, fragments)
	trace.log(
		ctx,
		"mark_fragments_synced",
		startedAt,
		nil,
		s.fragmentBatchLogFields(ctx, "mark_fragments_synced", meta,
			"collection_name", collectionName,
		)...,
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

func normalizeSyncFragmentBatchSize(size int) int {
	if size <= 0 {
		return defaultSyncFragmentBatchSize
	}
	return size
}

func normalizeFragmentBatchMemoryPollInterval(interval time.Duration) time.Duration {
	if interval <= 0 {
		return fragmentBatchMemoryGuardPollInterval
	}
	return interval
}

func (s *FragmentDomainService) effectiveSyncFragmentBatchSize() int {
	if s == nil {
		return defaultSyncFragmentBatchSize
	}
	return normalizeSyncFragmentBatchSize(s.syncFragmentBatchSize)
}

func fragmentBatchCount(fragmentCount, batchSize int) int {
	if fragmentCount <= 0 {
		return 0
	}
	batchSize = normalizeSyncFragmentBatchSize(batchSize)
	return (fragmentCount + batchSize - 1) / batchSize
}

func newFragmentBatchLogMeta(
	batchIndex int,
	fragments []*fragmodel.KnowledgeBaseFragment,
	fragmentCount int,
) fragmentBatchLogMeta {
	return fragmentBatchLogMeta{
		batchIndex:    batchIndex,
		batchSize:     len(fragments),
		fragmentCount: fragmentCount,
		documentCode:  resolveBatchDocumentCode(fragments),
	}
}

func resolveBatchDocumentCode(fragments []*fragmodel.KnowledgeBaseFragment) string {
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		if fragment.DocumentCode != "" {
			return fragment.DocumentCode
		}
	}
	return ""
}

func (s *FragmentDomainService) waitFragmentBatchMemoryAdmission(
	ctx context.Context,
	meta fragmentBatchLogMeta,
) error {
	if s == nil {
		return nil
	}
	guard := s.newFragmentBatchMemoryGuard()
	snapshot, err := guard.Check(ctx, fragmentBatchMemoryAdmissionStage)
	if shouldFailOpenFragmentBatchMemoryGuard(snapshot, err) {
		s.logFragmentBatchMemoryGuardFailOpen(ctx, meta, snapshot, err)
		return nil
	}
	if err == nil {
		return nil
	}

	s.logFragmentBatchMemoryGuardPaused(ctx, meta, snapshot, err)
	for {
		if err := sleepFragmentBatchMemoryGuard(ctx, s.memoryPollInterval); err != nil {
			return fmt.Errorf("wait fragment batch memory admission: %w", err)
		}
		snapshot, err = guard.Check(ctx, fragmentBatchMemoryAdmissionStage)
		if shouldFailOpenFragmentBatchMemoryGuard(snapshot, err) {
			s.logFragmentBatchMemoryGuardFailOpen(ctx, meta, snapshot, err)
			return nil
		}
		if s.fragmentBatchMemoryBelowResumeWaterline(snapshot) {
			s.logFragmentBatchMemoryGuardResumed(ctx, meta, snapshot)
			return nil
		}
	}
}

func (s *FragmentDomainService) newFragmentBatchMemoryGuard() *memoryguard.Guard {
	config := memoryguard.Config{
		SoftLimitBytes:             s.syncMemorySoftLimit,
		CgroupPressureRatio:        fragmentBatchMemoryGuardCgroupRatio,
		DisableCgroupPressureRatio: s.syncMemorySoftLimit > 0,
	}
	if s.memoryReader != nil {
		return memoryguard.NewGuardWithReader(config, s.memoryReader)
	}
	return memoryguard.NewGuard(config)
}

func shouldFailOpenFragmentBatchMemoryGuard(snapshot memoryguard.Snapshot, err error) bool {
	if err != nil {
		return !errors.Is(err, memoryguard.ErrMemoryPressure)
	}
	return !snapshot.CgroupAvailable
}

func (s *FragmentDomainService) fragmentBatchMemoryBelowResumeWaterline(snapshot memoryguard.Snapshot) bool {
	if snapshot.CurrentBytes <= 0 {
		return true
	}
	if snapshot.SoftLimitBytes > 0 {
		return snapshot.CurrentBytes <= int64(float64(snapshot.SoftLimitBytes)*fragmentBatchMemoryGuardSoftResumeRatio)
	}
	if snapshot.LimitBytes > 0 {
		return snapshot.CurrentBytes <= int64(float64(snapshot.LimitBytes)*fragmentBatchMemoryGuardCgroupResumeRatio)
	}
	return true
}

func sleepFragmentBatchMemoryGuard(ctx context.Context, interval time.Duration) error {
	timer := time.NewTimer(normalizeFragmentBatchMemoryPollInterval(interval))
	defer timer.Stop()

	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("sleep fragment batch memory guard: %w", ctx.Err())
	}
}

func (s *FragmentDomainService) logFragmentBatchMemoryGuardPaused(
	ctx context.Context,
	meta fragmentBatchLogMeta,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if s == nil || s.logger == nil {
		return
	}
	fields := appendFragmentBatchMemoryGuardAdmissionFields(meta, snapshot,
		"error", cause,
	)
	s.logger.KnowledgeWarnContext(ctx, memoryprobe.DocumentSyncKeyword+" "+fragmentBatchMemoryGuardLogKeyword+" pause fragment batch sync admission", fields...)
}

func (s *FragmentDomainService) logFragmentBatchMemoryGuardResumed(
	ctx context.Context,
	meta fragmentBatchLogMeta,
	snapshot memoryguard.Snapshot,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.InfoContext(
		ctx,
		memoryprobe.DocumentSyncKeyword+" "+fragmentBatchMemoryGuardLogKeyword+" fragment batch sync admission resumed",
		appendFragmentBatchMemoryGuardAdmissionFields(meta, snapshot)...,
	)
}

func (s *FragmentDomainService) logFragmentBatchMemoryGuardFailOpen(
	ctx context.Context,
	meta fragmentBatchLogMeta,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if s == nil || s.logger == nil {
		return
	}
	fields := appendFragmentBatchMemoryGuardAdmissionFields(meta, snapshot)
	if cause != nil {
		fields = append(fields, "error", cause)
	}
	s.logger.DebugContext(ctx, memoryprobe.DocumentSyncKeyword+" "+fragmentBatchMemoryGuardLogKeyword+" fragment batch sync memory cgroup unavailable, fail open", fields...)
}

func (s *FragmentDomainService) fragmentBatchLogFields(
	ctx context.Context,
	stage string,
	meta fragmentBatchLogMeta,
	fields ...any,
) []any {
	config := memoryguard.Config{
		SoftLimitBytes:             s.syncMemorySoftLimit,
		CgroupPressureRatio:        fragmentBatchMemoryGuardCgroupRatio,
		DisableCgroupPressureRatio: s.syncMemorySoftLimit > 0,
	}
	sample := memoryprobe.Capture(ctx, stage, config)
	s.logFragmentBatchLargeMemoryIfNeeded(ctx, meta, sample)
	return appendFragmentBatchMemoryGuardFieldsFromSample(meta, sample, fields...)
}

func (s *FragmentDomainService) logFragmentBatchLargeMemoryIfNeeded(
	ctx context.Context,
	meta fragmentBatchLogMeta,
	sample memoryprobe.Sample,
) {
	peak, warn := memoryprobe.Observe(ctx, sample)
	if !warn || s == nil || s.logger == nil {
		return
	}
	fields := memoryprobe.ExceededFields(sample, peak)
	fields = append(fields,
		"document_code", meta.documentCode,
		"batch_index", meta.batchIndex,
		"batch_size", meta.batchSize,
		"fragment_count", meta.fragmentCount,
	)
	s.logger.KnowledgeWarnContext(ctx, memoryprobe.DocumentSyncKeyword+" fragment batch memory exceeded threshold", fields...)
}

func appendFragmentBatchMemoryGuardAdmissionFields(
	meta fragmentBatchLogMeta,
	snapshot memoryguard.Snapshot,
	fields ...any,
) []any {
	return appendFragmentBatchMemoryGuardFields(meta, snapshot, append([]any{"stage", snapshot.Stage}, fields...)...)
}

func appendFragmentBatchMemoryGuardFields(
	meta fragmentBatchLogMeta,
	snapshot memoryguard.Snapshot,
	fields ...any,
) []any {
	output := make([]any, 0, len(fields)+fragmentBatchLogFieldCount)
	output = append(output,
		"memory_probe_keyword", memoryprobe.DocumentSyncKeyword,
		"memory_guard_keyword", fragmentBatchMemoryGuardLogKeyword,
		"document_code", meta.documentCode,
		"batch_index", meta.batchIndex,
		"batch_size", meta.batchSize,
		"fragment_count", meta.fragmentCount,
		"current_bytes", snapshot.CurrentBytes,
		"limit_bytes", snapshot.LimitBytes,
		"usage_ratio", snapshot.UsageRatio,
		"soft_limit_bytes", snapshot.SoftLimitBytes,
		"limit_name", snapshot.LimitName,
		"limit_value", snapshot.LimitValue,
		"observed_value", snapshot.ObservedValue,
	)
	output = append(output, fields...)
	return output
}

func appendFragmentBatchMemoryGuardFieldsFromSample(
	meta fragmentBatchLogMeta,
	sample memoryprobe.Sample,
	fields ...any,
) []any {
	output := make([]any, 0, len(fields)+fragmentBatchLogFieldCount)
	output = append(output,
		"memory_guard_keyword", fragmentBatchMemoryGuardLogKeyword,
		"document_code", meta.documentCode,
		"batch_index", meta.batchIndex,
		"batch_size", meta.batchSize,
		"fragment_count", meta.fragmentCount,
	)
	output = append(output, memoryprobe.SampleFields(sample)...)
	output = append(output, fields...)
	return output
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
