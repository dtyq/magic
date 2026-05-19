package layerdeps_test

import (
	"fmt"
	"go/ast"

	"golang.org/x/tools/go/analysis"

	layerdeps "magic/internal/tools/analyzers/layerdeps"
)

type (
	analyzerState     = layerdeps.AnalyzerState
	packageCacheShard = layerdeps.PackageCacheShard
	fileCacheEntry    = layerdeps.FileCacheEntry
	issueRecord       = layerdeps.IssueRecord
	layerType         = layerdeps.LayerType
)

type packageInfo struct {
	layer          layerType
	domain         string
	afterLayer     []string
	role           string
	isInRepository bool
	serviceName    string
	isInService    bool
}

type ignoreRules struct {
	ignoreAll    bool
	pathPatterns []string
}

const (
	layerUnknown        = layerdeps.LayerUnknown
	layerDI             = layerdeps.LayerDI
	layerDomain         = layerdeps.LayerDomain
	layerApplication    = layerdeps.LayerApplication
	layerInterfaces     = layerdeps.LayerInterfaces
	layerInfrastructure = layerdeps.LayerInfrastructure
)

func exportedPackageInfo(info packageInfo) layerdeps.PackageInfo {
	return layerdeps.PackageInfo{
		Layer:          info.layer,
		Domain:         info.domain,
		AfterLayer:     append([]string(nil), info.afterLayer...),
		Role:           info.role,
		IsInRepository: info.isInRepository,
		ServiceName:    info.serviceName,
		IsInService:    info.isInService,
	}
}

func localPackageInfo(info layerdeps.PackageInfo) packageInfo {
	return packageInfo{
		layer:          info.Layer,
		domain:         info.Domain,
		afterLayer:     append([]string(nil), info.AfterLayer...),
		role:           info.Role,
		isInRepository: info.IsInRepository,
		serviceName:    info.ServiceName,
		isInService:    info.IsInService,
	}
}

func (p packageInfo) isRepositoryPackage() bool {
	return exportedPackageInfo(p).IsRepositoryPackage()
}

func packageInfoFromPath(path string) (packageInfo, bool) {
	info, ok := layerdeps.PackageInfoFromPath(path, true)
	return localPackageInfo(info), ok
}

func packageInfoFromFilePath(path string) (packageInfo, bool) {
	info, ok := layerdeps.PackageInfoFromFilePath(path)
	return localPackageInfo(info), ok
}

func packageInfoFromImportPath(state *analyzerState, importPath string) (packageInfo, bool) {
	info, ok := layerdeps.PackageInfoFromImportPath(state, importPath)
	return localPackageInfo(info), ok
}

