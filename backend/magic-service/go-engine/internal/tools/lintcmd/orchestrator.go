// Package lintcmd orchestrates the repository lint checks.
package lintcmd

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"sync"
	"time"

	"magic/internal/tools/smartdeadcode"
	"magic/internal/tools/smartgolangci"
	"magic/internal/tools/smartvet"
	"magic/internal/tools/smartvettool"
	"magic/internal/tools/smartwire"
)

type staticError string

func (e staticError) Error() string {
	return string(e)
}

const (
	defaultGolangCIConfigPath = ".golangci.yml"
	defaultVetToolPath        = "./bin/layerdeps"
	defaultVetCacheDir        = ".cache/lint/vetpkgs"
	defaultDeadcodeCacheFile  = ".cache/lint/deadcode.json"
	defaultGolangCICacheFile  = ".cache/lint/golangci.json"
	defaultVetToolCacheFile   = ".cache/lint/vettool.json"
	defaultWireCacheFile      = ".cache/lint/wire.json"
	defaultWireBinary         = "wire"
	lintTaskGroupCount        = 4

	errContextRequired = staticError("context is required")
	errUnknownTask     = staticError("unknown lint task")
	errLintFailed      = staticError("lint checks failed")
)

const (
	taskVetToolSmart  = "vettool-smart"
	taskVetSmart      = "vet-smart"
	taskGolangCILint  = "golangci-lint"
	taskDeadcodeSmart = "deadcode-smart"
	taskWireSmart     = "wire-smart"
)

type lintStatus string

const (
	statusPass lintStatus = "PASS"
	statusFail lintStatus = "FAIL"
	statusSkip lintStatus = "SKIP"
)

// Options configures the lint tools executed by Runner.
type Options struct{}

// Runner executes the configured lint tasks and reports a summary.
type Runner struct {
	stdout  io.Writer
	stderr  io.Writer
	tasks   []lintTask
	runTask func(ctx context.Context, task lintTask) lintResult
}

type lintTask struct {
	name     string
	validate func(output string, execErr error) error
}

type lintResult struct {
	name     string
	duration time.Duration
	output   string
	err      error
	status   lintStatus
}

// ParseOptions parses lint command flags into runtime options.
func ParseOptions(args []string) (Options, error) {
	fs := flag.NewFlagSet("lint", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	if err := fs.Parse(args); err != nil {
		return Options{}, fmt.Errorf("parse flags: %w", err)
	}
	return Options{}, nil
}

// NewRunner constructs a lint runner with the provided outputs.
func NewRunner(opts Options, stdout, stderr io.Writer) *Runner {
	_ = opts

	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}

	r := &Runner{
		stdout: stdout,
		stderr: stderr,
	}
	r.tasks = buildTasks()
	r.runTask = r.defaultRunTask

	return r
}

func buildTasks() []lintTask {
	return []lintTask{
		{
			name:     taskVetToolSmart,
			validate: validateCommand,
		},
		{
			name:     taskVetSmart,
			validate: validateCommand,
		},
		{
			name:     taskGolangCILint,
			validate: validateCommand,
		},
		{
			name:     taskDeadcodeSmart,
			validate: validateCommand,
		},
		{
			name:     taskWireSmart,
			validate: validateCommand,
		},
	}
}

func validateCommand(_ string, execErr error) error {
	if execErr != nil {
		return fmt.Errorf("command failed: %w", execErr)
	}

	return nil
}

// Run executes all configured lint tasks and prints a summary.
func (r *Runner) Run(ctx context.Context) error {
	if ctx == nil {
		return errContextRequired
	}
	startedAt := time.Now()

	results := make([]lintResult, len(r.tasks))
	taskByName := r.taskLookup()

	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)

	storeResult := func(taskName string, result lintResult) {
		mu.Lock()
		defer mu.Unlock()
		results[r.taskIndex(taskName)] = normalizeResult(taskName, result)
	}

	wg.Add(lintTaskGroupCount)
	go func() {
		defer wg.Done()

		vettoolResult := normalizeResult(taskVetToolSmart, r.runTask(ctx, taskByName[taskVetToolSmart]))
		storeResult(taskVetToolSmart, vettoolResult)

		if vettoolResult.status == statusFail {
			storeResult(taskVetSmart, skippedResult(taskVetSmart, vettoolResult.err))
			return
		}

		storeResult(taskVetSmart, r.runTask(ctx, taskByName[taskVetSmart]))
	}()
	go func() {
		defer wg.Done()
		storeResult(taskGolangCILint, r.runTask(ctx, taskByName[taskGolangCILint]))
	}()
	go func() {
		defer wg.Done()
		storeResult(taskDeadcodeSmart, r.runTask(ctx, taskByName[taskDeadcodeSmart]))
	}()
	go func() {
		defer wg.Done()
		storeResult(taskWireSmart, r.runTask(ctx, taskByName[taskWireSmart]))
	}()
	wg.Wait()

	r.printSummary(results, time.Since(startedAt).Round(time.Millisecond))

	failedResults := failedLintResults(results)
	if len(failedResults) == 0 {
		_, _ = fmt.Fprintln(r.stdout, "All lint checks passed.")
		return nil
	}

	r.printFailures(failedResults)
	return fmt.Errorf("%w: %d checks failed", errLintFailed, len(failedResults))
}

