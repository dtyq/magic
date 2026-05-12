package appruntime

import (
	"context"
	"errors"
	"os"
	"slices"
	"syscall"
	"testing"
	"time"
)

type recordingShutdownHandler struct {
	called chan context.Context
}

var errTestShutdownFailed = errors.New("shutdown failed")

func (h *recordingShutdownHandler) Stop(ctx context.Context) error {
	if h.called != nil {
		h.called <- ctx
	}
	return nil
}

type failingShutdownHandler struct{}

func (h *failingShutdownHandler) Stop(context.Context) error {
	return errTestShutdownFailed
}

func TestGracefulShutdownManagerWaitForShutdownSignalReturnsAfterHandlingSignal(t *testing.T) {
	manager := NewGracefulShutdownManager()
	handlerCalled := make(chan context.Context, 1)
	manager.RegisterShutdownHandler(&recordingShutdownHandler{called: handlerCalled})

	done := make(chan struct{})
	quit := make(chan os.Signal, 1)
	go func() {
		manager.waitForShutdownSignal(quit)
		close(done)
	}()

	quit <- os.Interrupt

	select {
	case ctx := <-handlerCalled:
		if ctx == nil {
			t.Fatal("expected shutdown handler to receive context")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for shutdown handler to be called")
	}

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for graceful shutdown manager to return")
	}
}

func TestGracefulShutdownManagerContinuesAfterHandlerFailure(t *testing.T) {
	manager := NewGracefulShutdownManager()
	handlerCalled := make(chan context.Context, 1)
	manager.RegisterShutdownHandler(&failingShutdownHandler{})
	manager.RegisterShutdownHandler(&recordingShutdownHandler{called: handlerCalled})

	done := make(chan struct{})
	quit := make(chan os.Signal, 1)
	go func() {
		manager.waitForShutdownSignal(quit)
		close(done)
	}()

	quit <- os.Interrupt

	select {
	case ctx := <-handlerCalled:
		if ctx == nil {
			t.Fatal("expected later shutdown handler to receive context")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for later shutdown handler to be called")
	}

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for graceful shutdown manager to return")
	}
}

func TestShutdownSignalsIncludeHangupAndQuit(t *testing.T) {
	signals := shutdownSignals()

	for _, sig := range []os.Signal{syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT} {
		if !slices.Contains(signals, sig) {
			t.Fatalf("expected shutdown signals to include %s", sig)
		}
	}
}
