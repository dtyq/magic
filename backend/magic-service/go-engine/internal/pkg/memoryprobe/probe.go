// Package memoryprobe records high-water memory samples for long-running tasks.
package memoryprobe

import (
	"context"
	"runtime"
	"sync"

	"magic/internal/pkg/memoryguard"
)

const (
	// DocumentSyncKeyword is the stable log keyword for oversized document sync memory usage.
	DocumentSyncKeyword = "KnowledgeDocumentSyncMemoryProbe"
	// DocumentSyncLargeMemoryThresholdBytes is 1 GiB.
	DocumentSyncLargeMemoryThresholdBytes uint64 = 1024 * 1024 * 1024
)

type probeContextKey struct{}

// Sample describes one memory observation.
type Sample struct {
	Stage             string
	HeapAllocBytes    uint64
	HeapSysBytes      uint64
	HeapIdleBytes     uint64
	HeapReleasedBytes uint64
	RuntimeSysBytes   uint64
	CurrentBytes      int64
	LimitBytes        int64
	UsageRatio        float64
	SoftLimitBytes    int64
	LimitName         string
	LimitValue        int64
	ObservedValue     int64
	ObservedBytes     uint64
}

// Probe tracks the peak memory sample for a single document sync.
type Probe struct {
	mu             sync.Mutex
	thresholdBytes uint64
	warned         bool
	peak           Sample
}

// NewDocumentSyncProbe creates a probe for one document sync task.
func NewDocumentSyncProbe() *Probe {
	return &Probe{thresholdBytes: DocumentSyncLargeMemoryThresholdBytes}
}

// WithProbe attaches a memory probe to ctx.
func WithProbe(ctx context.Context, probe *Probe) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if probe == nil {
		return ctx
	}
	return context.WithValue(ctx, probeContextKey{}, probe)
}

// FromContext returns the probe attached to ctx.
func FromContext(ctx context.Context) (*Probe, bool) {
	if ctx == nil {
		return nil, false
	}
	probe, ok := ctx.Value(probeContextKey{}).(*Probe)
	return probe, ok && probe != nil
}

// Capture reads current runtime and cgroup memory state.
func Capture(ctx context.Context, stage string, config memoryguard.Config) Sample {
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	snapshot, _ := memoryguard.NewGuard(config).Check(ctx, stage)
	observedBytes := max(stats.Sys, stats.HeapSys, stats.Alloc, positiveInt64ToUint64(snapshot.CurrentBytes))
	return Sample{
		Stage:             stage,
		HeapAllocBytes:    stats.Alloc,
		HeapSysBytes:      stats.HeapSys,
		HeapIdleBytes:     stats.HeapIdle,
		HeapReleasedBytes: stats.HeapReleased,
		RuntimeSysBytes:   stats.Sys,
		CurrentBytes:      snapshot.CurrentBytes,
		LimitBytes:        snapshot.LimitBytes,
		UsageRatio:        snapshot.UsageRatio,
		SoftLimitBytes:    snapshot.SoftLimitBytes,
		LimitName:         snapshot.LimitName,
		LimitValue:        snapshot.LimitValue,
		ObservedValue:     snapshot.ObservedValue,
		ObservedBytes:     observedBytes,
	}
}

func positiveInt64ToUint64(value int64) uint64 {
	if value <= 0 {
		return 0
	}
	return uint64(value)
}

// Observe records sample against the ctx probe. warn is true only once, when the document first crosses threshold.
func Observe(ctx context.Context, sample Sample) (peak Sample, warn bool) {
	probe, ok := FromContext(ctx)
	if !ok {
		return sample, false
	}
	return probe.Observe(sample)
}

// Observe records sample and returns the current peak.
func (p *Probe) Observe(sample Sample) (peak Sample, warn bool) {
	if p == nil {
		return sample, false
	}
	p.mu.Lock()
	defer p.mu.Unlock()

	if sample.ObservedBytes > p.peak.ObservedBytes {
		p.peak = sample
	}
	if !p.warned && sample.ObservedBytes >= p.thresholdBytes {
		p.warned = true
		return p.peak, true
	}
	return p.peak, false
}

// SampleFields returns common log fields for a memory sample.
func SampleFields(sample Sample) []any {
	return []any{
		"heap_alloc_bytes", sample.HeapAllocBytes,
		"heap_sys_bytes", sample.HeapSysBytes,
		"heap_idle_bytes", sample.HeapIdleBytes,
		"heap_released_bytes", sample.HeapReleasedBytes,
		"runtime_sys_bytes", sample.RuntimeSysBytes,
		"current_bytes", sample.CurrentBytes,
		"limit_bytes", sample.LimitBytes,
		"usage_ratio", sample.UsageRatio,
		"soft_limit_bytes", sample.SoftLimitBytes,
		"limit_name", sample.LimitName,
		"limit_value", sample.LimitValue,
		"observed_value", sample.ObservedValue,
		"observed_memory_bytes", sample.ObservedBytes,
	}
}

// ExceededFields returns fields for the rare high-memory warning log.
func ExceededFields(sample, peak Sample) []any {
	fields := make([]any, 0, 5+len(SampleFields(sample)))
	fields = append(fields,
		"memory_probe_keyword", DocumentSyncKeyword,
		"stage", sample.Stage,
		"threshold_bytes", DocumentSyncLargeMemoryThresholdBytes,
		"peak_stage", peak.Stage,
		"peak_memory_bytes", peak.ObservedBytes,
	)
	fields = append(fields, SampleFields(sample)...)
	return fields
}
