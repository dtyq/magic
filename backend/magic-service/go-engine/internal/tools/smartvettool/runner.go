// Package smartvettool provides cache-backed incremental analyzer builds.
package smartvettool

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"magic/internal/tools/smartcache"
)

type staticError string

func (e staticError) Error() string {
	return string(e)
}

const (
	defaultRootDir   = "."
	defaultCacheFile = ".cache/lint/vettool.json"
	defaultOutput    = "./bin/layerdeps"
	defaultPackage   = "./cmd/layerdeps"
	cacheFilePerm    = 0o600

	errContextRequired = staticError("context is required")
)

// Options configures the incremental analyzer build runner.
type Options struct {
	RootDir   string
	CacheFile string
}

// Runner builds the analyzer binary only when tracked inputs have changed.
type Runner struct {
	opts        Options
	stdout      io.Writer
	stderr      io.Writer
	runBuild    func(ctx context.Context) (string, error)
	loadTracked func(root string) ([]smartcache.TrackedFile, error)
	atomicWrite func(filename string, data []byte, perm os.FileMode) error
}

type cacheState struct {
	InputHash string                         `json:"input_hash"`
	Files     map[string]smartcache.FileMeta `json:"files"`
}

// ParseOptions parses CLI flags into runner options.
func ParseOptions(args []string) (Options, error) {
	fs := flag.NewFlagSet("vettool", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	opts := Options{
		RootDir:   defaultRootDir,
		CacheFile: defaultCacheFile,
	}

	fs.StringVar(&opts.RootDir, "root", defaultRootDir, "repository root to scan")
	fs.StringVar(&opts.CacheFile, "cache", defaultCacheFile, "cache file path")

	if err := fs.Parse(args); err != nil {
		return Options{}, fmt.Errorf("parse flags: %w", err)
	}

	return opts, nil
}

// NewRunner constructs a cache-backed analyzer build runner.
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
	r := &Runner{
		opts:        opts,
		stdout:      stdout,
		stderr:      stderr,
		loadTracked: loadTrackedFiles,
		atomicWrite: smartcache.AtomicWriteFile,
	}
	r.runBuild = r.defaultRunBuild

	return r
}

// Run executes the analyzer build when tracked inputs changed.
func (r *Runner) Run(ctx context.Context) error {
	if ctx == nil {
		return errContextRequired
	}

	trackedFiles, err := r.loadTracked(r.opts.RootDir)
	if err != nil {
		return fmt.Errorf("collect tracked files: %w", err)
	}

	currentState := cacheState{
		Files: smartcache.FilesMap(trackedFiles),
	}

	previousState, _ := loadCache(r.opts.CacheFile)
	outputExists := fileExists(filepath.Join(r.opts.RootDir, strings.TrimPrefix(defaultOutput, "./")))
	if outputExists && smartcache.MetadataMatch(previousState.Files, currentState.Files) {
		_, _ = fmt.Fprintln(r.stdout, "Skipping layerdeps build (no changes since last run)")
		return nil
	}

	inputHash, err := smartcache.HashFiles(trackedFiles)
	if err != nil {
		return fmt.Errorf("hash tracked files: %w", err)
	}
	currentState.InputHash = inputHash

	if outputExists && previousState.InputHash == currentState.InputHash {
		if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
			return err
		}
		_, _ = fmt.Fprintln(r.stdout, "Skipping layerdeps build (content unchanged)")
		return nil
	}

	output, err := r.runBuild(ctx)
	if trimmed := strings.TrimSpace(output); trimmed != "" {
		_, _ = fmt.Fprintln(r.stderr, trimmed)
	}
	if err != nil {
		return fmt.Errorf("build analyzer: %w", err)
	}

	if err := persistCache(r.opts.CacheFile, currentState, r.atomicWrite); err != nil {
		return err
	}

	_, _ = fmt.Fprintln(r.stdout, "✓ Layerdeps analyzer ready")
	return nil
}

func loadTrackedFiles(root string) ([]smartcache.TrackedFile, error) {
	files, err := smartcache.CollectFiles(root, func(relPath string) bool {
		if relPath == "go.mod" || relPath == "go.sum" {
			return true
		}
		return isTrackedSource(relPath)
	})
	if err != nil {
		return nil, fmt.Errorf("collect files: %w", err)
	}

	return files, nil
}

func (r *Runner) defaultRunBuild(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "go", "build", "-o", defaultOutput, defaultPackage)
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

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func isTrackedSource(relPath string) bool {
	if !strings.HasSuffix(relPath, ".go") {
		return false
	}

	return strings.HasPrefix(relPath, "cmd/layerdeps/") ||
		strings.HasPrefix(relPath, "internal/tools/analyzers/layerdeps/") ||
		strings.HasPrefix(relPath, "internal/pkg/fileutil/")
}
