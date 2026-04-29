package rebuild

import (
	"context"
	"fmt"
	"slices"
	"sync"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	"magic/internal/pkg/runguard"
)

func (r *Runner) resyncAllDocuments(
	ctx context.Context,
	runID string,
	opts rebuilddto.RunOptions,
	scope domainrebuild.Scope,
	target resyncTarget,
) (resyncSummary, error) {
	state := newResyncState()
	var afterID int64

	for ctx.Err() == nil {
		docs, listErr := r.store.ListDocumentsBatch(ctx, scope, afterID, opts.BatchSize)
		if listErr != nil {
			return state.snapshot(), fmt.Errorf("list documents batch: %w", listErr)
		}
		if len(docs) == 0 {
			break
		}
		afterID = docs[len(docs)-1].ID
		r.processResyncBatch(ctx, runID, docs, opts, state, target)
	}

	if ctx.Err() != nil {
		return state.snapshot(), ctx.Err()
	}
	return state.snapshot(), nil
}

func validateResyncSummary(scope domainrebuild.Scope, summary resyncSummary) error {
	if err := domainrebuild.ValidateResyncSummary(scope, domainrebuild.ResyncSummary{
		TotalDocs:  summary.TotalDocs,
		FailedDocs: summary.FailedDocs,
	}); err != nil {
		return fmt.Errorf("validate resync summary: %w", err)
	}
	return nil
}

func (r *Runner) processResyncBatch(
	ctx context.Context,
	runID string,
	docs []domainrebuild.DocumentTask,
	opts rebuilddto.RunOptions,
	state *resyncState,
	target resyncTarget,
) {
	tasks := makeResyncTasks(docs, state, target)
	taskCh := make(chan domainrebuild.DocumentTask)
	var workerWG sync.WaitGroup
	for range opts.Concurrency {
		workerWG.Go(func() {
			defer runguard.Recover(ctx, rebuildPanicOptions(r.logger, "knowledge.rebuild.resync_worker", "run_id", runID))
			for task := range taskCh {
				r.executeResyncTask(ctx, runID, task, opts.Retry, state)
			}
		})
	}

dispatchLoop:
	for _, task := range tasks {
		if ctx.Err() != nil {
			break
		}
		select {
		case <-ctx.Done():
			break dispatchLoop
		case taskCh <- task:
		}
	}

	close(taskCh)
	workerWG.Wait()
}

func makeResyncTasks(docs []domainrebuild.DocumentTask, state *resyncState, target resyncTarget) []domainrebuild.DocumentTask {
	if len(docs) == 0 {
		return nil
	}

	tasks := make([]domainrebuild.DocumentTask, 0, len(docs))
	for _, task := range docs {
		task.TargetCollection = target.Collection
		task.TargetTermCollection = target.TermCollection
		task.TargetModel = target.Model
		task.TargetSparseBackend = target.SparseBackend
		state.markDispatched()
		tasks = append(tasks, task)
	}
	return tasks
}

func (r *Runner) executeResyncTask(
	ctx context.Context,
	runID string,
	task domainrebuild.DocumentTask,
	retry int,
	state *resyncState,
) {
	attempts, syncErr := r.resyncWithRetry(ctx, task, retry)
	if syncErr == nil {
		state.markSuccess()
		_ = r.coordinator.IncrMetric(ctx, runID, "success_docs", 1)
		return
	}

	state.markFailed()
	_ = r.coordinator.IncrMetric(ctx, runID, "failed_docs", 1)
	r.logResyncFailure(ctx, runID, task, attempts, syncErr)
	state.appendFailure(failureRecordFromError(task, attempts, syncErr))
}

func (r *Runner) resyncWithRetry(ctx context.Context, task domainrebuild.DocumentTask, retry int) (int, error) {
	var lastErr error
	attempts := retry + 1
	for i := 1; i <= attempts; i++ {
		if err := r.resyncer.Resync(ctx, task); err != nil {
			lastErr = err
			continue
		}
		return i, nil
	}
	if lastErr == nil {
		lastErr = errUnknownResync
	}
	return attempts, lastErr
}

func failureRecordFromError(task domainrebuild.DocumentTask, attempts int, err error) rebuilddto.FailureRecord {
	return rebuilddto.FailureRecordFromDomain(task, attempts, err)
}

func applyResyncSummary(result *rebuilddto.RunResult, summary resyncSummary) {
	if result == nil {
		return
	}
	result.Failures = append(result.Failures, summary.Failures...)
	result.TotalDocs += summary.TotalDocs
	result.SuccessDocs += summary.SuccessDocs
	result.FailedDocs += summary.FailedDocs
}

func newResyncState() *resyncState {
	return &resyncState{failures: make([]rebuilddto.FailureRecord, 0)}
}

func (s *resyncState) appendFailure(record rebuilddto.FailureRecord) {
	s.failureMu.Lock()
	s.failures = append(s.failures, record)
	s.failureMu.Unlock()
}

func (s *resyncState) markSuccess() {
	s.successDocs.Add(1)
}

func (s *resyncState) markFailed() {
	s.failedDocs.Add(1)
}

func (s *resyncState) markDispatched() {
	s.totalDocs.Add(1)
}

func (s *resyncState) snapshot() resyncSummary {
	s.failureMu.Lock()
	failures := slices.Clone(s.failures)
	s.failureMu.Unlock()
	return resyncSummary{
		Failures:    failures,
		TotalDocs:   s.totalDocs.Load(),
		SuccessDocs: s.successDocs.Load(),
		FailedDocs:  s.failedDocs.Load(),
	}
}
