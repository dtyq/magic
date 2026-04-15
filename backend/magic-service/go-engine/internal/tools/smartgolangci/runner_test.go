package smartgolangci_test

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	smartgolangci "magic/internal/tools/smartgolangci"
)

var (
	errLintFinding               = errors.New("lint finding")
	errTransientGolangciExecFail = errors.New("temporary golangci execution failure")
)

func TestRunnerSkipsWhenInputsUnchanged(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "golangci.json")

	writeFile(t, filepath.Join(rootDir, "go.mod"), "module magic\n\ngo 1.26.0\n")
	writeFile(t, filepath.Join(rootDir, ".golangci.yml"), "version: \"2\"\n")
	filePath := filepath.Join(rootDir, "foo.go")
	writeFile(t, filePath, "package magic\n\nfunc Foo() {}\n")

	var output bytes.Buffer
	runCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output, func(context.Context, string) (string, error) {
		runCount++
		return "", nil
	})

	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("first run failed: %v", err)
	}
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), "✓ golangci-lint passed") {
		t.Fatalf("expected success output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("second run failed: %v", err)
	}
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), "Skipping golangci-lint (no changes since last run)") {
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
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), "Skipping golangci-lint (content unchanged)") {
		t.Fatalf("expected content skip output, got %q", output.String())
	}

	output.Reset()
	writeFile(t, filePath, "package magic\n\nfunc Foo() { println(\"changed\") }\n")
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("fourth run failed: %v", err)
	}
	assertRunCount(t, runCount, 2)
	if !strings.Contains(output.String(), "✓ golangci-lint passed") {
		t.Fatalf("expected rerun success output, got %q", output.String())
	}
}

func TestRunnerCachesFailedResult(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "golangci.json")

	writeFile(t, filepath.Join(rootDir, "go.mod"), "module magic\n\ngo 1.26.0\n")
	writeFile(t, filepath.Join(rootDir, ".golangci.yml"), "version: \"2\"\n")
	writeFile(t, filepath.Join(rootDir, "foo.go"), "package magic\n\nfunc Foo() {}\n")

	var output bytes.Buffer
	runCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output, func(context.Context, string) (string, error) {
		runCount++
		return "lint issue from cache test", errLintFinding
	})
	smartgolangci.SetIsFindingForTest(runner, func(err error) bool { return errors.Is(err, errLintFinding) })

	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected first run to fail")
	}
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), "lint issue from cache test") {
		t.Fatalf("expected failure output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected cached second run to fail")
	}
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), "Skipping golangci-lint (no changes since last run; cached failed result)") {
		t.Fatalf("expected cached skip output, got %q", output.String())
	}
	if !strings.Contains(output.String(), "lint issue from cache test") {
		t.Fatalf("expected cached failure details, got %q", output.String())
	}
}

func TestRunnerDoesNotCacheExecutionFailure(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "golangci.json")

	writeFile(t, filepath.Join(rootDir, "go.mod"), "module magic\n\ngo 1.26.0\n")
	writeFile(t, filepath.Join(rootDir, ".golangci.yml"), "version: \"2\"\n")
	writeFile(t, filepath.Join(rootDir, "foo.go"), "package magic\n\nfunc Foo() {}\n")

	var output bytes.Buffer
	runCount := 0
	runner := newTestRunner(t, rootDir, cacheFile, &output, func(context.Context, string) (string, error) {
		runCount++
		if runCount == 1 {
			return errTransientGolangciExecFail.Error(), errTransientGolangciExecFail
		}
		return "", nil
	})

	if err := runner.Run(t.Context()); err == nil {
		t.Fatal("expected first run to fail")
	}
	assertRunCount(t, runCount, 1)
	if !strings.Contains(output.String(), errTransientGolangciExecFail.Error()) {
		t.Fatalf("expected execution failure output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("expected second run to rerun and succeed, got %v", err)
	}
	assertRunCount(t, runCount, 2)
	if strings.Contains(output.String(), "cached failed result") {
		t.Fatalf("expected second run to rerun instead of using cache, got %q", output.String())
	}
	if !strings.Contains(output.String(), "✓ golangci-lint passed") {
		t.Fatalf("expected success output after rerun, got %q", output.String())
	}
}

func newTestRunner(t *testing.T, rootDir, cacheFile string, output *bytes.Buffer, run func(context.Context, string) (string, error)) *smartgolangci.Runner {
	t.Helper()

	runner := smartgolangci.NewRunner(smartgolangci.Options{
		RootDir:   rootDir,
		CacheFile: cacheFile,
		Binary:    filepath.Join(rootDir, "golangci-lint"),
	}, output, output)
	smartgolangci.SetLookPathForTest(runner, func(file string) (string, error) {
		return file, nil
	})
	smartgolangci.SetFileHashForTest(runner, func(string) (string, error) {
		return "golangci-binary-hash", nil
	})
	smartgolangci.SetRunLintForTest(runner, run)

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

func assertRunCount(t *testing.T, actual, expected int) {
	t.Helper()
	if actual != expected {
		t.Fatalf("expected %d runs, got %d", expected, actual)
	}
}
