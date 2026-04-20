// Package smartwire provides cache-backed incremental Wire validation.
package smartwire

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"magic/internal/tools/smartcache"
)

type staticError string

func (e staticError) Error() string {
	return string(e)
}

const (
	defaultRootDir   = "."
	defaultCacheFile = ".cache/lint/wire.json"
	defaultBinary    = "wire"
	cacheFilePerm    = 0o600

	errContextRequired = staticError("context is required")
	errCachedFailure   = staticError("cached wire failure")
	resultPass         = "pass"
	resultFail         = "fail"
)

// Options configures the incremental Wire runner.
type Options struct {
	RootDir   string
	CacheFile string
	Binary    string
}

// Runner executes Wire validation only when tracked inputs changed.
type Runner struct {
	opts        Options
	stdout      io.Writer
	stderr      io.Writer
	lookPath    func(file string) (string, error)
	fileHash    func(path string) (string, error)
	loadTracked func(root string) ([]smartcache.TrackedFile, error)
	atomicWrite func(filename string, data []byte, perm os.FileMode) error
	runCheck    func(ctx context.Context, binaryPath string) (string, error)
	runDiff     func(ctx context.Context, binaryPath string) (string, error)
	isDiffMatch func(error) bool
}

type cacheState struct {
	ToolHash  string                         `json:"tool_hash"`
	InputHash string                         `json:"input_hash"`
	Files     map[string]smartcache.FileMeta `json:"files"`
	Result    string                         `json:"result,omitempty"`
	Output    string                         `json:"output,omitempty"`
}

// NewRunner constructs a Wire runner with cache-backed incremental skipping.
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
		fileHash:    smartcache.FileHash,
		loadTracked: loadTrackedFiles,
		atomicWrite: smartcache.AtomicWriteFile,
		isDiffMatch: isDiffMismatchError,
	}
	r.runCheck = r.defaultRunCheck
	r.runDiff = r.defaultRunDiff

	return r
}

// Run executes Wire checks when tracked inputs changed, otherwise reuses cached state.
func (r *Runner) Run(ctx context.Context) error {
	if ctx == nil {
		return errContextRequired
	}

	binaryPath, err := r.lookPath(r.opts.Binary)
	if err != nil {
		return fmt.Errorf("wire not found: %w; install it with `make dev-tools`", err)
	}

	toolHash, err := r.fileHash(binaryPath)
	if err != nil {
		return fmt.Errorf("hash wire binary: %w", err)
	}

	trackedFiles, err := r.loadTracked(r.opts.RootDir)
	if err != nil {
		return fmt.Errorf("collect tracked files: %w", err)
	}

	currentState := cacheState{
		ToolHash: toolHash,
		Files:    smartcache.FilesMap(trackedFiles),
	}

	previousState, _ := loadCache(r.opts.CacheFile)
	if previousState.ToolHash == currentState.ToolHash && smartcache.MetadataMatch(previousState.Files, currentState.Files) {
		return r.replayCachedResult(previousState, "Skipping wire checks (no changes since last run)")
	}

	inputHash, err := smartcache.HashFiles(trackedFiles)
	if err != nil {
		return fmt.Errorf("hash tracked files: %w", err)
	}
	currentState.InputHash = inputHash

	if previousState.ToolHash == currentState.ToolHash && previousState.InputHash == currentState.InputHash {
		currentState.Result = previousState.Result
		if previousState.Result == resultFail {
			currentState.Output = previousState.Output
		}
		if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
			return err
		}
		return r.replayCachedResult(previousState, "Skipping wire checks (content unchanged)")
	}

	return r.executeAndPersist(ctx, binaryPath, currentState)
}

func loadTrackedFiles(root string) ([]smartcache.TrackedFile, error) {
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

func (r *Runner) executeAndPersist(ctx context.Context, binaryPath string, currentState cacheState) error {
	checkOutput, checkErr := r.runCheck(ctx, binaryPath)
	trimmedCheckOutput := strings.TrimSpace(checkOutput)
	if checkErr != nil {
		return r.persistFindings(currentState, trimmedCheckOutput, fmt.Errorf("wire check failed: %w", checkErr))
	}

	diffOutput, diffErr := r.runDiff(ctx, binaryPath)
	trimmedDiffOutput := strings.TrimSpace(diffOutput)
	if diffErr != nil {
		if r.isDiffMatch(diffErr) {
			return r.persistFindings(currentState, trimmedDiffOutput, fmt.Errorf("wire diff failed: %w", diffErr))
		}

		return r.reportRunFailure(trimmedDiffOutput, fmt.Errorf("wire diff failed: %w", diffErr))
	}

	currentState.Result = resultPass
	currentState.Output = ""
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}

	_, _ = fmt.Fprintln(r.stdout, "✓ wire checks passed")
	return nil
}

func (r *Runner) persistFindings(currentState cacheState, trimmedOutput string, runErr error) error {
	currentState.Result = resultFail
	currentState.Output = trimmedOutput
	if currentState.Output == "" {
		currentState.Output = runErr.Error()
	}
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}
	if currentState.Output != "" {
		_, _ = fmt.Fprintln(r.stderr, currentState.Output)
	}

	return runErr
}

func (r *Runner) reportRunFailure(trimmedOutput string, runErr error) error {
	if trimmedOutput != "" {
		_, _ = fmt.Fprintln(r.stderr, trimmedOutput)
	}

	return runErr
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

func isDiffMismatchError(err error) bool {
	var exitErr *exec.ExitError
	return errors.As(err, &exitErr) && exitErr.ExitCode() == 1
}

func (r *Runner) defaultRunCheck(ctx context.Context, binaryPath string) (string, error) {
	cmd := exec.CommandContext(ctx, binaryPath, "check")
	cmd.Dir = r.opts.RootDir

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	err := cmd.Run()
	return output.String(), err
}

func (r *Runner) defaultRunDiff(ctx context.Context, binaryPath string) (string, error) {
	cmd := exec.CommandContext(ctx, binaryPath, "diff")
	cmd.Dir = r.opts.RootDir

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	err := cmd.Run()
	return output.String(), err
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
