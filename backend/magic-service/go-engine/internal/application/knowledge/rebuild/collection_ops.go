package rebuild

import (
	"context"
	"fmt"
	"strings"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

func (r *Runner) runInplace(ctx context.Context, runID string, opts rebuilddto.RunOptions, result *rebuilddto.RunResult, scope domainrebuild.Scope) error {
	activePhysicalCollection := strings.TrimSpace(result.PreviousCollection)
	if activePhysicalCollection == "" {
		activePhysicalCollection = strings.TrimSpace(result.ActiveCollection)
	}
	if activePhysicalCollection != strings.TrimSpace(result.ActiveCollection) {
		if err := r.ensureLogicalAliasPointsTo(ctx, result.ActiveCollection, activePhysicalCollection); err != nil {
			return fmt.Errorf("ensure active alias before inplace resync: %w", err)
		}
	}
	if err := r.ensureCollectionPayloadIndexes(ctx, activePhysicalCollection); err != nil {
		return fmt.Errorf("ensure inplace collection payload indexes: %w", err)
	}

	if err := r.saveJob(ctx, runID, "running", "inplace_reset_status", "", nil); err != nil {
		return err
	}
	stats, err := r.store.ResetSyncStatus(ctx, scope)
	if err != nil {
		return fmt.Errorf("reset sync status: %w", err)
	}
	result.ResetStats = rebuilddto.MigrationStatsFromDomain(stats)

	if err := r.saveJob(ctx, runID, "running", "inplace_resync", "", nil); err != nil {
		return err
	}
	summary, err := r.resyncAllDocuments(ctx, runID, opts, scope, resyncTarget{
		Collection:     result.ActiveCollection,
		TermCollection: activePhysicalCollection,
		Model:          result.TargetModel,
		SparseBackend:  result.TargetSparseBackend,
	})
	applyResyncSummary(result, summary)
	if err != nil {
		return err
	}
	if err := validateResyncSummary(scope, summary); err != nil {
		return err
	}

	if err := r.saveJob(ctx, runID, "running", "inplace_update_collection_meta", "", nil); err != nil {
		return err
	}
	metaDim := result.ActiveDimension
	if result.TargetDimension > 0 {
		metaDim = result.TargetDimension
	}
	if metaDim <= 0 {
		detectedDim, detectErr := r.detectCollectionDimension(ctx, result.ActiveCollection)
		if detectErr != nil {
			return fmt.Errorf("detect inplace collection dimension: %w", detectErr)
		}
		metaDim = detectedDim
	}
	if err := r.upsertCollectionMeta(ctx, sharedroute.CollectionMeta{
		CollectionName:         result.ActiveCollection,
		PhysicalCollectionName: activePhysicalCollection,
		Model:                  result.TargetModel,
		VectorDimension:        metaDim,
		SparseBackend:          result.TargetSparseBackend,
	}); err != nil {
		return err
	}
	if err := r.updateScopeEmbeddingModelMetadata(ctx, runID, scope, result.TargetModel); err != nil {
		return err
	}
	result.ActiveModel = result.TargetModel
	result.ActiveSparseBackend = result.TargetSparseBackend
	result.ActiveDimension = metaDim
	result.PreviousCollection = activePhysicalCollection
	result.ActivePhysicalCollection = activePhysicalCollection
	return nil
}

func (r *Runner) runBlueGreen(ctx context.Context, runID string, opts rebuilddto.RunOptions, result *rebuilddto.RunResult, scope domainrebuild.Scope) error {
	if result.TargetDimension <= 0 {
		return errBlueGreenTargetDimensionRequired
	}

	previousPhysicalCollection := strings.TrimSpace(result.PreviousCollection)
	newCollection := domainrebuild.ResolveFixedBlueGreenTarget(previousPhysicalCollection, result.Bootstrap, fixedActiveCollection, fixedShadowCollection)
	standbyCollection := domainrebuild.ResolveStandbyCollection(newCollection, fixedActiveCollection, fixedShadowCollection)
	result.ShadowCollection = newCollection
	result.TargetPhysicalCollection = newCollection
	cleanupShadow := true
	defer func() {
		if cleanupShadow {
			r.cleanupCollectionAndTerms(ctx, newCollection, "Cleanup failed shadow collection")
		}
	}()

	if err := r.saveJob(ctx, runID, "running", "bluegreen_prepare_target", "", map[string]any{
		"target_collection": newCollection,
	}); err != nil {
		return err
	}
	if err := r.prepareReusableTargetSlot(ctx, newCollection, result.TargetDimension); err != nil {
		return err
	}

	if err := r.saveJob(ctx, runID, "running", "bluegreen_resync", "", nil); err != nil {
		return err
	}
	summary, err := r.resyncAllDocuments(ctx, runID, opts, scope, resyncTarget{
		Collection:     newCollection,
		TermCollection: newCollection,
		Model:          result.TargetModel,
		SparseBackend:  result.TargetSparseBackend,
	})
	applyResyncSummary(result, summary)
	if err != nil {
		return err
	}
	if err := validateBlueGreenCutover(scope, summary, newCollection); err != nil {
		return err
	}
	if err := r.validateBlueGreenTargetCollection(ctx, newCollection); err != nil {
		return err
	}

	if err := r.saveJob(ctx, runID, "running", "bluegreen_switch_collection_meta", "", nil); err != nil {
		return err
	}
	if err := r.ensureLogicalAliasPointsTo(ctx, result.ActiveCollection, newCollection); err != nil {
		return fmt.Errorf("swap active alias to shadow collection: %w", err)
	}
	if err := r.upsertCollectionMeta(ctx, sharedroute.CollectionMeta{
		CollectionName:         result.ActiveCollection,
		PhysicalCollectionName: newCollection,
		Model:                  result.TargetModel,
		VectorDimension:        result.TargetDimension,
		SparseBackend:          result.TargetSparseBackend,
	}); err != nil {
		r.rollbackAliasCutover(ctx, result.ActiveCollection, previousPhysicalCollection, newCollection)
		return err
	}
	result.ActiveModel = result.TargetModel
	result.ActiveSparseBackend = result.TargetSparseBackend
	result.ActiveDimension = result.TargetDimension
	result.PreviousCollection = previousPhysicalCollection
	result.ActivePhysicalCollection = newCollection
	result.PhysicalNameNormalized = result.LegacyPhysicalCollectionDetected && previousPhysicalCollection != "" && previousPhysicalCollection != newCollection
	cleanupShadow = false
	if err := r.updateScopeEmbeddingModelMetadata(ctx, runID, scope, result.TargetModel); err != nil {
		return err
	}

	r.cleanupPreviousCollection(ctx, previousPhysicalCollection, newCollection, result)
	r.prepareStandbySlot(ctx, standbyCollection, result.TargetDimension, result)
	return nil
}

func (r *Runner) upsertCollectionMeta(ctx context.Context, meta sharedroute.CollectionMeta) error {
	if r.collectionMeta == nil {
		return sharedroute.ErrCollectionMetaWriterNotConfigured
	}
	if err := r.collectionMeta.Upsert(ctx, meta); err != nil {
		return fmt.Errorf("upsert collection meta: %w", err)
	}
	return nil
}

func (r *Runner) updateScopeEmbeddingModelMetadata(ctx context.Context, runID string, scope domainrebuild.Scope, model string) error {
	if strings.TrimSpace(model) == "" {
		return nil
	}
	if err := r.saveJob(ctx, runID, "running", "update_scope_embedding_model_metadata", "", map[string]any{
		"target_model": model,
	}); err != nil {
		return err
	}
	if _, err := r.store.UpdateModel(ctx, scope, model); err != nil {
		return fmt.Errorf("update scoped embedding model metadata: %w", err)
	}
	return nil
}

func (r *Runner) prepareTargetCollection(ctx context.Context, collectionName string, targetDimension int64) error {
	exists, err := r.collections.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("check target collection existence: %w", err)
	}
	if !exists {
		if createErr := r.collections.CreateCollection(ctx, collectionName, targetDimension); createErr != nil {
			return fmt.Errorf("create target collection: %w", createErr)
		}
		return r.ensureCollectionPayloadIndexes(ctx, collectionName)
	}

	info, infoErr := r.collections.GetCollectionInfo(ctx, collectionName)
	if infoErr != nil {
		return fmt.Errorf("get target collection info: %w", infoErr)
	}
	if info != nil && info.VectorSize != targetDimension {
		return fmt.Errorf(
			"%w: collection=%s expected=%d actual=%d",
			errTargetCollectionDimensionMismatch,
			collectionName,
			targetDimension,
			info.VectorSize,
		)
	}
	return r.ensureCollectionPayloadIndexes(ctx, collectionName)
}

