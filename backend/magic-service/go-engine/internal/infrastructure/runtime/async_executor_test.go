package appruntime_test

import (
	"context"
	"errors"
	"slices"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	appruntime "magic/internal/infrastructure/runtime"
)

const testExecutorName appruntime.ExecutorName = "test"

func TestAsyncExecutorStartsOnFirstEnqueueAndProcessesInOrder(t *testing.T) {
	t.Parallel()

	var (
		mu      sync.Mutex
		handled []int
	)
	executor := appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    4,
		Handler: func(_ context.Context, item int) error {
			mu.Lock()
			defer mu.Unlock()
			handled = append(handled, item)
			return nil
		},
	})

	for _, item := range []int{1, 2, 3} {
		if !executor.Enqueue(context.Background(), item) {
			t.Fatalf("expected enqueue success for item %d", item)
		}
	}
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if !slices.Equal(handled, []int{1, 2, 3}) {
		t.Fatalf("unexpected handled order: %v", handled)
	}
}

func TestAsyncExecutorReturnsFalseWhenQueueFull(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	release := make(chan struct{})
	executor := appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    1,
		Handler: func(_ context.Context, _ int) error {
			select {
			case <-started:
			default:
				close(started)
			}
			<-release
			return nil
		},
	})

	if !executor.Enqueue(context.Background(), 1) {
		t.Fatal("expected first enqueue to succeed")
	}
	<-started
	if !executor.Enqueue(context.Background(), 2) {
		t.Fatal("expected second enqueue to succeed")
	}
	if executor.Enqueue(context.Background(), 3) {
		t.Fatal("expected enqueue to fail when queue is full")
	}

	close(release)
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}
}

func TestAsyncExecutorCloseWaitsForPendingTasks(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		started := make(chan struct{})
		release := make(chan struct{})
		finished := make(chan struct{})
		executor := appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int]{
			ExecutorName: testExecutorName,
			QueueSize:    2,
			Handler: func(_ context.Context, item int) error {
				if item == 1 {
					close(started)
					<-release
				}
				return nil
			},
		})

		if !executor.Enqueue(context.Background(), 1) || !executor.Enqueue(context.Background(), 2) {
			t.Fatal("expected enqueue to succeed")
		}
		<-started

		go func() {
			defer close(finished)
			if err := executor.Close(context.Background()); err != nil {
				t.Errorf("Close returned error: %v", err)
			}
		}()

		select {
		case <-finished:
			t.Fatal("expected Close to wait for pending tasks")
		case <-time.After(50 * time.Millisecond):
		}

		close(release)

		select {
		case <-finished:
		case <-time.After(time.Second):
			t.Fatal("expected Close to return after pending tasks completed")
		}
	})
}

func TestAsyncExecutorCloseReturnsTimeout(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		executor := appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int]{
			ExecutorName: testExecutorName,
			QueueSize:    1,
			Handler: func(_ context.Context, _ int) error {
				<-release
				return nil
			},
		})

		if !executor.Enqueue(context.Background(), 1) {
			t.Fatal("expected enqueue to succeed")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()

		err := executor.Close(ctx)
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("expected deadline exceeded, got %v", err)
		}

		close(release)
	})
}

func TestAsyncExecutorRejectsEnqueueAfterClose(t *testing.T) {
	t.Parallel()

	executor := appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    1,
		Handler: func(_ context.Context, _ int) error {
			return nil
		},
	})
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}
	if executor.Enqueue(context.Background(), 1) {
		t.Fatal("expected enqueue to fail after close")
	}
}
