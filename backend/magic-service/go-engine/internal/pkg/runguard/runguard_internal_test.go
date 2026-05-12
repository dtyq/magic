package runguard

import (
	"context"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRecoverReportsPanic(t *testing.T) {
	t.Parallel()

	var called atomic.Bool
	func() {
		defer Recover(context.Background(), Options{
			Scope:  "unit.recover",
			Policy: CloseScope,
			Fields: []any{"extra", "value"},
			OnPanic: func(_ context.Context, report Report) {
				called.Store(true)
				if report.Scope != "unit.recover" || report.Policy != CloseScope {
					t.Fatalf("unexpected report scope/policy: %#v", report)
				}
				if report.Panic == "" || report.Recovered == nil {
					t.Fatalf("expected panic payload, got %#v", report)
				}
				if !strings.Contains(report.Stack, "runguard_internal_test.go") {
					t.Fatalf("expected stack to include test file, got %q", report.Stack)
				}
				assertField(t, report.Fields, "scope", "unit.recover")
				assertField(t, report.Fields, "extra", "value")
				assertField(t, report.Fields, "goroutine_policy", CloseScope)
			},
		})
		triggerRunGuardTestPanic()
	}()

	if !called.Load() {
		t.Fatal("expected OnPanic to be called")
	}
}

func TestGoProtectsGoroutine(t *testing.T) {
	t.Parallel()

	called := make(chan Report, 1)
	Go(context.Background(), Options{
		Scope:  "unit.go",
		Policy: Continue,
		OnPanic: func(_ context.Context, report Report) {
			called <- report
		},
	}, triggerRunGuardTestPanic)

	select {
	case report := <-called:
		if report.Scope != "unit.go" || report.Policy != Continue {
			t.Fatalf("unexpected report: %#v", report)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for panic report")
	}
}

func TestExitProcessUsesInjectedExit(t *testing.T) {
	t.Parallel()

	exitCalled := make(chan int, 1)
	func() {
		defer Recover(context.Background(), Options{
			Scope:  "unit.exit",
			Policy: ExitProcess,
			Exit: func(code int) {
				exitCalled <- code
			},
		})
		triggerRunGuardTestPanic()
	}()

	select {
	case code := <-exitCalled:
		if code != 1 {
			t.Fatalf("expected exit code 1, got %d", code)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for injected exit")
	}
}

func assertField(t *testing.T, fields []any, key string, want any) {
	t.Helper()

	for i := 0; i+1 < len(fields); i += 2 {
		if got, ok := fields[i].(string); ok && got == key {
			if fields[i+1] != want {
				t.Fatalf("field %q = %#v, want %#v", key, fields[i+1], want)
			}
			return
		}
	}
	t.Fatalf("missing field %q in %#v", key, fields)
}

func triggerRunGuardTestPanic() {
	var ptr *int
	_ = *ptr
}
