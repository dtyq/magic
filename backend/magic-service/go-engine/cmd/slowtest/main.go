// Package main provides a helper CLI to report slow unit tests from `go test -json`.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

const (
	defaultTopResults     = 50
	defaultPackageTop     = 30
	defaultResultCapacity = 32
	scannerInitialBufSize = 64 * 1024
	scannerMaxBufSize     = 2 * 1024 * 1024
)

var errCalibrateMissingPackageResult = errors.New("calibrate missing package result")

type event struct {
	Action  string
	Package string
	Test    string
	Elapsed float64
	Output  string
}

type slowTest struct {
	Package string
	Test    string
	Elapsed time.Duration
}

type slowPackage struct {
	Package string
	Elapsed time.Duration
}

type failure struct {
	Package string
	Test    string
	Output  []string
}

type scanResults struct {
	Tests        []slowTest
	Packages     []slowPackage
	Failures     []failure
	PackagesSeen []string
}

func main() {
	var (
		threshold        = flag.Duration("threshold", 100*time.Millisecond, "只展示耗时不低于该阈值的测试")
		top              = flag.Int("top", defaultTopResults, "最多展示多少条慢测")
		packageThreshold = flag.Duration("package-threshold", time.Second, "只展示耗时不低于该阈值的包")
		packageTop       = flag.Int("package-top", defaultPackageTop, "最多展示多少条慢包")
	)
	flag.Parse()

	goTestArgs := flag.Args()
	if len(goTestArgs) == 0 {
		goTestArgs = []string{"./..."}
	}
	goTestArgs = ensureArg(goTestArgs, "-count=1", "-count")

	results, err := runGoTestJSON(context.Background(), goTestArgs, *threshold, *packageThreshold)
	if err == nil {
		calibratedPackages, calibrateErr := calibrateSlowPackages(
			context.Background(),
			goTestArgs,
			results.PackagesSeen,
			results.Packages,
			*packageThreshold,
			runGoTestJSON,
		)
		if calibrateErr != nil {
			err = calibrateErr
		} else {
			results.Packages = calibratedPackages
		}
	}
	if printErr := printSlowTests(os.Stdout, results.Tests, *threshold, *top); printErr != nil {
		_, _ = fmt.Fprintf(os.Stderr, "print slow tests: %v\n", printErr)
		os.Exit(1)
	}
	if printErr := printSlowPackages(os.Stdout, results.Packages, *packageThreshold, *packageTop); printErr != nil {
		_, _ = fmt.Fprintf(os.Stderr, "print slow packages: %v\n", printErr)
		os.Exit(1)
	}
	if printErr := printFailures(os.Stderr, results.Failures); printErr != nil {
		_, _ = fmt.Fprintf(os.Stderr, "print failures: %v\n", printErr)
		os.Exit(1)
	}
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			os.Exit(exitErr.ExitCode())
		}
		_, _ = fmt.Fprintf(os.Stderr, "run go test: %v\n", err)
		os.Exit(1)
	}
}

func runGoTestJSON(ctx context.Context, goTestArgs []string, testThreshold, packageThreshold time.Duration) (scanResults, error) {
	cmd := exec.CommandContext(ctx, "go", "test", "-json")
	cmd.Args = append(cmd.Args, goTestArgs...)
	cmd.Stderr = os.Stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return scanResults{}, fmt.Errorf("pipe go test stdout: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return scanResults{}, fmt.Errorf("start go test: %w", err)
	}

	results, scanErr := collectSlowResults(stdout, testThreshold, packageThreshold)
	waitErr := cmd.Wait()
	if scanErr != nil {
		return results, fmt.Errorf("scan go test json: %w", scanErr)
	}
	if waitErr != nil {
		return results, fmt.Errorf("wait go test: %w", waitErr)
	}
	return results, nil
}

func collectSlowResults(r io.Reader, testThreshold, packageThreshold time.Duration) (scanResults, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, scannerInitialBufSize), scannerMaxBufSize)

	collector := newSlowResultCollector()
	for scanner.Scan() {
		evt, err := decodeEvent(scanner.Bytes())
		if err != nil {
			return scanResults{}, err
		}
		collector.collect(evt, testThreshold, packageThreshold)
	}
	if err := scanner.Err(); err != nil {
		return scanResults{}, fmt.Errorf("scan output: %w", err)
	}

	return collector.results(), nil
}

type slowResultCollector struct {
	scanResults   scanResults
	outputByKey   map[string][]string
	failuresByKey map[string]failure
	packagesSeen  map[string]struct{}
}

func newSlowResultCollector() slowResultCollector {
	return slowResultCollector{
		scanResults: scanResults{
			Tests:    make([]slowTest, 0, defaultResultCapacity),
			Packages: make([]slowPackage, 0, defaultResultCapacity),
		},
		outputByKey:   make(map[string][]string),
		failuresByKey: make(map[string]failure),
		packagesSeen:  make(map[string]struct{}),
	}
}

