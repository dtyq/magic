package rebuild

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

func normalizeRunOptions(o rebuilddto.RunOptions, isLocalDev bool, now func() time.Time, maxConcurrency int) rebuilddto.RunOptions {
	n := o
	normalized := domainrebuild.NormalizeExecutionOptions(domainrebuild.ExecutionOptions{
		Scope:       n.Scope.ToDomain(),
		Mode:        domainrebuild.RunMode(n.Mode),
		Concurrency: n.Concurrency,
		BatchSize:   n.BatchSize,
		Retry:       n.Retry,
	}, domainrebuild.RunMode(defaultMode), defaultConcurrency, maxConcurrency, defaultBatchSize, defaultRetry)
	n.Scope = rebuilddto.ScopeFromDomain(normalized.Scope)
	n.Mode = rebuilddto.RunMode(normalized.Mode)
	n.Concurrency = normalized.Concurrency
	n.BatchSize = normalized.BatchSize
	n.Retry = normalized.Retry
	if !isLocalDev {
		n.FailureReport = ""
		return n
	}
	if n.FailureReport == "" {
		n.FailureReport = buildDefaultFailureReportPath(now())
	}
	return n
}

// NormalizeRunOptions 返回归一化后的重建参数。
func NormalizeRunOptions(opts rebuilddto.RunOptions) rebuilddto.RunOptions {
	return normalizeRunOptions(opts, false, time.Now, defaultMaxConcurrency)
}

func buildDefaultFailureReportPath(now time.Time) string {
	cwd, err := os.Getwd()
	if err != nil {
		return buildFailureReportPath(defaultReportDir, now)
	}
	return buildDefaultFailureReportPathFromDir(cwd, now)
}

func buildDefaultFailureReportPathFromDir(startDir string, now time.Time) string {
	reportDir := defaultReportDir
	if moduleRoot := findGoModuleRoot(startDir); moduleRoot != "" {
		reportDir = filepath.Join(moduleRoot, defaultReportDir)
	}
	return buildFailureReportPath(reportDir, now)
}

func buildFailureReportPath(reportDir string, now time.Time) string {
	fileName := fmt.Sprintf("knowledge_rebuild_failures_%s.json", now.Format("20060102_150405"))
	return filepath.Join(reportDir, fileName)
}

func findGoModuleRoot(startDir string) string {
	dir := filepath.Clean(startDir)
	for {
		if dir == "" || dir == "." {
			return ""
		}
		goModPath := filepath.Join(dir, goModFileName)
		info, err := os.Stat(goModPath)
		if err == nil && !info.IsDir() {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}
