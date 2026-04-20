// Package rebuild 为重建模块提供测试辅助导出。
package rebuild

import (
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
)

const (
	DefaultReportDirForTest      = defaultReportDir
	GoModFileNameForTest         = goModFileName
	FixedActiveCollectionForTest = fixedActiveCollection
	FixedShadowCollectionForTest = fixedShadowCollection
)

var (
	ErrAllScopeNoDocumentsForTest           = errAllScopeNoDocuments
	ErrOrganizationScopeNoDocumentsForTest  = errOrganizationScopeNoDocuments
	ErrKnowledgeBaseScopeNoDocumentsForTest = errKnowledgeBaseScopeNoDocuments
	ErrInplaceModeMismatchForTest           = errInplaceModeMismatch
	ErrDocumentScopeNoDocumentsForTest      = errDocumentScopeNoDocuments
	ErrResyncFailuresBlockCutoverForTest    = errResyncFailuresBlockCutover
)

func BuildDefaultFailureReportPathFromDirForTest(startDir string, now time.Time) string {
	return buildDefaultFailureReportPathFromDir(startDir, now)
}

func NormalizeRunOptionsForTest(opts rebuilddto.RunOptions, isLocalDev bool) rebuilddto.RunOptions {
	return normalizeRunOptions(opts, isLocalDev, time.Now, defaultMaxConcurrency)
}

func NormalizeRunOptionsWithMaxConcurrencyForTest(opts rebuilddto.RunOptions, isLocalDev bool, maxConcurrency int) rebuilddto.RunOptions {
	return normalizeRunOptions(opts, isLocalDev, time.Now, maxConcurrency)
}
