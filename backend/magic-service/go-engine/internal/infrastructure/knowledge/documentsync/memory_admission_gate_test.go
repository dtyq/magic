package documentsync_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"magic/internal/infrastructure/knowledge/documentsync"
	"magic/internal/pkg/memoryguard"
)

type memoryAdmissionCheckerStub struct {
	readings []memoryAdmissionReading
	err      error
	calls    int
}

type memoryAdmissionReading struct {
	current int64
	limit   int64
}

func (s *memoryAdmissionCheckerStub) Read() (int64, int64, error) {
	if s.err != nil {
		return 0, 0, s.err
	}
	if len(s.readings) == 0 {
		s.calls++
		return 0, 0, nil
	}
	index := min(s.calls, len(s.readings)-1)
	reading := s.readings[index]
	s.calls++
	return reading.current, reading.limit, nil
}

func TestMemoryAdmissionGateWaitsUntilLowWaterline(t *testing.T) {
	t.Parallel()

	checker := &memoryAdmissionCheckerStub{
		readings: []memoryAdmissionReading{
			{current: 95, limit: 100},
			{current: 75, limit: 100},
			{current: 60, limit: 100},
		},
	}
	gate := documentsync.NewMemoryAdmissionGate(
		memoryguard.NewGuardWithReader(memoryguard.Config{SoftLimitBytes: 90, CgroupPressureRatio: 0.8}, checker),
		nil,
		documentsync.MemoryAdmissionGateConfig{
			PollInterval:      time.Nanosecond,
			SoftResumeRatio:   0.90,
			CgroupResumeRatio: 0.70,
		},
	)

	if err := gate.Wait(context.Background(), &documentsync.Task{Kind: documentsync.TaskKindDocumentSync}); err != nil {
		t.Fatalf("expected admission to resume, got %v", err)
	}
	if checker.calls != 3 {
		t.Fatalf("expected three checks before low-water resume, got %d", checker.calls)
	}
}

func TestMemoryAdmissionGateReturnsContextErrorWhilePaused(t *testing.T) {
	t.Parallel()

	checker := &memoryAdmissionCheckerStub{
		readings: []memoryAdmissionReading{{current: 95, limit: 100}},
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	gate := documentsync.NewMemoryAdmissionGate(
		memoryguard.NewGuardWithReader(memoryguard.Config{SoftLimitBytes: 90, CgroupPressureRatio: 0.8}, checker),
		nil,
		documentsync.MemoryAdmissionGateConfig{},
	)

	if err := gate.Wait(ctx, &documentsync.Task{Kind: documentsync.TaskKindDocumentSync}); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled, got %v", err)
	}
}
