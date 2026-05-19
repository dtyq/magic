// Package layerdeps 提供自定义分析器，用于校验 DDD 分层依赖。
package layerdeps

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/tools/go/analysis"
	"gopkg.in/yaml.v3"

	"magic/internal/pkg/fileutil"
)

const (
	analyzerName = "layerdeps"
	analyzerDoc  = "checks DDD layered dependencies under internal/"
	// 缓存文件/目录的权限常量。
	permDir                 = 0o750
	permFile                = 0o600
	layerdepsConfigFilePath = "internal/tools/analyzers/layerdeps/whitelist.yaml"
)

type staticError string

func (e staticError) Error() string { return string(e) }

const (
	errGetCurrentWorkingDirectory staticError = "get current working directory"
	errFindRepoRoot               staticError = "find repo root"
)

// NewAnalyzer 构建 DDD 依赖边界检查器的分析器实例。
func NewAnalyzer() *analysis.Analyzer {
	state := newAnalyzerState()
	return &analysis.Analyzer{
		Name:       analyzerName,
		Doc:        analyzerDoc,
		ResultType: reflect.TypeFor[struct{}](),
		Run:        state.run,
	}
}

type layerType string

const (
	layerUnknown        layerType = ""
	layerDI             layerType = "di"
	layerDomain         layerType = "domain"
	layerApplication    layerType = "application"
	layerInterfaces     layerType = "interfaces"
	layerInfrastructure layerType = "infrastructure"
	pathSegmentRepo               = "repository"
	pathSegmentService            = "service"
)

type packageInfo struct {
	layer      layerType
	domain     string
	afterLayer []string
	role       domainPackageRole
	// 用于 repository 服务/仓储检测
	isInRepository bool
	serviceName    string
	// 用于 application/domain 服务检测
	isInService bool
}

type domainPackageRole string

const (
	domainRoleUnknown    domainPackageRole = ""
	domainRoleEntity     domainPackageRole = "entity"
	domainRoleModel      domainPackageRole = "model"
	domainRoleRepository domainPackageRole = "repository"
	domainRoleService    domainPackageRole = "service"
	domainRoleShared     domainPackageRole = "shared"
	domainRoleMetadata   domainPackageRole = "metadata"
	domainRoleRetrieval  domainPackageRole = "retrieval"
)

type layerdepsConfigFile struct {
	Domain      layerdepsDomainConfig      `yaml:"domain"`
	Application layerdepsApplicationConfig `yaml:"application"`
}

type layerdepsDomainConfig struct {
	StructureSegmentsWhitelist      []string `yaml:"structureSegmentsWhitelist"`
	SharedKernelSubdomainsWhitelist []string `yaml:"sharedKernelSubdomainsWhitelist"`
}

type layerdepsApplicationConfig struct {
	CommonSubappsWhitelist []string `yaml:"commonSubappsWhitelist"`
}

type layerdepsRuleConfig struct {
	domainStructureSegments      map[string]struct{}
	domainSharedKernelSubdomains map[string]struct{}
	applicationCommonSubapps     map[string]struct{}
}

// --------------- 简单的磁盘缓存 -----------------

// 分析器状态封装缓存与配置
type analyzerState struct {
	cacheRoot          string
	analyzerHash       string
	shards             sync.Map // map[string]*packageCacheShard（包路径 -> shard）
	pathInfo           sync.Map // map[string]packageInfo（导入路径 -> 信息）
	initOnce           sync.Once
	ruleConfigInitOnce sync.Once
	ruleConfigLoader   func() (layerdepsRuleConfig, error)
}

type packageCacheShard struct {
	sync.RWMutex
	AnalyzerHash string                    `json:"analyzer_hash,omitempty"`
	PackagePath  string                    `json:"package_path"`
	Files        map[string]fileCacheEntry `json:"files"` // 文件绝对路径 -> 条目
	dirty        bool                      // 未保存的变更
}

type fileCacheEntry struct {
	FileHash    string        `json:"file_hash"`
	Issues      []issueRecord `json:"issues"`
	ModUnixNano int64         `json:"mod_unix_nano"`
	Size        int64         `json:"size"`
}

type issueRecord struct {
	Line    int    `json:"line"`
	Message string `json:"message"`
}

// CacheCheckParams 缓存检查参数
type CacheCheckParams struct {
	Pass        *analysis.Pass
	Shard       *packageCacheShard
	PkgPath     string
	AbsPath     string
	File        *ast.File
	FileHash    string
	ModUnixNano int64
	Size        int64
}

// FileMeta 文件元数据
type FileMeta struct {
	FileHash    string
	ModUnixNano int64
	Size        int64
}

func isCacheEnabled() bool { // 默认总是开启
	return true
}

func newAnalyzerState() *analyzerState {
	state := &analyzerState{}
	state.initRuleConfigLoader()
	return state
}

func readLayerdepsRuleConfig() (layerdepsRuleConfig, error) {
	configPath, err := resolveLayerdepsConfigPath()
	if err != nil {
		return layerdepsRuleConfig{}, err
	}
	return readLayerdepsRuleConfigFromFile(configPath)
}

