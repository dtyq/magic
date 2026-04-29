package lintcmd_test

import (
	"bytes"
	"context"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"magic/internal/tools/lintcmd"
)

type testError string

func (e testError) Error() string {
	return string(e)
}

const (
	errOther               = testError("other error")
	errVetRanBeforeVettool = testError("vet ran before vettool")
	errUnexpectedTask      = testError("unexpected task")
	errBuildFailed         = testError("build failed")
)

func TestParseOptionsRejectsUnknownFlag(t *testing.T) {
	t.Parallel()

	_, err := lintcmd.ParseOptions([]string{"--unknown-flag"})
	if err == nil {
		t.Fatal("expected ParseOptions to fail for unknown flag")
	}
	if !strings.Contains(err.Error(), "parse flags") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseOptionsAcceptsEmptyArgs(t *testing.T) {
	t.Parallel()

	_, err := lintcmd.ParseOptions(nil)
	if err != nil {
		t.Fatalf("ParseOptions returned error: %v", err)
	}
}

func TestParseOptionsParsesNoSmartCache(t *testing.T) {
	t.Parallel()

	opts, err := lintcmd.ParseOptions([]string{"--no-smart-cache"})
	if err != nil {
		t.Fatalf("ParseOptions returned error: %v", err)
	}
	if !opts.NoSmartCache {
		t.Fatal("expected NoSmartCache to be true")
	}
}

func TestRunExecutesVetAfterVettool(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var (
			stdout         bytes.Buffer
			stderr         bytes.Buffer
			vettoolDone    atomic.Bool
			vetSmartCalled atomic.Bool
		)

		runner := lintcmd.NewRunner(lintcmd.Options{}, &stdout, &stderr)
		runner.SetTestRunTask(func(_ context.Context, taskName string) lintcmd.TestResult {
			switch taskName {
			case lintcmd.TestTaskVetToolSmart:
				time.Sleep(20 * time.Millisecond)
				vettoolDone.Store(true)
				return lintcmd.TestResult{Duration: 20 * time.Millisecond}
			case lintcmd.TestTaskVetSmart:
				vetSmartCalled.Store(true)
				if !vettoolDone.Load() {
					return lintcmd.TestResult{Err: errVetRanBeforeVettool}
				}
				time.Sleep(5 * time.Millisecond)
				return lintcmd.TestResult{Duration: 5 * time.Millisecond}
			case lintcmd.TestTaskGolangCILint:
				time.Sleep(40 * time.Millisecond)
				return lintcmd.TestResult{Duration: 40 * time.Millisecond}
			case lintcmd.TestTaskDeadcodeSmart:
				time.Sleep(30 * time.Millisecond)
				return lintcmd.TestResult{Duration: 30 * time.Millisecond}
			case lintcmd.TestTaskWireSmart:
				time.Sleep(25 * time.Millisecond)
				return lintcmd.TestResult{Duration: 25 * time.Millisecond}
			default:
				return lintcmd.TestResult{Err: errUnexpectedTask}
			}
		})

		if err := runner.Run(context.Background()); err != nil {
			t.Fatalf("Run returned error: %v", err)
		}
		if !vetSmartCalled.Load() {
			t.Fatal("expected vet-smart to run after vettool-smart")
		}

		output := stdout.String()
		for _, expected := range []string{
			"[PASS] vettool-smart (20ms)",
			"[PASS] vet-smart (5ms)",
			"[PASS] golangci-lint (40ms)",
			"[PASS] deadcode-smart (30ms)",
			"[PASS] wire-smart (25ms)",
			"Parallel lint elapsed:",
			"All lint checks passed.",
		} {
			if !strings.Contains(output, expected) {
				t.Fatalf("expected stdout to contain %q, got %q", expected, output)
			}
		}
		if stderr.Len() != 0 {
			t.Fatalf("expected empty stderr, got %q", stderr.String())
		}
	})
}

func TestRunSkipsVetWhenVettoolFails(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var (
			stdout        bytes.Buffer
			stderr        bytes.Buffer
			vetSmartCalls atomic.Int32
		)

		runner := lintcmd.NewRunner(lintcmd.Options{}, &stdout, &stderr)
		runner.SetTestRunTask(func(_ context.Context, taskName string) lintcmd.TestResult {
			switch taskName {
			case lintcmd.TestTaskVetToolSmart:
				time.Sleep(10 * time.Millisecond)
				return lintcmd.TestResult{
					Duration: 10 * time.Millisecond,
					Err:      errBuildFailed,
				}
			case lintcmd.TestTaskVetSmart:
				vetSmartCalls.Add(1)
				return lintcmd.TestResult{Duration: 1 * time.Millisecond}
			case lintcmd.TestTaskGolangCILint:
				time.Sleep(60 * time.Millisecond)
				return lintcmd.TestResult{Duration: 60 * time.Millisecond}
			case lintcmd.TestTaskDeadcodeSmart:
				time.Sleep(40 * time.Millisecond)
				return lintcmd.TestResult{Duration: 40 * time.Millisecond}
			case lintcmd.TestTaskWireSmart:
				time.Sleep(50 * time.Millisecond)
				return lintcmd.TestResult{Duration: 50 * time.Millisecond}
			default:
				return lintcmd.TestResult{Err: errUnexpectedTask}
			}
		})

		startedAt := time.Now()
		err := runner.Run(context.Background())
		elapsed := time.Since(startedAt)

		if err == nil {
			t.Fatal("expected Run to fail")
		}
		if !lintcmd.IsLintFailure(err) {
			t.Fatalf("expected lint failure, got %v", err)
		}
		if vetSmartCalls.Load() != 0 {
			t.Fatalf("expected vet-smart to be skipped, got %d calls", vetSmartCalls.Load())
		}
		if elapsed < 50*time.Millisecond {
			t.Fatalf("expected Run to wait for independent tasks, got elapsed=%s", elapsed)
		}

		output := stdout.String()
		for _, expected := range []string{
			"[FAIL] vettool-smart (10ms)",
			"[SKIP] vet-smart (<1ms)",
			"[PASS] golangci-lint (60ms)",
			"[PASS] deadcode-smart (40ms)",
			"[PASS] wire-smart (50ms)",
			"Parallel lint elapsed:",
		} {
			if !strings.Contains(output, expected) {
				t.Fatalf("expected stdout to contain %q, got %q", expected, output)
			}
		}

		errOutput := stderr.String()
		if !strings.Contains(errOutput, "=== vettool-smart ===") {
			t.Fatalf("expected stderr to contain vettool-smart failure details, got %q", errOutput)
		}
		if strings.Contains(errOutput, "=== vet-smart ===") {
			t.Fatalf("expected skipped vet-smart to be omitted from failure details, got %q", errOutput)
		}
	})
}

func TestIsLintFailureReturnsFalseForNonLintError(t *testing.T) {
	t.Parallel()

	if lintcmd.IsLintFailure(errOther) {
		t.Fatal("expected non-lint error to return false")
	}
}
