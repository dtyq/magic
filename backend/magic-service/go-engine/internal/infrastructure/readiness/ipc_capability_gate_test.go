package readiness_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"magic/internal/infrastructure/readiness"
)

var errReadinessFake = errors.New("readiness fake failed")

type ipcCapabilityWaiterStub struct {
	ready       bool
	waitErr     error
	waitMethods []string
}

func (s *ipcCapabilityWaiterStub) HasCapableClient(methods ...string) bool {
	return s.ready
}

func (s *ipcCapabilityWaiterStub) WaitCapableClient(_ context.Context, methods ...string) error {
	s.waitMethods = append([]string(nil), methods...)
	return s.waitErr
}

func TestIPCCapabilityGateWaitReady(t *testing.T) {
	t.Parallel()

	waiter := &ipcCapabilityWaiterStub{}
	gate := readiness.NewIPCCapabilityGate(waiter, " php-ipc:test ", "demo.echo", "", "demo.echo")

	if gate.Name() != "php-ipc:test" {
		t.Fatalf("Name() = %q", gate.Name())
	}
	if err := gate.WaitReady(context.Background()); err != nil {
		t.Fatalf("WaitReady() error = %v", err)
	}
	if !slices.Equal(waiter.waitMethods, []string{"demo.echo"}) {
		t.Fatalf("wait methods = %#v", waiter.waitMethods)
	}
}

func TestIPCCapabilityGateWaitReadySkipsWhenAlreadyReady(t *testing.T) {
	t.Parallel()

	waiter := &ipcCapabilityWaiterStub{ready: true}
	gate := readiness.NewIPCCapabilityGate(waiter, "", "demo.echo")

	if err := gate.WaitReady(context.Background()); err != nil {
		t.Fatalf("WaitReady() error = %v", err)
	}
	if len(waiter.waitMethods) != 0 {
		t.Fatalf("WaitCapableClient should not be called when already ready")
	}
}

func TestIPCCapabilityGateWaitReadyWrapsError(t *testing.T) {
	t.Parallel()

	waiter := &ipcCapabilityWaiterStub{waitErr: errReadinessFake}
	gate := readiness.NewIPCCapabilityGate(waiter, "php-ipc:test", "demo.echo")

	if err := gate.WaitReady(context.Background()); !errors.Is(err, errReadinessFake) {
		t.Fatalf("expected wrapped fake error, got %v", err)
	}
}
