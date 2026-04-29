package memoryguard_test

import (
	"context"
	"errors"
	"runtime/debug"
	"testing"

	"magic/internal/pkg/memoryguard"
)

type fakeCgroupReader struct {
	current int64
	limit   int64
	err     error
}

var errTestCgroupNotFound = errors.New("cgroup not found")

func (r fakeCgroupReader) Read() (int64, int64, error) {
	return r.current, r.limit, r.err
}

func TestGuardCheckSoftLimitExceeded(t *testing.T) {
	t.Parallel()

	guard := memoryguard.NewGuardWithReader(memoryguard.Config{SoftLimitBytes: 10}, fakeCgroupReader{current: 11, limit: 100})
	snapshot, err := guard.Check(context.Background(), "parse_document_content")
	if !errors.Is(err, memoryguard.ErrMemoryPressure) {
		t.Fatalf("expected memory pressure error, got %v", err)
	}
	if snapshot.LimitName != "sync_memory_soft_limit_bytes" || snapshot.ObservedValue != 11 || snapshot.LimitValue != 10 {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
}

func TestGuardCheckCgroupRatioExceeded(t *testing.T) {
	t.Parallel()

	guard := memoryguard.NewGuardWithReader(
		memoryguard.Config{SoftLimitBytes: 0, CgroupPressureRatio: 0.8},
		fakeCgroupReader{current: 81, limit: 100},
	)
	snapshot, err := guard.Check(context.Background(), "sync_fragment_batch")
	if !errors.Is(err, memoryguard.ErrMemoryPressure) {
		t.Fatalf("expected memory pressure error, got %v", err)
	}
	if snapshot.LimitName != "cgroup_memory_ratio" || snapshot.ObservedValue != 81 || snapshot.LimitValue != 80 {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
}

func TestGuardCheckIgnoresUnavailableCgroup(t *testing.T) {
	t.Parallel()

	guard := memoryguard.NewGuardWithReader(memoryguard.Config{SoftLimitBytes: 10}, fakeCgroupReader{err: errTestCgroupNotFound})
	if _, err := guard.Check(context.Background(), "build_fragments"); err != nil {
		t.Fatalf("expected unavailable cgroup ignored, got %v", err)
	}
}

func TestConfigureGoMemLimitSkipsExplicitEnv(t *testing.T) {
	t.Setenv("GOMEMLIMIT", "512MiB")
	limit, applied, err := memoryguard.ConfigureGoMemLimitFromReader(fakeCgroupReader{current: 1, limit: 100}, 0.75)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if applied || limit != 0 {
		t.Fatalf("expected explicit env to skip config, got limit=%d applied=%v", limit, applied)
	}
}

func TestConfigureGoMemLimitAppliesCgroupLimit(t *testing.T) {
	t.Setenv("GOMEMLIMIT", "")
	previousLimit := debug.SetMemoryLimit(-1)
	t.Cleanup(func() {
		debug.SetMemoryLimit(previousLimit)
	})

	limit, applied, err := memoryguard.ConfigureGoMemLimitFromReader(fakeCgroupReader{current: 1, limit: 100}, 0.75)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !applied || limit != 75 {
		t.Fatalf("expected cgroup limit applied, got limit=%d applied=%v", limit, applied)
	}
}
