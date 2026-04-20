package eventbus

import (
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"
)

type internalTestPayload struct {
	ID int64
}

type internalOtherPayload struct {
	Name string
}

func TestPublishReportsInternalInvariantForInvalidHandler(t *testing.T) {
	t.Parallel()

	event := NewEvent[internalTestPayload]("internal.invalid.handler")
	errCh := make(chan error, 1)
	b := NewWithConfig(&Config{
		OnError: func(eventName string, err error) {
			if eventName != event.Name() {
				t.Errorf("unexpected event name %q", eventName)
			}
			errCh <- err
		},
	})
	defer b.Close()

	b.mu.Lock()
	b.types[event.name] = payloadTypeOf[internalTestPayload]()
	b.handlers[event.name] = []*handlerRecord{
		{id: 1, fn: "invalid-handler"},
	}
	b.mu.Unlock()

	if err := Publish(b, NewEnvelope(event, internalTestPayload{ID: 1})); err != nil {
		t.Fatalf("publish returned error: %v", err)
	}

	err := <-errCh
	if !errors.Is(err, ErrInternalInvariant) {
		t.Fatalf("expected ErrInternalInvariant, got %v", err)
	}
	if errors.Is(err, ErrPanic) {
		t.Fatalf("did not expect ErrPanic, got %v", err)
	}
}

func TestPublishReportsErrPanicForPanickingHandler(t *testing.T) {
	t.Parallel()

	event := NewEvent[internalTestPayload]("internal.handler.panic")
	errCh := make(chan error, 1)
	b := NewWithConfig(&Config{
		OnError: func(eventName string, err error) {
			if eventName != event.Name() {
				t.Errorf("unexpected event name %q", eventName)
			}
			errCh <- err
		},
	})
	defer b.Close()

	_, err := Subscribe(b, event, func(*EventEnvelope[internalTestPayload]) error {
		triggerNilPointerDerefForInternalBusTest()
		return nil
	})
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	if err = Publish(b, NewEnvelope(event, internalTestPayload{ID: 1})); err != nil {
		t.Fatalf("publish returned error: %v", err)
	}

	got := <-errCh
	if !errors.Is(got, ErrPanic) {
		t.Fatalf("expected ErrPanic, got %v", got)
	}
	if errors.Is(got, ErrInternalInvariant) {
		t.Fatalf("did not expect ErrInternalInvariant, got %v", got)
	}
}

func triggerNilPointerDerefForInternalBusTest() {
	var ptr *int
	_ = *ptr
}

func TestWorkerReportsInternalInvariantAndKeepsRunning(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		event := NewEvent[internalTestPayload]("internal.worker.invalid-envelope")
		errCh := make(chan error, 1)
		done := make(chan struct{}, 1)
		b := NewWithConfig(&Config{
			WorkerCount: 1,
			QueueSize:   4,
			OnError: func(eventName string, err error) {
				if eventName != event.Name() {
					t.Errorf("unexpected event name %q", eventName)
				}
				errCh <- err
			},
		})
		defer b.Close()

		invoker := makeInvoker[internalTestPayload](event.name)
		record := &handlerRecord{
			id: 1,
			fn: Handler[internalTestPayload](func(*EventEnvelope[internalTestPayload]) error {
				done <- struct{}{}
				return nil
			}),
		}

		b.jobs <- asyncJob{
			eventName: event.name,
			envelope:  NewEnvelope(NewEvent[internalOtherPayload](event.name), internalOtherPayload{Name: "bad"}),
			record:    record,
			invoker:   invoker,
		}
		synctest.Wait()

		err := <-errCh
		if !errors.Is(err, ErrInternalInvariant) {
			t.Fatalf("expected ErrInternalInvariant, got %v", err)
		}

		b.jobs <- asyncJob{
			eventName: event.name,
			envelope:  NewEnvelope(event, internalTestPayload{ID: 2}),
			record:    record,
			invoker:   invoker,
		}
		synctest.Wait()

		<-done
	})
}

func TestInvokeTypedStopsPropagationWithoutReportingError(t *testing.T) {
	t.Parallel()

	event := NewEvent[internalTestPayload]("internal.stop.propagation")
	b := New()
	defer b.Close()

	stop, err := invokeTyped(
		event.name,
		NewEnvelope(event, internalTestPayload{ID: 1}),
		&handlerRecord{
			id: 1,
			fn: Handler[internalTestPayload](func(*EventEnvelope[internalTestPayload]) error {
				return ErrStopPropagation
			}),
		},
	)
	if err != nil {
		t.Fatalf("invokeTyped returned error: %v", err)
	}
	if !stop {
		t.Fatal("expected stop propagation to be true")
	}
}

func TestSubscribeReturnsErrBusClosedWhenCloseHasStarted(t *testing.T) {
	t.Parallel()

	b := New()
	event := NewEvent[internalTestPayload]("internal.close.subscribe")

	b.mu.Lock()

	closeDone := make(chan struct{})
	go func() {
		b.Close()
		close(closeDone)
	}()

	deadline := time.Now().Add(time.Second)
	for !b.closed.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if !b.closed.Load() {
		b.mu.Unlock()
		t.Fatal("close did not start in time")
	}

	errCh := make(chan error, 1)
	go func() {
		_, err := Subscribe(b, event, func(*EventEnvelope[internalTestPayload]) error {
			return nil
		})
		errCh <- err
	}()

	b.mu.Unlock()

	select {
	case err := <-errCh:
		if !errors.Is(err, ErrBusClosed) {
			t.Fatalf("expected ErrBusClosed, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for subscribe result")
	}

	select {
	case <-closeDone:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for close result")
	}
}

func TestAsyncPublishStillProcessesSubsequentJobsAfterInternalError(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		event := NewEvent[internalTestPayload]("internal.async.publish.continue")
		var count atomic.Int32
		errCh := make(chan error, 1)
		done := make(chan struct{}, 1)
		b := NewWithConfig(&Config{
			WorkerCount: 1,
			QueueSize:   4,
			OnError: func(eventName string, err error) {
				if eventName != event.Name() {
					t.Errorf("unexpected event name %q", eventName)
				}
				errCh <- err
			},
		})
		defer b.Close()

		b.mu.Lock()
		b.types[event.name] = payloadTypeOf[internalTestPayload]()
		b.handlers[event.name] = []*handlerRecord{
			{id: 1, fn: "invalid-handler", async: true},
			{
				id:    2,
				async: true,
				fn: Handler[internalTestPayload](func(*EventEnvelope[internalTestPayload]) error {
					if count.Add(1) == 1 {
						done <- struct{}{}
					}
					return nil
				}),
			},
		}
		b.mu.Unlock()

		if err := Publish(b, NewEnvelope(event, internalTestPayload{ID: 1})); err != nil {
			t.Fatalf("publish returned error: %v", err)
		}
		synctest.Wait()

		err := <-errCh
		if !errors.Is(err, ErrInternalInvariant) {
			t.Fatalf("expected ErrInternalInvariant, got %v", err)
		}

		<-done
	})
}
