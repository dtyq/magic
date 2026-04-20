// Package fixlegacy 提供一次性修复历史空 document_code 片段的执行逻辑。
package fixlegacy

import (
	"context"
	"fmt"
	"slices"
	"sync"

	"golang.org/x/sync/errgroup"

	"magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/knowledgebase/service"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

const (
	defaultBatchSize       = 500
	defaultSyncConcurrency = 4
	maxFailureSamples      = 10
)

// ScanQuery 定义空 document_code 片段扫描条件。
type ScanQuery struct {
	OrganizationCode string
	KnowledgeCode    string
	StartID          int64
	Limit            int
}

type fragmentRepository interface {
	ListMissingDocumentCode(ctx context.Context, query ScanQuery) ([]*fragmodel.KnowledgeBaseFragment, error)
	BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error)
	FindByIDs(ctx context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error)
}

type knowledgeBaseReader interface {
	Show(ctx context.Context, code string) (*knowledgebase.KnowledgeBase, error)
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*knowledgebase.KnowledgeBase, error)
}

type defaultDocumentEnsurer interface {
	EnsureDefaultDocument(ctx context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) (*document.KnowledgeBaseDocument, bool, error)
}

type fragmentBatchSyncer interface {
	SyncFragmentBatch(ctx context.Context, kb any, fragments []*fragmodel.KnowledgeBaseFragment, businessParams *ctxmeta.BusinessParams) error
}

// Options 定义修复任务参数。
type Options struct {
	DryRun           bool
	OrganizationCode string
	KnowledgeCode    string
	BatchSize        int
	SyncConcurrency  int
	StartID          int64
	MaxRows          int
}

// FailureSample 定义失败样本。
type FailureSample struct {
	KnowledgeCode string
	FragmentIDs   []int64
	Message       string
}

// Result 定义修复结果统计。
type Result struct {
	Scanned                 int
	Candidates              int
	Updated                 int
	Synced                  int
	Failed                  int
	DefaultDocumentsFound   int
	DefaultDocumentsCreated int
	Failures                []FailureSample
}

// HasFailures 返回是否存在失败。
func (r Result) HasFailures() bool {
	return r.Failed > 0 || len(r.Failures) > 0
}

// Runner 执行历史空 document_code 修复。
type Runner struct {
	fragments fragmentRepository
	knowledge knowledgeBaseReader
	documents defaultDocumentEnsurer
	syncer    fragmentBatchSyncer
	logger    *logging.SugaredLogger
}

