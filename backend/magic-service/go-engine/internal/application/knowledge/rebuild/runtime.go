package rebuild

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

func (r *Runner) saveJob(ctx context.Context, runID, status, phase, errMsg string, extra map[string]any) error {
	values := map[string]any{
		"status": status,
		"phase":  phase,
		"error":  errMsg,
	}
	maps.Copy(values, extra)
	if err := r.coordinator.SaveJob(ctx, runID, values); err != nil {
		return fmt.Errorf("save rebuild job state: %w", err)
	}
	return nil
}

func (r *Runner) maybeWriteFailureReport(result *rebuilddto.RunResult, path string) error {
	if result == nil || !r.isLocalDev || len(result.Failures) == 0 || strings.TrimSpace(path) == "" {
		return nil
	}
	if err := writeFailureReport(path, result.Failures); err != nil {
		return fmt.Errorf("write failure report: %w", err)
	}
	result.FailureReport = path
	return nil
}

func writeFailureReport(path string, failures []rebuilddto.FailureRecord) error {
	if err := os.MkdirAll(filepath.Dir(path), reportDirPerm); err != nil {
		return fmt.Errorf("create report dir: %w", err)
	}
	data, err := json.MarshalIndent(failures, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal failure report: %w", err)
	}
	if err := os.WriteFile(path, data, reportFilePerm); err != nil {
		return fmt.Errorf("write failure report file: %w", err)
	}
	return nil
}

func (r *Runner) startRunHeartbeat(ctx context.Context, runID, lockOwner string, interval time.Duration) func() {
	if interval <= 0 {
		interval = defaultHeartbeatInterval
	}

	heartbeatCtx := context.WithoutCancel(ctx)
	stopCh := make(chan struct{})
	var stopOnce sync.Once
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-stopCh:
				return
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				r.refreshRunHeartbeat(heartbeatCtx, runID, lockOwner)
			}
		}
	}()
	return func() {
		stopOnce.Do(func() {
			close(stopCh)
		})
	}
}

func (r *Runner) refreshRunHeartbeat(ctx context.Context, runID, lockOwner string) {
	renewed, err := r.coordinator.RefreshLock(ctx, lockOwner, defaultLockTTL)
	if err != nil {
		r.logHeartbeatWarn(ctx, "Failed to refresh rebuild lock", runID, err)
		return
	}
	if !renewed {
		r.logHeartbeatWarn(ctx, "Skip heartbeat refresh because rebuild lock owner mismatched", runID, nil)
		return
	}
	if err := r.coordinator.SetCurrentRun(ctx, runID); err != nil {
		r.logHeartbeatWarn(ctx, "Failed to refresh current run heartbeat", runID, err)
	}
}

func (r *Runner) logHeartbeatWarn(ctx context.Context, msg, runID string, err error) {
	if r.logger == nil {
		return
	}
	fields := []any{"run_id", runID}
	if err != nil {
		fields = append(fields, "error", err)
	}
	r.logger.WarnContext(ctx, msg, fields...)
}

func (r *Runner) logResyncFailure(
	ctx context.Context,
	runID string,
	task domainrebuild.DocumentTask,
	attempts int,
	err error,
) {
	if r.logger == nil {
		return
	}
	r.logger.ErrorContext(
		ctx,
		"Knowledge rebuild document resync failed",
		"run_id", runID,
		"document_id", task.ID,
		"organization_code", task.OrganizationCode,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.DocumentCode,
		"user_id", task.UserID,
		"embedding_model", task.EmbeddingModel,
		"target_collection", task.TargetCollection,
		"target_model", task.TargetModel,
		"attempts", attempts,
		"error", err,
	)
}
