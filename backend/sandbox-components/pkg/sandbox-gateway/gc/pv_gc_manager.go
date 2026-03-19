package gc

import (
	"context"
	"sync"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc/detector"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"k8s.io/client-go/kubernetes"
)

// PVGCManager manages PV garbage collection
type PVGCManager struct {
	pvDetector *detector.PVDetector
	client     kubernetes.Interface

	checkInterval     time.Duration
	releasedThreshold time.Duration
	enabled           bool

	ctx    context.Context
	cancel context.CancelFunc
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewPVGCManager creates a new PV garbage collection manager
func NewPVGCManager(
	parentCtx context.Context,
	client kubernetes.Interface,
	config PVGCConfig,
) *PVGCManager {
	ctx, cancel := context.WithCancel(parentCtx)

	pvDetector := detector.NewPVDetector(ctx, client, config.ReleasedThreshold)

	return &PVGCManager{
		pvDetector:        pvDetector,
		client:            client,
		checkInterval:     config.CheckInterval,
		releasedThreshold: config.ReleasedThreshold,
		enabled:           config.Enabled,
		ctx:               ctx,
		cancel:            cancel,
		stopCh:            make(chan struct{}),
	}
}

// Start starts the PV garbage collection manager
func (m *PVGCManager) Start() error {
	if !m.enabled {
		logger.Info("PV garbage collection is disabled")
		return nil
	}

	logger.Infof("Starting PV GC Manager with check interval %v", m.checkInterval)
	logger.Infof("PV GC will cleanup released PVs older than %v", m.releasedThreshold)

	m.wg.Add(1)
	go m.gcLoop()

	logger.Info("PV GC Manager started successfully")
	return nil
}

// Stop stops the PV garbage collection manager
func (m *PVGCManager) Stop() {
	if !m.enabled {
		return
	}

	logger.Info("Stopping PV GC Manager")

	close(m.stopCh)
	m.cancel()
	m.wg.Wait()

	logger.Info("PV GC Manager stopped")
}

// gcLoop is the main garbage collection loop
func (m *PVGCManager) gcLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.checkInterval)
	defer ticker.Stop()

	logger.Infof("PV GC loop started with interval %v", m.checkInterval)

	for {
		select {
		case <-m.stopCh:
			logger.Info("PV GC loop stopping")
			return
		case <-m.ctx.Done():
			logger.Info("PV GC loop context cancelled")
			return
		case <-ticker.C:
			m.PerformGC()
		}
	}
}

// PerformGC performs one PV garbage collection cycle
func (m *PVGCManager) PerformGC() {
	startTime := time.Now()

	logger.Debug("Starting PV garbage collection cycle")

	// Use the new Perform interface - detection and cleanup are now integrated
	err := m.pvDetector.Perform()
	if err != nil {
		logger.Errorf("Failed to perform PV cleanup: %v", err)
		return
	}

	duration := time.Since(startTime)
	logger.Infof("PV GC cycle complete in %v", duration)
}
