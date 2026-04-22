package retrieval

import (
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"syscall"

	"github.com/go-ego/gse"
)

type runtimeStaticError string

func (e runtimeStaticError) Error() string {
	return string(e)
}

const retrievalSegmenterLockFilePerm = 0o600

const (
	errRetrievalSegmenterLockFileNil       = runtimeStaticError("retrieval segmenter lock file is nil")
	errRetrievalSegmenterLockFDIntOverflow = runtimeStaticError("retrieval segmenter lock fd overflows int")
	errRetrievalBundledDictDirsEmpty       = runtimeStaticError("no bundled retrieval dictionary directories configured")
	errRetrievalBundledDictsNotFound       = runtimeStaticError("bundled retrieval dictionaries not found")
	errRetrievalBundledDictPathIsDirectory = runtimeStaticError("bundled retrieval dictionary path is a directory")
	retrievalBundledDictCandidateCapacity  = 4
)

const (
	retrievalBundledDictMagicServiceDir = "go-engine/assets/gse/data/dict/zh"
	retrievalBundledDictGoEngineDir     = "assets/gse/data/dict/zh"
	retrievalBundledSimplifiedDictFile  = "s_1.txt"
	retrievalBundledTraditionalDictFile = "t_1.txt"
)

// defaultRetrievalSegmenterProvider 必须保持为进程级单例。
//
// 原因：
//  1. gse 初始化会触碰全局 HMM 词典状态，重复初始化在并发测试和冷启动阶段都容易放大 race 风险。
//  2. 检索 analyzer 在包级 helper 和多个 service 实例之间都会被复用；如果默认 provider 不是单例，
//     同一个进程里就会出现“逻辑上是默认分词器，实际上被重复初始化”的隐性退化。
//  3. 这里的全局值不是可变业务状态，只承载默认依赖的懒加载单例，因此比在各调用点分散创建 provider 更安全。
//
// 不要改回“每次调用创建一个新的默认 provider”。
//
//nolint:gochecknoglobals // 默认检索分词器必须是进程级单例，避免重复初始化 gse 的全局 HMM 状态。
var defaultRetrievalSegmenterProvider = newRetrievalSegmenterProvider(loadDefaultRetrievalSegmenter)

func loadDefaultRetrievalSegmenter(segmenter *gse.Segmenter) error {
	if isRetrievalTestBinary() {
		if err := segmenter.LoadDictStr(retrievalTestSegmenterDict); err != nil {
			return fmt.Errorf("load retrieval test segmenter: %w", err)
		}
		return nil
	}

	dictFiles, err := resolveBundledRetrievalDictionaryFiles(retrievalBundledDictionaryDirCandidates())
	if err != nil {
		return fmt.Errorf("resolve bundled retrieval dictionaries: %w", err)
	}
	if err := segmenter.LoadDict(strings.Join(dictFiles, ", ")); err != nil {
		return fmt.Errorf("load bundled retrieval segmenter: %w", err)
	}
	return nil
}

func isRetrievalTestBinary() bool {
	return filepath.Ext(os.Args[0]) == ".test"
}

func retrievalBundledDictionaryDirCandidates() []string {
	candidates := make([]string, 0, retrievalBundledDictCandidateCapacity)
	appendCandidate := func(path string) {
		if path == "" {
			return
		}
		cleanPath := filepath.Clean(path)
		if slices.Contains(candidates, cleanPath) {
			return
		}
		candidates = append(candidates, cleanPath)
	}

	if executablePath, err := os.Executable(); err == nil {
		executableRoot := filepath.Dir(filepath.Dir(executablePath))
		appendCandidate(filepath.Join(executableRoot, retrievalBundledDictMagicServiceDir))
		appendCandidate(filepath.Join(executableRoot, retrievalBundledDictGoEngineDir))
	}
	if workingDir, err := os.Getwd(); err == nil {
		appendCandidate(filepath.Join(workingDir, retrievalBundledDictMagicServiceDir))
		appendCandidate(filepath.Join(workingDir, retrievalBundledDictGoEngineDir))
	}

	return candidates
}

func resolveBundledRetrievalDictionaryFiles(candidateDirs []string) ([]string, error) {
	if len(candidateDirs) == 0 {
		return nil, errRetrievalBundledDictDirsEmpty
	}

	for _, candidateDir := range candidateDirs {
		dictFiles, err := bundledRetrievalDictionaryFilesFromDir(candidateDir)
		if err == nil {
			return dictFiles, nil
		}
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		return nil, err
	}

	return nil, fmt.Errorf("%w: %s", errRetrievalBundledDictsNotFound, strings.Join(candidateDirs, ", "))
}

