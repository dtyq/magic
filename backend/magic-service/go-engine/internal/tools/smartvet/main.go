// Package smartvet provides cache-backed incremental go vet checks.
package smartvet

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"magic/internal/pkg/fileutil"
	"magic/internal/pkg/logkey"
	"magic/internal/tools/smartcache"
)

// PackageInfo 表示 go list -json 的输出
type PackageInfo struct {
	ImportPath string
	Dir        string
	GoFiles    []string
	// 如需区分测试变更，可添加独立的测试文件列表
	// TestGoFiles []string `json:"TestGoFiles"` // 预留示例
}

// PackageCache 保存包的哈希与文件元数据
type PackageCache struct {
	Hash  string              `json:"hash"`
	Files map[string]FileMeta `json:"files"`
}

// RepoCache stores repository-level metadata for the top-level smartvet cache.
type RepoCache struct {
	AnalyzerHash string              `json:"analyzer_hash"`
	InputHash    string              `json:"input_hash"`
	Files        map[string]FileMeta `json:"files"`
}

// FileMeta stores file metadata used by smartvet caches.
type FileMeta struct {
	Mtime int64 `json:"mtime"`
	Size  int64 `json:"size"`
}

type staticError string

func (e staticError) Error() string {
	return string(e)
}

const (
	defaultCacheDir      = ".cache/vetpkgs"
	cacheDirPerm         = 0o750
	cacheFilePerm        = 0o600
	maxConcurrent        = 20
	maxVetArgs           = 50
	lastAnalyzerHashFile = "last_analyzer_hash"
	repoStateFile        = "repo_state.json"
	errVetToolRequired   = staticError("vettool argument is required")
	errGoListFailed      = staticError("go list failed")
)

// Options configures the incremental go vet runner.
type Options struct {
	VetToolPath string
	CacheDir    string
	RootDir     string
}

// Runner executes incremental go vet checks.
type Runner struct {
	opts         Options
	execCommand  func(name string, args ...string) *exec.Cmd
	listPackages func() ([]PackageInfo, error)
	fileHash     func(path string) (string, error)
	runGoVet     func(args ...string) error
	logger       *slog.Logger
	stdout       io.Writer
	stderr       io.Writer
}

type repoRunState struct {
	cachePath string
	current   RepoCache
	fullScan  bool
}

// ParseOptions parses CLI flags into runner options.
func ParseOptions(args []string) (Options, error) {
	fs := flag.NewFlagSet("smartvet", flag.ContinueOnError)
	var opts Options
	fs.StringVar(&opts.VetToolPath, "vettool", "", "path to the custom vet analyzer binary")
	fs.StringVar(&opts.CacheDir, "cache", defaultCacheDir, "directory to store package hashes")
	fs.StringVar(&opts.RootDir, "root", ".", "repository root to scan")
	if err := fs.Parse(args); err != nil {
		return Options{}, fmt.Errorf("parse flags: %w", err)
	}
	if opts.VetToolPath == "" {
		return Options{}, errVetToolRequired
	}
	return opts, nil
}

// NewRunner constructs a smartvet runner.
func NewRunner(opts Options, logger *slog.Logger, stdout, stderr io.Writer) *Runner {
	if logger == nil {
		logger = slog.New(slog.DiscardHandler)
	}
	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}
	if opts.RootDir == "" {
		opts.RootDir = "."
	}
	if opts.CacheDir == "" {
		opts.CacheDir = defaultCacheDir
	}
	r := &Runner{
		opts:        opts,
		execCommand: exec.Command,
		logger:      logger,
		stdout:      stdout,
		stderr:      stderr,
	}
	r.listPackages = r.defaultListPackages
	r.fileHash = fileHash
	r.runGoVet = r.defaultRunGoVet
	return r
}

