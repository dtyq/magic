package smartwire_test

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	smartwire "magic/internal/tools/smartwire"
)

var (
	errTransientWireExecFailure = errors.New("temporary wire execution failure")
	errWireDiffMismatch         = errors.New("wire diff mismatch")
	errWireCheckFailed          = errors.New("wire check failed")
)

func TestRunnerSkipsWhenInputsUnchanged(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "wire.json")

	writeTrackedFiles(t, rootDir)
	filePath := filepath.Join(rootDir, "internal", "di", "app", "providers.go")

	var output bytes.Buffer
	checkCount := 0
	diffCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output,
		func(context.Context, string) (string, error) {
			checkCount++
			return "", nil
		},
		func(context.Context, string) (string, error) {
			diffCount++
			return "", nil
		},
	)

	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("first run failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 1, 1)
	if !strings.Contains(output.String(), "✓ wire checks passed") {
		t.Fatalf("expected success output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("second run failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 1, 1)
	if !strings.Contains(output.String(), "Skipping wire checks (no changes since last run)") {
		t.Fatalf("expected metadata skip output, got %q", output.String())
	}

	output.Reset()
	now := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(filePath, now, now); err != nil {
		t.Fatalf("touch file: %v", err)
	}
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("third run failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 1, 1)
	if !strings.Contains(output.String(), "Skipping wire checks (content unchanged)") {
		t.Fatalf("expected content skip output, got %q", output.String())
	}

	output.Reset()
	writeFile(t, filePath, "package app\n\nfunc Changed() {}\n")
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("fourth run failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 2, 2)
	if !strings.Contains(output.String(), "✓ wire checks passed") {
		t.Fatalf("expected rerun success output, got %q", output.String())
	}
}

func TestRunnerCachesCheckFailure(t *testing.T) {
	t.Parallel()

	assertCachedFailure(t, cachedFailureCase{
		failureSubcommand: "check",
		failureMessage:    "wire cycle detected",
		expectedCheckRuns: 1,
		expectedDiffRuns:  0,
	})
}

func TestRunnerCachesDiffFailure(t *testing.T) {
	t.Parallel()

	assertCachedFailure(t, cachedFailureCase{
		failureSubcommand: "diff",
		failureMessage:    "wire_gen.go is stale",
		expectedCheckRuns: 1,
		expectedDiffRuns:  1,
	})
}

func TestRunnerReportsMissingWireBinary(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "wire.json")

	writeTrackedFiles(t, rootDir)

	var output bytes.Buffer
	runner := smartwire.NewRunner(smartwire.Options{
		RootDir:   rootDir,
		CacheFile: cacheFile,
		Binary:    "definitely-missing-wire-binary",
	}, &output, &output)

	err := runner.Run(t.Context())
	if err == nil {
		t.Fatal("expected missing binary to fail")
	}
	if !strings.Contains(err.Error(), "make dev-tools") {
		t.Fatalf("expected install hint, got %v", err)
	}
	if _, statErr := os.Stat(cacheFile); !os.IsNotExist(statErr) {
		t.Fatalf("expected cache file to be absent, statErr=%v", statErr)
	}
}

func TestRunnerDoesNotCacheTransientDiffFailure(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "wire.json")

	writeTrackedFiles(t, rootDir)

	var output bytes.Buffer
	checkCount := 0
	diffCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output,
		func(context.Context, string) (string, error) {
			checkCount++
			return "", nil
		},
		func(context.Context, string) (string, error) {
			diffCount++
			if diffCount == 1 {
				return errTransientWireExecFailure.Error(), errTransientWireExecFailure
			}
			return "", nil
		},
	)

	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected first run to fail")
	}
	assertRunCounts(t, checkCount, diffCount, 1, 1)
	if !strings.Contains(output.String(), errTransientWireExecFailure.Error()) {
		t.Fatalf("expected execution failure output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("expected second run to rerun and succeed, got %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 2, 2)
	if strings.Contains(output.String(), "cached failed result") {
		t.Fatalf("expected second run to rerun instead of using cache, got %q", output.String())
	}
	if !strings.Contains(output.String(), "✓ wire checks passed") {
		t.Fatalf("expected success output after rerun, got %q", output.String())
	}
}

