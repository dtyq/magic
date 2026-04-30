package retrieval

import (
	"bufio"
	"errors"
	"fmt"
	"io"
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
	errRetrievalBundledDictNameUnknown     = runtimeStaticError("unknown bundled retrieval dictionary file")
	retrievalBundledDictCandidateCapacity  = 4
)

const (
	retrievalBundledDictMagicServiceDir      = "go-engine/assets/gse/data/dict/zh"
	retrievalBundledDictGoEngineDir          = "assets/gse/data/dict/zh"
	retrievalBundledSimplifiedDictFile       = "s_1.txt"
	retrievalBundledTraditionalDictFile      = "t_1.txt"
	retrievalBundledCustomTermsDictFile      = "custom_terms.txt"
	retrievalBundledRetrievalStopwordsFile   = "retrieval_stopwords.txt"
	retrievalBundledStopTokensDictFile       = "stop_tokens.txt"
	retrievalBundledStopWordDictFile         = "stop_word.txt"
	retrievalBundledIDFDictFile              = "idf.txt"
	retrievalBundledTFIDFDictFile            = "tf_idf.txt"
	retrievalBundledTFIDFOriginDictFile      = "tf_idf_origin.txt"
	retrievalBundledCoreDictMinimumFileCount = 4
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

//nolint:gochecknoglobals // 默认检索 token policy 同样需要共享懒加载，避免重复读取仓库词典。
var defaultRetrievalTokenPolicyProvider = newRetrievalTokenPolicyProvider(loadDefaultRetrievalTokenPolicy)

//nolint:gochecknoglobals // gse/hmm 维护进程级全局词典状态，必须用进程内锁建立并发读写同步。
var retrievalSegmenterProcessMu sync.RWMutex

type retrievalBundledDictionarySet struct {
	dir   string
	paths map[string]string
}

type retrievalTokenPolicy struct {
	stopwords              map[string]struct{}
	dictDir                string
	customTermsPath        string
	retrievalStopwords     string
	upstreamStopWordPath   string
	upstreamStopTokensPath string
	idfPath                string
	tfIDFPath              string
	tfIDFOriginPath        string
}

type retrievalTokenPolicyProvider struct {
	once sync.Once

	mu     sync.RWMutex
	policy retrievalTokenPolicy
	err    error
	load   func() (retrievalTokenPolicy, error)
}

func newRetrievalTokenPolicyProvider(load func() (retrievalTokenPolicy, error)) *retrievalTokenPolicyProvider {
	return &retrievalTokenPolicyProvider{load: load}
}

func (p *retrievalTokenPolicyProvider) warmup() error {
	_, err := p.get()
	return err
}

func (p *retrievalTokenPolicyProvider) get() (retrievalTokenPolicy, error) {
	p.once.Do(func() {
		if p.load != nil {
			p.policy, p.err = p.load()
		}
	})

	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.policy, p.err
}

func retrievalBundledCoreServingDictFiles() []string {
	return []string{
		retrievalBundledSimplifiedDictFile,
		retrievalBundledTraditionalDictFile,
		retrievalBundledCustomTermsDictFile,
		retrievalBundledRetrievalStopwordsFile,
	}
}

func retrievalBundledSegmenterDictFiles() []string {
	return []string{
		retrievalBundledSimplifiedDictFile,
		retrievalBundledTraditionalDictFile,
		retrievalBundledCustomTermsDictFile,
	}
}

func retrievalBundledExtendedDictFiles() []string {
	return []string{
		retrievalBundledStopTokensDictFile,
		retrievalBundledStopWordDictFile,
		retrievalBundledIDFDictFile,
		retrievalBundledTFIDFDictFile,
		retrievalBundledTFIDFOriginDictFile,
	}
}

func retrievalBundledKnownDictFiles() []string {
	files := make([]string, 0, retrievalBundledCoreDictMinimumFileCount+len(retrievalBundledExtendedDictFiles()))
	files = append(files, retrievalBundledCoreServingDictFiles()...)
	files = append(files, retrievalBundledExtendedDictFiles()...)
	return files
}

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
	dictSet, err := resolveBundledRetrievalDictionarySet(candidateDirs)
	if err != nil {
		return nil, err
	}
	return dictSet.requiredPaths(retrievalBundledSegmenterDictFiles()...)
}

func resolveBundledRetrievalDictionarySet(candidateDirs []string) (retrievalBundledDictionarySet, error) {
	if len(candidateDirs) == 0 {
		return retrievalBundledDictionarySet{}, errRetrievalBundledDictDirsEmpty
	}

	var missingCore []string
	for _, candidateDir := range candidateDirs {
		dictSet, err := bundledRetrievalDictionarySetFromDir(candidateDir)
		if err == nil {
			return dictSet, nil
		}
		if errors.Is(err, os.ErrNotExist) {
			missingCore = append(missingCore, err.Error())
			continue
		}
		return retrievalBundledDictionarySet{}, err
	}

	if len(missingCore) == 0 {
		return retrievalBundledDictionarySet{}, fmt.Errorf("%w: %s", errRetrievalBundledDictsNotFound, strings.Join(candidateDirs, ", "))
	}
	return retrievalBundledDictionarySet{}, fmt.Errorf(
		"%w: %s",
		errRetrievalBundledDictsNotFound,
		strings.Join(missingCore, "; "),
	)
}