func readLayerdepsRuleConfigFromFile(configPath string) (layerdepsRuleConfig, error) {
	content, err := os.ReadFile(configPath)
	if err != nil {
		return layerdepsRuleConfig{}, fmt.Errorf("read layerdeps config %s: %w", configPath, err)
	}

	var configFile layerdepsConfigFile
	if err := yaml.Unmarshal(content, &configFile); err != nil {
		return layerdepsRuleConfig{}, fmt.Errorf("unmarshal layerdeps config %s: %w", configPath, err)
	}

	return layerdepsRuleConfig{
		domainStructureSegments:      normalizeWhitelist(configFile.Domain.StructureSegmentsWhitelist),
		domainSharedKernelSubdomains: normalizeWhitelist(configFile.Domain.SharedKernelSubdomainsWhitelist),
		applicationCommonSubapps:     normalizeWhitelist(configFile.Application.CommonSubappsWhitelist),
	}, nil
}

func resolveLayerdepsConfigPath() (string, error) {
	if _, currentFile, _, ok := runtime.Caller(0); ok {
		candidate := filepath.Join(filepath.Dir(currentFile), "whitelist.yaml")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("%w: %w", errGetCurrentWorkingDirectory, err)
	}
	root := findRepoRoot(cwd)
	if root == "" {
		return "", fmt.Errorf("%w: %s", errFindRepoRoot, cwd)
	}
	return filepath.Join(root, layerdepsConfigFilePath), nil
}

func normalizeWhitelist(items []string) map[string]struct{} {
	result := make(map[string]struct{}, len(items))
	for _, item := range items {
		normalized := strings.TrimSpace(item)
		if normalized == "" {
			continue
		}
		result[normalized] = struct{}{}
	}
	return result
}

func whitelistContains(values map[string]struct{}, target string) bool {
	if len(values) == 0 {
		return false
	}
	_, ok := values[strings.TrimSpace(target)]
	return ok
}

func initCache() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	root := findRepoRoot(cwd)
	if root == "" {
		root = cwd
	}
	dir := filepath.Join(root, ".cache", "layerdeps")
	_ = os.MkdirAll(dir, permDir)
	return root
}

func currentAnalyzerHash() string {
	exePath, err := os.Executable()
	if err != nil {
		return ""
	}

	hash, err := fileutil.FileHash(exePath)
	if err != nil {
		return ""
	}

	return hash
}

func shardFilePath(root, pkgPath string) string {
	// 将包路径转换为安全文件名：internal/config -> internal_config.json
	safe := strings.ReplaceAll(pkgPath, "/", "_")
	safe = strings.ReplaceAll(safe, "\\", "_")
	return filepath.Join(root, ".cache", "layerdeps", safe+".json")
}

