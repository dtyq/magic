// Package smartdeadcode provides incremental deadcode checks backed by .cache state.
package smartdeadcode

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"

	"magic/internal/pkg/fileutil"
)

type staticError string

func (e staticError) Error() string {
	return string(e)
}

const (
	defaultRootDir   = "."
	defaultCacheFile = ".cache/lint/deadcode.json"
	defaultBinary    = "deadcode"
	cacheFilePerm    = 0o600

	errContextRequired = staticError("context is required")
	errDeadcodeFound   = staticError("deadcode reported findings")
	errCachedFailure   = staticError("cached deadcode failure")
	resultPass         = "pass"
	resultFail         = "fail"
)

// Options configures the incremental deadcode runner.
type Options struct {
	RootDir   string
	CacheFile string
	Binary    string
}

// Runner executes deadcode only when tracked inputs have changed.
type Runner struct {
	opts        Options
	stdout      io.Writer
	stderr      io.Writer
	lookPath    func(file string) (string, error)
	runDeadcode func(ctx context.Context, binaryPath string) (string, error)
	fileHash    func(path string) (string, error)
	loadTracked func(root string) ([]trackedFile, error)
	atomicWrite func(filename string, data []byte, perm os.FileMode) error
}

type cacheState struct {
	ToolHash  string              `json:"tool_hash"`
	InputHash string              `json:"input_hash"`
	Files     map[string]fileMeta `json:"files"`
	Result    string              `json:"result,omitempty"`
	Output    string              `json:"output,omitempty"`
}

type fileMeta struct {
	Mtime int64 `json:"mtime"`
	Size  int64 `json:"size"`
}

type trackedFile struct {
	RelativePath string
	FullPath     string
	Meta         fileMeta
}

// ParseOptions parses CLI flags into runner options.
func ParseOptions(args []string) (Options, error) {
	fs := flag.NewFlagSet("deadcode", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	opts := Options{
		RootDir:   defaultRootDir,
		CacheFile: defaultCacheFile,
		Binary:    defaultBinary,
	}

	fs.StringVar(&opts.RootDir, "root", defaultRootDir, "repository root to scan")
	fs.StringVar(&opts.CacheFile, "cache", defaultCacheFile, "cache file path")
	fs.StringVar(&opts.Binary, "bin", defaultBinary, "deadcode binary path or name")

	if err := fs.Parse(args); err != nil {
		return Options{}, fmt.Errorf("parse flags: %w", err)
	}

	return opts, nil
}

// NewRunner constructs a deadcode runner with cache-backed incremental skipping.
func NewRunner(opts Options, stdout, stderr io.Writer) *Runner {
	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}
	if opts.RootDir == "" {
		opts.RootDir = defaultRootDir
	}
	if opts.CacheFile == "" {
		opts.CacheFile = defaultCacheFile
	}
	if opts.Binary == "" {
		opts.Binary = defaultBinary
	}

	r := &Runner{
		opts:        opts,
		stdout:      stdout,
		stderr:      stderr,
		lookPath:    exec.LookPath,
		fileHash:    fileHash,
		loadTracked: collectTrackedFiles,
		atomicWrite: atomicWriteFile,
	}
	r.runDeadcode = r.defaultRunDeadcode

	return r
}

// Run executes deadcode when tracked inputs changed, otherwise reuses cached state.
func (r *Runner) Run(ctx context.Context) error {
	if ctx == nil {
		return errContextRequired
	}

	previousState, currentState, binaryPath, err := r.prepareRunState()
	if err != nil {
		return err
	}
	if isMetadataMatch(previousState, currentState) {
		return r.replayCachedResult(previousState, "Skipping deadcode (no changes since last run)")
	}

	if previousState.ToolHash == currentState.ToolHash && previousState.InputHash == currentState.InputHash {
		return r.persistAndReplayCachedState(previousState, currentState, "Skipping deadcode (content unchanged)")
	}

	return r.executeAndPersist(ctx, binaryPath, currentState)
}

func (r *Runner) prepareRunState() (cacheState, cacheState, string, error) {
	binaryPath, err := r.lookPath(r.opts.Binary)
	if err != nil {
		return cacheState{}, cacheState{}, "", fmt.Errorf("deadcode not found: %w", err)
	}

	toolHash, err := r.fileHash(binaryPath)
	if err != nil {
		return cacheState{}, cacheState{}, "", fmt.Errorf("hash deadcode binary: %w", err)
	}

	trackedFiles, err := r.loadTracked(r.opts.RootDir)
	if err != nil {
		return cacheState{}, cacheState{}, "", fmt.Errorf("collect tracked files: %w", err)
	}

	inputHash, err := hashTrackedFiles(trackedFiles)
	if err != nil {
		return cacheState{}, cacheState{}, "", fmt.Errorf("hash tracked files: %w", err)
	}

	currentState := cacheState{
		ToolHash:  toolHash,
		InputHash: inputHash,
		Files:     trackedFileMap(trackedFiles),
	}
	previousState, _ := loadCache(r.opts.CacheFile)

	return previousState, currentState, binaryPath, nil
}

func (r *Runner) persistAndReplayCachedState(previousState, currentState cacheState, skipMessage string) error {
	currentState.Result = previousState.Result
	if previousState.Result == resultFail {
		currentState.Output = previousState.Output
	}
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}

	return r.replayCachedResult(previousState, skipMessage)
}

