package documentsync

import (
	"context"
	"errors"
	"fmt"
	"time"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/memoryguard"
)

const (
	defaultMemoryAdmissionPollInterval      = time.Second
	defaultMemoryAdmissionSoftResumeRatio   = 0.90
	defaultMemoryAdmissionCgroupResumeRatio = 0.70
	memoryAdmissionStage                    = "document_sync_admission"
	memoryAdmissionBaseLogFieldCount        = 24
)

// MemoryAdmissionGate controls whether a delivered task may start execution.
type MemoryAdmissionGate interface {
	Wait(ctx context.Context, task *Task) error
}

// MemoryAdmissionGateConfig describes memory-admission hysteresis.
type MemoryAdmissionGateConfig struct {
	PollInterval      time.Duration
	SoftResumeRatio   float64
	CgroupResumeRatio float64
}

// CgroupMemoryAdmissionGate blocks new document-sync tasks while cgroup memory is above the admission waterline.
type CgroupMemoryAdmissionGate struct {
	checker *memoryguard.Guard
	logger  *logging.SugaredLogger
	config  MemoryAdmissionGateConfig
	sleep   func(context.Context, time.Duration) error
}

// NewMemoryAdmissionGate creates a cgroup-aware admission gate for document sync tasks.
func NewMemoryAdmissionGate(
	checker *memoryguard.Guard,
	logger *logging.SugaredLogger,
	config MemoryAdmissionGateConfig,
) *CgroupMemoryAdmissionGate {
	if checker == nil {
		return nil
	}
	return &CgroupMemoryAdmissionGate{
		checker: checker,
		logger:  logger,
		config:  normalizeMemoryAdmissionGateConfig(config),
		sleep:   sleepContext,
	}
}

func normalizeMemoryAdmissionGateConfig(config MemoryAdmissionGateConfig) MemoryAdmissionGateConfig {
	if config.PollInterval <= 0 {
		config.PollInterval = defaultMemoryAdmissionPollInterval
	}
	if config.SoftResumeRatio <= 0 || config.SoftResumeRatio >= 1 {
		config.SoftResumeRatio = defaultMemoryAdmissionSoftResumeRatio
	}
	if config.CgroupResumeRatio <= 0 || config.CgroupResumeRatio >= 1 {
		config.CgroupResumeRatio = defaultMemoryAdmissionCgroupResumeRatio
	}
	return config
}

// Wait blocks until the current process is below the low memory waterline.
func (g *CgroupMemoryAdmissionGate) Wait(ctx context.Context, task *Task) error {
	if g == nil || g.checker == nil {
		return nil
	}
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("wait document sync memory admission: %w", err)
	}

	snapshot, err := g.checker.Check(ctx, memoryAdmissionStage)
	if shouldFailOpenMemoryAdmission(snapshot, err) {
		g.logAdmissionFailOpen(ctx, task, snapshot, err)
		return nil
	}
	if err == nil {
		return nil
	}

	g.logAdmissionPaused(ctx, task, snapshot, err)
	for {
		if err := g.sleep(ctx, g.config.PollInterval); err != nil {
			return err
		}

		snapshot, err = g.checker.Check(ctx, memoryAdmissionStage)
		if shouldFailOpenMemoryAdmission(snapshot, err) {
			g.logAdmissionFailOpen(ctx, task, snapshot, err)
			return nil
		}
		if g.memoryBelowResumeWaterline(snapshot) {
			g.logAdmissionResumed(ctx, task, snapshot)
			return nil
		}
	}
}

func shouldFailOpenMemoryAdmission(snapshot memoryguard.Snapshot, err error) bool {
	if err != nil {
		return !errors.Is(err, memoryguard.ErrMemoryPressure)
	}
	return !snapshot.CgroupAvailable
}

