package docapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/knowledgeroute"
)

const (
	fragmentResyncPageSize = 500
)

func (s *DocumentAppService) resyncFragmentsIncrementally(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	kb *kbentity.KnowledgeBase,
	collectionName string,
	fragments []*fragmodel.KnowledgeBaseFragment,
	businessParams *ctxmeta.BusinessParams,
) (err error) {
	trace := newDocumentSyncTracer(s, document.SyncModeResync)
	trace.withDocument(doc)
	resyncStartedAt := time.Now()
	defer func() {
		trace.log(
			ctx,
			"incremental_resync_total",
			resyncStartedAt,
			err,
			"collection_name", collectionName,
			"candidate_fragment_count", len(fragments),
		)
	}()

	listStartedAt := time.Now()
	existingFragments, err := s.listAllFragmentsByDocument(ctx, doc.KnowledgeBaseCode, doc.Code)
	trace.log(
		ctx,
		"list_existing_fragments",
		listStartedAt,
		err,
		"existing_fragment_count", len(existingFragments),
		"collection_name", collectionName,
	)
	if err != nil {
		return fmt.Errorf("list existing fragments: %w", err)
	}

	_, rebuildOverrideEnabled := knowledgeroute.ResolveRebuildOverride(ctx)
	planStartedAt := time.Now()
	plan, err := fragdomain.BuildFragmentResyncPlan(existingFragments, fragments, true)
	trace.log(
		ctx,
		"build_fragment_resync_plan",
		planStartedAt,
		err,
		"changed_count", len(plan.Changed),
		"added_count", len(plan.Added),
		"deleted_count", len(plan.Deleted),
		"unchanged_count", len(plan.Unchanged),
		"rekeyed_point_count", len(plan.RekeyedPointIDs),
		"missing_point_backfill", true,
		"rebuild_override_enabled", rebuildOverrideEnabled,
	)
	if err != nil {
		return fmt.Errorf("build fragment resync plan: %w", err)
	}
	plan, err = s.maybeApplyMissingPointBackfill(ctx, trace, collectionName, plan)
	if err != nil {
		return err
	}

	return s.applyFragmentResyncPlan(ctx, trace, kb, collectionName, plan, businessParams)
}

func (s *DocumentAppService) maybeApplyMissingPointBackfill(
	ctx context.Context,
	trace *documentSyncTracer,
	collectionName string,
	plan fragdomain.FragmentResyncPlan,
) (fragdomain.FragmentResyncPlan, error) {
	backfillStartedAt := time.Now()
	missingPointIDs, err := s.listExistingPointIDs(ctx, collectionName, plan.Unchanged)
	trace.log(
		ctx,
		"resolve_missing_point_backfill",
		backfillStartedAt,
		err,
		"collection_name", collectionName,
		"candidate_count", len(plan.Unchanged),
	)
	if err != nil {
		return fragdomain.FragmentResyncPlan{}, fmt.Errorf("resolve missing point backfill: %w", err)
	}

	beforeChanged := len(plan.Changed)
	plan = fragdomain.ApplyMissingPointBackfill(plan, missingPointIDs)
	backfillCount := len(plan.Changed) - beforeChanged
	if backfillCount <= 0 || s.logger == nil {
		return plan, nil
	}

	s.logger.InfoContext(
		ctx,
		"Backfill missing vector points during incremental resync",
		"collection_name", collectionName,
		"candidate_count", len(plan.Unchanged),
		"backfill_count", backfillCount,
		"document_code", trace.doc.Code,
		"knowledge_base_code", trace.doc.KnowledgeBaseCode,
	)
	return plan, nil
}

func (s *DocumentAppService) applyFragmentResyncPlan(
	ctx context.Context,
	trace *documentSyncTracer,
	kb *kbentity.KnowledgeBase,
	collectionName string,
	plan fragdomain.FragmentResyncPlan,
	businessParams *ctxmeta.BusinessParams,
) error {
	if err := s.updateChangedFragments(ctx, trace, plan.Changed); err != nil {
		return err
	}
	if err := s.saveAddedFragments(ctx, trace, plan.Added); err != nil {
		return err
	}
	if err := s.syncChangedOrAddedFragments(ctx, trace, kb, collectionName, plan, businessParams); err != nil {
		return err
	}
	if err := s.deleteLegacyResyncedPoints(ctx, trace, collectionName, plan.RekeyedPointIDs); err != nil {
		return err
	}
	return s.deleteRemovedResyncFragments(ctx, trace, collectionName, plan.Deleted)
}

func (s *DocumentAppService) updateChangedFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	changed []*fragmodel.KnowledgeBaseFragment,
) error {
	startedAt := time.Now()
	if err := s.fragmentService.UpdateBatch(ctx, changed); err != nil {
		trace.log(ctx, "update_changed_fragments", startedAt, err, "changed_count", len(changed))
		return fmt.Errorf("update changed fragments: %w", err)
	}
	trace.log(ctx, "update_changed_fragments", startedAt, nil, "changed_count", len(changed))
	return nil
}