func (r *Runner) prepareReusableTargetSlot(ctx context.Context, collectionName string, targetDimension int64) error {
	exists, err := r.collections.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("check reusable target slot existence: %w", err)
	}
	var info *domainrebuild.VectorCollectionInfo
	if exists {
		info, err = r.collections.GetCollectionInfo(ctx, collectionName)
		if err != nil {
			return fmt.Errorf("get reusable target slot info: %w", err)
		}
	}
	plan := domainrebuild.BuildReusableTargetSlotPlan(exists, info, targetDimension)
	switch {
	case plan.Create:
		return r.prepareTargetCollection(ctx, collectionName, targetDimension)
	case plan.Recreate:
		if err := r.deleteCollectionAndTerms(ctx, collectionName); err != nil {
			return fmt.Errorf("recreate reusable target slot %s: %w", collectionName, err)
		}
		return r.prepareTargetCollection(ctx, collectionName, targetDimension)
	case plan.ClearPoints:
		if err := r.collections.DeletePointsByFilter(ctx, collectionName); err != nil {
			return fmt.Errorf("clear reusable target slot points %s: %w", collectionName, err)
		}
		return r.ensureCollectionPayloadIndexes(ctx, collectionName)
	default:
		return r.ensureCollectionPayloadIndexes(ctx, collectionName)
	}
}