// findRepoRoot 从起始目录向上查找并返回第一个包含 go.mod 的目录；
// 未找到则返回空字符串。
func findRepoRoot(start string) string {
	dir := start
	for {
		if dir == "" || dir == "/" {
			return ""
		}
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func (s *analyzerState) ensureInit() {
	s.initOnce.Do(func() {
		s.cacheRoot = initCache()
		s.analyzerHash = currentAnalyzerHash()
	})
}

func (s *analyzerState) initRuleConfigLoader() {
	if s == nil {
		return
	}
	s.ruleConfigInitOnce.Do(func() {
		s.ruleConfigLoader = sync.OnceValues(readLayerdepsRuleConfig)
	})
}

func (s *analyzerState) loadRuleConfig() (layerdepsRuleConfig, error) {
	if s == nil {
		return readLayerdepsRuleConfig()
	}
	s.initRuleConfigLoader()
	if s.ruleConfigLoader == nil {
		return readLayerdepsRuleConfig()
	}
	return s.ruleConfigLoader()
}

func (s *analyzerState) loadCacheShard(pkgPath string) *packageCacheShard {
	s.ensureInit()

	// 优先从 sync.Map 快速读取
	if val, ok := s.shards.Load(pkgPath); ok {
		if shard, ok := val.(*packageCacheShard); ok {
			return shard
		}
		s.shards.Delete(pkgPath)
	}

	// 新建或从磁盘加载
	shard := &packageCacheShard{
		AnalyzerHash: s.analyzerHash,
		PackagePath:  pkgPath,
		Files:        make(map[string]fileCacheEntry),
	}

	if loaded := s.loadCompatibleShard(pkgPath); loaded != nil {
		shard = loaded
	}

	// 直接存入 sync.Map（竞争可接受，缓存加载可采用最后写入覆盖）
	actual, _ := s.shards.LoadOrStore(pkgPath, shard)
	if cached, ok := actual.(*packageCacheShard); ok {
		return cached
	}
	s.shards.Store(pkgPath, shard)
	return shard
}

func (s *analyzerState) loadCompatibleShard(pkgPath string) *packageCacheShard {
	if s.cacheRoot == "" {
		return nil
	}

	path := shardFilePath(s.cacheRoot, pkgPath)
	content, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	loaded := &packageCacheShard{}
	if json.Unmarshal(content, loaded) != nil || !s.isCompatibleShard(loaded) {
		return nil
	}
	if loaded.Files == nil {
		loaded.Files = make(map[string]fileCacheEntry)
	}

	return loaded
}

func (s *analyzerState) isCompatibleShard(shard *packageCacheShard) bool {
	if shard == nil {
		return false
	}

	return s.analyzerHash != "" &&
		shard.AnalyzerHash != "" &&
		shard.AnalyzerHash == s.analyzerHash
}

func (s *analyzerState) saveCacheShard(shard *packageCacheShard) error {
	if shard == nil || s.cacheRoot == "" {
		return nil
	}

	shard.Lock()
	defer shard.Unlock()

	if !shard.dirty {
		return nil
	}

	shard.AnalyzerHash = s.analyzerHash

	b, err := json.Marshal(shard)
	if err != nil {
		return fmt.Errorf("marshal cache shard: %w", err)
	}

	path := shardFilePath(s.cacheRoot, shard.PackagePath)
	if err := fileutil.AtomicWriteFile(path, b, permFile); err != nil {
		return fmt.Errorf("write cache shard: %w", err)
	}
	shard.dirty = false
	return nil
}

func (s *analyzerState) getCacheEntry(pkgPath, filePath string) (fileCacheEntry, bool) {
	shard := s.loadCacheShard(pkgPath)
	if shard == nil {
		return fileCacheEntry{}, false
	}
	shard.RLock()
	defer shard.RUnlock()
	v, ok := shard.Files[filePath]
	return v, ok
}

// hashBytes 使用 FNV-1a 计算字节数组的快速哈希
func hashBytes(b []byte) string {
	return fileutil.HashBytes(b)
}

// ignoreRules 保存从注释解析的文件级忽略配置。
type ignoreRules struct {
	ignoreAll    bool
	pathPatterns []string // 精确或前缀匹配；前缀可用 '*' 或 '/*' 结尾
}

func (s *analyzerState) run(pass *analysis.Pass) (any, error) {
	// 在某些测试/插桩场景 pass.Pkg 为空时也能推导安全包路径
	pkgPath := "unknown"
	if pass.Pkg != nil {
		pkgPath = pass.Pkg.Path()
	}
	shard := s.loadCacheShardIfEnabled(pkgPath)

	for _, file := range pass.Files {
		f := pass.Fset.File(file.Pos())
		if f == nil {
			// 若无法解析文件名则跳过（正常情况下不应发生）
			continue
		}
		filename := f.Name()
		absPath, _ := filepath.Abs(filename)

		// 快速路径：先用 stat 尝试缓存命中（不读文件）
		var (
			modUnix int64
			size    int64
		)
		if fi, statErr := os.Stat(filename); statErr == nil {
			modUnix = fi.ModTime().UnixNano()
			size = fi.Size()
			if tryEmitCachedIssuesWithStat(&CacheCheckParams{
				Pass:        pass,
				Shard:       shard,
				PkgPath:     pkgPath,
				AbsPath:     absPath,
				File:        file,
				ModUnixNano: modUnix,
				Size:        size,
			}) {
				continue
			}
		}

		// 仅在 stat 快速路径未命中时读取文件并计算哈希。
		// 注意：测试场景下文件可能不存在，需要优雅处理
		content, err := os.ReadFile(filename)
		var fileHash string
		if err == nil {
			fileHash = hashBytes(content)
			// 尝试使用预计算哈希的缓存结果
			if tryEmitCachedIssuesWithHash(&CacheCheckParams{
				Pass:     pass,
				Shard:    shard,
				PkgPath:  pkgPath,
				AbsPath:  absPath,
				File:     file,
				FileHash: fileHash,
			}) {
				continue
			}
		}
		// 若文件不存在（如测试场景），跳过缓存但仍执行分析

		// 执行分析
		pkgInfo, ok := packageInfoFromFilePath(filename)
		if !ok {
			continue
		}

		collected := s.analyzeFileImports(pass, file, pkgInfo)

		// 仅在成功读取文件时更新缓存
		if err == nil {
			updateCacheForFileWithMeta(shard, absPath, FileMeta{
				FileHash:    fileHash,
				ModUnixNano: modUnix,
				Size:        size,
			}, collected)
		}
	}

	s.saveCacheShardIfEnabled(shard)
	return struct{}{}, nil
}

func (s *analyzerState) loadCacheShardIfEnabled(pkgPath string) *packageCacheShard {
	if !isCacheEnabled() {
		return nil
	}
	return s.loadCacheShard(pkgPath)
}

// tryEmitCachedIssuesWithHash 检查缓存，命中则输出问题（使用预计算哈希优化）
func tryEmitCachedIssuesWithHash(params *CacheCheckParams) bool {
	if params.Shard == nil || params.File == nil || params.Pass == nil || params.Pass.Fset == nil {
		return false
	}

	entry, ok := getCacheEntryFromShard(params.Shard, params.AbsPath)
	if !ok {
		return false
	}

	if entry.FileHash != params.FileHash {
		return false
	}

	// 缓存命中：重新输出缓存诊断
	f := params.Pass.Fset.File(params.File.Pos())
	if f == nil {
		for _, it := range entry.Issues {
			params.Pass.Reportf(params.File.Pos(), "%s", it.Message)
		}
		return true
	}
	for _, it := range entry.Issues {
		pos := f.LineStart(it.Line)
		params.Pass.Reportf(pos, "%s", it.Message)
	}
	return true
}

// tryEmitCachedIssuesWithStat 使用文件 mtime/size 命中缓存并输出问题
func tryEmitCachedIssuesWithStat(params *CacheCheckParams) bool {
	if params.Shard == nil || params.File == nil || params.Pass == nil || params.Pass.Fset == nil {
		return false
	}
	entry, ok := getCacheEntryFromShard(params.Shard, params.AbsPath)
	if !ok {
		return false
	}
	if entry.ModUnixNano != params.ModUnixNano || entry.Size != params.Size {
		return false
	}
	f := params.Pass.Fset.File(params.File.Pos())
	if f == nil {
		for _, it := range entry.Issues {
			params.Pass.Reportf(params.File.Pos(), "%s", it.Message)
		}
		return true
	}
	for _, it := range entry.Issues {
		pos := f.LineStart(it.Line)
		params.Pass.Reportf(pos, "%s", it.Message)
	}
	return true
}

func (s *analyzerState) analyzeFileImports(pass *analysis.Pass, file *ast.File, pkgInfo packageInfo) []issueRecord {
	var collected []issueRecord
	rules := extractIgnoreRules(file)

	for _, decl := range file.Decls {
		gd, ok := decl.(*ast.GenDecl)
		if !ok || gd.Tok != token.IMPORT {
			continue
		}
		collected = append(collected, s.analyzeImportSpecs(pass, gd, pkgInfo, rules)...)
	}

	return collected
}

func (s *analyzerState) analyzeImportSpecs(pass *analysis.Pass, gd *ast.GenDecl, pkgInfo packageInfo, rules ignoreRules) []issueRecord {
	// 预分配切片容量，避免多次分配
	collected := make([]issueRecord, 0, len(gd.Specs))
	config, err := s.loadRuleConfig()
	if err != nil {
		config = layerdepsRuleConfig{}
	}

	for _, sp := range gd.Specs {
		spec, ok := sp.(*ast.ImportSpec)
		if !ok {
			continue
		}

		impPath, err := strconv.Unquote(spec.Path.Value)
		if err != nil || shouldIgnoreImport(impPath, spec, gd.Doc, rules) {
			continue
		}

		impInfo, ok := s.packageInfoFromImportPath(impPath)
		if !ok {
			continue
		}

		if msg, violated := checkDependencyWithConfig(config, pkgInfo, impInfo, impPath); violated {
			pass.Reportf(spec.Path.Pos(), "%s", msg)
			if isCacheEnabled() {
				pos := pass.Fset.Position(spec.Path.Pos())
				collected = append(collected, issueRecord{Line: pos.Line, Message: msg})
			}
		}
	}

	return collected
}

// updateCacheForFileWithMeta 使用预计算哈希更新缓存（优化：不重复读文件）
func updateCacheForFileWithMeta(shard *packageCacheShard, absPath string, meta FileMeta, collected []issueRecord) {
	if shard == nil {
		return
	}

	setCacheEntryOnShard(shard, absPath, fileCacheEntry{
		FileHash:    meta.FileHash,
		Issues:      collected,
		ModUnixNano: meta.ModUnixNano,
		Size:        meta.Size,
	})
}

func (s *analyzerState) saveCacheShardIfEnabled(shard *packageCacheShard) {
	if shard != nil {
		_ = s.saveCacheShard(shard)
	}
}

// 分片级缓存访问辅助，避免重复加载与冗余全局锁
func getCacheEntryFromShard(shard *packageCacheShard, filePath string) (fileCacheEntry, bool) {
	shard.RLock()
	defer shard.RUnlock()
	v, ok := shard.Files[filePath]
	return v, ok
}

func setCacheEntryOnShard(shard *packageCacheShard, filePath string, entry fileCacheEntry) {
	shard.Lock()
	shard.Files[filePath] = entry
	shard.dirty = true
	shard.Unlock()
}

func checkDependency(from, to packageInfo, importPath string) (string, bool) {
	return newAnalyzerState().checkDependency(from, to, importPath)
}

func (s *analyzerState) checkDependency(from, to packageInfo, importPath string) (string, bool) {
	config, err := s.loadRuleConfig()
	if err != nil {
		config = layerdepsRuleConfig{}
	}
	return checkDependencyWithConfig(config, from, to, importPath)
}

func checkDependencyWithConfig(config layerdepsRuleConfig, from, to packageInfo, importPath string) (string, bool) {
	// 全局例外：允许任何层导入 infrastructure/logging
	if isLoggingImport(importPath) {
		return "", false
	}

	// 检查 repository 跨依赖
	if msg, violated := checkRepositoryCrossDependency(from, to, importPath); violated {
		return msg, true
	}

	// 检查 application 服务跨依赖
	if msg, violated := checkApplicationServiceCrossDependency(from, to, importPath); violated {
		return msg, true
	}

	// 检查 application 子 app 横向依赖
	if msg, violated := checkApplicationSiblingDependency(config, from, to, importPath); violated {
		return msg, true
	}

	// 检查 domain 服务跨依赖
	if msg, violated := checkDomainServiceCrossDependency(from, to, importPath); violated {
		return msg, true
	}

	// 检查分层规则
	return checkLayerDependencyRulesWithConfig(config, from, to, importPath)
}

func isLoggingImport(importPath string) bool {
	const marker = "/internal/infrastructure/logging"
	_, after, ok := strings.Cut(importPath, marker)
	if !ok {
		return false
	}
	rest := after
	return rest == "" || strings.HasPrefix(rest, "/")
}

func checkRepositoryCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	if !from.isInRepository || !to.isInRepository {
		return "", false
	}
	if from.layer != layerDomain || to.layer != layerDomain {
		return "", false
	}
	if from.domain != to.domain {
		return "", false
	}
	if from.serviceName == "" || to.serviceName == "" || from.serviceName == to.serviceName {
		return "", false
	}

	return fmt.Sprintf(
		"repository service/repository '%s' must not depend on '%s' in domain '%s' (%s). hint: extract a shared repository or depend on domain interfaces only",
		from.serviceName, to.serviceName, from.domain, importPath,
	), true
}

func checkApplicationServiceCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	if from.layer != layerApplication || to.layer != layerApplication {
		return "", false
	}
	if !from.isInService || !to.isInService {
		return "", false
	}
	if sameApplicationSubdomain(from, to) {
		return "", false
	}
	if from.serviceName == "" || to.serviceName == "" || from.serviceName == to.serviceName {
		return "", false
	}

	return fmt.Sprintf(
		"application service '%s' must not depend on application service '%s' (%s). hint: depend on domain services or extract shared logic to domain layer",
		from.serviceName, to.serviceName, importPath,
	), true
}

