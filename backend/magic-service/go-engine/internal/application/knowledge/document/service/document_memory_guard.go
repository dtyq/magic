package docapp

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/pkg/memoryguard"
	"magic/internal/pkg/memoryprobe"
)

const (
	documentMemoryGuardLogKeyword              = "knowledge_document_memory_guard"
	documentMemoryGuardStage                   = "document_sync_start"
	documentMemoryGuardPostBuildReleaseStage   = "post_build_fragments_memory_release"
	documentMemoryGuardPostBuildAdmissionStage = "post_build_fragments_admission"
	documentMemoryGuardCgroupRatio             = 0.50
	documentMemoryGuardCgroupResumeRatio       = 0.45
	documentMemoryGuardSoftResumeRatio         = 0.90
	documentMemoryGuardPollInterval            = time.Second
)

func (s *DocumentAppService) waitDocumentSyncMemoryAdmission(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) error {
	return s.waitDocumentSyncMemoryAdmissionForStage(ctx, doc, documentMemoryGuardStage)
}

func (s *DocumentAppService) waitDocumentSyncMemoryAdmissionForStage(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	stage string,
) error {
	if s == nil {
		return nil
	}
	limits := s.ResourceLimits()
	guard := memoryguard.NewGuard(memoryguard.Config{
		SoftLimitBytes:             limits.SyncMemorySoftLimitBytes,
		CgroupPressureRatio:        documentMemoryGuardCgroupRatio,
		DisableCgroupPressureRatio: limits.SyncMemorySoftLimitBytes > 0,
	})

	snapshot, err := guard.Check(ctx, stage)
	if shouldFailOpenDocumentMemoryGuard(snapshot, err) {
		s.logDocumentMemoryGuardFailOpen(ctx, doc, snapshot, err)
		return nil
	}
	if err == nil {
		return nil
	}

	s.logDocumentMemoryGuardPaused(ctx, doc, snapshot, err)
	for {
		if err := sleepDocumentMemoryGuard(ctx); err != nil {
			return err
		}
		snapshot, err = guard.Check(ctx, stage)
		if shouldFailOpenDocumentMemoryGuard(snapshot, err) {
			s.logDocumentMemoryGuardFailOpen(ctx, doc, snapshot, err)
			return nil
		}
		if memoryBelowDocumentResumeWaterline(snapshot) {
			s.logDocumentMemoryGuardResumed(ctx, doc, snapshot)
			return nil
		}
	}
}

func (s *DocumentAppService) releaseDocumentSyncBuildMemory(
	ctx context.Context,
	trace *documentSyncTracer,
	fragmentCount int,
) {
	startedAt := time.Now()
	debug.FreeOSMemory()
	if trace == nil {
		return
	}
	trace.log(ctx, documentMemoryGuardPostBuildReleaseStage, startedAt, nil, "fragment_count", fragmentCount)
}

func shouldFailOpenDocumentMemoryGuard(snapshot memoryguard.Snapshot, err error) bool {
	if err != nil {
		return !errors.Is(err, memoryguard.ErrMemoryPressure)
	}
	return !snapshot.CgroupAvailable
}

func memoryBelowDocumentResumeWaterline(snapshot memoryguard.Snapshot) bool {
	if snapshot.CurrentBytes <= 0 {
		return true
	}
	if snapshot.SoftLimitBytes > 0 {
		return snapshot.CurrentBytes <= int64(float64(snapshot.SoftLimitBytes)*documentMemoryGuardSoftResumeRatio)
	}
	if snapshot.LimitBytes > 0 {
		return snapshot.CurrentBytes <= int64(float64(snapshot.LimitBytes)*documentMemoryGuardCgroupResumeRatio)
	}
	return true
}

func (s *DocumentAppService) logDocumentMemoryGuardPaused(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if s == nil || s.logger == nil {
		return
	}
	fields := appendDocumentMemoryGuardFields(doc, snapshot, "error", cause)
	s.logger.KnowledgeWarnContext(ctx, memoryprobe.DocumentSyncKeyword+" "+documentMemoryGuardLogKeyword+" pause document sync start", fields...)
}

func (s *DocumentAppService) logDocumentMemoryGuardResumed(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	snapshot memoryguard.Snapshot,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.InfoContext(
		ctx,
		memoryprobe.DocumentSyncKeyword+" "+documentMemoryGuardLogKeyword+" document sync start resumed",
		appendDocumentMemoryGuardFields(doc, snapshot)...,
	)
}

func (s *DocumentAppService) logDocumentMemoryGuardFailOpen(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if s == nil || s.logger == nil {
		return
	}
	fields := appendDocumentMemoryGuardFields(doc, snapshot)
	if cause != nil {
		fields = append(fields, "error", cause)
	}
	s.logger.DebugContext(ctx, memoryprobe.DocumentSyncKeyword+" "+documentMemoryGuardLogKeyword+" document sync memory cgroup unavailable, fail open", fields...)
}

func appendDocumentMemoryGuardFields(
	doc *docentity.KnowledgeBaseDocument,
	snapshot memoryguard.Snapshot,
	fields ...any,
) []any {
	output := appendDocumentResourceLogFields(doc,
		"memory_probe_keyword", memoryprobe.DocumentSyncKeyword,
		"memory_guard_keyword", documentMemoryGuardLogKeyword,
		"stage", snapshot.Stage,
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

func sleepDocumentMemoryGuard(ctx context.Context) error {
	timer := time.NewTimer(documentMemoryGuardPollInterval)
	defer timer.Stop()

	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("sleep document sync memory guard: %w", ctx.Err())
	}
}
