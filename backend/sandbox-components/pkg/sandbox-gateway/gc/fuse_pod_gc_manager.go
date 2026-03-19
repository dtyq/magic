package gc

import (
	"context"
	"sync"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc/detector"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"k8s.io/client-go/kubernetes"
)

// FusePodGCManager manages Fuse Pod garbage collection
type FusePodGCManager struct {
	fusePodDetector *detector.FusePodDetector
	client          kubernetes.Interface

	checkInterval     time.Duration
	orphanedThreshold time.Duration
	enabled           bool

	ctx    context.Context
	cancel context.CancelFunc
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewFusePodGCManager creates a new Fuse Pod garbage collection manager
func NewFusePodGCManager(
	parentCtx context.Context,
	client kubernetes.Interface,
	config FusePodGCConfig,
	sandboxNamespace string,
	fusePodNamespace string,
) *FusePodGCManager {
	ctx, cancel := context.WithCancel(parentCtx)

	fusePodDetector := detector.NewFusePodDetector(ctx, client, fusePodNamespace, sandboxNamespace, config.OrphanedThreshold)

	return &FusePodGCManager{
		fusePodDetector:   fusePodDetector,
		client:            client,
		checkInterval:     config.CheckInterval,
		orphanedThreshold: config.OrphanedThreshold,
		enabled:           config.Enabled,
		ctx:               ctx,
		cancel:            cancel,
		stopCh:            make(chan struct{}),
	}
}

// Start starts the Fuse Pod GC manager
func (m *FusePodGCManager) Start() error {
	if !m.enabled {
		logger.Info("Fuse Pod garbage collection is disabled")
		return nil
	}

	logger.Infof("Starting Fuse Pod GC Manager with check interval %v", m.checkInterval)
	logger.Infof("Fuse Pod GC will cleanup orphaned fuse pods older than %v", m.orphanedThreshold)

	m.wg.Add(1)
	go m.gcLoop()

	logger.Info("Fuse Pod GC Manager started successfully")
	return nil
}

// Stop stops the Fuse Pod GC manager
func (m *FusePodGCManager) Stop() {
	if !m.enabled {
		return
	}

	logger.Info("Stopping Fuse Pod GC Manager")

	close(m.stopCh)
	m.cancel()
	m.wg.Wait()

	logger.Info("Fuse Pod GC Manager stopped")
}

// gcLoop is the main garbage collection loop
func (m *FusePodGCManager) gcLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.checkInterval)
	defer ticker.Stop()

	logger.Infof("Fuse Pod GC loop started with interval %v", m.checkInterval)

	// Run initial cleanup
	m.PerformGC()

	for {
		select {
		case <-m.stopCh:
			logger.Info("Fuse Pod GC loop stopping")
			return
		case <-m.ctx.Done():
			logger.Info("Fuse Pod GC loop context cancelled")
			return
		case <-ticker.C:
			m.PerformGC()
		}
	}
}

// PerformGC performs one Fuse Pod garbage collection cycle
func (m *FusePodGCManager) PerformGC() {
	startTime := time.Now()

	logger.Debug("Starting Fuse Pod garbage collection cycle")

	// Use the new Perform interface - detection and cleanup are now integrated
	err := m.fusePodDetector.Perform()
	if err != nil {
		logger.Errorf("Failed to perform Fuse Pod cleanup: %v", err)
		return
	}

	duration := time.Since(startTime)
	logger.Infof("Fuse Pod GC cycle complete in %v", duration)
}
