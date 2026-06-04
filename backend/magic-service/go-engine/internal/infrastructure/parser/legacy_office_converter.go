package docparser

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sync/semaphore"
	"golang.org/x/sys/execabs"
)

const (
	defaultOfficeConversionTimeout       = 60 * time.Second
	defaultOfficeConversionMaxInputBytes = 50 * 1024 * 1024
	defaultOfficeConversionConcurrency   = 2
	officeConversionLogLimitBytes        = 8 * 1024
	officeConversionDirPerm              = 0o700
	officeConversionFilePerm             = 0o600
	officeCommandSoffice                 = "soffice"
	officeCommandLibreOffice             = "libreoffice"
	officeCommandMacSoffice              = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
)

var (
	errOfficeConversionDisabled        = errors.New("office conversion is disabled")
	errOfficeConversionCommandNotFound = errors.New("office conversion command not found")
	errOfficeConversionInputTooLarge   = errors.New("office conversion input is too large")
	errOfficeConversionOutputMissing   = errors.New("office conversion output is missing")
	errOfficeConversionOutputTooLarge  = errors.New("office conversion output is too large")
	errOfficeConversionProcessFailed   = errors.New("office conversion process failed")
)

// OfficeConversionConfig 描述旧 Office 转换器配置。
type OfficeConversionConfig struct {
	Enabled        bool
	Command        string
	Timeout        time.Duration
	MaxInputBytes  int64
	MaxOutputBytes int64
	MaxConcurrent  int64
}

// LegacyOfficeConverter 将旧 Office 文件转换成 OpenXML 格式。
type LegacyOfficeConverter struct {
	cfg       OfficeConversionConfig
	semaphore *semaphore.Weighted
}

// NewLegacyOfficeConverter 创建 LibreOffice 转换器。
func NewLegacyOfficeConverter(cfg OfficeConversionConfig) *LegacyOfficeConverter {
	cfg = normalizeOfficeConversionConfig(cfg)
	return &LegacyOfficeConverter{
		cfg:       cfg,
		semaphore: semaphore.NewWeighted(cfg.MaxConcurrent),
	}
}

// Convert 转换旧 Office 内容。
func (c *LegacyOfficeConverter) Convert(
	ctx context.Context,
	source io.Reader,
	sourceExt string,
	targetExt string,
) ([]byte, error) {
	if c == nil || !c.cfg.Enabled {
		return nil, errOfficeConversionDisabled
	}
	if err := c.semaphore.Acquire(ctx, 1); err != nil {
		return nil, fmt.Errorf("acquire office conversion slot: %w", err)
	}
	defer c.semaphore.Release(1)

	command, err := resolveOfficeCommand(c.cfg.Command)
	if err != nil {
		return nil, err
	}
	data, err := readOfficeConversionInput(source, c.cfg.MaxInputBytes)
	if err != nil {
		return nil, err
	}
	tmpDir, err := os.MkdirTemp("", "magic-office-convert-*")
	if err != nil {
		return nil, fmt.Errorf("create office conversion temp dir: %w", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	inputPath := filepath.Join(tmpDir, "input."+strings.TrimPrefix(strings.ToLower(sourceExt), "."))
	outputDir := filepath.Join(tmpDir, "out")
	profileDir := filepath.Join(tmpDir, "profile")
	if err := os.MkdirAll(outputDir, officeConversionDirPerm); err != nil {
		return nil, fmt.Errorf("create office conversion output dir: %w", err)
	}
	if err := os.MkdirAll(profileDir, officeConversionDirPerm); err != nil {
		return nil, fmt.Errorf("create office conversion profile dir: %w", err)
	}
	if err := os.WriteFile(inputPath, data, officeConversionFilePerm); err != nil {
		return nil, fmt.Errorf("write office conversion input: %w", err)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, c.cfg.Timeout)
	defer cancel()
	stdout, stderr, err := runOfficeCommand(timeoutCtx, command, officeCommandSpec{
		inputPath:  inputPath,
		outputDir:  outputDir,
		profileDir: profileDir,
		targetExt:  targetExt,
	})
	if err != nil {
		if timeoutCtx.Err() != nil {
			return nil, fmt.Errorf("office conversion timeout: %w", timeoutCtx.Err())
		}
		return nil, fmt.Errorf(
			"run office conversion: %w stdout=%q stderr=%q",
			err,
			stdout,
			stderr,
		)
	}
	if timeoutCtx.Err() != nil {
		return nil, fmt.Errorf("office conversion timeout: %w", timeoutCtx.Err())
	}

	outputPath := filepath.Join(outputDir, "input."+strings.TrimPrefix(strings.ToLower(targetExt), "."))
	info, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", errOfficeConversionOutputMissing, outputPath)
	}
	if c.cfg.MaxOutputBytes > 0 && info.Size() > c.cfg.MaxOutputBytes {
		return nil, fmt.Errorf("%w: size=%d max=%d", errOfficeConversionOutputTooLarge, info.Size(), c.cfg.MaxOutputBytes)
	}
	output, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, fmt.Errorf("read office conversion output: %w", err)
	}
	return output, nil
}

func normalizeOfficeConversionConfig(cfg OfficeConversionConfig) OfficeConversionConfig {
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultOfficeConversionTimeout
	}
	if cfg.MaxInputBytes <= 0 {
		cfg.MaxInputBytes = defaultOfficeConversionMaxInputBytes
	}
	if cfg.MaxOutputBytes <= 0 {
		cfg.MaxOutputBytes = cfg.MaxInputBytes
	}
	if cfg.MaxConcurrent <= 0 {
		cfg.MaxConcurrent = defaultOfficeConversionConcurrency
	}
	return cfg
}