// Run executes the incremental go vet workflow.
func (r *Runner) Run() error {
	start := time.Now()

	analyzerHash, err := r.fileHash(r.opts.VetToolPath)
	if err != nil {
		return fmt.Errorf("failed to hash analyzer binary: %w", err)
	}

	if err := os.MkdirAll(r.opts.CacheDir, cacheDirPerm); err != nil {
		return fmt.Errorf("failed to create cache dir: %w", err)
	}

	repoState, shouldSkip, err := r.prepareRepoState(analyzerHash)
	if err != nil {
		return err
	}
	if shouldSkip {
		return nil
	}

	pkgs, err := r.listPackages()
	if err != nil {
		return fmt.Errorf("go list failed: %w", err)
	}

	changedPkgs, newCaches := r.computeChangedPackages(pkgs, repoState.fullScan)
	if repoState.fullScan {
		return r.runFullScan(start, analyzerHash, repoState, pkgs, newCaches)
	}
	if len(changedPkgs) == 0 {
		r.logger.Info("No package changes detected (cached)")
		return persistRepoCache(repoState.cachePath, repoState.current)
	}
	if err := r.runChangedPackages(changedPkgs); err != nil {
		return err
	}

	r.persistCache(newCaches, changedPkgs)
	if err := persistRepoCache(repoState.cachePath, repoState.current); err != nil {
		return err
	}
	r.logger.Info("Done", logkey.Duration, time.Since(start).Round(time.Millisecond))
	return nil
}

func (r *Runner) prepareRepoState(analyzerHash string) (repoRunState, bool, error) {
	repoCachePath := filepath.Join(r.opts.CacheDir, repoStateFile)
	trackedFiles, err := collectRepoTrackedFiles(r.opts.RootDir)
	if err != nil {
		return repoRunState{}, false, fmt.Errorf("collect repo tracked files: %w", err)
	}

	currentRepoCache := RepoCache{
		AnalyzerHash: analyzerHash,
		Files:        trackedFilesMetaMap(trackedFiles),
	}
	previousRepoCache, _ := loadRepoCache(repoCachePath)

	if repoMetadataMatch(previousRepoCache, currentRepoCache) {
		r.logger.Info("No repository changes detected (cached)")
		return repoRunState{}, true, nil
	}

	inputHash, err := smartcache.HashFiles(trackedFiles)
	if err != nil {
		return repoRunState{}, false, fmt.Errorf("hash repo tracked files: %w", err)
	}
	currentRepoCache.InputHash = inputHash

	if repoContentMatch(previousRepoCache, currentRepoCache) {
		if err := persistRepoCache(repoCachePath, currentRepoCache); err != nil {
			return repoRunState{}, false, err
		}
		r.logger.Info("Repository content unchanged (cached)")
		return repoRunState{}, true, nil
	}

	lastRunFile := filepath.Join(r.opts.CacheDir, lastAnalyzerHashFile)
	lastHashBytes, _ := os.ReadFile(lastRunFile)
	fullScan := string(lastHashBytes) != analyzerHash || repoRequiresFullScan(previousRepoCache, currentRepoCache)
	if fullScan {
		r.logger.Info("Analyzer changed (or first run), forcing full scan")
	}

	return repoRunState{
		cachePath: repoCachePath,
		current:   currentRepoCache,
		fullScan:  fullScan,
	}, false, nil
}

func (r *Runner) runFullScan(
	start time.Time,
	analyzerHash string,
	repoState repoRunState,
	pkgs []PackageInfo,
	newCaches map[string]PackageCache,
) error {
	r.logger.Info("Running full analysis")
	if err := r.runGoVet("./..."); err != nil {
		return err
	}
	r.persistCache(newCaches, collectImportPaths(pkgs))
	if err := persistRepoCache(repoState.cachePath, repoState.current); err != nil {
		return err
	}
	lastRunFile := filepath.Join(r.opts.CacheDir, lastAnalyzerHashFile)
	_ = atomicWriteFile(lastRunFile, []byte(analyzerHash))
	r.logger.Info("Done", logkey.Duration, time.Since(start).Round(time.Millisecond))
	return nil
}

func loadRepoCache(path string) (RepoCache, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return RepoCache{}, fmt.Errorf("read repo cache: %w", err)
	}

	var cache RepoCache
	if err := json.Unmarshal(content, &cache); err != nil {
		return RepoCache{}, fmt.Errorf("unmarshal repo cache: %w", err)
	}

	return cache, nil
}

func persistRepoCache(path string, cache RepoCache) error {
	content, err := json.Marshal(cache)
	if err != nil {
		return fmt.Errorf("marshal repo cache: %w", err)
	}
	if err := atomicWriteFile(path, content); err != nil {
		return fmt.Errorf("persist repo cache: %w", err)
	}

	return nil
}

func collectRepoTrackedFiles(root string) ([]smartcache.TrackedFile, error) {
	files, err := smartcache.CollectFiles(root, func(relPath string) bool {
		if relPath == "go.mod" || relPath == "go.sum" {
			return true
		}

		return strings.HasSuffix(relPath, ".go")
	})
	if err != nil {
		return nil, fmt.Errorf("collect files: %w", err)
	}

	return files, nil
}

