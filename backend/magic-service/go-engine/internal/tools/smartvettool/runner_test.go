package smartvettool_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"magic/internal/tools/smartvettool"
)

func TestRunnerSkipsWhenInputsUnchanged(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	cacheFile := filepath.Join(rootDir, ".cache", "lint", "vettool.json")

	writeFile(t, filepath.Join(rootDir, "go.mod"), "module magic\n\ngo 1.26.0\n")
	writeFile(t, filepath.Join(rootDir, "cmd", "layerdeps", "main.go"), "package main\n\nfunc main() {}\n")
	writeFile(t, filepath.Join(rootDir, "internal", "tools", "analyzers", "layerdeps", "stub.go"), "package layerdeps\n")
	filePath := filepath.Join(rootDir, "internal", "pkg", "fileutil", "stub.go")
	writeFile(t, filePath, "package fileutil\n")

	var output bytes.Buffer
	runner := smartvettool.NewRunner(smartvettool.Options{
		RootDir:   rootDir,
		CacheFile: cacheFile,
	}, &output, &output)

	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("first run failed: %v", err)
	}
	if !fileExists(filepath.Join(rootDir, "bin", "layerdeps")) {
		t.Fatal("expected analyzer binary to be created")
	}
	if !strings.Contains(output.String(), "✓ Layerdeps analyzer ready") {
		t.Fatalf("expected success output, got %q", output.String())
	}

	output.Reset()
	if err := runner.Run(t.Context()); err != nil {
		t.Fatalf("second run failed: %v", err)
	}
	if !strings.Contains(output.String(), "Skipping layerdeps build (no changes since last run)") {
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
	if !strings.Contains(output.String(), "Skipping layerdeps build (content unchanged)") {
		t.Fatalf("expected content skip output, got %q", output.String())
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