func sameApplicationSubdomain(from, to packageInfo) bool {
	fromSubdomain, fromOK := applicationSubdomain(from)
	toSubdomain, toOK := applicationSubdomain(to)
	if !fromOK || !toOK {
		return false
	}
	return fromSubdomain == toSubdomain
}

func checkApplicationSiblingDependency(config layerdepsRuleConfig, from, to packageInfo, importPath string) (string, bool) {
	if from.layer != layerApplication || to.layer != layerApplication {
		return "", false
	}

	fromSubdomain, fromOK := applicationSubdomain(from)
	toSubdomain, toOK := applicationSubdomain(to)
	if !fromOK || !toOK {
		return "", false
	}

	if fromSubdomain == toSubdomain {
		return "", false
	}
	if allowApplicationCommonImport(config, fromSubdomain, toSubdomain) {
		return "", false
	}

	return fmt.Sprintf(
		"application sub-app '%s' must not import sibling sub-app '%s' (%s). hint: orchestrate in a dedicated single-flow app or depend on internal/application/<bounded-context>/{helper,shared}",
		fromSubdomain, toSubdomain, importPath,
	), true
}

func applicationSubdomain(info packageInfo) (string, bool) {
	if info.layer != layerApplication || len(info.afterLayer) < 2 {
		return "", false
	}

	contextName := strings.TrimSpace(info.afterLayer[0])
	subdomain := strings.TrimSpace(info.afterLayer[1])
	if contextName == "" || subdomain == "" {
		return "", false
	}

	if strings.HasSuffix(contextName, ".go") || strings.HasSuffix(subdomain, ".go") {
		return "", false
	}

	return contextName + "/" + subdomain, true
}

