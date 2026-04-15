package rebuild

import (
	"context"
	"fmt"
	"strings"
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/constants"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

// Run 执行一次知识库重建任务。
func (r *Runner) Run(ctx context.Context, opts rebuilddto.RunOptions) (*rebuilddto.RunResult, error) {
	requestedConcurrency := opts.Concurrency
	opts = normalizeRunOptions(opts, r.isLocalDev, r.now, r.maxConcurrency)
	if requestedConcurrency > opts.Concurrency && r.logger != nil {
		r.logger.InfoContext(
			ctx,
			"Knowledge rebuild concurrency clamped by server config",
			"requested_concurrency", requestedConcurrency,
			"effective_concurrency", opts.Concurrency,
			"max_concurrency", r.maxConcurrency,
		)
	}
	if opts.Mode != rebuilddto.ModeAuto && opts.Mode != rebuilddto.ModeInplace && opts.Mode != rebuilddto.ModeBlueGreen {
		return nil, fmt.Errorf("%w: %s", errInvalidMode, opts.Mode)
	}

	runID := strings.TrimSpace(opts.ResumeRunID)
	if runID == "" {
		runID = fmt.Sprintf("r%d", r.now().UnixNano())
	}
	cleanupRun, err := r.acquireRunLease(ctx, runID, opts.HeartbeatInterval)
	if err != nil {
		return nil, err
	}
	defer cleanupRun()

	result, selectedMode, effectiveScope, err := r.prepareRun(ctx, runID, opts)
	if err != nil {
		return nil, err
	}
	requestedMode := opts.Mode
	if err := r.recordRunStart(ctx, runID, requestedMode, selectedMode, *result); err != nil {
		return nil, err
	}

	switch selectedMode {
	case rebuilddto.ModeInplace:
		if err := r.runInplace(ctx, runID, opts, result, effectiveScope); err != nil {
			return r.failRun(ctx, runID, "inplace", opts, result, err)
		}
	case rebuilddto.ModeBlueGreen:
		if err := r.runBlueGreen(ctx, runID, opts, result, effectiveScope); err != nil {
			return r.failRun(ctx, runID, "bluegreen", opts, result, err)
		}
	default:
		return nil, fmt.Errorf("%w: %s", errInvalidMode, selectedMode)
	}

	if err := r.completeRun(ctx, runID, selectedMode, opts, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Runner) acquireRunLease(ctx context.Context, runID string, heartbeatInterval time.Duration) (func(), error) {
	lockOwner := "knowledge-rebuild:" + runID
	ok, err := r.coordinator.AcquireLock(ctx, lockOwner, defaultLockTTL)
	if err != nil {
		return nil, fmt.Errorf("acquire rebuild lock: %w", err)
	}
	if !ok {
		return nil, errRunnerAlreadyRunning
	}

	_ = r.coordinator.SetCurrentRun(ctx, runID)
	if heartbeatInterval <= 0 {
		heartbeatInterval = defaultHeartbeatInterval
	}
	stopHeartbeat := r.startRunHeartbeat(ctx, runID, lockOwner, heartbeatInterval)
	return func() {
		_ = r.coordinator.ClearCurrentRun(ctx, runID)
		stopHeartbeat()
		_ = r.coordinator.ReleaseLock(ctx, lockOwner)
	}, nil
}

func (r *Runner) prepareRun(ctx context.Context, runID string, opts rebuilddto.RunOptions) (*rebuilddto.RunResult, rebuilddto.RunMode, domainrebuild.Scope, error) {
	meta, err := r.store.GetCollectionMeta(ctx)
	if err != nil {
		return nil, "", domainrebuild.Scope{}, fmt.Errorf("get collection meta: %w", err)
	}
	targetSparseBackend := r.currentTargetSparseBackend()

	requestedScope := domainrebuild.NormalizeScope(opts.Scope.ToDomain())
	effectiveScope, scopeEscalated, scopeEscalationReason := domainrebuild.DetermineEffectiveScope(requestedScope, !meta.Exists)

	activeState, err := r.resolveActiveCollectionState(ctx, meta)
	if err != nil {
		return nil, "", domainrebuild.Scope{}, err
	}
	activeCollection := activeState.Alias
	activeModel := activeState.Model
	activeDimension := activeState.Dimension
	bootstrap := activeState.Bootstrap

	opts.TargetModel = domainrebuild.ResolveRequestedTargetModel(opts.TargetModel, meta)
	selectedMode := rebuilddto.RunMode(domainrebuild.SelectMode(domainrebuild.RunMode(opts.Mode), meta, opts.TargetModel, targetSparseBackend))
	switch {
	case bootstrap:
		selectedMode = rebuilddto.ModeBlueGreen
	case activeState.NeedsNormalization:
		selectedMode = rebuilddto.ModeBlueGreen
	case !activeState.SchemaOK && selectedMode == rebuilddto.ModeInplace:
		selectedMode = rebuilddto.ModeBlueGreen
	}

	targetDimension, err := r.resolveTargetDimension(ctx, opts, selectedMode)
	if err != nil {
		return nil, "", domainrebuild.Scope{}, err
	}
	if selectedMode == rebuilddto.ModeInplace {
		if err := domainrebuild.ValidateInplaceTargetDimension(activeCollection, activeDimension, opts.TargetDimension); err != nil {
			return nil, "", domainrebuild.Scope{}, fmt.Errorf("validate inplace target dimension: %w", err)
		}
	}

	requestedScopeDTO := rebuilddto.ScopeFromDomain(requestedScope)
	effectiveScopeDTO := rebuilddto.ScopeFromDomain(effectiveScope)
	result := &rebuilddto.RunResult{
		RunID:                            runID,
		RequestedMode:                    opts.Mode,
		SelectedMode:                     selectedMode,
		RequestedScopeMode:               requestedScopeDTO.Mode,
		RequestedScopeOrg:                requestedScopeDTO.OrganizationCode,
		ScopeMode:                        effectiveScopeDTO.Mode,
		ScopeOrg:                         effectiveScopeDTO.OrganizationCode,
		ScopeEscalated:                   scopeEscalated,
		ScopeEscalationReason:            scopeEscalationReason,
		Bootstrap:                        bootstrap,
		TargetModel:                      opts.TargetModel,
		TargetSparseBackend:              targetSparseBackend,
		TargetDimension:                  targetDimension,
		ActiveModel:                      activeModel,
		ActiveSparseBackend:              fragmodel.NormalizeSparseBackend(meta.SparseBackend),
		ActiveDimension:                  activeDimension,
		ActiveCollection:                 activeCollection,
		ActivePhysicalCollection:         activeState.PhysicalCollection,
		LegacyPhysicalCollectionDetected: activeState.NeedsNormalization,
		PreviousCollection:               activeState.PhysicalCollection,
		Failures:                         make([]rebuilddto.FailureRecord, 0),
		StartedAt:                        r.now(),
	}
	return result, selectedMode, effectiveScope, nil
}

func (r *Runner) resolveActiveCollectionState(
	ctx context.Context,
	meta domainrebuild.CollectionMeta,
) (activeCollectionState, error) {
	aliasTarget := ""
	loadedAliasTarget, exists, err := r.collections.GetAliasTarget(ctx, constants.KnowledgeBaseCollectionName)
	if err != nil {
		return activeCollectionState{}, fmt.Errorf("get active alias target: %w", err)
	}
	if exists {
		aliasTarget = loadedAliasTarget
	}
	var info *domainrebuild.VectorCollectionInfo
	if physical := strings.TrimSpace(firstNonEmptyPhysicalCollection(aliasTarget, meta.PhysicalCollectionName, meta.CollectionName)); physical != "" {
		loaded, err := r.collections.GetCollectionInfo(ctx, physical)
		if err != nil {
			return activeCollectionState{}, fmt.Errorf("get active collection info: %w", err)
		}
		info = loaded
	}
	resolved := domainrebuild.ResolveActiveCollectionState(meta, constants.KnowledgeBaseCollectionName, aliasTarget, info, fixedActiveCollection)
	return activeCollectionState(resolved), nil
}

func firstNonEmptyPhysicalCollection(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (r *Runner) resolveTargetDimension(ctx context.Context, opts rebuilddto.RunOptions, selectedMode rebuilddto.RunMode) (int64, error) {
	targetDimension := opts.TargetDimension
	if selectedMode != rebuilddto.ModeBlueGreen {
		return targetDimension, nil
	}
	if targetDimension > 0 {
		return targetDimension, nil
	}
	if r.dimensionResolver == nil {
		return 0, errBlueGreenTargetDimensionRequired
	}
	resolvedDim, err := r.dimensionResolver.ResolveDimension(ctx, opts.TargetModel)
	if err != nil {
		return 0, fmt.Errorf("resolve target dimension for model %s: %w", opts.TargetModel, err)
	}
	if resolvedDim <= 0 {
		return 0, errBlueGreenTargetDimensionRequired
	}
	return resolvedDim, nil
}

func (r *Runner) detectCollectionDimension(ctx context.Context, collection string) (int64, error) {
	info, err := r.collections.GetCollectionInfo(ctx, collection)
	if err != nil {
		return 0, fmt.Errorf("get collection info: %w", err)
	}
	if info == nil {
		return 0, nil
	}
	return info.VectorSize, nil
}

func (r *Runner) recordRunStart(ctx context.Context, runID string, requestedMode, selectedMode rebuilddto.RunMode, result rebuilddto.RunResult) error {
	if r.logger != nil {
		r.logger.InfoContext(
			ctx,
			"Knowledge rebuild started",
			"run_id", runID,
			"requested_mode", requestedMode,
			"selected_mode", selectedMode,
			"requested_scope_mode", result.RequestedScopeMode,
			"requested_scope_org", result.RequestedScopeOrg,
			"scope_mode", result.ScopeMode,
			"scope_org", result.ScopeOrg,
			"scope_escalated", result.ScopeEscalated,
			"scope_escalation_reason", result.ScopeEscalationReason,
			"target_model", result.TargetModel,
			"current_sparse_backend", fragmodel.NormalizeSparseBackend(result.ActiveSparseBackend),
			"target_sparse_backend", result.TargetSparseBackend,
			"target_dimension", result.TargetDimension,
			"active_model", result.ActiveModel,
			"active_dimension", result.ActiveDimension,
			"active_collection", result.ActiveCollection,
			"active_physical_collection", result.ActivePhysicalCollection,
			"legacy_physical_collection_detected", result.LegacyPhysicalCollectionDetected,
			"physical_name_normalized", result.PhysicalNameNormalized,
			"previous_physical_collection", result.PreviousCollection,
			"target_physical_collection", result.TargetPhysicalCollection,
		)
	}

	return r.saveJob(ctx, runID, "running", "start", "", map[string]any{
		"mode":                                selectedMode,
		"requested_scope_mode":                result.RequestedScopeMode,
		"requested_scope_org":                 result.RequestedScopeOrg,
		"scope_mode":                          result.ScopeMode,
		"scope_org":                           result.ScopeOrg,
		"scope_escalated":                     result.ScopeEscalated,
		"scope_escalation_reason":             result.ScopeEscalationReason,
		"bootstrap":                           result.Bootstrap,
		"target_model":                        result.TargetModel,
		"current_sparse_backend":              fragmodel.NormalizeSparseBackend(result.ActiveSparseBackend),
		"target_sparse_backend":               result.TargetSparseBackend,
		"target_dimension":                    result.TargetDimension,
		"active_model":                        result.ActiveModel,
		"active_dimension":                    result.ActiveDimension,
		"active_collection":                   result.ActiveCollection,
		"active_physical_collection":          result.ActivePhysicalCollection,
		"legacy_physical_collection_detected": result.LegacyPhysicalCollectionDetected,
		"physical_name_normalized":            result.PhysicalNameNormalized,
		"previous_physical_collection":        result.PreviousCollection,
		"target_physical_collection":          result.TargetPhysicalCollection,
		"started_at":                          result.StartedAt.Unix(),
	})
}

func (r *Runner) completeRun(ctx context.Context, runID string, selectedMode rebuilddto.RunMode, opts rebuilddto.RunOptions, result *rebuilddto.RunResult) error {
	result.FinishedAt = r.now()
	if err := r.maybeWriteFailureReport(result, opts.FailureReport); err != nil {
		return err
	}
	if err := r.saveJob(ctx, runID, "completed", "done", "", map[string]any{
		"finished_at":                         result.FinishedAt.Unix(),
		"total_docs":                          result.TotalDocs,
		"success_docs":                        result.SuccessDocs,
		"failed_docs":                         result.FailedDocs,
		"scope_mode":                          result.ScopeMode,
		"scope_org":                           result.ScopeOrg,
		"scope_escalated":                     result.ScopeEscalated,
		"scope_escalation_reason":             result.ScopeEscalationReason,
		"deleted_previous_collection":         result.DeletedPreviousCollection,
		"delete_previous_collection_warning":  result.DeletePreviousCollectionWarning,
		"active_physical_collection":          result.ActivePhysicalCollection,
		"legacy_physical_collection_detected": result.LegacyPhysicalCollectionDetected,
		"physical_name_normalized":            result.PhysicalNameNormalized,
		"previous_physical_collection":        result.PreviousCollection,
		"target_physical_collection":          result.TargetPhysicalCollection,
	}); err != nil {
		return err
	}
	if r.logger != nil {
		r.logger.InfoContext(
			ctx,
			"Knowledge rebuild finished",
			"run_id", runID,
			"selected_mode", selectedMode,
			"active_sparse_backend", result.ActiveSparseBackend,
			"target_sparse_backend", result.TargetSparseBackend,
			"scope_mode", result.ScopeMode,
			"scope_org", result.ScopeOrg,
			"scope_escalated", result.ScopeEscalated,
			"scope_escalation_reason", result.ScopeEscalationReason,
			"total_docs", result.TotalDocs,
			"success_docs", result.SuccessDocs,
			"failed_docs", result.FailedDocs,
			"failure_report", result.FailureReport,
			"deleted_previous_collection", result.DeletedPreviousCollection,
			"delete_previous_collection_warning", result.DeletePreviousCollectionWarning,
			"active_physical_collection", result.ActivePhysicalCollection,
			"legacy_physical_collection_detected", result.LegacyPhysicalCollectionDetected,
			"physical_name_normalized", result.PhysicalNameNormalized,
			"previous_physical_collection", result.PreviousCollection,
			"target_physical_collection", result.TargetPhysicalCollection,
		)
	}
	return nil
}

func (r *Runner) failRun(ctx context.Context, runID, phase string, opts rebuilddto.RunOptions, result *rebuilddto.RunResult, err error) (*rebuilddto.RunResult, error) {
	extra := map[string]any{}
	if result != nil {
		result.FinishedAt = r.now()
		extra["scope_mode"] = result.ScopeMode
		extra["scope_org"] = result.ScopeOrg
		extra["scope_escalated"] = result.ScopeEscalated
		extra["scope_escalation_reason"] = result.ScopeEscalationReason
		if writeErr := r.maybeWriteFailureReport(result, opts.FailureReport); writeErr != nil {
			return result, writeErr
		}
		if result.FailureReport != "" {
			extra["failure_report"] = result.FailureReport
		}
		extra["finished_at"] = result.FinishedAt.Unix()
		extra["total_docs"] = result.TotalDocs
		extra["success_docs"] = result.SuccessDocs
		extra["failed_docs"] = result.FailedDocs
	}

	if saveErr := r.saveJob(ctx, runID, "failed", phase, err.Error(), extra); saveErr != nil {
		return result, saveErr
	}
	return result, err
}
