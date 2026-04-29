// Package memoryguard provides lightweight cgroup-aware memory pressure checks.
package memoryguard

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime/debug"
	"strconv"
	"strings"
)

const (
	defaultCgroupPressureRatio = 0.80
	defaultGoMemLimitRatio     = 0.75
)

var (
	// ErrMemoryPressure 表示当前进程所在 cgroup 已经达到内存软水位。
	ErrMemoryPressure = errors.New("memory pressure")
	errCgroupNotFound = errors.New("cgroup memory files not found")
)

// Config 描述内存水位策略。
type Config struct {
	SoftLimitBytes      int64
	CgroupPressureRatio float64
}

// Snapshot 描述一次内存读取结果。
type Snapshot struct {
	Stage               string
	CgroupAvailable     bool
	CurrentBytes        int64
	LimitBytes          int64
	SoftLimitBytes      int64
	CgroupPressureRatio float64
	UsageRatio          float64
	LimitName           string
	LimitValue          int64
	ObservedValue       int64
}

// PressureError 携带触发内存水位保护的上下文。
type PressureError struct {
	Snapshot Snapshot
}

func (e *PressureError) Error() string {
	if e == nil {
		return ErrMemoryPressure.Error()
	}
	return fmt.Sprintf(
		"%s: %s observed=%d limit=%d stage=%s",
		ErrMemoryPressure.Error(),
		e.Snapshot.LimitName,
		e.Snapshot.ObservedValue,
		e.Snapshot.LimitValue,
		e.Snapshot.Stage,
	)
}

func (e *PressureError) Unwrap() error {
	return ErrMemoryPressure
}

// Guard performs memory pressure checks.
type Guard struct {
	config Config
	reader Reader
}

// Reader reads current and limit bytes from a memory controller.
type Reader interface {
	Read() (currentBytes, limitBytes int64, err error)
}

type fileCgroupReader struct{}

// NewGuard creates a cgroup memory guard.
func NewGuard(config Config) *Guard {
	return NewGuardWithReader(config, fileCgroupReader{})
}

// NewGuardWithReader creates a guard with an injected reader.
func NewGuardWithReader(config Config, reader Reader) *Guard {
	if reader == nil {
		reader = fileCgroupReader{}
	}
	return &Guard{
		config: normalizeConfig(config),
		reader: reader,
	}
}

// Check checks whether the current cgroup exceeds the configured soft waterline.
func (g *Guard) Check(_ context.Context, stage string) (Snapshot, error) {
	if g == nil {
		return Snapshot{Stage: stage}, nil
	}
	config := normalizeConfig(g.config)
	current, limit, ok := g.readCgroup()
	if !ok {
		return Snapshot{Stage: stage, SoftLimitBytes: config.SoftLimitBytes}, nil
	}
	snapshot := Snapshot{
		Stage:               stage,
		CgroupAvailable:     true,
		CurrentBytes:        current,
		LimitBytes:          limit,
		SoftLimitBytes:      config.SoftLimitBytes,
		CgroupPressureRatio: config.CgroupPressureRatio,
	}
	if limit > 0 {
		snapshot.UsageRatio = float64(current) / float64(limit)
	}

	if config.SoftLimitBytes > 0 && current > config.SoftLimitBytes {
		snapshot.LimitName = "sync_memory_soft_limit_bytes"
		snapshot.LimitValue = config.SoftLimitBytes
		snapshot.ObservedValue = current
		return snapshot, &PressureError{Snapshot: snapshot}
	}
	if limit > 0 && snapshot.UsageRatio >= config.CgroupPressureRatio {
		snapshot.LimitName = "cgroup_memory_ratio"
		snapshot.LimitValue = int64(float64(limit) * config.CgroupPressureRatio)
		snapshot.ObservedValue = current
		return snapshot, &PressureError{Snapshot: snapshot}
	}
	return snapshot, nil
}

// ConfigureGoMemLimitFromCgroup sets Go runtime memory limit from cgroup limit
// unless GOMEMLIMIT has already been explicitly configured.
func ConfigureGoMemLimitFromCgroup() (int64, bool, error) {
	return configureGoMemLimitFromCgroup(fileCgroupReader{}, defaultGoMemLimitRatio)
}

// ConfigureGoMemLimitFromReader sets Go runtime memory limit using an injected reader.
func ConfigureGoMemLimitFromReader(reader Reader, ratio float64) (int64, bool, error) {
	if reader == nil {
		reader = fileCgroupReader{}
	}
	return configureGoMemLimitFromCgroup(reader, ratio)
}

func configureGoMemLimitFromCgroup(reader Reader, ratio float64) (int64, bool, error) {
	if strings.TrimSpace(os.Getenv("GOMEMLIMIT")) != "" {
		return 0, false, nil
	}
	if ratio <= 0 || ratio >= 1 {
		ratio = defaultGoMemLimitRatio
	}
	_, limit, err := reader.Read()
	if err != nil {
		return 0, false, fmt.Errorf("read cgroup memory limit: %w", err)
	}
	if limit <= 0 {
		return 0, false, nil
	}
	goLimit := int64(float64(limit) * ratio)
	if goLimit <= 0 {
		return 0, false, nil
	}
	debug.SetMemoryLimit(goLimit)
	return goLimit, true, nil
}

func (g *Guard) readCgroup() (int64, int64, bool) {
	current, limit, err := g.reader.Read()
	if err != nil {
		return 0, 0, false
	}
	return current, limit, true
}

func normalizeConfig(config Config) Config {
	if config.CgroupPressureRatio <= 0 || config.CgroupPressureRatio >= 1 {
		config.CgroupPressureRatio = defaultCgroupPressureRatio
	}
	return config
}

func (fileCgroupReader) Read() (int64, int64, error) {
	if current, limit, err := readCgroupV2Memory(); err == nil {
		return current, limit, nil
	}
	return readCgroupV1Memory()
}

func readCgroupV2Memory() (int64, int64, error) {
	current, err := readInt64File("/sys/fs/cgroup/memory.current")
	if err != nil {
		return 0, 0, err
	}
	limit, err := readCgroupLimitFile("/sys/fs/cgroup/memory.max")
	if err != nil {
		return 0, 0, err
	}
	return current, limit, nil
}

func readCgroupV1Memory() (int64, int64, error) {
	current, err := readInt64File("/sys/fs/cgroup/memory/memory.usage_in_bytes")
	if err != nil {
		return 0, 0, errCgroupNotFound
	}
	limit, err := readCgroupLimitFile("/sys/fs/cgroup/memory/memory.limit_in_bytes")
	if err != nil {
		return 0, 0, err
	}
	return current, limit, nil
}

func readInt64File(path string) (int64, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", path, err)
	}
	value, err := strconv.ParseInt(strings.TrimSpace(string(raw)), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", path, err)
	}
	return value, nil
}

func readCgroupLimitFile(path string) (int64, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", path, err)
	}
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "max" {
		return 0, nil
	}
	value, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", path, err)
	}
	if value <= 0 || value > 1<<60 {
		return 0, nil
	}
	return value, nil
}