func readOfficeConversionInput(source io.Reader, maxBytes int64) ([]byte, error) {
	reader := io.LimitReader(source, maxBytes+1)
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read office conversion input: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("%w: size=%d max=%d", errOfficeConversionInputTooLarge, len(data), maxBytes)
	}
	return data, nil
}

func resolveOfficeCommand(configured string) (string, error) {
	candidates := []string{configured, officeCommandSoffice, officeCommandLibreOffice, officeCommandMacSoffice}
	for _, candidate := range candidates {
		if command, ok := resolveOfficeCommandCandidate(candidate); ok {
			return command, nil
		}
	}
	return "", errOfficeConversionCommandNotFound
}

func resolveOfficeCommandCandidate(candidate string) (string, bool) {
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return "", false
	}
	if filepath.IsAbs(candidate) {
		return resolveAbsoluteOfficeCommand(candidate)
	}
	return resolveNamedOfficeCommand(candidate)
}

func resolveAbsoluteOfficeCommand(candidate string) (string, bool) {
	if candidate == officeCommandMacSoffice {
		info, err := os.Stat(candidate)
		return candidate, err == nil && !info.IsDir()
	}
	return resolveNamedOfficeCommand(filepath.Base(candidate))
}

func resolveNamedOfficeCommand(candidate string) (string, bool) {
	if candidate != officeCommandSoffice && candidate != officeCommandLibreOffice {
		return "", false
	}
	if _, err := execabs.LookPath(candidate); err != nil {
		return "", false
	}
	return candidate, true
}

type officeCommandSpec struct {
	inputPath  string
	outputDir  string
	profileDir string
	targetExt  string
}

func runOfficeCommand(
	ctx context.Context,
	command string,
	spec officeCommandSpec,
) (string, string, error) {
	commandPath, err := resolveOfficeCommandPath(command)
	if err != nil {
		return "", "", err
	}
	stdoutFile, err := os.CreateTemp("", "magic-office-stdout-*")
	if err != nil {
		return "", "", fmt.Errorf("create office stdout file: %w", err)
	}
	defer func() { _ = os.Remove(stdoutFile.Name()) }()
	defer func() { _ = stdoutFile.Close() }()
	stderrFile, err := os.CreateTemp("", "magic-office-stderr-*")
	if err != nil {
		return "", "", fmt.Errorf("create office stderr file: %w", err)
	}
	defer func() { _ = os.Remove(stderrFile.Name()) }()
	defer func() { _ = stderrFile.Close() }()

	process, err := os.StartProcess(commandPath, officeProcessArgs(commandPath, spec), &os.ProcAttr{
		Env:   os.Environ(),
		Files: []*os.File{os.Stdin, stdoutFile, stderrFile},
	})
	if err != nil {
		return "", "", fmt.Errorf("start office process: %w", err)
	}
	waitResult := make(chan officeWaitResult, 1)
	go func() {
		state, waitErr := process.Wait()
		waitResult <- officeWaitResult{state: state, err: waitErr}
	}()
	select {
	case result := <-waitResult:
		stdout := readOfficeProcessOutput(stdoutFile.Name())
		stderr := readOfficeProcessOutput(stderrFile.Name())
		if result.err != nil {
			return stdout, stderr, fmt.Errorf("wait office process: %w", result.err)
		}
		if result.state == nil || !result.state.Success() {
			return stdout, stderr, errOfficeConversionProcessFailed
		}
		return stdout, stderr, nil
	case <-ctx.Done():
		_ = process.Kill()
		result := <-waitResult
		stdout := readOfficeProcessOutput(stdoutFile.Name())
		stderr := readOfficeProcessOutput(stderrFile.Name())
		if result.err != nil {
			return stdout, stderr, fmt.Errorf("%w: %w", ctx.Err(), result.err)
		}
		return stdout, stderr, fmt.Errorf("office process context done: %w", ctx.Err())
	}
}

type officeWaitResult struct {
	state *os.ProcessState
	err   error
}

func resolveOfficeCommandPath(command string) (string, error) {
	if command == officeCommandMacSoffice {
		return command, nil
	}
	path, err := execabs.LookPath(command)
	if err != nil {
		return "", fmt.Errorf("look up office command: %w", err)
	}
	return path, nil
}

func officeProcessArgs(commandPath string, spec officeCommandSpec) []string {
	return []string{
		commandPath,
		"--headless",
		"--nologo",
		"--nofirststartwizard",
		"--nodefault",
		"--nolockcheck",
		"-env:UserInstallation=" + officeProfileURI(spec),
		"--convert-to",
		officeTargetExtension(spec),
		"--outdir",
		filepath.Clean(spec.outputDir),
		filepath.Clean(spec.inputPath),
	}
}

func officeProfileURI(spec officeCommandSpec) string {
	return (&url.URL{Scheme: "file", Path: filepath.Clean(spec.profileDir)}).String()
}

func officeTargetExtension(spec officeCommandSpec) string {
	switch strings.TrimPrefix(strings.ToLower(spec.targetExt), ".") {
	case "doc":
		return "doc:MS Word 97"
	case "docx":
		return "docx:Office Open XML Text"
	case "xls":
		return "xls:MS Excel 97"
	case "xlsx":
		return "xlsx:Calc Office Open XML"
	default:
		return strings.TrimPrefix(strings.ToLower(spec.targetExt), ".")
	}
}

func readOfficeProcessOutput(path string) string {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return ""
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, officeConversionLogLimitBytes))
	if err != nil {
		return ""
	}
	return string(bytes.TrimSpace(data))
}