func trackedFilesMetaMap(files []smartcache.TrackedFile) map[string]FileMeta {
	result := make(map[string]FileMeta, len(files))
	for _, file := range files {
		result[file.RelativePath] = FileMeta{
			Mtime: file.Meta.Mtime,
			Size:  file.Meta.Size,
		}
	}

	return result
}

func repoMetadataMatch(previous, current RepoCache) bool {
	if previous.AnalyzerHash == "" || previous.AnalyzerHash != current.AnalyzerHash {
		return false
	}
	if len(previous.Files) != len(current.Files) {
		return false
	}

	for path, currentMeta := range current.Files {
		previousMeta, ok := previous.Files[path]
		if !ok || previousMeta != currentMeta {
			return false
		}
	}

	return true
}

func repoContentMatch(previous, current RepoCache) bool {
	return previous.AnalyzerHash == current.AnalyzerHash &&
		previous.InputHash != "" &&
		previous.InputHash == current.InputHash
}

func repoRequiresFullScan(previous, current RepoCache) bool {
	return fileMetaChanged(previous.Files, current.Files, "go.mod") ||
		fileMetaChanged(previous.Files, current.Files, "go.sum")
}

func fileMetaChanged(previous, current map[string]FileMeta, path string) bool {
	previousMeta, previousOK := previous[path]
	currentMeta, currentOK := current[path]

	if previousOK != currentOK {
		return true
	}
	if !previousOK {
		return false
	}

	return previousMeta != currentMeta
}

func (r *Runner) computeChangedPackages(pkgs []PackageInfo, fullScan bool) ([]string, map[string]PackageCache) {
	var (
		mu          sync.Mutex
		changedPkgs []string
		newCaches   = make(map[string]PackageCache)
	)

	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for _, pkg := range pkgs {
		wg.Add(1)
		go func(p PackageInfo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			cachePath := cachePath(r.opts.CacheDir, p.ImportPath)
			var oldCache PackageCache

			// 仅在非全量扫描时加载旧缓存
			if !fullScan {
				if b, err := os.ReadFile(cachePath); err == nil {
					_ = json.Unmarshal(b, &oldCache)
				}
			}

			// 计算新缓存（可用时走快速路径）
			newCache, err := computePackageState(p, oldCache)
			if err != nil {
				// 出错则视为变更
				mu.Lock()
				changedPkgs = append(changedPkgs, p.ImportPath)
				mu.Unlock()
				return
			}

			mu.Lock()
			newCaches[p.ImportPath] = newCache
			mu.Unlock()

			// 判断是否变更
			if !fullScan && oldCache.Hash == newCache.Hash {
				return
			}

			mu.Lock()
			changedPkgs = append(changedPkgs, p.ImportPath)
			mu.Unlock()
		}(pkg)
	}

	wg.Wait()
	return changedPkgs, newCaches
}

func (r *Runner) persistCache(newCaches map[string]PackageCache, pkgs []string) {
	for _, pkgImport := range pkgs {
		cache, ok := newCaches[pkgImport]
		if !ok {
			continue
		}
		path := cachePath(r.opts.CacheDir, pkgImport)
		if b, err := json.Marshal(cache); err == nil {
			_ = atomicWriteFile(path, b)
		}
	}
}

func (r *Runner) runChangedPackages(changedPkgs []string) error {
	slices.Sort(changedPkgs)
	r.logger.Info("Checking changed packages", logkey.Count, len(changedPkgs))

	for i := 0; i < len(changedPkgs); i += maxVetArgs {
		end := min(i+maxVetArgs, len(changedPkgs))
		chunk := changedPkgs[i:end]
		if err := r.runGoVet(chunk...); err != nil {
			return err
		}
	}
	return nil
}

func cachePath(cacheDir, importPath string) string {
	safe := strings.ReplaceAll(importPath, "/", "_")
	safe = strings.ReplaceAll(safe, "\\", "_")
	return filepath.Join(cacheDir, safe+".json")
}

func collectImportPaths(pkgs []PackageInfo) []string {
	imports := make([]string, 0, len(pkgs))
	for _, p := range pkgs {
		imports = append(imports, p.ImportPath)
	}
	return imports
}