func checkDependency(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckDependency(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func checkApplicationServiceCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckApplicationServiceCrossDependency(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func checkDomainServiceCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckDomainServiceCrossDependency(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func checkRepositoryCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckRepositoryCrossDependency(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func checkInterfacesLayerRules(to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckInterfacesLayerRules(exportedPackageInfo(to), importPath)
}

func checkLayerDependencyRules(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckLayerDependencyRules(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func checkDomainLayerRules(from, to packageInfo, importPath string) (string, bool) {
	return layerdeps.CheckDomainLayerRules(exportedPackageInfo(from), exportedPackageInfo(to), importPath)
}

func allowDomainSharedKernelImport(from, to packageInfo) bool {
	return layerdeps.AllowDomainSharedKernelImport(exportedPackageInfo(from), exportedPackageInfo(to))
}

func ReadRuleConfigFromFile(path string) (layerdeps.RuleConfig, error) {
	config, err := layerdeps.ReadRuleConfigFromFile(path)
	if err != nil {
		return layerdeps.RuleConfig{}, fmt.Errorf("read rule config from file: %w", err)
	}
	return config, nil
}

func extractIgnoreRules(file *ast.File) ignoreRules {
	rules := layerdeps.ExtractIgnoreRules(file)
	return ignoreRules{
		ignoreAll:    rules.IgnoreAll,
		pathPatterns: append([]string(nil), rules.PathPatterns...),
	}
}

func shouldIgnoreImport(impPath string, spec *ast.ImportSpec, declDoc *ast.CommentGroup, rules ignoreRules) bool {
	return layerdeps.ShouldIgnoreImport(impPath, spec, declDoc, layerdeps.IgnoreRules{
		IgnoreAll:    rules.ignoreAll,
		PathPatterns: append([]string(nil), rules.pathPatterns...),
	})
}

func isLoggingImport(importPath string) bool {
	return layerdeps.IsLoggingImport(importPath)
}

func NewPackageCacheShard(pkgPath string, files map[string]fileCacheEntry, dirty bool) *packageCacheShard {
	return layerdeps.NewPackageCacheShard(pkgPath, files, dirty)
}

func SetShardDirty(shard *packageCacheShard, dirty bool) {
	layerdeps.SetShardDirty(shard, dirty)
}

func SetCacheRoot(state *analyzerState, root string) {
	layerdeps.SetCacheRoot(state, root)
}

func SetCacheState(state *analyzerState, root, analyzerHash string) {
	layerdeps.SetCacheState(state, root, analyzerHash)
}

func LoadCacheShard(state *analyzerState, pkgPath string) *packageCacheShard {
	return layerdeps.LoadCacheShard(state, pkgPath)
}

func LoadCacheShardIfEnabled(state *analyzerState, pkgPath string) *packageCacheShard {
	return layerdeps.LoadCacheShardIfEnabled(state, pkgPath)
}

func GetCacheEntry(state *analyzerState, pkgPath, filePath string) (fileCacheEntry, bool) {
	return layerdeps.GetCacheEntry(state, pkgPath, filePath)
}

func SetCacheEntryOnShard(shard *packageCacheShard, filePath string, entry fileCacheEntry) {
	layerdeps.SetCacheEntryOnShard(shard, filePath, entry)
}

func SaveCacheShard(state *analyzerState, shard *packageCacheShard) error {
	if err := layerdeps.SaveCacheShard(state, shard); err != nil {
		return fmt.Errorf("save cache shard: %w", err)
	}
	return nil
}

func AnalyzeFileImports(state *analyzerState, pass *analysis.Pass, file *ast.File, info packageInfo) []issueRecord {
	return layerdeps.AnalyzeFileImports(state, pass, file, exportedPackageInfo(info))
}

func MatchIgnorePattern(pattern, impPath string) bool {
	return layerdeps.MatchIgnorePattern(pattern, impPath)
}

func CommentGroupContains(cg *ast.CommentGroup, substr string) bool {
	return layerdeps.CommentGroupContains(cg, substr)
}

func StripRepositorySuffixes(name string) string {
	return layerdeps.StripRepositorySuffixes(name)
}

func StripServiceSuffixes(name string) string {
	return layerdeps.StripServiceSuffixes(name)
}

func FindRepoRoot(start string) string {
	return layerdeps.FindRepoRoot(start)
}

func InitCache() string {
	return layerdeps.InitCache()
}

func IsCacheEnabled() bool {
	return layerdeps.IsCacheEnabled()
}

func ExtractRepositoryServiceName(afterLayer []string, repoIdx int, isFile bool) string {
	return layerdeps.ExtractRepositoryServiceName(afterLayer, repoIdx, isFile)
}

func ExtractServiceName(afterLayer []string, serviceIdx int, isFile bool) string {
	return layerdeps.ExtractServiceName(afterLayer, serviceIdx, isFile)
}

func DetectApplicationService(info *packageInfo, isFile bool) {
	if info == nil {
		return
	}
	exported := exportedPackageInfo(*info)
	layerdeps.DetectApplicationService(&exported, isFile)
	*info = localPackageInfo(exported)
}

func DetectDomainService(info *packageInfo, isFile bool) {
	if info == nil {
		return
	}
	exported := exportedPackageInfo(*info)
	layerdeps.DetectDomainService(&exported, isFile)
	*info = localPackageInfo(exported)
}

func DetectRepositoryService(info *packageInfo, isFile bool) {
	if info == nil {
		return
	}
	exported := exportedPackageInfo(*info)
	layerdeps.DetectRepositoryService(&exported, isFile)
	*info = localPackageInfo(exported)
}

func ShardFilePath(root, pkgPath string) string {
	return layerdeps.ShardFilePath(root, pkgPath)
}

func NewAnalyzer() *analysis.Analyzer {
	return layerdeps.NewAnalyzer()
}

func hashBytes(b []byte) string {
	return layerdeps.HashBytes(b)
}