func decodeEvent(line []byte) (event, error) {
	var evt event
	if err := json.Unmarshal(line, &evt); err != nil {
		return event{}, fmt.Errorf("decode event %q: %w", string(line), err)
	}

	return evt, nil
}

func (c *slowResultCollector) collect(evt event, testThreshold, packageThreshold time.Duration) {
	key := failureKey(evt.Package, evt.Test)
	c.collectPackage(evt)
	c.collectOutput(key, evt)
	c.collectFailure(key, evt)
	c.collectPass(evt, testThreshold, packageThreshold)
}

func (c *slowResultCollector) collectPackage(evt event) {
	if evt.Package == "" {
		return
	}
	c.packagesSeen[evt.Package] = struct{}{}
}

func (c *slowResultCollector) collectOutput(key string, evt event) {
	if evt.Action != "output" || strings.TrimSpace(evt.Output) == "" {
		return
	}

	c.outputByKey[key] = append(c.outputByKey[key], strings.TrimRight(evt.Output, "\n"))
}

func (c *slowResultCollector) collectFailure(key string, evt event) {
	if evt.Action != "fail" {
		return
	}

	c.failuresByKey[key] = failure{
		Package: evt.Package,
		Test:    evt.Test,
		Output:  append([]string(nil), c.outputByKey[key]...),
	}
}

func (c *slowResultCollector) collectPass(evt event, testThreshold, packageThreshold time.Duration) {
	if evt.Action != "pass" {
		return
	}

	elapsed := time.Duration(evt.Elapsed * float64(time.Second))
	if evt.Test == "" {
		if elapsed >= packageThreshold {
			c.scanResults.Packages = append(c.scanResults.Packages, slowPackage{
				Package: evt.Package,
				Elapsed: elapsed,
			})
		}
		return
	}
	if elapsed < testThreshold {
		return
	}

	c.scanResults.Tests = append(c.scanResults.Tests, slowTest{
		Package: evt.Package,
		Test:    evt.Test,
		Elapsed: elapsed,
	})
}

func (c *slowResultCollector) results() scanResults {
	results := c.scanResults
	sortSlowTests(results.Tests)
	sortSlowPackages(results.Packages)
	results.Failures = failureSlice(c.failuresByKey)
	results.PackagesSeen = sortedKeys(c.packagesSeen)
	return results
}

type goTestJSONRunner func(context.Context, []string, time.Duration, time.Duration) (scanResults, error)

func sortSlowTests(results []slowTest) {
	sort.Slice(results, func(i, j int) bool {
		if results[i].Elapsed != results[j].Elapsed {
			return results[i].Elapsed > results[j].Elapsed
		}
		if results[i].Package != results[j].Package {
			return results[i].Package < results[j].Package
		}
		return results[i].Test < results[j].Test
	})
}

func sortSlowPackages(results []slowPackage) {
	sort.Slice(results, func(i, j int) bool {
		if results[i].Elapsed != results[j].Elapsed {
			return results[i].Elapsed > results[j].Elapsed
		}
		return results[i].Package < results[j].Package
	})
}

