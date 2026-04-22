package documentsync_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"magic/internal/infrastructure/knowledge/documentsync"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	lockpkg "magic/internal/pkg/lock"
)

var errMockAsyncSyncFailed = errors.New("mock async sync failed")

const (
	testBusinessIDFirst  = "first"
	testBusinessIDSecond = "second"
	testBusinessIDThird  = "third"
	testBusinessIDLatest = "latest"
)

type syncPayload struct {
	BusinessParams *ctxmeta.BusinessParams `json:"business_params,omitempty"`
}

type executedTask struct {
	Task      *documentsync.Task
	Payload   syncPayload
	RequestID string
}

func TestAsyncSchedulerRunsOnlyLatestTrailingResyncByDocument(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		runner := &blockingTaskRunner{
			started: make(chan executedTask, 3),
			release: make(chan struct{}),
		}
		scheduler := documentsync.NewAsyncScheduler(runner, logging.New(), 100*time.Millisecond)

		scheduler.Schedule(context.Background(), newResyncTask(t, testBusinessIDFirst))
		synctest.Wait()

		started := <-runner.started
		assertBusinessID(t, started, testBusinessIDFirst)

		scheduler.Schedule(context.Background(), newResyncTask(t, testBusinessIDSecond))
		scheduler.Schedule(context.Background(), newResyncTask(t, testBusinessIDThird))
		synctest.Wait()

		select {
		case extra := <-runner.started:
			t.Fatalf("expected trailing execution to wait for current run, got %#v", extra)
		default:
		}

		close(runner.release)
		synctest.Wait()

		trailing := <-runner.started
		assertBusinessID(t, trailing, testBusinessIDThird)

		select {
		case extra := <-runner.started:
			t.Fatalf("expected only one trailing execution, got %#v", extra)
		default:
		}
	})
}

func TestAsyncSchedulerKeepsTrailingLatestResyncAfterFailure(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		runner := &failingThenRecordingTaskRunner{
			started:      make(chan executedTask, 2),
			releaseFirst: make(chan struct{}),
		}
		scheduler := documentsync.NewAsyncScheduler(runner, logging.New(), 100*time.Millisecond)

		scheduler.Schedule(context.Background(), newResyncTask(t, testBusinessIDFirst))
		synctest.Wait()

		first := <-runner.started
		assertBusinessID(t, first, testBusinessIDFirst)

		scheduler.Schedule(context.Background(), newResyncTask(t, testBusinessIDLatest))
		close(runner.releaseFirst)
		synctest.Wait()

		trailing := <-runner.started
		assertBusinessID(t, trailing, testBusinessIDLatest)

		select {
		case extra := <-runner.started:
			t.Fatalf("expected only one trailing execution after failure, got %#v", extra)
		default:
		}
	})
}

func TestAsyncSchedulerKeepsRequestIDForExecution(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		runner := &recordingTaskRunner{
			started: make(chan executedTask, 1),
		}
		scheduler := documentsync.NewAsyncScheduler(runner, logging.New(), 100*time.Millisecond)

		reqCtx := ctxmeta.WithRequestID(context.Background(), "req-async-sync-1")
		scheduler.Schedule(reqCtx, newResyncTask(t, testBusinessIDFirst))
		synctest.Wait()

		got := <-runner.started
		if got.RequestID != "req-async-sync-1" {
			t.Fatalf("expected request_id req-async-sync-1, got %q", got.RequestID)
		}
	})
}

func TestRedisSchedulerExecutesOnlyLatestRequestWithinDebounceWindow(t *testing.T) {
	t.Parallel()

	server, client := newTestRedis(t)
	defer server.Close()

	runner := &recordingTaskRunner{
		started: make(chan executedTask, 2),
	}
	scheduler := documentsync.NewRedisScheduler(
		runner,
		logging.New(),
		client,
		lockpkg.NewRedisLockManager(client, &lockpkg.RedisConfig{LockPrefix: "lock:"}),
		documentsync.RedisSchedulerConfig{
			DebounceWindow:    10 * time.Millisecond,
			LockTTL:           200 * time.Millisecond,
			HeartbeatInterval: 5 * time.Millisecond,
			StateTTL:          time.Minute,
			RedisOpTimeout:    200 * time.Millisecond,
			WatchRetryTimes:   5,
		},
		200*time.Millisecond,
	)

	scheduler.Schedule(context.Background(), newResyncTask(t, "first"))
	scheduler.Schedule(context.Background(), newResyncTask(t, "second"))
	scheduler.Schedule(context.Background(), newResyncTask(t, "third"))

	select {
	case got := <-runner.started:
		assertBusinessID(t, got, "third")
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected debounced sync execution")
	}

	select {
	case extra := <-runner.started:
		t.Fatalf("expected only one execution, got %#v", extra)
	case <-time.After(30 * time.Millisecond):
	}
}