func knowledgeBaseSnapshotFromDomain(kb *knowledgebase.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
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

// NewRunner 创建修复 runner。
func NewRunner(
	fragments fragmentRepository,
	knowledge knowledgeBaseReader,
	documents defaultDocumentEnsurer,
	syncer fragmentBatchSyncer,
	logger *logging.SugaredLogger,
) *Runner {
	return &Runner{
		fragments: fragments,
		knowledge: knowledge,
		documents: documents,
		syncer:    syncer,
		logger:    logger,
	}
}

// Run 执行修复。
func (r *Runner) Run(ctx context.Context, options Options) (Result, error) {
	options = normalizeOptions(options)

	result := Result{
		Failures: make([]FailureSample, 0, maxFailureSamples),
	}

	nextStartID := options.StartID
	remaining := options.MaxRows
	for {
		limit := options.BatchSize
		if remaining > 0 && remaining < limit {
			limit = remaining
		}

		fragments, err := r.fragments.ListMissingDocumentCode(ctx, ScanQuery{
			OrganizationCode: options.OrganizationCode,
			KnowledgeCode:    options.KnowledgeCode,
			StartID:          nextStartID,
			Limit:            limit,
		})
		if err != nil {
			return result, fmt.Errorf("list fragments missing document code: %w", err)
		}
		if len(fragments) == 0 {
			return result, nil
		}

		result.Scanned += len(fragments)
		result.Candidates += len(fragments)
		nextStartID = fragments[len(fragments)-1].ID

		if options.DryRun {
			r.logger.InfoContext(ctx, "dry run batch scanned", "count", len(fragments), "last_id", nextStartID)
		} else {
			batchResult := r.processBatch(ctx, options, groupFragmentsByKnowledgeCode(fragments))
			mergeResult(&result, batchResult)
		}

		if remaining > 0 {
			remaining -= len(fragments)
			if remaining <= 0 {
				return result, nil
			}
		}
	}
}

func (r *Runner) processBatch(
	ctx context.Context,
	options Options,
	grouped map[string][]*fragmodel.KnowledgeBaseFragment,
) Result {
	result := Result{
		Failures: make([]FailureSample, 0, maxFailureSamples),
	}
	if len(grouped) == 0 {
		return result
	}

	keys := make([]string, 0, len(grouped))
	for knowledgeCode := range grouped {
		keys = append(keys, knowledgeCode)
	}
	slices.Sort(keys)

	var (
		mu sync.Mutex
		eg errgroup.Group
	)
	eg.SetLimit(options.SyncConcurrency)

	for _, knowledgeCode := range keys {
		fragments := grouped[knowledgeCode]
		eg.Go(func() error {
			groupResult := r.processKnowledgeGroup(ctx, options, knowledgeCode, fragments)
			mu.Lock()
			defer mu.Unlock()
			mergeResult(&result, groupResult)
			return nil
		})
	}

	_ = eg.Wait()
	return result
}

func (r *Runner) processKnowledgeGroup(
	ctx context.Context,
	options Options,
	knowledgeCode string,
	fragments []*fragmodel.KnowledgeBaseFragment,
) Result {
	result := Result{
		Failures: make([]FailureSample, 0, 1),
	}
	if len(fragments) == 0 {
		return result
	}

	kb, err := r.loadKnowledgeBase(ctx, knowledgeCode, options.OrganizationCode)
	if err != nil {
		return result.withFailure(knowledgeCode, fragmentIDs(fragments), fmt.Sprintf("load knowledge base: %v", err))
	}

	defaultDoc, created, err := r.documents.EnsureDefaultDocument(ctx, knowledgeBaseSnapshotFromDomain(kb))
	if err != nil {
		return result.withFailure(knowledgeCode, fragmentIDs(fragments), fmt.Sprintf("ensure default document: %v", err))
	}
	if created {
		result.DefaultDocumentsCreated++
	} else {
		result.DefaultDocumentsFound++
	}

	ids := fragmentIDs(fragments)
	updated, err := r.fragments.BackfillDocumentCode(ctx, ids, defaultDoc.Code)
	if err != nil {
		return result.withFailure(knowledgeCode, ids, fmt.Sprintf("backfill document code: %v", err))
	}
	result.Updated += int(updated)

	reloaded, err := r.fragments.FindByIDs(ctx, ids)
	if err != nil {
		return result.withFailure(knowledgeCode, ids, fmt.Sprintf("reload fragments: %v", err))
	}
	if len(reloaded) == 0 {
		return result
	}

	for _, fragment := range reloaded {
		fragment.OrganizationCode = kb.OrganizationCode
		fragment.DocumentCode = defaultDoc.Code
		fragment.DocumentName = defaultDoc.Name
		fragment.DocumentType = defaultDoc.DocType
	}

	if err := r.syncer.SyncFragmentBatch(ctx, kb, reloaded, &ctxmeta.BusinessParams{
		OrganizationCode: kb.OrganizationCode,
	}); err != nil {
		return result.withFailure(knowledgeCode, ids, fmt.Sprintf("sync fragment batch: %v", err))
	}
	result.Synced += len(reloaded)

	return result
}

func (r *Runner) loadKnowledgeBase(ctx context.Context, knowledgeCode, organizationCode string) (*knowledgebase.KnowledgeBase, error) {
	if organizationCode != "" {
		kb, err := r.knowledge.ShowByCodeAndOrg(ctx, knowledgeCode, organizationCode)
		if err != nil {
			return nil, fmt.Errorf("show knowledge base by org: %w", err)
		}
		return kb, nil
	}
	kb, err := r.knowledge.Show(ctx, knowledgeCode)
	if err != nil {
		return nil, fmt.Errorf("show knowledge base: %w", err)
	}
	return kb, nil
}

func (r Result) withFailure(knowledgeCode string, ids []int64, message string) Result {
	r.Failed += len(ids)
	if len(r.Failures) < maxFailureSamples {
		r.Failures = append(r.Failures, FailureSample{
			KnowledgeCode: knowledgeCode,
			FragmentIDs:   append([]int64(nil), ids...),
			Message:       message,
		})
	}
	return r
}

func normalizeOptions(options Options) Options {
	if options.BatchSize <= 0 {
		options.BatchSize = defaultBatchSize
	}
	if options.SyncConcurrency <= 0 {
		options.SyncConcurrency = defaultSyncConcurrency
	}
	if options.StartID < 0 {
		options.StartID = 0
	}
	return options
}

func groupFragmentsByKnowledgeCode(fragments []*fragmodel.KnowledgeBaseFragment) map[string][]*fragmodel.KnowledgeBaseFragment {
	grouped := make(map[string][]*fragmodel.KnowledgeBaseFragment)
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		grouped[fragment.KnowledgeCode] = append(grouped[fragment.KnowledgeCode], fragment)
	}
	return grouped
}

func fragmentIDs(fragments []*fragmodel.KnowledgeBaseFragment) []int64 {
	ids := make([]int64, 0, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		ids = append(ids, fragment.ID)
	}
	return ids
}

func mergeResult(target *Result, delta Result) {
	target.Scanned += delta.Scanned
	target.Candidates += delta.Candidates
	target.Updated += delta.Updated
	target.Synced += delta.Synced
	target.Failed += delta.Failed
	target.DefaultDocumentsFound += delta.DefaultDocumentsFound
	target.DefaultDocumentsCreated += delta.DefaultDocumentsCreated
	for _, failure := range delta.Failures {
		if len(target.Failures) >= maxFailureSamples {
			break
		}
		target.Failures = append(target.Failures, failure)
	}
}
