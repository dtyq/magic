package docapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/knowledgeroute"
)

// DocumentSyncAppService 负责文档同步命令流。
type DocumentSyncAppService struct {
	support *DocumentAppService
}

// NewDocumentSyncAppService 创建文档同步命令流应用服务。
func NewDocumentSyncAppService(support *DocumentAppService) *DocumentSyncAppService {
	return &DocumentSyncAppService{support: support}
}

// ScheduleSync 调度文档异步同步。
func (s *DocumentSyncAppService) ScheduleSync(ctx context.Context, input *document.SyncDocumentInput) {
	if s == nil || s.support == nil {
		return
	}
	s.support.ScheduleSync(ctx, input)
}

// Sync 执行文档同步。
func (s *DocumentSyncAppService) Sync(ctx context.Context, input *document.SyncDocumentInput) (err error) {
	if s == nil || s.support == nil {
		return nil
	}
	return s.support.executeSync(ctx, input)
}

func (s *DocumentAppService) executeSync(ctx context.Context, input *document.SyncDocumentInput) (err error) {
	if s == nil || input == nil {
		return nil
	}
	if input.RebuildOverride != nil {
		ctx = knowledgeroute.WithRebuildOverride(ctx, input.RebuildOverride)
	}
	mode := document.ResolveSyncMode(input.Mode)
	startedAt := time.Now()
	trace := newDocumentSyncTracer(s, mode)
	defer func() {
		trace.log(ctx, "sync_document_total", startedAt, err)
	}()

	doc, err := s.fetchDocumentForSync(ctx, input)
	if err != nil {
		return err
	}
	trace.withDocument(doc)
	if err := s.validateDocumentOrg(doc, input.OrganizationCode); err != nil {
		return err
	}
	if err := s.ensureKnowledgeBaseAccessibleInAgentScope(
		ctx,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
	); err != nil {
		return err
	}
	if err := s.injectProjectFileSourceOverride(ctx, doc, input); err != nil {
		return err
	}
	s.prepareSingleDocumentThirdPlatformResync(ctx, doc, input)
	if redirected, redirectErr := s.redirectThirdPlatformResync(ctx, mode, doc, input); redirectErr != nil || redirected {
		return redirectErr
	}
	return s.executeSyncDocument(ctx, input, trace, doc)
}

func (s *DocumentAppService) executeSyncDocument(
	ctx context.Context,
	input *document.SyncDocumentInput,
	trace *documentSyncTracer,
	doc *document.KnowledgeBaseDocument,
) error {
	runtimeKB, err := s.loadRuntimeKnowledgeBaseForSync(ctx, doc)
	if err != nil {
		return err
	}
	if runtimeKB == nil {
		return errKnowledgeBaseNil
	}

	override := document.NormalizeSourceOverride(input.SourceOverride, time.Now())
	if err := s.persistSourceOverride(ctx, doc, override); err != nil {
		return err
	}
	if err := s.preflightDocumentSource(ctx, doc, override); err != nil {
		return fmt.Errorf("preflight document source: %w", err)
	}
	s.ensureDocumentFileExtensionForSync(ctx, doc)

	if err := s.markDocumentSyncing(ctx, doc); err != nil {
		return err
	}

	parseStartedAt := time.Now()
	parsedDocument, content, err := s.parseDocumentContent(ctx, doc, input.BusinessParams, override)
	trace.log(ctx, "parse_document_content", parseStartedAt, err)
	if err != nil {
		return s.failSync(ctx, doc, document.SyncFailureParsing, err)
	}
	document.MergeParsedDocumentMeta(doc, parsedDocument)

	buildStartedAt := time.Now()
	fragments, err := s.buildFragments(ctx, doc, runtimeKB, parsedDocument, runtimeKB.Model)
	trace.log(ctx, "build_fragments", buildStartedAt, err, "fragment_count", len(fragments))
	if err != nil {
		return s.failSync(ctx, doc, document.SyncFailureSplitFragments, err)
	}

	if err := s.syncDocumentFragments(ctx, trace, documentFragmentSyncRequest{
		doc:            doc,
		kb:             runtimeKB,
		collectionName: runtimeKB.ResolvedRoute.VectorCollectionName,
		fragments:      fragments,
		businessParams: input.BusinessParams,
	}); err != nil {
		return s.failSync(ctx, doc, document.SyncFailureSyncVector, err)
	}

	return s.finishSync(ctx, doc, content)
}

func (s *DocumentAppService) persistSourceOverride(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	override *document.SourceOverride,
) error {
	if override == nil {
		return nil
	}

	changed := document.ApplySourceOverrideForSync(
		doc,
		override,
		s.resolveDocumentFileExtensionForStage(ctx, doc, "persist"),
	)
	if !changed {
		return nil
	}
	if err := s.domainService.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to update document source override: %w", err)
	}
	return nil
}

func (s *DocumentAppService) failSync(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	fallbackReason string,
	err error,
) error {
	reason, cause := unwrapDocumentSyncStageError(err, fallbackReason)
	failureErr := document.NewSyncStageError(reason, cause)
	if markErr := s.domainService.MarkSyncFailed(
		ctx,
		doc,
		document.BuildSyncFailureMessage(reason, cause),
	); markErr != nil {
		return errors.Join(failureErr, fmt.Errorf("failed to mark document sync failed: %w", markErr))
	}
	return failureErr
}

func unwrapDocumentSyncStageError(err error, fallbackReason string) (string, error) {
	if err == nil {
		return fallbackReason, nil
	}

	var stageErr *document.SyncStageError
	if errors.As(err, &stageErr) && stageErr != nil {
		reason := stageErr.Reason
		if reason == "" {
			reason = fallbackReason
		}
		if stageErr.Err != nil {
			return reason, stageErr.Err
		}
		return reason, err
	}
	return fallbackReason, err
}