func TestRedisSchedulerRunsOnlyOneTrailingResyncAfterCurrentExecution(t *testing.T) {
	t.Parallel()

	server, client := newTestRedis(t)
	defer server.Close()

	runner := &recordingTaskRunner{
		started: make(chan executedTask, 3),
		release: make(chan struct{}),
	}
	scheduler := documentsync.NewRedisScheduler(
		runner,
		logging.New(),
		client,
		lockpkg.NewRedisLockManager(client, &lockpkg.RedisConfig{LockPrefix: "lock:"}),
		documentsync.RedisSchedulerConfig{
			DebounceWindow:    10 * time.Millisecond,
			LockTTL:           200 * time.Millisecond,
			HeartbeatInterval: 5 * time.Millisecond,
			StateTTL:          time.Minute,
			RedisOpTimeout:    200 * time.Millisecond,
			WatchRetryTimes:   5,
		},
		300*time.Millisecond,
	)

	scheduler.Schedule(context.Background(), newResyncTask(t, "first"))

	var first executedTask
	select {
	case first = <-runner.started:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected first execution to start")
	}
	assertBusinessID(t, first, "first")

	scheduler.Schedule(context.Background(), newResyncTask(t, "second"))
	scheduler.Schedule(context.Background(), newResyncTask(t, "third"))

	close(runner.release)

	select {
	case trailing := <-runner.started:
		assertBusinessID(t, trailing, "third")
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected trailing execution to start")
	}

	select {
	case extra := <-runner.started:
		t.Fatalf("expected only one trailing execution, got %#v", extra)
	case <-time.After(30 * time.Millisecond):
	}
}

func TestRedisSchedulerKeepsLatestRequestIDForExecution(t *testing.T) {
	t.Parallel()

	server, client := newTestRedis(t)
	defer server.Close()

	runner := &recordingTaskRunner{
		started: make(chan executedTask, 1),
	}
	scheduler := documentsync.NewRedisScheduler(
		runner,
		logging.New(),
		client,
		lockpkg.NewRedisLockManager(client, &lockpkg.RedisConfig{LockPrefix: "lock:"}),
		documentsync.RedisSchedulerConfig{
			DebounceWindow:    10 * time.Millisecond,
			LockTTL:           200 * time.Millisecond,
			HeartbeatInterval: 5 * time.Millisecond,
			StateTTL:          time.Minute,
			RedisOpTimeout:    200 * time.Millisecond,
			WatchRetryTimes:   5,
		},
		200*time.Millisecond,
	)

	scheduler.Schedule(ctxmeta.WithRequestID(context.Background(), "req-first"), newResyncTask(t, "first"))
	scheduler.Schedule(ctxmeta.WithRequestID(context.Background(), "req-second"), newResyncTask(t, "second"))

	select {
	case got := <-runner.started:
		if got.RequestID != "req-second" {
			t.Fatalf("expected latest request_id req-second, got %q", got.RequestID)
		}
		assertBusinessID(t, got, "second")
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected debounced sync execution")
	}
}

type blockingTaskRunner struct {
	started chan executedTask
	release chan struct{}
}

func (r *blockingTaskRunner) Run(ctx context.Context, task *documentsync.Task) error {
	requestID, _ := ctxmeta.RequestIDFromContext(ctx)
	r.started <- executedTask{Task: documentsync.CloneTask(task), Payload: decodePayload(task), RequestID: requestID}
	<-r.release
	return nil
}

type recordingTaskRunner struct {
	started chan executedTask
	release chan struct{}
}

func (r *recordingTaskRunner) Run(ctx context.Context, task *documentsync.Task) error {
	requestID, _ := ctxmeta.RequestIDFromContext(ctx)
	r.started <- executedTask{Task: documentsync.CloneTask(task), Payload: decodePayload(task), RequestID: requestID}
	if r.release != nil {
		<-r.release
	}
	return nil
}

type failingThenRecordingTaskRunner struct {
	started      chan executedTask
	releaseFirst chan struct{}
	calls        int
}

func (r *failingThenRecordingTaskRunner) Run(ctx context.Context, task *documentsync.Task) error {
	requestID, _ := ctxmeta.RequestIDFromContext(ctx)
	r.started <- executedTask{Task: documentsync.CloneTask(task), Payload: decodePayload(task), RequestID: requestID}
	if r.calls == 0 {
		r.calls++
		<-r.releaseFirst
		return errMockAsyncSyncFailed
	}
	r.calls++
	return nil
}

func newResyncTask(tb testing.TB, businessID string) *documentsync.Task {
	tb.Helper()

	payload, err := json.Marshal(syncPayload{
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       businessID,
		},
	})
	if err != nil {
		tb.Fatalf("marshal sync payload: %v", err)
		return nil
	}

	return &documentsync.Task{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC1",
		Mode:              "resync",
		Async:             true,
		Payload:           payload,
	}
}

func decodePayload(task *documentsync.Task) syncPayload {
	if task == nil || len(task.Payload) == 0 {
		return syncPayload{}
	}

	var payload syncPayload
	if err := json.Unmarshal(task.Payload, &payload); err != nil {
		return syncPayload{}
	}
	return payload
}

func assertBusinessID(t *testing.T, got executedTask, expected string) {
	t.Helper()
	if got.Payload.BusinessParams == nil || got.Payload.BusinessParams.BusinessID != expected {
		t.Fatalf("expected business_id %q, got %#v", expected, got.Payload.BusinessParams)
	}
}

func newTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	return server, client
}