func (g *CgroupMemoryAdmissionGate) memoryBelowResumeWaterline(snapshot memoryguard.Snapshot) bool {
	if snapshot.CurrentBytes <= 0 {
		return true
	}
	if softResume := g.softResumeThreshold(snapshot); softResume > 0 && snapshot.CurrentBytes > softResume {
		return false
	}
	if cgroupResume := g.cgroupResumeThreshold(snapshot); cgroupResume > 0 && snapshot.CurrentBytes > cgroupResume {
		return false
	}
	return true
}

func (g *CgroupMemoryAdmissionGate) softResumeThreshold(snapshot memoryguard.Snapshot) int64 {
	if snapshot.SoftLimitBytes <= 0 {
		return 0
	}
	return int64(float64(snapshot.SoftLimitBytes) * g.config.SoftResumeRatio)
}

func (g *CgroupMemoryAdmissionGate) cgroupResumeThreshold(snapshot memoryguard.Snapshot) int64 {
	if snapshot.LimitBytes <= 0 {
		return 0
	}
	return int64(float64(snapshot.LimitBytes) * g.config.CgroupResumeRatio)
}

func (g *CgroupMemoryAdmissionGate) activeResumeThreshold(snapshot memoryguard.Snapshot) int64 {
	switch snapshot.LimitName {
	case "cgroup_memory_ratio":
		return g.cgroupResumeThreshold(snapshot)
	case "sync_memory_soft_limit_bytes":
		return g.softResumeThreshold(snapshot)
	default:
		if threshold := g.softResumeThreshold(snapshot); threshold > 0 {
			return threshold
		}
		return g.cgroupResumeThreshold(snapshot)
	}
}

func (g *CgroupMemoryAdmissionGate) logAdmissionPaused(
	ctx context.Context,
	task *Task,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if g == nil || g.logger == nil {
		return
	}
	fields := appendMemoryAdmissionFields(task, snapshot,
		"resume_threshold", g.activeResumeThreshold(snapshot),
		"error", cause,
	)
	g.logger.KnowledgeWarnContext(ctx, "memory pressure pause document sync admission", fields...)
}

func (g *CgroupMemoryAdmissionGate) logAdmissionResumed(
	ctx context.Context,
	task *Task,
	snapshot memoryguard.Snapshot,
) {
	if g == nil || g.logger == nil {
		return
	}
	fields := appendMemoryAdmissionFields(task, snapshot,
		"resume_threshold", g.activeResumeThreshold(snapshot),
	)
	g.logger.InfoContext(ctx, "Document sync admission resumed after memory pressure", fields...)
}

func (g *CgroupMemoryAdmissionGate) logAdmissionFailOpen(
	ctx context.Context,
	task *Task,
	snapshot memoryguard.Snapshot,
	cause error,
) {
	if g == nil || g.logger == nil {
		return
	}
	fields := appendMemoryAdmissionFields(task, snapshot)
	if cause != nil {
		fields = append(fields, "error", cause)
	}
	g.logger.DebugContext(ctx, "Document sync admission memory cgroup unavailable, fail open", fields...)
}

func appendMemoryAdmissionFields(task *Task, snapshot memoryguard.Snapshot, fields ...any) []any {
	output := make([]any, 0, len(fields)+memoryAdmissionBaseLogFieldCount)
	output = append(output,
		"task_kind", taskKindForLog(task),
		"document_code", taskDocumentCodeForLog(task),
		"knowledge_base_code", taskKnowledgeBaseCodeForLog(task),
		"mode", taskModeForLog(task),
		"task_key", taskKeyForLog(task),
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

func taskKindForLog(task *Task) string {
	if task == nil {
		return ""
	}
	return task.Kind
}

func taskDocumentCodeForLog(task *Task) string {
	if task == nil {
		return ""
	}
	return task.Code
}

func taskKnowledgeBaseCodeForLog(task *Task) string {
	if task == nil {
		return ""
	}
	return task.KnowledgeBaseCode
}

func taskModeForLog(task *Task) string {
	if task == nil {
		return ""
	}
	return task.Mode
}

func taskKeyForLog(task *Task) string {
	if task == nil {
		return ""
	}
	return task.Key
}

func sleepContext(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("sleep document sync memory admission: %w", ctx.Err())
	}
}