func (r *Runner) ensureCollectionPayloadIndexes(ctx context.Context, collectionName string) error {
	if strings.TrimSpace(collectionName) == "" {
		return nil
	}
	if r.payloadIndexes == nil {
		return errPayloadIndexEnsurerNil
	}
	if err := r.payloadIndexes.EnsurePayloadIndexes(ctx, collectionName, knowledgebasedomain.ExpectedPayloadIndexSpecs()); err != nil {
		return fmt.Errorf("ensure payload indexes for %s: %w", collectionName, err)
	}
	return nil
}

func (r *Runner) cleanupPreviousCollection(
	ctx context.Context,
	previousCollection string,
	activePhysicalCollection string,
	result *rebuilddto.RunResult,
) {
	if result == nil {
		return
	}
	previous := strings.TrimSpace(previousCollection)
	if previous == "" || previous == strings.TrimSpace(activePhysicalCollection) {
		return
	}
	exists, existsErr := r.collections.CollectionExists(ctx, previous)
	if existsErr != nil {
		result.DeletePreviousCollectionWarning = existsErr.Error()
		if r.logger != nil {
			r.logger.KnowledgeWarnContext(ctx, "Check previous collection existence failed after cutover", "previous_collection", previous, "error", existsErr)
		}
		return
	}
	if !exists {
		return
	}

	err := r.deleteCollectionAndTerms(ctx, previous)
	if err == nil {
		result.DeletedPreviousCollection = true
		return
	}
	result.DeletePreviousCollectionWarning = err.Error()
	if r.logger != nil {
		r.logger.KnowledgeWarnContext(ctx, "Delete previous collection failed after cutover", "previous_collection", previous, "error", err)
	}
}

func (r *Runner) prepareStandbySlot(
	ctx context.Context,
	standbyCollection string,
	targetDimension int64,
	result *rebuilddto.RunResult,
) {
	if strings.TrimSpace(standbyCollection) == "" {
		return
	}
	if err := r.prepareReusableTargetSlot(ctx, standbyCollection, targetDimension); err != nil {
		if result != nil {
			result.StandbyCollectionWarning = err.Error()
		}
		if r.logger != nil {
			r.logger.KnowledgeWarnContext(
				ctx,
				"Prepare standby collection failed after cutover",
				"standby_collection", standbyCollection,
				"error", err,
			)
		}
		return
	}
	if result != nil {
		result.StandbyCollection = standbyCollection
	}
}

func validateBlueGreenCutover(scope domainrebuild.Scope, summary resyncSummary, targetInfoCollection string) error {
	if err := domainrebuild.ValidateBlueGreenCutover(scope, domainrebuild.ResyncSummary{
		TotalDocs:  summary.TotalDocs,
		FailedDocs: summary.FailedDocs,
	}, targetInfoCollection); err != nil {
		return fmt.Errorf("validate bluegreen cutover: %w", err)
	}
	return nil
}