func failedLintResults(results []lintResult) []lintResult {
	failed := make([]lintResult, 0, len(results))
	for _, result := range results {
		if result.status == statusFail {
			failed = append(failed, result)
		}
	}

	return failed
}

func normalizeResult(taskName string, result lintResult) lintResult {
	if result.name == "" {
		result.name = taskName
	}
	if result.status != "" {
		return result
	}
	if result.err != nil {
		result.status = statusFail
		return result
	}

	result.status = statusPass
	return result
}

func skippedResult(taskName string, cause error) lintResult {
	result := lintResult{
		name:   taskName,
		status: statusSkip,
		output: "skipped because vettool-smart failed",
	}
	if cause != nil {
		result.output = fmt.Sprintf("%s: %v", result.output, cause)
	}

	return result
}

func (r *Runner) taskLookup() map[string]lintTask {
	lookup := make(map[string]lintTask, len(r.tasks))
	for _, task := range r.tasks {
		lookup[task.name] = task
	}

	return lookup
}

func (r *Runner) taskIndex(taskName string) int {
	for idx, task := range r.tasks {
		if task.name == taskName {
			return idx
		}
	}

	return -1
}

func (r *Runner) defaultRunTask(ctx context.Context, task lintTask) lintResult {
	startedAt := time.Now()
	commandOutput, execErr := r.runTaskInProcess(ctx, task.name)
	validationErr := task.validate(commandOutput, execErr)

	return lintResult{
		name:     task.name,
		duration: time.Since(startedAt).Round(time.Millisecond),
		output:   commandOutput,
		err:      validationErr,
		status:   resultStatus(validationErr),
	}
}

func (r *Runner) runTaskInProcess(ctx context.Context, taskName string) (string, error) {
	var output bytes.Buffer

	runWithBuffer := func(fn func(stdout, stderr io.Writer) error) (string, error) {
		err := fn(&output, &output)
		return strings.TrimSpace(output.String()), err
	}

	switch taskName {
	case taskVetToolSmart:
		return runWithBuffer(func(stdout, stderr io.Writer) error {
			return smartvettool.NewRunner(smartvettool.Options{
				CacheFile: defaultVetToolCacheFile,
			}, stdout, stderr).Run(ctx)
		})
	case taskVetSmart:
		return runWithBuffer(func(stdout, stderr io.Writer) error {
			logger := slog.New(slog.DiscardHandler)
			return smartvet.NewRunner(smartvet.Options{
				VetToolPath: defaultVetToolPath,
				CacheDir:    defaultVetCacheDir,
				RootDir:     ".",
			}, logger, stdout, stderr).Run()
		})
	case taskGolangCILint:
		return runWithBuffer(func(stdout, stderr io.Writer) error {
			return smartgolangci.NewRunner(smartgolangci.Options{
				CacheFile: defaultGolangCICacheFile,
			}, stdout, stderr).Run(ctx)
		})
	case taskDeadcodeSmart:
		return runWithBuffer(func(stdout, stderr io.Writer) error {
			return smartdeadcode.NewRunner(smartdeadcode.Options{
				CacheFile: defaultDeadcodeCacheFile,
			}, stdout, stderr).Run(ctx)
		})
	case taskWireSmart:
		return runWithBuffer(func(stdout, stderr io.Writer) error {
			return smartwire.NewRunner(smartwire.Options{
				Binary:    defaultWireBinary,
				CacheFile: defaultWireCacheFile,
			}, stdout, stderr).Run(ctx)
		})
	default:
		return "", errUnknownTask
	}
}

func resultStatus(err error) lintStatus {
	if err != nil {
		return statusFail
	}

	return statusPass
}

func (r *Runner) printSummary(results []lintResult, elapsed time.Duration) {
	_, _ = fmt.Fprintln(r.stdout, "Lint summary:")
	for _, result := range results {
		_, _ = fmt.Fprintf(r.stdout, "[%s] %s (%s)\n", result.status, result.name, formatDuration(result.duration))
	}
	_, _ = fmt.Fprintf(r.stdout, "Parallel lint elapsed: %s\n", formatDuration(elapsed))
}

func (r *Runner) printFailures(results []lintResult) {
	_, _ = fmt.Fprintln(r.stderr, "Lint failure details:")
	for _, result := range results {
		_, _ = fmt.Fprintf(r.stderr, "=== %s ===\n", result.name)

		if result.output != "" {
			_, _ = fmt.Fprintln(r.stderr, result.output)
		} else {
			_, _ = fmt.Fprintf(r.stderr, "error: %v\n", result.err)
		}

		_, _ = fmt.Fprintln(r.stderr)
	}
}

func formatDuration(duration time.Duration) string {
	if duration < time.Millisecond {
		return "<1ms"
	}

	return duration.String()
}

// IsLintFailure reports whether err represents one or more failed lint checks.
func IsLintFailure(err error) bool {
	return errors.Is(err, errLintFailed)
}
