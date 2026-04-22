package appruntime_test

import (
	"context"
	"reflect"
	"testing"

	appruntime "magic/internal/infrastructure/runtime"
)

type testShutdownHandler struct {
	called bool
}

func (h *testShutdownHandler) Stop(_ context.Context) error {
	h.called = true
	return nil
}

func TestGracefulShutdownManagerRegisterHandler(t *testing.T) {
	t.Parallel()

	manager := appruntime.NewGracefulShutdownManager()
	handler := &testShutdownHandler{}
	manager.RegisterShutdownHandler(handler)

	managerValue := reflect.ValueOf(manager).Elem()
	loggerField := managerValue.FieldByName("logger")
	if loggerField.IsNil() {
		t.Fatal("expected logger to be initialized")
	}
	handlersField := managerValue.FieldByName("shutdownHandlers")
	if handlersField.Len() != 1 {
		t.Fatalf("expected one registered handler, got %d", handlersField.Len())
	}
}
