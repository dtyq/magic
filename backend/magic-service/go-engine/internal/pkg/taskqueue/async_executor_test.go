package taskqueue_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/runguard"
	"magic/internal/pkg/taskqueue"
)

const testExecutorName taskqueue.ExecutorName = "test"

var errTaskBoom = errors.New("boom")

type testContextKey string

type lockedBuffer struct {
	mu   sync.Mutex
	data []byte
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, p...)
	return len(p), nil
}

func (b *lockedBuffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.data)
}

func (b *lockedBuffer) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]byte(nil), b.data...)
}

func TestAsyncExecutorStartsOnFirstEnqueueAndProcessesInOrder(t *testing.T) {
	t.Parallel()

	var (
		mu      sync.Mutex
		handled []int
	)
	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
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

func TestAsyncExecutorRunsTasksConcurrentlyWhenConfiguredWithMultipleWorkers(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		started := make(chan int, 2)
		release := make(chan struct{})

		executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
			ExecutorName: testExecutorName,
			QueueSize:    2,
			WorkerCount:  2,
			Handler: func(_ context.Context, item int) error {
				started <- item
				<-release
				return nil
			},
		})

		if !executor.Enqueue(context.Background(), 1) || !executor.Enqueue(context.Background(), 2) {
			t.Fatal("expected enqueue to succeed")
		}

		first := <-started
		second := <-started
		if first == second {
			t.Fatalf("expected two different started tasks, got %d and %d", first, second)
		}

		close(release)
		synctest.Wait()

		if err := executor.Close(context.Background()); err != nil {
			t.Fatalf("Close returned error: %v", err)
		}
	})
}

func TestAsyncExecutorReturnsFalseWhenQueueFull(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	release := make(chan struct{})
	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
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
		executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
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
		executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
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

	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
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

func TestAsyncExecutorPassesTaskContextToHandler(t *testing.T) {
	t.Parallel()

	var (
		mu      sync.Mutex
		handled []string
	)
	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    2,
		Handler: func(ctx context.Context, _ int) error {
			value, _ := ctx.Value(testContextKey("request_id")).(string)
			mu.Lock()
			defer mu.Unlock()
			handled = append(handled, value)
			return nil
		},
	})

	firstCtx := context.WithValue(context.Background(), testContextKey("request_id"), "req-1")
	secondCtx := context.WithValue(context.Background(), testContextKey("request_id"), "req-2")
	if !executor.Enqueue(firstCtx, 1) || !executor.Enqueue(secondCtx, 2) {
		t.Fatal("expected enqueue to succeed")
	}
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if !slices.Equal(handled, []string{"req-1", "req-2"}) {
		t.Fatalf("unexpected handler contexts: %v", handled)
	}
}

func TestAsyncExecutorCallsOnErrorWithTaskContext(t *testing.T) {
	t.Parallel()

	var (
		called atomic.Bool
		gotCtx string
	)
	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    1,
		Handler: func(_ context.Context, _ int) error {
			return errTaskBoom
		},
		OnError: func(ctx context.Context, err error) {
			if err != nil {
				gotCtx, _ = ctx.Value(testContextKey("request_id")).(string)
				called.Store(true)
			}
		},
	})

	taskCtx := context.WithValue(context.Background(), testContextKey("request_id"), "req-onerror")
	if !executor.Enqueue(taskCtx, 1) {
		t.Fatal("expected enqueue to succeed")
	}
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}
	if !called.Load() {
		t.Fatal("expected OnError to be called")
	}
	if gotCtx != "req-onerror" {
		t.Fatalf("unexpected OnError context value %q", gotCtx)
	}
}

func TestAsyncExecutorWorkerPanicLogs(t *testing.T) {
	var logBuf lockedBuffer
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel("debug"),
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuf).Named("taskqueue.test")
	executor := taskqueue.NewAsyncExecutor(taskqueue.AsyncExecutorConfig[int]{
		ExecutorName: testExecutorName,
		QueueSize:    1,
		Logger:       logger,
		PanicPolicy:  runguard.Continue,
		Handler: func(context.Context, int) error {
			triggerTaskQueueTestPanic()
			return nil
		},
	})

	if !executor.Enqueue(context.Background(), 1) {
		t.Fatal("expected enqueue to succeed")
	}
	if err := executor.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}

	deadline := time.After(time.Second)
	for logBuf.Len() == 0 {
		select {
		case <-deadline:
			t.Fatal("timeout waiting for panic log")
		default:
			time.Sleep(time.Millisecond)
		}
	}

	var got map[string]any
	if err := json.Unmarshal(logBuf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal panic log: %v", err)
	}
	if got["msg"] != "goEngineException: Goroutine panic recovered" {
		t.Fatalf("unexpected msg: %#v", got["msg"])
	}
	if got["scope"] != "taskqueue.worker" || got["executor_name"] != string(testExecutorName) || got["stack"] == "" {
		t.Fatalf("unexpected panic log fields: %#v", got)
	}
}

func triggerTaskQueueTestPanic() {
	var ptr *int
	_ = *ptr
}