func sortedKeys(values map[string]struct{}) []string {
	if len(values) == 0 {
		return nil
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func failureSlice(failuresByKey map[string]failure) []failure {
	failures := make([]failure, 0, len(failuresByKey))
	for _, item := range failuresByKey {
		failures = append(failures, item)
	}
	sort.Slice(failures, func(i, j int) bool {
		if failures[i].Package != failures[j].Package {
			return failures[i].Package < failures[j].Package
		}
		return failures[i].Test < failures[j].Test
	})
	return failures
}

func printSlowTests(w io.Writer, results []slowTest, threshold time.Duration, top int) error {
	if top <= 0 || top > len(results) {
		top = len(results)
	}

	if _, err := fmt.Fprintf(w, "真实慢测阈值: %s\n", threshold); err != nil {
		return fmt.Errorf("write threshold: %w", err)
	}
	if len(results) == 0 {
		if _, err := fmt.Fprintln(w, "没有测试超过阈值。"); err != nil {
			return fmt.Errorf("write empty result: %w", err)
		}
		return nil
	}

	if _, err := fmt.Fprintf(w, "命中慢测: %d\n", len(results)); err != nil {
		return fmt.Errorf("write result count: %w", err)
	}
	for _, result := range results[:top] {
		if _, err := fmt.Fprintf(w, "%s\t%s\t%s\n", result.Elapsed.Round(time.Millisecond), result.Package, result.Test); err != nil {
			return fmt.Errorf("write slow test row: %w", err)
		}
	}
	return nil
}

func printSlowPackages(w io.Writer, results []slowPackage, threshold time.Duration, top int) error {
	if _, err := fmt.Fprintln(w, ""); err != nil {
		return fmt.Errorf("write section spacer: %w", err)
	}

	if top <= 0 || top > len(results) {
		top = len(results)
	}

	if _, err := fmt.Fprintf(w, "真实慢包阈值: %s\n", threshold); err != nil {
		return fmt.Errorf("write threshold: %w", err)
	}
	if len(results) == 0 {
		if _, err := fmt.Fprintln(w, "没有包超过阈值。"); err != nil {
			return fmt.Errorf("write empty result: %w", err)
		}
		return nil
	}

	if _, err := fmt.Fprintf(w, "命中慢包: %d\n", len(results)); err != nil {
		return fmt.Errorf("write result count: %w", err)
	}
	for _, result := range results[:top] {
		if _, err := fmt.Fprintf(w, "%s\t%s\n", result.Elapsed.Round(time.Millisecond), result.Package); err != nil {
			return fmt.Errorf("write slow package row: %w", err)
		}
	}
	return nil
}

func printFailures(w io.Writer, failures []failure) error {
	if len(failures) == 0 {
		return nil
	}
	if _, err := fmt.Fprintln(w, ""); err != nil {
		return fmt.Errorf("write failure spacer: %w", err)
	}
	if _, err := fmt.Fprintln(w, "测试失败摘要:"); err != nil {
		return fmt.Errorf("write failure header: %w", err)
	}
	for _, item := range failures {
		if item.Test != "" {
			if _, err := fmt.Fprintf(w, "[FAIL] %s %s\n", item.Package, item.Test); err != nil {
				return fmt.Errorf("write failure row: %w", err)
			}
		} else {
			if _, err := fmt.Fprintf(w, "[FAIL] %s\n", item.Package); err != nil {
				return fmt.Errorf("write package failure row: %w", err)
			}
		}
		for _, line := range item.Output {
			if _, err := fmt.Fprintln(w, line); err != nil {
				return fmt.Errorf("write failure output: %w", err)
			}
		}
	}
	return nil
}

func calibrateSlowPackages(
	ctx context.Context,
	goTestArgs []string,
	allPackages []string,
	candidates []slowPackage,
	threshold time.Duration,
	run goTestJSONRunner,
) ([]slowPackage, error) {
	if len(candidates) == 0 {
		return nil, nil
	}

	baseArgs := stripPackageArgs(goTestArgs, allPackages)
	baseArgs = overrideFlagValue(baseArgs, "-p", "1")

	calibrated := make([]slowPackage, 0, len(candidates))
	for _, candidate := range candidates {
		args := append(append([]string(nil), baseArgs...), candidate.Package)
		results, err := run(ctx, args, 1<<63-1, 0)
		if err != nil {
			return nil, fmt.Errorf("calibrate slow package %s: %w", candidate.Package, err)
		}

		pkg, ok := findPackageResult(results.Packages, candidate.Package)
		if !ok {
			return nil, fmt.Errorf("calibrate slow package %s: %w", candidate.Package, errCalibrateMissingPackageResult)
		}
		if pkg.Elapsed >= threshold {
			calibrated = append(calibrated, pkg)
		}
	}

	sortSlowPackages(calibrated)
	return calibrated, nil
}

func stripPackageArgs(args, packages []string) []string {
	if len(args) == 0 || len(packages) == 0 {
		return append([]string(nil), args...)
	}

	packageSet := make(map[string]struct{}, len(packages))
	for _, pkg := range packages {
		packageSet[pkg] = struct{}{}
	}

	filtered := make([]string, 0, len(args))
	for _, arg := range args {
		if _, ok := packageSet[arg]; ok {
			continue
		}
		filtered = append(filtered, arg)
	}
	return filtered
}

func overrideFlagValue(args []string, flagName, value string) []string {
	replacement := flagName + "=" + value
	updated := make([]string, 0, len(args)+1)
	replaced := false

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == flagName:
			updated = append(updated, replacement)
			replaced = true
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				i++
			}
		case strings.HasPrefix(arg, flagName+"="):
			updated = append(updated, replacement)
			replaced = true
		default:
			updated = append(updated, arg)
		}
	}

	if replaced {
		return updated
	}
	return append([]string{replacement}, updated...)
}

func findPackageResult(results []slowPackage, pkg string) (slowPackage, bool) {
	for _, result := range results {
		if result.Package == pkg {
			return result, true
		}
	}
	return slowPackage{}, false
}

func ensureArg(args []string, fullArg, prefix string) []string {
	for _, arg := range args {
		if arg == fullArg || strings.HasPrefix(arg, prefix+"=") {
			return args
		}
	}
	return append([]string{fullArg}, args...)
}

func failureKey(pkg, test string) string {
	if test == "" {
		return pkg
	}
	return pkg + "::" + test
}