func TestRunnerDisableCacheAlwaysExecutes(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "wire.json")

	writeTrackedFiles(t, rootDir)

	var output bytes.Buffer
	checkCount := 0
	diffCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output,
		func(context.Context, string) (string, error) {
			checkCount++
			return "", nil
		},
		func(context.Context, string) (string, error) {
			diffCount++
			return "", nil
		},
	)

	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("first run failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 1, 1)

	output.Reset()
	runner = smartwire.NewRunner(smartwire.Options{
		RootDir:      rootDir,
		CacheFile:    cacheFile,
		Binary:       filepath.Join(rootDir, "wire"),
		DisableCache: true,
	}, &output, &output)
	smartwire.SetLookPathForTest(runner, func(file string) (string, error) {
		return file, nil
	})
	smartwire.SetRunCheckForTest(runner, func(context.Context, string) (string, error) {
		checkCount++
		return "", nil
	})
	smartwire.SetRunDiffForTest(runner, func(context.Context, string) (string, error) {
		diffCount++
		return "", nil
	})

	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("second run with disabled cache failed: %v", err)
	}
	assertRunCounts(t, checkCount, diffCount, 2, 2)
	if strings.Contains(output.String(), "Skipping wire checks") {
		t.Fatalf("expected disabled cache run to execute instead of skipping, got %q", output.String())
	}
	if !strings.Contains(output.String(), "✓ wire checks passed") {
		t.Fatalf("expected success output, got %q", output.String())
	}
}

func writeTrackedFiles(t *testing.T, rootDir string) {
	t.Helper()

	writeFile(t, filepath.Join(rootDir, "go.mod"), "module magic\n\ngo 1.26.0\n")
	writeFile(t, filepath.Join(rootDir, "go.sum"), "")
	writeFile(t, filepath.Join(rootDir, "wire.go"), "//go:build wireinject\n\npackage main\n")
	writeFile(t, filepath.Join(rootDir, "wire_gen.go"), "// Code generated by Wire. DO NOT EDIT.\n\npackage main\n")
	writeFile(t, filepath.Join(rootDir, "internal", "di", "app", "providers.go"), "package app\n")
}

type cachedFailureCase struct {
	failureSubcommand string
	failureMessage    string
	expectedCheckRuns int
	expectedDiffRuns  int
}

func assertCachedFailure(t *testing.T, tc cachedFailureCase) {
	t.Helper()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "wire.json")

	writeTrackedFiles(t, rootDir)

	var output bytes.Buffer
	checkCount := 0
	diffCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output,
		func(context.Context, string) (string, error) {
			checkCount++
			if tc.failureSubcommand == "check" {
				return tc.failureMessage, errWireCheckFailed
			}
			return "", nil
		},
		func(context.Context, string) (string, error) {
			diffCount++
			if tc.failureSubcommand == "diff" {
				return tc.failureMessage, errWireDiffMismatch
			}
			return "", nil
		},
	)
	smartwire.SetIsDiffMatchForTest(runner, func(err error) bool { return errors.Is(err, errWireDiffMismatch) })

	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected first run to fail")
	}
	assertRunCounts(t, checkCount, diffCount, tc.expectedCheckRuns, tc.expectedDiffRuns)
	if !strings.Contains(output.String(), tc.failureMessage) {
		t.Fatalf("expected failure output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected cached second run to fail")
	}
	assertRunCounts(t, checkCount, diffCount, tc.expectedCheckRuns, tc.expectedDiffRuns)
	if !strings.Contains(output.String(), "Skipping wire checks (no changes since last run; cached failed result)") {
		t.Fatalf("expected cached skip output, got %q", output.String())
	}
	if !strings.Contains(output.String(), tc.failureMessage) {
		t.Fatalf("expected cached failure details, got %q", output.String())
	}
}

func newTestRunner(
	t *testing.T,
	rootDir, cacheFile string,
	output *bytes.Buffer,
	runCheck func(context.Context, string) (string, error),
	runDiff func(context.Context, string) (string, error),
) *smartwire.Runner {
	t.Helper()

	runner := smartwire.NewRunner(smartwire.Options{
		RootDir:   rootDir,
		CacheFile: cacheFile,
		Binary:    filepath.Join(rootDir, "wire"),
	}, output, output)
	smartwire.SetLookPathForTest(runner, func(file string) (string, error) {
		return file, nil
	})
	smartwire.SetFileHashForTest(runner, func(string) (string, error) {
		return "wire-binary-hash", nil
	})
	smartwire.SetRunCheckForTest(runner, runCheck)
	smartwire.SetRunDiffForTest(runner, runDiff)

	return runner
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	writeFileWithMode(t, path, content, 0o600)
}

func writeFileWithMode(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func assertRunCounts(t *testing.T, actualCheck, actualDiff, expectedCheck, expectedDiff int) {
	t.Helper()
	if actualCheck != expectedCheck || actualDiff != expectedDiff {
		t.Fatalf("expected check/diff runs %d/%d, got %d/%d", expectedCheck, expectedDiff, actualCheck, actualDiff)
	}
}