func (r *Runner) executeAndPersist(ctx context.Context, binaryPath string, currentState cacheState) error {
	output, err := r.runDeadcode(ctx, binaryPath)
	trimmedOutput := strings.TrimSpace(output)
	if err != nil {
		return r.reportRunFailure(trimmedOutput, err)
	}
	if trimmedOutput != "" {
		return r.persistFindings(currentState, trimmedOutput)
	}

	currentState.Result = resultPass
	currentState.Output = ""
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}

	_, _ = fmt.Fprintln(r.stdout, "✓ No deadcode found")
	return nil
}

func (r *Runner) reportRunFailure(trimmedOutput string, runErr error) error {
	if trimmedOutput != "" {
		_, _ = fmt.Fprintln(r.stderr, trimmedOutput)
	}

	return fmt.Errorf("deadcode failed: %w", runErr)
}

func (r *Runner) persistFindings(currentState cacheState, trimmedOutput string) error {
	currentState.Result = resultFail
	currentState.Output = trimmedOutput
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}
	_, _ = fmt.Fprintln(r.stderr, trimmedOutput)

	return errDeadcodeFound
}

func (r *Runner) replayCachedResult(state cacheState, skipMessage string) error {
	if state.Result != resultFail {
		_, _ = fmt.Fprintln(r.stdout, skipMessage)
		return nil
	}
	_, _ = fmt.Fprintln(r.stdout, cachedFailureMessage(skipMessage))
	if state.Output != "" {
		_, _ = fmt.Fprintln(r.stderr, state.Output)
	}

	return errCachedFailure
}

func cachedFailureMessage(skipMessage string) string {
	if before, ok := strings.CutSuffix(skipMessage, ")"); ok {
		return before + "; cached failed result)"
	}

	return skipMessage + " (cached failed result)"
}

func (r *Runner) defaultRunDeadcode(ctx context.Context, binaryPath string) (string, error) {
	cmd := exec.CommandContext(ctx, binaryPath, "-test", "./...")
	cmd.Dir = r.opts.RootDir

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	err := cmd.Run()
	return output.String(), err
}

func trackedFileMap(files []trackedFile) map[string]fileMeta {
	result := make(map[string]fileMeta, len(files))
	for _, file := range files {
		result[file.RelativePath] = file.Meta
	}

	return result
}

func isMetadataMatch(previous, current cacheState) bool {
	if previous.ToolHash == "" || previous.ToolHash != current.ToolHash {
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

func loadCache(path string) (cacheState, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return cacheState{}, fmt.Errorf("read cache: %w", err)
	}

	var state cacheState
	if err := json.Unmarshal(content, &state); err != nil {
		return cacheState{}, fmt.Errorf("unmarshal cache: %w", err)
	}

	return state, nil
}

func persistCache(path string, state cacheState, writeFile func(filename string, data []byte, perm os.FileMode) error) error {
	content, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("marshal cache: %w", err)
	}
	if err := writeFile(path, content, cacheFilePerm); err != nil {
		return fmt.Errorf("write cache: %w", err)
	}

	return nil
}

func collectTrackedFiles(root string) ([]trackedFile, error) {
	tracked := make([]trackedFile, 0)

	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("relative path %s: %w", path, err)
		}
		if relPath == "." {
			return nil
		}

		if entry.IsDir() {
			if shouldSkipDir(relPath) {
				return filepath.SkipDir
			}
			return nil
		}
		if !shouldTrackFile(relPath) {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return fmt.Errorf("stat %s: %w", path, err)
		}

		tracked = append(tracked, trackedFile{
			RelativePath: filepath.ToSlash(relPath),
			FullPath:     path,
			Meta: fileMeta{
				Mtime: info.ModTime().UnixNano(),
				Size:  info.Size(),
			},
		})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk tracked files: %w", err)
	}

	slices.SortFunc(tracked, func(a, b trackedFile) int {
		return strings.Compare(a.RelativePath, b.RelativePath)
	})

	return tracked, nil
}

func shouldSkipDir(relPath string) bool {
	firstSegment := strings.Split(filepath.ToSlash(relPath), "/")[0]
	switch firstSegment {
	case ".cache", "tmp", "bin", ".git":
		return true
	default:
		return false
	}
}

func shouldTrackFile(relPath string) bool {
	baseName := filepath.Base(relPath)
	if baseName == "go.mod" || baseName == "go.sum" {
		return true
	}

	return strings.HasSuffix(relPath, ".go")
}

func hashTrackedFiles(files []trackedFile) (string, error) {
	hasher := sha256.New()

	for _, file := range files {
		if _, err := io.WriteString(hasher, file.RelativePath); err != nil {
			return "", fmt.Errorf("hash path %s: %w", file.RelativePath, err)
		}
		if err := hashFileInto(hasher, file.FullPath); err != nil {
			return "", err
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func hashFileInto(writer io.Writer, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open file %s: %w", path, err)
	}
	defer func() { _ = file.Close() }()

	if _, err := io.Copy(writer, file); err != nil {
		return fmt.Errorf("hash file %s: %w", path, err)
	}

	return nil
}

func fileHash(path string) (string, error) {
	hash, err := fileutil.FileHash(path)
	if err != nil {
		return "", fmt.Errorf("file hash: %w", err)
	}

	return hash, nil
}

func atomicWriteFile(filename string, data []byte, perm os.FileMode) error {
	if err := fileutil.AtomicWriteFile(filename, data, perm); err != nil {
		return fmt.Errorf("atomic write: %w", err)
	}

	return nil
}