func bundledRetrievalDictionaryFilesFromDir(dir string) ([]string, error) {
	fileNames := []string{
		retrievalBundledSimplifiedDictFile,
		retrievalBundledTraditionalDictFile,
	}
	files := make([]string, 0, len(fileNames))
	for _, fileName := range fileNames {
		filePath := filepath.Join(dir, fileName)
		info, err := os.Stat(filePath)
		if err != nil {
			return nil, fmt.Errorf("stat bundled retrieval dictionary %s: %w", filePath, err)
		}
		if info.IsDir() {
			return nil, fmt.Errorf("%w: %s", errRetrievalBundledDictPathIsDirectory, filePath)
		}
		files = append(files, filePath)
	}
	return files, nil
}

type retrievalSegmenterGate struct{}

func (retrievalSegmenterGate) withExclusiveLock(run func() error) error {
	unlock, err := lockDefaultRetrievalDictionary(syscall.LOCK_EX)
	if err != nil {
		return err
	}
	defer unlock()
	return run()
}

func (retrievalSegmenterGate) withSharedLock(run func() []string) ([]string, error) {
	unlock, err := lockDefaultRetrievalDictionary(syscall.LOCK_SH)
	if err != nil {
		return nil, err
	}
	defer unlock()
	return run(), nil
}

func lockDefaultRetrievalDictionary(operation int) (func(), error) {
	file, err := os.OpenFile(defaultRetrievalSegmenterLockFile(), os.O_CREATE|os.O_RDWR, retrievalSegmenterLockFilePerm)
	if err != nil {
		return nil, fmt.Errorf("open retrieval segmenter lock: %w", err)
	}
	fd, err := fileDescriptorForLock(file)
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	if err := syscall.Flock(fd, operation); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("lock retrieval segmenter load: %w", err)
	}

	return func() {
		_ = syscall.Flock(fd, syscall.LOCK_UN)
		_ = file.Close()
	}, nil
}

func defaultRetrievalSegmenterLockFile() string {
	return filepath.Join(os.TempDir(), "magic-retrieval-segmenter.lock")
}

func fileDescriptorForLock(file *os.File) (int, error) {
	if file == nil {
		return 0, errRetrievalSegmenterLockFileNil
	}
	fd := file.Fd()
	if fd > math.MaxInt {
		return 0, fmt.Errorf("%w: %d", errRetrievalSegmenterLockFDIntOverflow, fd)
	}
	return int(fd), nil
}

// SegmenterProvider 负责按需加载并复用检索分词器实例。
type SegmenterProvider struct {
	once sync.Once

	gate      retrievalSegmenterGate
	mu        sync.RWMutex
	segmenter *gse.Segmenter
	err       error
	load      func(*gse.Segmenter) error
}

type lockedSegmenter struct {
	inner *gse.Segmenter
	gate  retrievalSegmenterGate
}

func (s lockedSegmenter) CutSearch(text string, searchMode ...bool) []string {
	if s.inner == nil {
		return nil
	}
	terms, err := s.gate.withSharedLock(func() []string {
		return s.inner.CutSearch(text, searchMode...)
	})
	if err == nil {
		return terms
	}
	return s.inner.CutSearch(text, searchMode...)
}

func (s lockedSegmenter) unwrap() *gse.Segmenter {
	return s.inner
}

func newRetrievalSegmenterProvider(load func(*gse.Segmenter) error) *SegmenterProvider {
	return &SegmenterProvider{
		gate: retrievalSegmenterGate{},
		load: load,
	}
}

func newDefaultRetrievalSegmenterProvider() *SegmenterProvider {
	return defaultRetrievalSegmenterProvider
}

// NewDefaultSegmenterProvider 返回默认检索分词器单例。
//
// 这里返回的是共享单例，不是新的 provider。这样可以保证默认分词器在整个进程内只初始化一次。
func NewDefaultSegmenterProvider() *SegmenterProvider {
	return newDefaultRetrievalSegmenterProvider()
}

func (p *SegmenterProvider) warmup() error {
	_, err := p.get()
	return err
}

func (p *SegmenterProvider) get() (*gse.Segmenter, error) {
	p.once.Do(func() {
		segmenter := &gse.Segmenter{
			AlphaNum: true,
			SkipLog:  true,
		}
		if p.load != nil {
			p.err = p.gate.withExclusiveLock(func() error {
				return p.load(segmenter)
			})
		}
		p.mu.Lock()
		defer p.mu.Unlock()
		if p.err == nil {
			p.segmenter = segmenter
		}
	})

	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.segmenter, p.err
}

func (p *SegmenterProvider) cutter() (segmentedWordCutter, error) {
	segmenter, err := p.get()
	if err != nil {
		return nil, err
	}
	return lockedSegmenter{inner: segmenter, gate: p.gate}, nil
}