func (s *DocumentAppService) saveAddedFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	added []*fragmodel.KnowledgeBaseFragment,
) error {
	startedAt := time.Now()
	if err := s.fragmentService.SaveBatch(ctx, added); err != nil {
		trace.log(ctx, "save_added_fragments", startedAt, err, "added_count", len(added))
		return fmt.Errorf("save added fragments: %w", err)
	}
	trace.log(ctx, "save_added_fragments", startedAt, nil, "added_count", len(added))
	return nil
}

func (s *DocumentAppService) syncChangedOrAddedFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	kb *kbentity.KnowledgeBase,
	collectionName string,
	plan fragdomain.FragmentResyncPlan,
	businessParams *ctxmeta.BusinessParams,
) error {
	fragmentsToSync := make([]*fragmodel.KnowledgeBaseFragment, 0, len(plan.Changed)+len(plan.Added))
	fragmentsToSync = append(fragmentsToSync, plan.Changed...)
	fragmentsToSync = append(fragmentsToSync, plan.Added...)

	startedAt := time.Now()
	if err := s.fragmentService.SyncFragmentBatch(ctx, knowledgeBaseSnapshotFromDomain(kb), fragmentsToSync, businessParams); err != nil {
		trace.log(
			ctx,
			"sync_changed_or_added_fragments",
			startedAt,
			err,
			"sync_fragment_count", len(fragmentsToSync),
			"collection_name", collectionName,
		)
		return fmt.Errorf("sync changed or added fragments: %w", err)
	}
	trace.log(
		ctx,
		"sync_changed_or_added_fragments",
		startedAt,
		nil,
		"sync_fragment_count", len(fragmentsToSync),
		"collection_name", collectionName,
	)
	return nil
}

func (s *DocumentAppService) deleteLegacyResyncedPoints(
	ctx context.Context,
	trace *documentSyncTracer,
	collectionName string,
	rekeyedPointIDs []string,
) error {
	startedAt := time.Now()
	if err := s.fragmentService.DeletePointDataBatch(ctx, collectionName, trace.doc.KnowledgeBaseCode, rekeyedPointIDs); err != nil {
		trace.log(
			ctx,
			"delete_legacy_point_data",
			startedAt,
			err,
			"collection_name", collectionName,
			"rekeyed_point_count", len(rekeyedPointIDs),
		)
		return fmt.Errorf("delete legacy point data: %w", err)
	}
	trace.log(
		ctx,
		"delete_legacy_point_data",
		startedAt,
		nil,
		"collection_name", collectionName,
		"rekeyed_point_count", len(rekeyedPointIDs),
	)
	return nil
}

func (s *DocumentAppService) deleteRemovedResyncFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	collectionName string,
	deleted []*fragmodel.KnowledgeBaseFragment,
) error {
	startedAt := time.Now()
	if err := s.fragmentService.DestroyBatch(ctx, deleted, collectionName); err != nil {
		trace.log(
			ctx,
			"delete_removed_fragments",
			startedAt,
			err,
			"collection_name", collectionName,
			"deleted_count", len(deleted),
		)
		return fmt.Errorf("delete removed fragments: %w", err)
	}
	trace.log(
		ctx,
		"delete_removed_fragments",
		startedAt,
		nil,
		"collection_name", collectionName,
		"deleted_count", len(deleted),
	)
	return nil
}

func (s *DocumentAppService) listExistingPointIDs(
	ctx context.Context,
	collectionName string,
	candidates []*fragmodel.KnowledgeBaseFragment,
) (map[string]struct{}, error) {
	if len(candidates) == 0 {
		return map[string]struct{}{}, nil
	}

	pointIDs := make([]string, 0, len(candidates))
	for _, fragment := range candidates {
		if fragment == nil || strings.TrimSpace(fragment.PointID) == "" {
			continue
		}
		pointIDs = append(pointIDs, fragment.PointID)
	}

	existingPointIDs, err := s.fragmentService.ListExistingPointIDs(ctx, collectionName, pointIDs)
	if err != nil {
		return nil, fmt.Errorf("list existing point ids: %w", err)
	}
	return existingPointIDs, nil
}

func (s *DocumentAppService) listAllFragmentsByDocument(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	all := make([]*fragmodel.KnowledgeBaseFragment, 0, fragmentResyncPageSize)
	var lastID int64
	for {
		fragments, err := s.fragmentService.ListByDocumentAfterID(ctx, knowledgeCode, documentCode, lastID, fragmentResyncPageSize)
		if err != nil {
			return nil, fmt.Errorf("list fragments by document: %w", err)
		}
		all = append(all, fragments...)
		if len(fragments) == 0 {
			return all, nil
		}
		lastID = fragments[len(fragments)-1].ID
	}
}