func (r *Runner) defaultListPackages() ([]PackageInfo, error) {
	cmd := r.execCommand("go", "list", "-json", "./...")
	cmd.Dir = r.opts.RootDir
	out, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			stderr := strings.TrimSpace(string(exitErr.Stderr))
			if stderr == "" {
				return nil, errors.Join(errGoListFailed, err)
			}
			return nil, fmt.Errorf("%w: %s: %w", errGoListFailed, stderr, err)
		}
		return nil, errors.Join(errGoListFailed, err)
	}

	var pkgs []PackageInfo
	decoder := json.NewDecoder(strings.NewReader(string(out)))
	for {
		var p PackageInfo
		if err := decoder.Decode(&p); err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("decode package info: %w", err)
		}
		// 过滤无 Go 文件的包
		if len(p.GoFiles) > 0 {
			pkgs = append(pkgs, p)
		}
	}
	return pkgs, nil
}

// computePackageState 计算包哈希，若可用则走 Mtime/Size 快速路径
func computePackageState(p PackageInfo, oldCache PackageCache) (PackageCache, error) {
	// 识别文件
	entries, err := os.ReadDir(p.Dir)
	if err != nil {
		return PackageCache{}, fmt.Errorf("read package dir %s: %w", p.Dir, err)
	}

	files := filterGoFiles(entries)
	if cache, ok := fastPathCache(files, oldCache); ok {
		return cache, nil
	}
	return hashPackageFiles(p.Dir, files)
}

func filterGoFiles(entries []os.DirEntry) []os.DirEntry {
	files := make([]os.DirEntry, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".go") {
			files = append(files, e)
		}
	}
	return files
}

func fastPathCache(files []os.DirEntry, oldCache PackageCache) (PackageCache, bool) {
	if len(oldCache.Files) != len(files) || oldCache.Hash == "" {
		return PackageCache{}, false
	}

	currentMeta := make(map[string]FileMeta, len(files))
	for _, e := range files {
		info, err := e.Info()
		if err != nil {
			return PackageCache{}, false
		}
		meta := FileMeta{
			Mtime: info.ModTime().UnixNano(),
			Size:  info.Size(),
		}
		currentMeta[e.Name()] = meta

		old, ok := oldCache.Files[e.Name()]
		if !ok || old.Mtime != meta.Mtime || old.Size != meta.Size {
			return PackageCache{}, false
		}
	}

	return PackageCache{
		Hash:  oldCache.Hash,
		Files: currentMeta,
	}, true
}

func hashPackageFiles(dir string, files []os.DirEntry) (PackageCache, error) {
	h := sha256.New()
	newMeta := make(map[string]FileMeta, len(files))

	for _, e := range files {
		path := filepath.Join(dir, e.Name())
		info, err := e.Info()
		if err != nil {
			return PackageCache{}, fmt.Errorf("stat file %s: %w", e.Name(), err)
		}

		if err := hashFile(h, path); err != nil {
			return PackageCache{}, err
		}

		newMeta[e.Name()] = FileMeta{
			Mtime: info.ModTime().UnixNano(),
			Size:  info.Size(),
		}
	}

	return PackageCache{
		Hash:  hex.EncodeToString(h.Sum(nil)),
		Files: newMeta,
	}, nil
}

// hashFile 把文件内容写入 hash，使用 defer 确保文件关闭
func hashFile(h io.Writer, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open file %s: %w", path, err)
	}
	defer func() { _ = f.Close() }() // 读文件场景忽略 Close 错误是安全的

	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("hash file %s: %w", path, err)
	}
	return nil
}

// fileHash 计算文件的 SHA256 哈希值
func fileHash(path string) (string, error) {
	hash, err := fileutil.FileHash(path)
	if err != nil {
		return "", fmt.Errorf("file hash: %w", err)
	}
	return hash, nil
}

// atomicWriteFile 原子性写入文件，委托给 fileutil
func atomicWriteFile(filename string, data []byte) error {
	if err := fileutil.AtomicWriteFile(filename, data, cacheFilePerm); err != nil {
		return fmt.Errorf("atomic write: %w", err)
	}
	return nil
}

func (r *Runner) defaultRunGoVet(args ...string) error {
	cmdArgs := append([]string{"vet", "-vettool=" + r.opts.VetToolPath}, args...)
	cmd := r.execCommand("go", cmdArgs...)
	cmd.Dir = r.opts.RootDir
	cmd.Stdout = r.stdout
	cmd.Stderr = r.stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go vet failed: %w", err)
	}
	return nil
}
