package layerdeps

import (
	"go/ast"
	"maps"
	"slices"

	"golang.org/x/tools/go/analysis"
)

// LayerType 表示分析器识别到的代码分层。
type LayerType string

// 对外暴露的层级常量，供外部测试包复用。
const (
	LayerUnknown        LayerType = LayerType(layerUnknown)
	LayerDI             LayerType = LayerType(layerDI)
	LayerDomain         LayerType = LayerType(layerDomain)
	LayerApplication    LayerType = LayerType(layerApplication)
	LayerInterfaces     LayerType = LayerType(layerInterfaces)
	LayerInfrastructure LayerType = LayerType(layerInfrastructure)
)

// PackageInfo 是 packageInfo 的测试友好镜像。
type PackageInfo struct {
	Layer          LayerType
	Domain         string
	AfterLayer     []string
	IsInRepository bool
	ServiceName    string
	IsInService    bool
}

// AnalyzerState 暴露分析器状态给外部测试包。
type AnalyzerState = analyzerState

// PackageCacheShard 暴露缓存分片给外部测试包。
type PackageCacheShard = packageCacheShard

// FileCacheEntry 暴露文件缓存条目给外部测试包。
type FileCacheEntry = fileCacheEntry

// IssueRecord 暴露问题记录给外部测试包。
type IssueRecord = issueRecord

// IgnoreRules 暴露忽略规则给外部测试包。
type IgnoreRules struct {
	IgnoreAll    bool
	PathPatterns []string
}

// RuleConfig 暴露 layerdeps 白名单配置，供外部测试包断言解析结果。
type RuleConfig struct {
	DomainStructureSegments      []string
	DomainSharedKernelSubdomains []string
	ApplicationCommonSubapps     []string
}

func packageInfoFromExported(info PackageInfo) packageInfo {
	return packageInfo{
		layer:          layerType(info.Layer),
		domain:         info.Domain,
		afterLayer:     append([]string(nil), info.AfterLayer...),
		isInRepository: info.IsInRepository,
		serviceName:    info.ServiceName,
		isInService:    info.IsInService,
	}
}

func packageInfoToExported(info packageInfo) PackageInfo {
	return PackageInfo{
		Layer:          LayerType(info.layer),
		Domain:         info.domain,
		AfterLayer:     append([]string(nil), info.afterLayer...),
		IsInRepository: info.isInRepository,
		ServiceName:    info.serviceName,
		IsInService:    info.isInService,
	}
}

// PackageInfoFromPath 解析绝对路径或导入路径对应的包信息。
func PackageInfoFromPath(path string, isFile bool) (PackageInfo, bool) {
	info, ok := packageInfoFromPath(path, isFile)
	return packageInfoToExported(info), ok
}

// PackageInfoFromFilePath 解析文件路径对应的包信息。
func PackageInfoFromFilePath(path string) (PackageInfo, bool) {
	info, ok := packageInfoFromFilePath(path)
	return packageInfoToExported(info), ok
}

// PackageInfoFromImportPath 解析导入路径对应的包信息。
func PackageInfoFromImportPath(state *AnalyzerState, importPath string) (PackageInfo, bool) {
	if state == nil {
		return PackageInfo{}, false
	}
	info, ok := state.packageInfoFromImportPath(importPath)
	return packageInfoToExported(info), ok
}