func (r *Runner) validateBlueGreenTargetCollection(ctx context.Context, collectionName string) error {
	info, err := r.collections.GetCollectionInfo(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("get bluegreen target collection info: %w", err)
	}
	if info == nil || !info.HasNamedDenseVector || !info.HasSparseVector {
		return fmt.Errorf("%w: collection=%s", errBlueGreenTargetSchemaIncomplete, collectionName)
	}
	if info.Points <= 0 {
		return fmt.Errorf("%w: collection=%s", errBlueGreenTargetEmpty, collectionName)
	}
	return nil
}

func (r *Runner) rollbackAliasCutover(ctx context.Context, alias, previousPhysicalCollection, newCollection string) {
	var err error
	if strings.TrimSpace(previousPhysicalCollection) == "" {
		err = r.collections.DeleteAlias(ctx, alias)
	} else {
		err = r.collections.SwapAliasAtomically(ctx, alias, newCollection, previousPhysicalCollection)
	}
	if err == nil || r.logger == nil {
		return
	}
	r.logger.KnowledgeWarnContext(
		ctx,
		"Rollback active alias after collection meta failure failed",
		"alias", alias,
		"previous_collection", previousPhysicalCollection,
		"new_collection", newCollection,
		"error", err,
	)
}

// ensureLogicalAliasPointsTo makes the stable logical collection name point to the target
// physical collection. It also cleans up legacy same-name collections that would otherwise
// block alias creation after the system migrated to fixed active/shadow slots.
func (r *Runner) ensureLogicalAliasPointsTo(ctx context.Context, alias, target string) error {
	alias = strings.TrimSpace(alias)
	target = strings.TrimSpace(target)
	if alias == "" || target == "" || alias == target {
		return nil
	}

	currentTarget, aliasExists, err := r.collections.GetAliasTarget(ctx, alias)
	if err != nil {
		return fmt.Errorf("get current alias target: %w", err)
	}
	currentTarget = strings.TrimSpace(currentTarget)
	if aliasExists && currentTarget == target {
		return nil
	}

	if !aliasExists {
		if err := r.deleteConflictingLegacyLogicalCollection(ctx, alias, target); err != nil {
			return err
		}
		if err := r.collections.EnsureAlias(ctx, alias, target); err != nil {
			return fmt.Errorf("ensure alias %s -> %s: %w", alias, target, err)
		}
		return nil
	}

	if err := r.collections.SwapAliasAtomically(ctx, alias, currentTarget, target); err != nil {
		return fmt.Errorf("swap alias %s from %s to %s: %w", alias, currentTarget, target, err)
	}
	return nil
}

func (r *Runner) deleteConflictingLegacyLogicalCollection(ctx context.Context, alias, target string) error {
	if alias == "" || target == "" || alias == target {
		return nil
	}

	exists, err := r.collections.CollectionExists(ctx, alias)
	if err != nil {
		return fmt.Errorf("check legacy conflicting collection %s: %w", alias, err)
	}
	if !exists {
		return nil
	}

	if err := r.deleteCollectionAndTerms(ctx, alias); err != nil {
		return fmt.Errorf("delete legacy conflicting collection %s before alias creation: %w", alias, err)
	}

	if r.logger != nil {
		r.logger.KnowledgeWarnContext(
			ctx,
			"Deleted legacy collection occupying logical alias name before alias creation",
			"alias", alias,
			"target_collection", target,
		)
	}

	return nil
}

func (r *Runner) deleteCollectionAndTerms(ctx context.Context, collectionName string) error {
	if err := r.collections.DeleteCollection(ctx, collectionName); err != nil {
		return fmt.Errorf("delete collection %s: %w", collectionName, err)
	}
	return nil
}

func (r *Runner) cleanupCollectionAndTerms(ctx context.Context, collectionName, logMessage string) {
	if strings.TrimSpace(collectionName) == "" {
		return
	}
	if err := r.deleteCollectionAndTerms(ctx, collectionName); err != nil && r.logger != nil {
		r.logger.KnowledgeWarnContext(ctx, logMessage, "collection", collectionName, "error", err)
	}
}
