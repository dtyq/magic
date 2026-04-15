// Package smartgolangci provides cache-backed incremental golangci-lint runs.
package smartgolangci

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
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
	defaultRootDir    = "."
	defaultCacheFile  = ".cache/lint/golangci.json"
	defaultBinary     = "golangci-lint"
	defaultConfigFile = ".golangci.yml"
	cacheFilePerm     = 0o600

	errContextRequired = staticError("context is required")
	errCachedFailure   = staticError("cached golangci-lint failure")
	resultPass         = "pass"
	resultFail         = "fail"
)

// Options configures the incremental golangci-lint runner.
type Options struct {
	RootDir   string
	CacheFile string
	Binary    string
}

// Runner executes golangci-lint only when tracked inputs have changed.
type Runner struct {
	opts        Options
	stdout      io.Writer
	stderr      io.Writer
	lookPath    func(file string) (string, error)
	runLint     func(ctx context.Context, binaryPath string) (string, error)
	isFinding   func(error) bool
	fileHash    func(path string) (string, error)
	loadTracked func(root string) ([]smartcache.TrackedFile, error)
	atomicWrite func(filename string, data []byte, perm os.FileMode) error
}

type cacheState struct {
	ToolHash  string                         `json:"tool_hash"`
	InputHash string                         `json:"input_hash"`
	Files     map[string]smartcache.FileMeta `json:"files"`
	Result    string                         `json:"result,omitempty"`
	Output    string                         `json:"output,omitempty"`
}

// ParseOptions parses CLI flags into runner options.
func ParseOptions(args []string) (Options, error) {
	fs := flag.NewFlagSet("golangci", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	opts := Options{
		RootDir:   defaultRootDir,
		CacheFile: defaultCacheFile,
		Binary:    defaultBinary,
	}

	fs.StringVar(&opts.RootDir, "root", defaultRootDir, "repository root to scan")
	fs.StringVar(&opts.CacheFile, "cache", defaultCacheFile, "cache file path")
	fs.StringVar(&opts.Binary, "bin", defaultBinary, "golangci-lint binary path or name")

	if err := fs.Parse(args); err != nil {
		return Options{}, fmt.Errorf("parse flags: %w", err)
	}

	return opts, nil
}

// NewRunner constructs a golangci-lint runner with cache-backed incremental skipping.
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
		isFinding:   isLintFindingsError,
	}
	r.runLint = r.defaultRunLint

	return r
}

// Run executes golangci-lint when tracked inputs changed, otherwise reuses cached state.
func (r *Runner) Run(ctx context.Context) error {
	if ctx == nil {
		return errContextRequired
	}

	binaryPath, err := r.lookPath(r.opts.Binary)
	if err != nil {
		return fmt.Errorf("golangci-lint not found: %w", err)
	}

	toolHash, err := r.fileHash(binaryPath)
	if err != nil {
		return fmt.Errorf("hash golangci-lint binary: %w", err)
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
		return r.replayCachedResult(previousState, "Skipping golangci-lint (no changes since last run)")
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
		return r.replayCachedResult(previousState, "Skipping golangci-lint (content unchanged)")
	}

	output, err := r.runLint(ctx, binaryPath)
	trimmedOutput := strings.TrimSpace(output)
	currentState.Output = trimmedOutput
	if err != nil {
		if r.isFinding(err) {
			return r.persistFindings(currentState, trimmedOutput, err)
		}
		return r.reportRunFailure(trimmedOutput, err)
	}
	currentState.Result = resultPass
	currentState.Output = ""
	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}

	_, _ = fmt.Fprintln(r.stdout, "✓ golangci-lint passed")
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
	if trimmedOutput != "" {
		_, _ = fmt.Fprintln(r.stderr, trimmedOutput)
	}

	return fmt.Errorf("golangci-lint failed: %w", runErr)
}

func (r *Runner) reportRunFailure(trimmedOutput string, runErr error) error {
	if trimmedOutput != "" {
		_, _ = fmt.Fprintln(r.stderr, trimmedOutput)
	}

	return fmt.Errorf("golangci-lint failed: %w", runErr)
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

func isLintFindingsError(err error) bool {
	var exitErr *exec.ExitError
	return errors.As(err, &exitErr) && exitErr.ExitCode() == 1
}

func loadTrackedFiles(root string) ([]smartcache.TrackedFile, error) {
	files, err := smartcache.CollectFiles(root, func(relPath string) bool {
		if relPath == defaultConfigFile || relPath == "go.mod" || relPath == "go.sum" {
			return true
		}

		return strings.HasSuffix(relPath, ".go")
	})
	if err != nil {
		return nil, fmt.Errorf("collect files: %w", err)
	}

	return files, nil
}

func (r *Runner) defaultRunLint(ctx context.Context, binaryPath string) (string, error) {
	cmd := exec.CommandContext(ctx, binaryPath, "run", "--config", defaultConfigFile)
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