// CheckDependency 运行主依赖规则检查。
func CheckDependency(from, to PackageInfo, importPath string) (string, bool) {
	return checkDependency(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// CheckApplicationServiceCrossDependency 检查 application service 之间的横向依赖。
func CheckApplicationServiceCrossDependency(from, to PackageInfo, importPath string) (string, bool) {
	return checkApplicationServiceCrossDependency(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// CheckDomainServiceCrossDependency 检查 domain service 之间的横向依赖。
func CheckDomainServiceCrossDependency(from, to PackageInfo, importPath string) (string, bool) {
	return checkDomainServiceCrossDependency(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// CheckRepositoryCrossDependency 检查 repository 子服务之间的横向依赖。
func CheckRepositoryCrossDependency(from, to PackageInfo, importPath string) (string, bool) {
	return checkRepositoryCrossDependency(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// CheckInterfacesLayerRules 检查 interfaces 层的依赖规则。
func CheckInterfacesLayerRules(to PackageInfo, importPath string) (string, bool) {
	return checkInterfacesLayerRules(packageInfoFromExported(to), importPath)
}

// CheckLayerDependencyRules 检查不同层级之间的依赖规则。
func CheckLayerDependencyRules(from, to PackageInfo, importPath string) (string, bool) {
	return checkLayerDependencyRules(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// CheckDomainLayerRules 检查 domain 层专属依赖规则。
func CheckDomainLayerRules(from, to PackageInfo, importPath string) (string, bool) {
	return checkDomainLayerRules(packageInfoFromExported(from), packageInfoFromExported(to), importPath)
}

// AllowDomainSharedKernelImport 判断是否允许导入同 bounded context 的 shared kernel。
func AllowDomainSharedKernelImport(from, to PackageInfo) bool {
	return allowDomainSharedKernelImport(packageInfoFromExported(from), packageInfoFromExported(to))
}

// ReadRuleConfigFromFile 读取指定 YAML 配置文件并返回归一化后的白名单配置。
func ReadRuleConfigFromFile(path string) (RuleConfig, error) {
	config, err := readLayerdepsRuleConfigFromFile(path)
	if err != nil {
		return RuleConfig{}, err
	}
	return RuleConfig{
		DomainStructureSegments:      sortedConfigKeys(config.domainStructureSegments),
		DomainSharedKernelSubdomains: sortedConfigKeys(config.domainSharedKernelSubdomains),
		ApplicationCommonSubapps:     sortedConfigKeys(config.applicationCommonSubapps),
	}, nil
}

// ExtractIgnoreRules 解析文件级忽略规则。
func ExtractIgnoreRules(file *ast.File) IgnoreRules {
	rules := extractIgnoreRules(file)
	return IgnoreRules{
		IgnoreAll:    rules.ignoreAll,
		PathPatterns: append([]string(nil), rules.pathPatterns...),
	}
}

// ShouldIgnoreImport 判断某个 import 是否应被跳过检查。
func ShouldIgnoreImport(impPath string, spec *ast.ImportSpec, declDoc *ast.CommentGroup, rules IgnoreRules) bool {
	return shouldIgnoreImport(impPath, spec, declDoc, ignoreRules{
		ignoreAll:    rules.IgnoreAll,
		pathPatterns: append([]string(nil), rules.PathPatterns...),
	})
}

// IsLoggingImport 判断导入路径是否属于 logging 特例。
func IsLoggingImport(importPath string) bool {
	return isLoggingImport(importPath)
}

// NewPackageCacheShard 创建测试可用的缓存分片。
func NewPackageCacheShard(pkgPath string, files map[string]FileCacheEntry, dirty bool) *PackageCacheShard {
	shard := &packageCacheShard{
		PackagePath: pkgPath,
		Files:       make(map[string]fileCacheEntry, len(files)),
		dirty:       dirty,
	}
	maps.Copy(shard.Files, files)
	return shard
}

// SetShardDirty 修改缓存分片的 dirty 状态。
func SetShardDirty(shard *PackageCacheShard, dirty bool) {
	if shard == nil {
		return
	}
	shard.dirty = dirty
}

// SetCacheRoot 设置缓存根目录。
func SetCacheRoot(state *AnalyzerState, root string) {
	if state == nil {
		return
	}
	state.cacheRoot = root
}

// SetCacheState 设置缓存初始化后的核心状态。
func SetCacheState(state *AnalyzerState, root, analyzerHash string) {
	if state == nil {
		return
	}
	state.cacheRoot = root
	state.analyzerHash = analyzerHash
	state.initOnce.Do(func() {})
}

// LoadCacheShard 加载指定包的缓存分片。
func LoadCacheShard(state *AnalyzerState, pkgPath string) *PackageCacheShard {
	return state.loadCacheShard(pkgPath)
}

// LoadCacheShardIfEnabled 在缓存开启时加载指定包的缓存分片。
func LoadCacheShardIfEnabled(state *AnalyzerState, pkgPath string) *PackageCacheShard {
	return state.loadCacheShardIfEnabled(pkgPath)
}

// GetCacheEntry 读取指定文件的缓存条目。
func GetCacheEntry(state *AnalyzerState, pkgPath, filePath string) (FileCacheEntry, bool) {
	return state.getCacheEntry(pkgPath, filePath)
}

// SetCacheEntryOnShard 向缓存分片写入文件缓存条目。
func SetCacheEntryOnShard(shard *PackageCacheShard, filePath string, entry FileCacheEntry) {
	setCacheEntryOnShard(shard, filePath, entry)
}

// SaveCacheShard 持久化缓存分片。
func SaveCacheShard(state *AnalyzerState, shard *PackageCacheShard) error {
	return state.saveCacheShard(shard)
}

// AnalyzeFileImports 直接执行单文件 import 分析。
func AnalyzeFileImports(state *AnalyzerState, pass *analysis.Pass, file *ast.File, info PackageInfo) []IssueRecord {
	if state == nil {
		return nil
	}
	return state.analyzeFileImports(pass, file, packageInfoFromExported(info))
}

// MatchIgnorePattern 判断忽略规则是否匹配导入路径。
func MatchIgnorePattern(pattern, impPath string) bool {
	return matchIgnorePattern(pattern, impPath)
}

// CommentGroupContains 判断注释组是否包含指定子串。
func CommentGroupContains(cg *ast.CommentGroup, substr string) bool {
	return commentGroupContains(cg, substr)
}

// StripRepositorySuffixes 去掉 repository 命名后缀。
func StripRepositorySuffixes(name string) string {
	return stripRepositorySuffixes(name)
}

// StripServiceSuffixes 去掉 service 命名后缀。
func StripServiceSuffixes(name string) string {
	return stripServiceSuffixes(name)
}

// FindRepoRoot 从给定目录向上查找仓库根目录。
func FindRepoRoot(start string) string {
	return findRepoRoot(start)
}

// InitCache 初始化缓存目录。
func InitCache() string {
	return initCache()
}

// IsCacheEnabled 返回缓存是否启用。
func IsCacheEnabled() bool {
	return isCacheEnabled()
}

// ExtractRepositoryServiceName 解析 repository service 名。
func ExtractRepositoryServiceName(afterLayer []string, repoIdx int, isFile bool) string {
	return extractRepositoryServiceName(afterLayer, repoIdx, isFile)
}

// ExtractServiceName 解析 service 名。
func ExtractServiceName(afterLayer []string, serviceIdx int, isFile bool) string {
	return extractServiceName(afterLayer, serviceIdx, isFile)
}

// DetectApplicationService 识别 application service 包。
func DetectApplicationService(info *PackageInfo, isFile bool) {
	if info == nil {
		return
	}
	current := packageInfoFromExported(*info)
	detectApplicationService(&current, isFile)
	*info = packageInfoToExported(current)
}

// DetectDomainService 识别 domain service 包。
func DetectDomainService(info *PackageInfo, isFile bool) {
	if info == nil {
		return
	}
	current := packageInfoFromExported(*info)
	detectDomainService(&current, isFile)
	*info = packageInfoToExported(current)
}

// DetectRepositoryService 识别 repository service 包。
func DetectRepositoryService(info *PackageInfo, isFile bool) {
	if info == nil {
		return
	}
	current := packageInfoFromExported(*info)
	detectRepositoryService(&current, isFile)
	*info = packageInfoToExported(current)
}

// ShardFilePath 生成缓存分片文件路径。
func ShardFilePath(root, pkgPath string) string {
	return shardFilePath(root, pkgPath)
}

// HashBytes 计算字节切片的稳定哈希。
func HashBytes(b []byte) string {
	return hashBytes(b)
}

// IsRepositoryPackage 返回包信息是否表示 repository 包。
func (p PackageInfo) IsRepositoryPackage() bool {
	return packageInfoFromExported(p).isRepositoryPackage()
}

func sortedConfigKeys(values map[string]struct{}) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}