func allowApplicationCommonImport(config layerdepsRuleConfig, fromSubdomain, toSubdomain string) bool {
	if fromSubdomain == "" || toSubdomain == "" {
		return false
	}

	fromContext, _, fromOK := splitApplicationSubdomain(fromSubdomain)
	toContext, toLeaf, toOK := splitApplicationSubdomain(toSubdomain)
	if !fromOK || !toOK || fromContext != toContext {
		return false
	}

	return whitelistContains(config.applicationCommonSubapps, toLeaf)
}

func splitApplicationSubdomain(subdomain string) (string, string, bool) {
	contextName, leaf, ok := strings.Cut(strings.TrimSpace(subdomain), "/")
	if !ok || contextName == "" || leaf == "" {
		return "", "", false
	}
	return contextName, leaf, true
}

func checkDomainServiceCrossDependency(from, to packageInfo, importPath string) (string, bool) {
	if from.layer != layerDomain || to.layer != layerDomain {
		return "", false
	}
	if !from.isInService || !to.isInService {
		return "", false
	}
	if from.domain != to.domain {
		return "", false
	}
	if from.serviceName == "" || to.serviceName == "" || from.serviceName == to.serviceName {
		return "", false
	}

	return fmt.Sprintf(
		"domain service '%s' must not depend on domain service '%s' in domain '%s' (%s). hint: extract shared logic to a common domain service or use domain interfaces",
		from.serviceName, to.serviceName, from.domain, importPath,
	), true
}

func checkLayerDependencyRules(from, to packageInfo, importPath string) (string, bool) {
	return newAnalyzerState().checkLayerDependencyRules(from, to, importPath)
}

func (s *analyzerState) checkLayerDependencyRules(from, to packageInfo, importPath string) (string, bool) {
	config, err := s.loadRuleConfig()
	if err != nil {
		config = layerdepsRuleConfig{}
	}
	return checkLayerDependencyRulesWithConfig(config, from, to, importPath)
}

func checkLayerDependencyRulesWithConfig(config layerdepsRuleConfig, from, to packageInfo, importPath string) (string, bool) {
	switch from.layer {
	case layerDI:
		return checkDILayerRules()
	case layerDomain:
		return checkDomainLayerRulesWithConfig(config, from, to, importPath)
	case layerApplication:
		return checkApplicationLayerRules(to, importPath)
	case layerInterfaces:
		return checkInterfacesLayerRules(to, importPath)
	case layerInfrastructure:
		return checkInfrastructureLayerRules(to, importPath)
	case layerUnknown:
		// 未知层不受 DDD 分层规则约束
		return "", false
	}
	return "", false
}

func checkDILayerRules() (string, bool) {
	return "", false
}

func checkDomainLayerRules(from, to packageInfo, importPath string) (string, bool) {
	return newAnalyzerState().checkDomainLayerRules(from, to, importPath)
}

func (s *analyzerState) checkDomainLayerRules(from, to packageInfo, importPath string) (string, bool) {
	config, err := s.loadRuleConfig()
	if err != nil {
		config = layerdepsRuleConfig{}
	}
	return checkDomainLayerRulesWithConfig(config, from, to, importPath)
}