func bundledRetrievalDictionarySetFromDir(dir string) (retrievalBundledDictionarySet, error) {
	fileNames := retrievalBundledKnownDictFiles()
	paths := make(map[string]string, len(fileNames))
	missingCore := make([]string, 0, retrievalBundledCoreDictMinimumFileCount)
	for _, fileName := range fileNames {
		filePath := filepath.Join(dir, fileName)
		info, err := os.Stat(filePath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				if slices.Contains(retrievalBundledCoreServingDictFiles(), fileName) {
					missingCore = append(missingCore, fileName)
				}
				continue
			}
			return retrievalBundledDictionarySet{}, fmt.Errorf("stat bundled retrieval dictionary %s: %w", filePath, err)
		}
		if info.IsDir() {
			return retrievalBundledDictionarySet{}, fmt.Errorf("%w: %s", errRetrievalBundledDictPathIsDirectory, filePath)
		}
		paths[fileName] = filePath
	}
	if len(missingCore) > 0 {
		return retrievalBundledDictionarySet{}, fmt.Errorf(
			"stat bundled retrieval dictionaries under %s: %w: missing core files [%s]",
			dir,
			os.ErrNotExist,
			strings.Join(missingCore, ", "),
		)
	}
	return retrievalBundledDictionarySet{
		dir:   dir,
		paths: paths,
	}, nil
}

func (s retrievalBundledDictionarySet) requiredPaths(fileNames ...string) ([]string, error) {
	files := make([]string, 0, len(fileNames))
	for _, fileName := range fileNames {
		filePath, err := s.path(fileName)
		if err != nil {
			return nil, err
		}
		files = append(files, filePath)
	}
	return files, nil
}

func (s retrievalBundledDictionarySet) path(fileName string) (string, error) {
	if !slices.Contains(retrievalBundledKnownDictFiles(), fileName) {
		return "", fmt.Errorf("%w: %s", errRetrievalBundledDictNameUnknown, fileName)
	}
	filePath := strings.TrimSpace(s.paths[fileName])
	if filePath == "" {
		return "", fmt.Errorf(
			"bundled retrieval dictionary %s in %s: %w",
			fileName,
			s.dir,
			os.ErrNotExist,
		)
	}
	return filePath, nil
}

func loadDefaultRetrievalTokenPolicy() (retrievalTokenPolicy, error) {
	if isRetrievalTestBinary() {
		stopwords, err := loadStopwordMapFromReader(strings.NewReader(retrievalTestStopwords))
		if err != nil {
			return retrievalTokenPolicy{}, fmt.Errorf("load retrieval test stopwords: %w", err)
		}
		return retrievalTokenPolicy{
			stopwords: stopwords,
		}, nil
	}

	dictSet, err := resolveBundledRetrievalDictionarySet(retrievalBundledDictionaryDirCandidates())
	if err != nil {
		return retrievalTokenPolicy{}, fmt.Errorf("resolve bundled retrieval token policy dictionaries: %w", err)
	}
	return loadRetrievalTokenPolicyFromSet(dictSet)
}

func loadRetrievalTokenPolicyFromSet(dictSet retrievalBundledDictionarySet) (retrievalTokenPolicy, error) {
	stopwordsPath, err := dictSet.path(retrievalBundledRetrievalStopwordsFile)
	if err != nil {
		return retrievalTokenPolicy{}, fmt.Errorf("resolve retrieval stopwords path: %w", err)
	}
	stopwords, err := loadStopwordMap(stopwordsPath)
	if err != nil {
		return retrievalTokenPolicy{}, fmt.Errorf("load retrieval stopwords %s: %w", stopwordsPath, err)
	}

	customTermsPath, err := dictSet.path(retrievalBundledCustomTermsDictFile)
	if err != nil {
		return retrievalTokenPolicy{}, fmt.Errorf("resolve custom terms path: %w", err)
	}

	policy := retrievalTokenPolicy{
		stopwords:          stopwords,
		dictDir:            dictSet.dir,
		customTermsPath:    customTermsPath,
		retrievalStopwords: stopwordsPath,
	}
	if path, err := dictSet.path(retrievalBundledStopWordDictFile); err == nil {
		policy.upstreamStopWordPath = path
	}
	if path, err := dictSet.path(retrievalBundledStopTokensDictFile); err == nil {
		policy.upstreamStopTokensPath = path
	}
	if path, err := dictSet.path(retrievalBundledIDFDictFile); err == nil {
		policy.idfPath = path
	}
	if path, err := dictSet.path(retrievalBundledTFIDFDictFile); err == nil {
		policy.tfIDFPath = path
	}
	if path, err := dictSet.path(retrievalBundledTFIDFOriginDictFile); err == nil {
		policy.tfIDFOriginPath = path
	}
	return policy, nil
}

func loadStopwordMap(filePath string) (map[string]struct{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open stopword file %s: %w", filePath, err)
	}
	defer func() {
		_ = file.Close()
	}()
	return loadStopwordMapFromReader(file)
}

func loadStopwordMapFromReader(reader io.Reader) (map[string]struct{}, error) {
	return loadStopwordMapFromScanner(bufio.NewScanner(reader))
}

func loadStopwordMapFromScanner(scanner *bufio.Scanner) (map[string]struct{}, error) {
	stopwords := make(map[string]struct{})
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		stopwords[line] = struct{}{}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan stopword entries: %w", err)
	}
	return stopwords, nil
}

type retrievalSegmenterGate struct{}

func (retrievalSegmenterGate) withExclusiveLock(run func() error) error {
	retrievalSegmenterProcessMu.Lock()
	defer retrievalSegmenterProcessMu.Unlock()

	unlock, err := lockDefaultRetrievalDictionary(syscall.LOCK_EX)
	if err != nil {
		return err
	}
	defer unlock()
	return run()
}

func (retrievalSegmenterGate) withSharedLock(run func() []string) ([]string, error) {
	retrievalSegmenterProcessMu.RLock()
	defer retrievalSegmenterProcessMu.RUnlock()

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
