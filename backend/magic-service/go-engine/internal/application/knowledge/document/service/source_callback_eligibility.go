package docapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/projectfile"
)

const (
	sourceCallbackReasonRealtimeBinding              = "realtime_binding"
	sourceCallbackReasonRealtimeMaterializedDocument = "realtime_materialized_document"
	sourceCallbackReasonNoRealtimeBinding            = "no_realtime_binding"
	sourceCallbackReasonNoRealtimeDocument           = "no_realtime_document"
	sourceCallbackReasonProjectFileDirectory         = "project_file_directory_without_document"
	sourceCallbackReasonProjectFileInactive          = "project_file_inactive_without_document"
	sourceCallbackReasonProjectFileMissingMeta       = "project_file_meta_missing"
)

func (s *ProjectFileChangeAppService) shouldScheduleProjectFileChange(
	ctx context.Context,
	input *docdto.NotifyProjectFileChangeInput,
) (sourcebindingrepository.SourceCallbackEligibilityDecision, error) {
	if s == nil || s.support == nil || input == nil || input.ProjectFileID <= 0 {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileMissingMeta), nil
	}

	meta, err := s.support.loadProjectFileChangeMeta(ctx, input)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, err
	}
	if meta == nil {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileMissingMeta), nil
	}
	meta = documentdomain.NormalizeKnowledgeBaseProjectFileMeta(meta)
	if meta == nil || strings.TrimSpace(meta.OrganizationCode) == "" || meta.ProjectID <= 0 || meta.ProjectFileID <= 0 {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileMissingMeta), nil
	}

	decision, err := s.computeProjectFileChangeEligibility(ctx, meta)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, err
	}
	return decision, nil
}

func (s *ProjectFileChangeAppService) computeProjectFileChangeEligibility(
	ctx context.Context,
	meta *projectfile.Meta,
) (sourcebindingrepository.SourceCallbackEligibilityDecision, error) {
	if s == nil || s.support == nil || meta == nil {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileMissingMeta), nil
	}

	hasDocument, err := s.support.domainService.HasRealtimeProjectFileDocumentInOrg(
		ctx,
		meta.OrganizationCode,
		meta.ProjectFileID,
	)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, fmt.Errorf("check realtime project-file document: %w", err)
	}
	if hasDocument {
		return newSourceCallbackEligibilityDecision(true, sourceCallbackReasonRealtimeMaterializedDocument), nil
	}

	if meta.IsDirectory {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileDirectory), nil
	}
	if projectfile.IsDeletedResolveStatus(meta.Status) || projectfile.IsUnsupportedResolveStatus(meta.Status) {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonProjectFileInactive), nil
	}

	if s.support.sourceBindingRepo == nil {
		return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonNoRealtimeBinding), nil
	}
	bindings, err := s.support.listRealtimeProjectBindings(ctx, meta.OrganizationCode, meta.ProjectID)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, fmt.Errorf("check realtime project source binding: %w", err)
	}
	ancestorRefs, err := s.support.loadProjectFileAncestorFolderRefs(ctx, meta)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, err
	}
	if len(filterProjectFileBindingRefsByCoverage(buildProjectFileBindingRefs(bindings), meta, ancestorRefs)) > 0 {
		return newSourceCallbackEligibilityDecision(true, sourceCallbackReasonRealtimeBinding), nil
	}
	return newSourceCallbackEligibilityDecision(false, sourceCallbackReasonNoRealtimeBinding), nil
}

func (s *ProjectFileChangeAppService) logSkippedProjectFileChange(
	ctx context.Context,
	input *docdto.NotifyProjectFileChangeInput,
	decision sourcebindingrepository.SourceCallbackEligibilityDecision,
) {
	if s == nil || s.support == nil || s.support.logger == nil || input == nil {
		return
	}
	s.support.logger.InfoContext(
		ctx,
		"Skip project-file change before mq because source is not realtime eligible",
		"project_file_id", input.ProjectFileID,
		"skip_reason", decision.Reason,
		"checked_at", decision.CheckedAt,
		"mode", documentdomain.SyncModeResync,
	)
}

func (s *ThirdFileRevectorizeAppService) shouldScheduleThirdFileRevectorize(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) (sourcebindingrepository.SourceCallbackEligibilityDecision, error) {
	task = documentdomain.NormalizeThirdFileRevectorizeInput(task)
	if task == nil || task.OrganizationCode == "" || task.ThirdPlatformType == "" || task.ThirdFileID == "" {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, shared.ErrDocumentNotFound
	}

	hasDocument, err := s.support.domainService.HasRealtimeThirdFileDocumentInOrg(
		ctx,
		task.OrganizationCode,
		task.ThirdPlatformType,
		task.ThirdFileID,
	)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, fmt.Errorf("check realtime third-file document: %w", err)
	}
	decision := newSourceCallbackEligibilityDecision(hasDocument, sourceCallbackReasonNoRealtimeDocument)
	if hasDocument {
		decision.Reason = sourceCallbackReasonRealtimeMaterializedDocument
		return decision, nil
	}
	covering, err := s.resolveThirdFileCoveringBindings(ctx, task)
	if err != nil {
		return sourcebindingrepository.SourceCallbackEligibilityDecision{}, err
	}
	if len(covering) > 0 {
		decision = newSourceCallbackEligibilityDecision(true, sourceCallbackReasonRealtimeBinding)
		return decision, nil
	}
	return decision, nil
}

func (s *ThirdFileRevectorizeAppService) logSkippedThirdFileBeforeMQ(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	decision sourcebindingrepository.SourceCallbackEligibilityDecision,
) {
	if s == nil || s.support == nil || s.support.logger == nil || task == nil {
		return
	}
	s.support.logger.InfoContext(
		ctx,
		"Skip third-file revectorize before mq because source is not realtime eligible",
		"organization_code", task.OrganizationCode,
		"third_platform_type", task.ThirdPlatformType,
		"third_file_id", task.ThirdFileID,
		"skip_reason", decision.Reason,
		"checked_at", decision.CheckedAt,
		"task_kind", thirdFileRevectorizeTaskKind,
		"mode", documentdomain.SyncModeResync,
	)
}

func newSourceCallbackEligibilityDecision(eligible bool, reason string) sourcebindingrepository.SourceCallbackEligibilityDecision {
	return sourcebindingrepository.SourceCallbackEligibilityDecision{
		Eligible:  eligible,
		Reason:    reason,
		CheckedAt: time.Now().Unix(),
	}
}
