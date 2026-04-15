package rebuild_test

import (
	"context"
	"testing"
	"testing/synctest"

	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

type stubRunStateReader struct {
	runID string
	err   error
}

func (s *stubRunStateReader) GetCurrentRun(context.Context) (string, error) {
	return s.runID, s.err
}

type stubRunner struct {
	called     chan rebuilddto.RunOptions
	requestIDs chan string
	block      chan struct{}
}

func (s *stubRunner) Run(ctx context.Context, opts rebuilddto.RunOptions) (*rebuilddto.RunResult, error) {
	if s.called != nil {
		s.called <- opts
	}
	if s.requestIDs != nil {
		requestID, _ := ctxmeta.RequestIDFromContext(ctx)
		s.requestIDs <- requestID
	}
	if s.block != nil {
		<-s.block
	}
	return &rebuilddto.RunResult{RunID: opts.ResumeRunID}, nil
}

func TestTriggerServiceReturnsAlreadyRunningWhenCurrentRunExists(t *testing.T) {
	t.Parallel()
	svc := apprebuild.NewTriggerService(
		&stubRunner{},
		&stubRunStateReader{runID: "r-existing"},
		logging.New(),
	)

	got, err := svc.Trigger(context.Background(), rebuilddto.RunOptions{})
	if err != nil {
		t.Fatalf("trigger rebuild: %v", err)
	}
	if got.Status != apprebuild.TriggerStatusAlreadyRunning {
		t.Fatalf("expected status=%s, got %s", apprebuild.TriggerStatusAlreadyRunning, got.Status)
	}
	if got.RunID != "r-existing" {
		t.Fatalf("expected existing run id, got %s", got.RunID)
	}
}

func TestTriggerServiceStartsAsyncRunAndReturnsTriggered(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		called := make(chan rebuilddto.RunOptions, 1)
		release := make(chan struct{})
		svc := apprebuild.NewTriggerService(
			&stubRunner{called: called, block: release},
			&stubRunStateReader{},
			logging.New(),
		)

		got, err := svc.Trigger(context.Background(), rebuilddto.RunOptions{})
		if err != nil {
			t.Fatalf("trigger rebuild: %v", err)
		}
		if got.Status != apprebuild.TriggerStatusTriggered {
			t.Fatalf("expected status=%s, got %s", apprebuild.TriggerStatusTriggered, got.Status)
		}
		if got.RunID == "" {
			t.Fatal("expected non-empty run id")
		}

		synctest.Wait()
		select {
		case runOpts := <-called:
			if runOpts.ResumeRunID != got.RunID {
				t.Fatalf("expected async run id %s, got %s", got.RunID, runOpts.ResumeRunID)
			}
		default:
			t.Fatal("expected async run to be invoked")
		}

		close(release)
	})
}

func TestTriggerServiceReturnsPendingRunAsAlreadyRunning(t *testing.T) {
	t.Parallel()
	release := make(chan struct{})
	svc := apprebuild.NewTriggerService(
		&stubRunner{block: release},
		&stubRunStateReader{},
		logging.New(),
	)

	first, err := svc.Trigger(context.Background(), rebuilddto.RunOptions{})
	if err != nil {
		t.Fatalf("first trigger rebuild: %v", err)
	}
	second, err := svc.Trigger(context.Background(), rebuilddto.RunOptions{})
	if err != nil {
		t.Fatalf("second trigger rebuild: %v", err)
	}

	if first.Status != apprebuild.TriggerStatusTriggered {
		t.Fatalf("expected first status=%s, got %s", apprebuild.TriggerStatusTriggered, first.Status)
	}
	if second.Status != apprebuild.TriggerStatusAlreadyRunning {
		t.Fatalf("expected second status=%s, got %s", apprebuild.TriggerStatusAlreadyRunning, second.Status)
	}
	if first.RunID == "" || second.RunID != first.RunID {
		t.Fatalf("expected second run id to be %s, got %s", first.RunID, second.RunID)
	}

	close(release)
}

func TestTriggerServiceKeepsRequestIDForAsyncRun(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		called := make(chan rebuilddto.RunOptions, 1)
		requestIDs := make(chan string, 1)
		release := make(chan struct{})
		svc := apprebuild.NewTriggerService(
			&stubRunner{called: called, requestIDs: requestIDs, block: release},
			&stubRunStateReader{},
			logging.New(),
		)

		ctx := ctxmeta.WithRequestID(context.Background(), "req-trigger-1")
		got, err := svc.Trigger(ctx, rebuilddto.RunOptions{})
		if err != nil {
			t.Fatalf("trigger rebuild: %v", err)
		}
		if got.Status != apprebuild.TriggerStatusTriggered {
			t.Fatalf("expected status=%s, got %s", apprebuild.TriggerStatusTriggered, got.Status)
		}

		synctest.Wait()
		select {
		case <-called:
		default:
			t.Fatal("expected async run to be invoked")
		}
		select {
		case requestID := <-requestIDs:
			if requestID != "req-trigger-1" {
				t.Fatalf("expected request_id=req-trigger-1, got %q", requestID)
			}
		default:
			t.Fatal("expected async run request_id to be captured")
		}

		close(release)
	})
}