func checkDomainLayerRulesWithConfig(config layerdepsRuleConfig, from, to packageInfo, importPath string) (string, bool) {
	if to.layer == layerDomain && from.domain != "" && to.domain != "" && from.domain != to.domain {
		if allowDomainSharedKernelImportWithConfig(config, from, to) {
			return "", false
		}
		return fmt.Sprintf(
			"domain '%s' must not import domain '%s' (%s). hint: avoid cross-subdomain deps; move shared contracts to internal/domain/<bounded-context>/shared or orchestrate via application",
			from.domain, to.domain, importPath,
		), true
	}
	if to.layer != layerDomain && to.layer != layerUnknown {
		if to.layer == layerDI {
			return fmt.Sprintf(
				"domain layer must not depend on di layer (%s). hint: move provider/wire code to internal/di and keep domain depending only on its subdomain or shared kernel",
				importPath,
			), true
		}
		return fmt.Sprintf(
			"domain layer must not depend on %s layer (%s). hint: keep domain pure; depend on domain interfaces or move cross-subdomain contracts to shared",
			string(to.layer), importPath,
		), true
	}
	return "", false
}

func allowDomainSharedKernelImport(from, to packageInfo) bool {
	return newAnalyzerState().allowDomainSharedKernelImport(from, to)
}

func (s *analyzerState) allowDomainSharedKernelImport(from, to packageInfo) bool {
	config, err := s.loadRuleConfig()
	if err != nil {
		return false
	}
	return allowDomainSharedKernelImportWithConfig(config, from, to)
}

func allowDomainSharedKernelImportWithConfig(config layerdepsRuleConfig, from, to packageInfo) bool {
	if from.layer != layerDomain || to.layer != layerDomain {
		return false
	}
	return isSharedKernelDomain(config, to.domain) && sameDomainBoundedContext(from.domain, to.domain)
}

func isSharedKernelDomain(config layerdepsRuleConfig, domain string) bool {
	trimmed := strings.TrimSpace(domain)
	if trimmed == "" {
		return false
	}
	if whitelistContains(config.domainSharedKernelSubdomains, trimmed) {
		return true
	}
	if _, leaf, ok := strings.Cut(trimmed, "/"); ok {
		return whitelistContains(config.domainSharedKernelSubdomains, leaf)
	}
	return false
}

func sameDomainBoundedContext(left, right string) bool {
	leftContext := boundedContextFromDomain(left)
	rightContext := boundedContextFromDomain(right)
	return leftContext != "" && leftContext == rightContext
}

func boundedContextFromDomain(domain string) string {
	trimmed := strings.TrimSpace(domain)
	if trimmed == "" {
		return ""
	}
	if head, _, ok := strings.Cut(trimmed, "/"); ok {
		return head
	}
	return trimmed
}

func checkApplicationLayerRules(to packageInfo, importPath string) (string, bool) {
	if to.layer == layerDI {
		return fmt.Sprintf(
			"application layer must not depend on di layer (%s). hint: application must not import composition root; move provider/wire usage to internal/di",
			importPath,
		), true
	}
	if to.layer == layerInfrastructure || to.layer == layerInterfaces {
		return fmt.Sprintf(
			"application layer must not depend on %s layer (%s). hint: keep use cases depending on domain only; inject infra implementations from internal/di",
			string(to.layer), importPath,
		), true
	}

	if isDomainRepositoryImplementationPath(to) {
		return fmt.Sprintf(
			"application layer must not import domain repository implementation package (%s). hint: depend on the owning subdomain repository contract package only",
			importPath,
		), true
	}

	return "", false
}

func isDomainRepositoryImplementationPath(p packageInfo) bool {
	if !p.isRepositoryPackage() {
		return false
	}
	return !p.isRepositoryRootPackage()
}

func checkInterfacesLayerRules(to packageInfo, importPath string) (string, bool) {
	if to.layer == layerDomain {
		return fmt.Sprintf(
			"interfaces layer must not depend on domain layer (%s). hint: interfaces should call application services, not domain code directly",
			importPath,
		), true
	}
	if to.layer == layerInfrastructure {
		if isLoggingImport(importPath) {
			return "", false
		}
		return fmt.Sprintf(
			"interfaces layer must not depend on infrastructure layer (%s). hint: interfaces should stay thin and call application services only",
			importPath,
		), true
	}
	if to.layer == layerDI {
		return fmt.Sprintf(
			"interfaces layer must not depend on di layer (%s). hint: interfaces must not import composition root; assemble dependencies in internal/di",
			importPath,
		), true
	}
	return "", false
}

func checkInfrastructureLayerRules(to packageInfo, importPath string) (string, bool) {
	if to.layer == layerDI {
		return fmt.Sprintf(
			"infrastructure layer must not depend on di layer (%s). hint: keep infra reusable; wire dependencies from internal/di instead of importing provider sets",
			importPath,
		), true
	}
	if to.layer == layerApplication || to.layer == layerInterfaces {
		return fmt.Sprintf(
			"infrastructure layer must not depend on %s layer (%s). hint: infrastructure should implement domain contracts and be wired from internal/di",
			string(to.layer), importPath,
		), true
	}
	if to.layer == layerDomain && to.role == domainRoleService {
		return fmt.Sprintf(
			"infrastructure layer must not depend on domain service package (%s). hint: depend on stable domain entity/model/repository/shared contracts instead of business workflow packages",
			importPath,
		), true
	}
	return "", false
}

func packageInfoFromFilePath(path string) (packageInfo, bool) {
	return newAnalyzerState().packageInfoFromPath(path, true)
}

