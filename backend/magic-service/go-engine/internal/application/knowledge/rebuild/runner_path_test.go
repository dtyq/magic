package rebuild_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
)

func TestBuildDefaultFailureReportPathFromDirUsesModuleRootRuntime(t *testing.T) {
	t.Parallel()

	moduleRoot := filepath.Join(t.TempDir(), "go-engine")
	if err := os.MkdirAll(filepath.Join(moduleRoot, "internal", "application", "knowledge", "rebuild"), 0o750); err != nil {
		t.Fatalf("create nested dir: %v", err)
	}
	writeTestGoMod(t, moduleRoot)

	startDir := filepath.Join(moduleRoot, "internal", "application", "knowledge", "rebuild")
	now := time.Date(2026, 3, 6, 15, 59, 10, 0, time.UTC)

	got := apprebuild.BuildDefaultFailureReportPathFromDirForTest(startDir, now)
	want := filepath.Join(moduleRoot, apprebuild.DefaultReportDirForTest, "knowledge_rebuild_failures_20260306_155910.json")
	if got != want {
		t.Fatalf("expected report path %q, got %q", want, got)
	}
}

func TestBuildDefaultFailureReportPathFromDirUsesRuntimeFromModuleRoot(t *testing.T) {
	t.Parallel()

	moduleRoot := filepath.Join(t.TempDir(), "go-engine")
	if err := os.MkdirAll(moduleRoot, 0o750); err != nil {
		t.Fatalf("create module root dir: %v", err)
	}
	writeTestGoMod(t, moduleRoot)

	now := time.Date(2026, 3, 6, 16, 5, 41, 0, time.UTC)
	got := apprebuild.BuildDefaultFailureReportPathFromDirForTest(moduleRoot, now)
	want := filepath.Join(moduleRoot, apprebuild.DefaultReportDirForTest, "knowledge_rebuild_failures_20260306_160541.json")
	if got != want {
		t.Fatalf("expected report path %q, got %q", want, got)
	}
}

func TestBuildDefaultFailureReportPathFromDirFallsBackToRelativeRuntimeWithoutGoMod(t *testing.T) {
	t.Parallel()

	startDir := filepath.Join(t.TempDir(), "a", "b", "c")
	if err := os.MkdirAll(startDir, 0o750); err != nil {
		t.Fatalf("create fallback start dir: %v", err)
	}

	now := time.Date(2026, 3, 6, 16, 23, 44, 0, time.UTC)
	got := apprebuild.BuildDefaultFailureReportPathFromDirForTest(startDir, now)
	want := filepath.Join(apprebuild.DefaultReportDirForTest, "knowledge_rebuild_failures_20260306_162344.json")
	if got != want {
		t.Fatalf("expected fallback report path %q, got %q", want, got)
	}
}

func TestRunOptionsNormalizeKeepsExplicitFailureReportInLocalDev(t *testing.T) {
	t.Parallel()

	explicit := filepath.Join(t.TempDir(), "custom", "failures.json")
	opts := rebuilddto.RunOptions{
		Mode:          rebuilddto.ModeInplace,
		TargetModel:   "text-embedding-3-small",
		FailureReport: explicit,
	}

	if got := apprebuild.NormalizeRunOptionsForTest(opts, true).FailureReport; got != explicit {
		t.Fatalf("expected explicit failure report %q, got %q", explicit, got)
	}
}

func TestRunOptionsNormalizeDropsFailureReportOutsideLocalDev(t *testing.T) {
	t.Parallel()

	explicit := filepath.Join(t.TempDir(), "custom", "failures.json")
	opts := rebuilddto.RunOptions{
		Mode:          rebuilddto.ModeInplace,
		TargetModel:   "text-embedding-3-small",
		FailureReport: explicit,
	}

	if got := apprebuild.NormalizeRunOptionsForTest(opts, false).FailureReport; got != "" {
		t.Fatalf("expected empty failure report outside local dev, got %q", got)
	}
}

func TestRunOptionsNormalizeDoesNotDefaultFailureReportOutsideLocalDev(t *testing.T) {
	t.Parallel()

	opts := rebuilddto.RunOptions{
		Mode: rebuilddto.ModeInplace,
	}

	if got := apprebuild.NormalizeRunOptionsForTest(opts, false).FailureReport; got != "" {
		t.Fatalf("expected no default failure report outside local dev, got %q", got)
	}
}

func TestRunOptionsNormalizeDoesNotDefaultTargetModel(t *testing.T) {
	t.Parallel()

	opts := rebuilddto.RunOptions{
		Mode: rebuilddto.ModeAuto,
	}

	if got := apprebuild.NormalizeRunOptionsForTest(opts, false).TargetModel; got != "" {
		t.Fatalf("expected empty target model, got %q", got)
	}
}

func TestRunOptionsNormalizeClampsConcurrencyToServerLimit(t *testing.T) {
	t.Parallel()

	opts := rebuilddto.RunOptions{
		Concurrency: 99,
	}

	got := apprebuild.NormalizeRunOptionsWithMaxConcurrencyForTest(opts, false, 8)
	if got.Concurrency != 8 {
		t.Fatalf("expected clamped concurrency 8, got %d", got.Concurrency)
	}
}

func TestRunOptionsNormalizeDefaultsConcurrencyBeforeClamp(t *testing.T) {
	t.Parallel()

	opts := rebuilddto.RunOptions{}

	got := apprebuild.NormalizeRunOptionsWithMaxConcurrencyForTest(opts, false, 3)
	if got.Concurrency != 3 {
		t.Fatalf("expected defaulted concurrency to be clamped to 3, got %d", got.Concurrency)
	}
}

func writeTestGoMod(t *testing.T, moduleRoot string) {
	t.Helper()

	goModPath := filepath.Join(moduleRoot, apprebuild.GoModFileNameForTest)
	content := []byte("module example.com/test\n\ngo 1.26\n")
	if err := os.WriteFile(goModPath, content, 0o600); err != nil {
		t.Fatalf("write go.mod: %v", err)
	}
}
