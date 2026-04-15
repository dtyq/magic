package rebuild_test

import (
	"context"
	"testing"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

func TestCoordinatorStateAndFailureQueueFlows(t *testing.T) {
	t.Parallel()

	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "run-1"

	if err := coordinator.SetDualWriteState(ctx, &domainrebuild.VectorDualWriteState{
		RunID:            runID,
		Enabled:          true,
		Mode:             string(domainrebuild.ModeBlueGreen),
		ActiveCollection: "active",
		ShadowCollection: "shadow",
		ActiveModel:      "m1",
		TargetModel:      "m2",
	}); err != nil {
		t.Fatalf("SetDualWriteState() error = %v", err)
	}

	state, err := coordinator.GetDualWriteState(ctx)
	if err != nil {
		t.Fatalf("GetDualWriteState() error = %v", err)
	}
	if !state.Enabled || state.RunID != runID || state.TargetModel != "m2" {
		t.Fatalf("unexpected state: %+v", state)
	}

	if err := coordinator.ClearDualWriteState(ctx, "other-run"); err != nil {
		t.Fatalf("ClearDualWriteState(other) error = %v", err)
	}
	state, err = coordinator.GetDualWriteState(ctx)
	if err != nil {
		t.Fatalf("GetDualWriteState(after other clear) error = %v", err)
	}
	if state.RunID != runID {
		t.Fatalf("expected state to remain for mismatched runID, got %+v", state)
	}

	if err := coordinator.EnqueueFailure(ctx, &domainrebuild.VectorRebuildFailureEvent{
		OrganizationCode:  "org-1",
		KnowledgeBaseCode: "kb-1",
		DocumentCode:      "doc-1",
		Operation:         "store",
		Error:             "boom",
	}); err != nil {
		t.Fatalf("EnqueueFailure() error = %v", err)
	}
	if _, err := server.RPush(testRetryKeyPrefix+runID, "{invalid-json"); err != nil {
		t.Fatalf("server.RPush() error = %v", err)
	}

	if got, err := coordinator.FailureQueueLength(ctx, runID); err != nil || got != 2 {
		t.Fatalf("FailureQueueLength() = (%d, %v), want (2, nil)", got, err)
	}

	failures, err := coordinator.DequeueFailures(ctx, runID, 10)
	if err != nil {
		t.Fatalf("DequeueFailures() error = %v", err)
	}
	if len(failures) != 1 || failures[0].RunID != runID {
		t.Fatalf("unexpected failures: %+v", failures)
	}

	if err := coordinator.ClearDualWriteState(ctx, runID); err != nil {
		t.Fatalf("ClearDualWriteState() error = %v", err)
	}
	state, err = coordinator.GetDualWriteState(ctx)
	if err != nil {
		t.Fatalf("GetDualWriteState(after clear) error = %v", err)
	}
	if state.RunID != "" || state.Enabled {
		t.Fatalf("expected cleared state, got %+v", state)
	}
}

func TestCoordinatorCurrentRunAndJobFlows(t *testing.T) {
	t.Parallel()

	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	if err := coordinator.SetCurrentRun(ctx, "run-2"); err != nil {
		t.Fatalf("SetCurrentRun() error = %v", err)
	}
	if got, err := coordinator.GetCurrentRun(ctx); err != nil || got != "run-2" {
		t.Fatalf("GetCurrentRun() = (%q, %v), want (%q, nil)", got, err, "run-2")
	}

	if err := coordinator.ClearCurrentRun(ctx, "other"); err != nil {
		t.Fatalf("ClearCurrentRun(other) error = %v", err)
	}
	if got, err := coordinator.GetCurrentRun(ctx); err != nil || got != "run-2" {
		t.Fatalf("GetCurrentRun(after other clear) = (%q, %v)", got, err)
	}

	if err := coordinator.ClearCurrentRun(ctx, "run-2"); err != nil {
		t.Fatalf("ClearCurrentRun() error = %v", err)
	}
	if got, err := coordinator.GetCurrentRun(ctx); err != nil || got != "" {
		t.Fatalf("GetCurrentRun(after clear) = (%q, %v)", got, err)
	}

	job, err := coordinator.LoadJob(ctx, "missing")
	if err != nil {
		t.Fatalf("LoadJob() error = %v", err)
	}
	if len(job) != 0 {
		t.Fatalf("expected missing job to return empty map, got %#v", job)
	}

	if err := coordinator.SaveJob(ctx, "run-2", map[string]any{"enabled": false}); err != nil {
		t.Fatalf("SaveJob() error = %v", err)
	}
	job, err = coordinator.LoadJob(ctx, "run-2")
	if err != nil {
		t.Fatalf("LoadJob(saved) error = %v", err)
	}
	if job["enabled"] != "0" {
		t.Fatalf("unexpected saved job: %#v", job)
	}
}