func (s *analyzerState) packageInfoFromImportPath(importPath string) (packageInfo, bool) {
	// 先查缓存（优化：避免重复路径解析）
	if cached, ok := s.pathInfo.Load(importPath); ok {
		info, ok := cached.(packageInfo)
		if !ok {
			// 类型断言失败，返回空 packageInfo 与 false
			return packageInfo{}, false
		}
		return info, true
	}

	// 计算并缓存结果
	info, ok := s.packageInfoFromPath(importPath, false)
	if ok {
		s.pathInfo.Store(importPath, info)
	}
	return info, ok
}

func packageInfoFromPath(path string, isFile bool) (packageInfo, bool) {
	return newAnalyzerState().packageInfoFromPath(path, isFile)
}

func (s *analyzerState) packageInfoFromPath(path string, isFile bool) (packageInfo, bool) {
	// 统一为正斜杠，并处理 Windows 风格路径（即使非 Windows）。
	normalized := strings.ReplaceAll(path, "\\", "/")
	normalized = filepath.ToSlash(normalized)
	// 优先使用最深的 "internal/" 段，避免误匹配父目录
	internalToken := "/internal/"
	idx := strings.LastIndex(normalized, internalToken)
	if idx == -1 {
		internalToken = "internal/"
		idx = strings.LastIndex(normalized, internalToken)
		if idx == -1 {
			return packageInfo{}, false
		}
	}

	after := normalized[idx+len(internalToken):]
	// 清理重复分隔符造成的前导斜杠（如 Windows 路径）
	after = strings.TrimLeft(after, "/")
	parts := strings.Split(after, "/")
	if len(parts) == 0 {
		return packageInfo{}, false
	}

	info := packageInfo{
		afterLayer: append([]string(nil), parts[1:]...),
	}

	switch parts[0] {
	case string(layerDI):
		info.layer = layerDI
	case string(layerDomain):
		if len(info.afterLayer) == 0 {
			return packageInfo{}, false
		}
		config, err := s.loadRuleConfig()
		if err != nil {
			return packageInfo{}, false
		}
		domain := resolveDomainName(config, info.afterLayer, isFile)
		if domain == "" {
			return packageInfo{}, false
		}
		info.layer = layerDomain
		info.domain = domain

		detectDomainRole(&info)
		// 可靠地检测 repository 服务/仓储。
		// 接受 "repository" 之后的目录或文件形式：
		//  - internal/domain/{domain}/repository/{service}/...（示例）
		//  - internal/domain/{domain}/repository/{service}.go（示例）
		//  - internal/domain/{domain}/repository/{service}（示例）

		detectRepositoryService(&info, isFile)
		detectDomainService(&info, isFile)
	case string(layerApplication):
		info.layer = layerApplication
		detectApplicationService(&info, isFile)
	case string(layerInterfaces):
		info.layer = layerInterfaces
	case string(layerInfrastructure):
		info.layer = layerInfrastructure
	default:
		return packageInfo{}, false
	}

	return info, true
}

func detectDomainRole(info *packageInfo) {
	if info == nil || info.layer != layerDomain {
		return
	}
	for idx := 1; idx < len(info.afterLayer); idx++ {
		role := normalizeDomainRole(info.afterLayer[idx])
		if role == domainRoleUnknown {
			continue
		}
		info.role = role
		return
	}
}

func normalizeDomainRole(segment string) domainPackageRole {
	switch strings.TrimSpace(segment) {
	case string(domainRoleEntity):
		return domainRoleEntity
	case string(domainRoleModel):
		return domainRoleModel
	case string(domainRoleRepository):
		return domainRoleRepository
	case string(domainRoleService):
		return domainRoleService
	case string(domainRoleShared):
		return domainRoleShared
	case string(domainRoleMetadata):
		return domainRoleMetadata
	case string(domainRoleRetrieval):
		return domainRoleRetrieval
	default:
		return domainRoleUnknown
	}
}

func resolveDomainName(config layerdepsRuleConfig, afterLayer []string, isFile bool) string {
	if len(afterLayer) == 0 {
		return ""
	}

	domain := afterLayer[0]
	if domain == "" {
		return ""
	}
	if isFile && strings.HasSuffix(domain, ".go") {
		return ""
	}

	if len(afterLayer) < 2 {
		return domain
	}

	subdomain := afterLayer[1]
	if subdomain == "" {
		return domain
	}
	if isFile && strings.HasSuffix(subdomain, ".go") {
		return domain
	}
	if isDomainStructureSegment(config, subdomain) {
		return domain
	}

	return domain + "/" + subdomain
}

func isDomainStructureSegment(config layerdepsRuleConfig, segment string) bool {
	return whitelistContains(config.domainStructureSegments, segment)
}

func detectRepositoryService(info *packageInfo, isFile bool) {
	const minPathSegmentsForRepo = 2 // 至少需要 domain + repository 段
	if len(info.afterLayer) < minPathSegmentsForRepo {
		return
	}

	for idx := 1; idx < len(info.afterLayer); idx++ {
		if info.afterLayer[idx] != pathSegmentRepo {
			continue
		}

		serviceName := extractRepositoryServiceName(info.afterLayer, idx, isFile)
		if serviceName != "" {
			info.isInRepository = true
			info.serviceName = serviceName
			break
		}
	}
}

