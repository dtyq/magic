package httpapi_test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"magic/internal/infrastructure/logging"
	httpapi "magic/internal/interfaces/http"
)

func TestServerStartDoesNotBlockOnTaskQueueService(t *testing.T) {
	t.Parallel()

	assertBackgroundServiceStartDoesNotBlock(t, "task queue start", func(
		deps *httpapi.ServerDependencies,
		started chan struct{},
		release chan struct{},
	) {
		deps.TaskQueueService = &taskQueueServiceStub{
			started: started,
			waitCh:  release,
		}
	})
}

func TestServerStopCancelsTaskQueueServiceContext(t *testing.T) {
	t.Parallel()

	assertBackgroundServiceStopCancels(t, "task queue start", "task queue cancel", func(
		deps *httpapi.ServerDependencies,
		started chan struct{},
		cancelled chan struct{},
	) {
		deps.TaskQueueService = &taskQueueServiceStub{
			started:    started,
			cancelled:  cancelled,
			waitForCtx: true,
		}
	})
}

type taskQueueServiceStub struct {
	started    chan struct{}
	cancelled  chan struct{}
	waitCh     chan struct{}
	waitForCtx bool
}

func (s *taskQueueServiceStub) Start(ctx context.Context) error {
	if s.started != nil {
		close(s.started)
	}
	if s.waitForCtx {
		<-ctx.Done()
		if s.cancelled != nil {
			close(s.cancelled)
		}
		return fmt.Errorf("task queue context done: %w", ctx.Err())
	}
	if s.waitCh != nil {
		<-s.waitCh
	}
	return nil
}

func TestServerStopWaitsForTaskQueueLifecycleBeforeClosingInfra(t *testing.T) {
	t.Parallel()

	server, fixture := newTaskQueueLifecycleServerFixture(t)
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(context.Background())
	}()

	waitForChannel(t, fixture.started, "task queue start")

	stopDone := make(chan error, 1)
	go func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		stopDone <- server.Stop(shutdownCtx)
	}()

	waitForChannel(t, fixture.cancelled, "task queue cancel")
	waitForChannel(t, fixture.stopCalled, "task queue stop")

	select {
	case <-fixture.infraClosed:
		t.Fatal("infra services should not close before task queue start returns")
	case <-time.After(100 * time.Millisecond):
	}

	close(fixture.releaseStartReturn)
	waitForChannel(t, fixture.startReturned, "task queue start return")
	waitForChannel(t, fixture.infraClosed, "infra close")

	select {
	case err := <-stopDone:
		if err != nil {
			t.Fatalf("stop server: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for server stop")
	}

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("server start returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for server start to exit")
	}

	if fixture.infra.closedBeforeTaskQueueStop.Load() {
		t.Fatal("infra services closed before task queue lifecycle completed")
	}
}

type taskQueueLifecycleFixture struct {
	started            chan struct{}
	cancelled          chan struct{}
	stopCalled         chan struct{}
	startReturned      chan struct{}
	releaseStartReturn chan struct{}
	infraClosed        chan struct{}
	infra              *orderingInfraServicesStub
}

func newTaskQueueLifecycleServerFixture(t *testing.T) (*httpapi.Server, *taskQueueLifecycleFixture) {
	t.Helper()

	fixture := &taskQueueLifecycleFixture{
		started:            make(chan struct{}),
		cancelled:          make(chan struct{}),
		stopCalled:         make(chan struct{}),
		startReturned:      make(chan struct{}),
		releaseStartReturn: make(chan struct{}),
		infraClosed:        make(chan struct{}),
	}
	taskQueue := &taskQueueLifecycleServiceStub{
		started:            fixture.started,
		cancelled:          fixture.cancelled,
		stopCalled:         fixture.stopCalled,
		startReturned:      fixture.startReturned,
		releaseStartReturn: fixture.releaseStartReturn,
	}
	fixture.infra = &orderingInfraServicesStub{
		taskQueueStopped: fixture.startReturned,
		closed:           fixture.infraClosed,
	}

	server := httpapi.NewServerWithDependencies(&httpapi.ServerDependencies{
		Config: &httpapi.ServerConfig{
			Enabled: false,
			Host:    "127.0.0.1",
			Port:    mustAllocateFreePort(t),
			Mode:    httpapi.ModeTest,
			Env:     "dev",
		},
		TaskQueueService: taskQueue,
		InfraServices:    fixture.infra,
		Logger:           logging.New().Named("httpapi.test"),
		Metrics:          metricsServiceStub{},
		RPCServer:        &rpcServerStub{},
	})

	return server, fixture
}

type taskQueueLifecycleServiceStub struct {
	started            chan struct{}
	cancelled          chan struct{}
	stopCalled         chan struct{}
	startReturned      chan struct{}
	releaseStartReturn chan struct{}
}

func (s *taskQueueLifecycleServiceStub) Start(ctx context.Context) error {
	if s.started != nil {
		close(s.started)
	}
	<-ctx.Done()
	if s.cancelled != nil {
		close(s.cancelled)
	}
	if s.releaseStartReturn != nil {
		<-s.releaseStartReturn
	}
	if s.startReturned != nil {
		close(s.startReturned)
	}
	return fmt.Errorf("task queue lifecycle context done: %w", ctx.Err())
}

func (s *taskQueueLifecycleServiceStub) Stop(ctx context.Context) error {
	if s.stopCalled != nil {
		close(s.stopCalled)
	}
	if s.startReturned == nil {
		return nil
	}
	select {
	case <-s.startReturned:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("task queue stop context done: %w", ctx.Err())
	}
}

type orderingInfraServicesStub struct {
	taskQueueStopped          <-chan struct{}
	closed                    chan struct{}
	closedBeforeTaskQueueStop atomic.Bool
}

func (s *orderingInfraServicesStub) HealthCheck(context.Context) (map[string]bool, error) {
	return map[string]bool{"ok": true}, nil
}

func (s *orderingInfraServicesStub) Close(context.Context) error {
	if s.taskQueueStopped != nil {
		select {
		case <-s.taskQueueStopped:
		default:
			s.closedBeforeTaskQueueStop.Store(true)
		}
	}
	if s.closed != nil {
		close(s.closed)
	}
	return nil
}