func extractRepositoryServiceName(afterLayer []string, repoIdx int, isFile bool) string {
	candIdx := repoIdx + 1
	if candIdx >= len(afterLayer) {
		return ""
	}

	candidate := afterLayer[candIdx]
	if candidate == "" {
		return ""
	}

	if isFile && candIdx == len(afterLayer)-1 && strings.HasSuffix(candidate, ".go") {
		return stripRepositorySuffixes(strings.TrimSuffix(candidate, ".go"))
	}

	return candidate
}

func stripRepositorySuffixes(name string) string {
	for _, suf := range []string{"_repository", "_repo", "_service"} {
		if before, ok := strings.CutSuffix(name, suf); ok {
			return before
		}
	}
	return name
}

func detectApplicationService(info *packageInfo, isFile bool) {
	const minPathSegmentsForService = 1 // 至少需要 service 段
	if len(info.afterLayer) < minPathSegmentsForService {
		return
	}

	for idx := range len(info.afterLayer) {
		if info.afterLayer[idx] != pathSegmentService {
			continue
		}

		serviceName := extractServiceName(info.afterLayer, idx, isFile)
		if serviceName != "" {
			info.isInService = true
			info.serviceName = serviceName
			break
		}
	}
}

func detectDomainService(info *packageInfo, isFile bool) {
	const minPathSegmentsForService = 2 // 至少需要 domain + service 段
	if len(info.afterLayer) < minPathSegmentsForService {
		return
	}

	for idx := 1; idx < len(info.afterLayer); idx++ {
		if info.afterLayer[idx] != pathSegmentService {
			continue
		}

		serviceName := extractServiceName(info.afterLayer, idx, isFile)
		if serviceName != "" {
			info.isInService = true
			info.serviceName = serviceName
			break
		}
	}
}

func extractServiceName(afterLayer []string, serviceIdx int, isFile bool) string {
	candIdx := serviceIdx + 1
	if candIdx >= len(afterLayer) {
		return ""
	}

	candidate := afterLayer[candIdx]
	if candidate == "" {
		return ""
	}

	if isFile && candIdx == len(afterLayer)-1 && strings.HasSuffix(candidate, ".go") {
		return stripServiceSuffixes(strings.TrimSuffix(candidate, ".go"))
	}

	return candidate
}

func stripServiceSuffixes(name string) string {
	for _, suf := range []string{"_service", "_app_service", "_domain_service"} {
		if before, ok := strings.CutSuffix(name, suf); ok {
			return before
		}
	}
	return name
}

func (p packageInfo) isRepositoryPackage() bool {
	return p.repositorySegmentIndex() >= 0
}

func (p packageInfo) isRepositoryRootPackage() bool {
	repoIdx := p.repositorySegmentIndex()
	return repoIdx >= 0 && repoIdx == len(p.afterLayer)-1
}

func (p packageInfo) repositorySegmentIndex() int {
	if p.layer != layerDomain {
		return -1
	}
	for idx := 1; idx < len(p.afterLayer); idx++ {
		if p.afterLayer[idx] == pathSegmentRepo {
			return idx
		}
	}
	return -1
}

// ---------- 忽略规则辅助 ----------

func extractIgnoreRules(file *ast.File) ignoreRules {
	var rules ignoreRules
	if file == nil {
		return rules
	}
	// 检查文件级 doc 与注释
	allComments := file.Comments
	for _, cg := range allComments {
		if cg == nil || cg.List == nil {
			continue
		}
		for _, c := range cg.List {
			if c == nil {
				continue
			}
			text := strings.TrimSpace(strings.TrimPrefix(c.Text, "//"))
			if text == "" {
				continue
			}
			// layerdeps:ignore <pattern>（示例）
			if after, ok := strings.CutPrefix(text, "layerdeps:ignore "); ok {
				pat := strings.TrimSpace(after)
				if pat != "" {
					rules.pathPatterns = append(rules.pathPatterns, pat)
				}
			}
		}
	}
	return rules
}

func shouldIgnoreImport(impPath string, spec *ast.ImportSpec, declDoc *ast.CommentGroup, rules ignoreRules) bool {
	if spec != nil {
		// 在 import 行或其注释中内联忽略
		if commentGroupContains(spec.Doc, "layerdeps:ignore") || commentGroupContains(spec.Comment, "layerdeps:ignore") {
			return true
		}
	}
	// 同时考虑附在 import 声明上的 GenDecl 级注释
	if declDoc != nil {
		if commentGroupContains(declDoc, "layerdeps:ignore") {
			return true
		}
	}
	if rules.ignoreAll {
		return true
	}
	if impPath == "" {
		return false
	}
	for _, pat := range rules.pathPatterns {
		if matchIgnorePattern(pat, impPath) {
			return true
		}
	}
	return false
}

func commentGroupContains(cg *ast.CommentGroup, substr string) bool {
	if cg == nil || substr == "" {
		return false
	}
	for _, c := range cg.List {
		if c == nil {
			continue
		}
		if strings.Contains(c.Text, substr) {
			return true
		}
	}
	return false
}

func matchIgnorePattern(pattern, impPath string) bool {
	if pattern == "" {
		return false
	}
	if pattern == impPath {
		return true
	}
	// 将结尾 '*' 视为前缀匹配
	if before, ok := strings.CutSuffix(pattern, "/*"); ok {
		prefix := before
		// 仅匹配子路径，不匹配父路径本身
		if impPath == prefix {
			return false
		}
		return strings.HasPrefix(impPath, prefix+"/")
	}
	if before, ok := strings.CutSuffix(pattern, "*"); ok {
		prefix := before
		return strings.HasPrefix(impPath, prefix)
	}
	return false
}
