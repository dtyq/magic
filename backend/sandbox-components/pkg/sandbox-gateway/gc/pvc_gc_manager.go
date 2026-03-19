package gc

import (
	"context"
	"sync"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc/detector"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"k8s.io/client-go/kubernetes"
)

// PVCGCManager manages PVC garbage collection
type PVCGCManager struct {
	pvcDetector *detector.PVCDetector
	client      kubernetes.Interface

	checkInterval   time.Duration
	unusedThreshold time.Duration
	enabled         bool

	ctx    context.Context
	cancel context.CancelFunc
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewPVCGCManager creates a new PVC garbage collection manager
func NewPVCGCManager(
	parentCtx context.Context,
	client kubernetes.Interface,
	config PVCGCConfig,
	namespace string,
) *PVCGCManager {
	ctx, cancel := context.WithCancel(parentCtx)

	pvcDetector := detector.NewPVCDetector(ctx, client, config.UnusedThreshold, namespace)

	return &PVCGCManager{
		pvcDetector:     pvcDetector,
		client:          client,
		checkInterval:   config.CheckInterval,
		unusedThreshold: config.UnusedThreshold,
		enabled:         config.Enabled,
		ctx:             ctx,
		cancel:          cancel,
		stopCh:          make(chan struct{}),
	}
}

// Start starts the PVC garbage collection manager
func (m *PVCGCManager) Start() error {
	if !m.enabled {
		logger.Info("PVC garbage collection is disabled")
		return nil
	}

	logger.Infof("Starting PVC GC Manager with check interval %v", m.checkInterval)
	logger.Infof("PVC GC will cleanup unused PVCs older than %v", m.unusedThreshold)

	m.wg.Add(1)
	go m.gcLoop()

	logger.Info("PVC GC Manager started successfully")
	return nil
}

// Stop stops the PVC garbage collection manager
func (m *PVCGCManager) Stop() {
	if !m.enabled {
		return
	}

	logger.Info("Stopping PVC GC Manager")

	close(m.stopCh)
	m.cancel()
	m.wg.Wait()

	logger.Info("PVC GC Manager stopped")
}

// gcLoop is the main garbage collection loop
func (m *PVCGCManager) gcLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.checkInterval)
	defer ticker.Stop()

	logger.Infof("PVC GC loop started with interval %v", m.checkInterval)

	for {
		select {
		case <-m.stopCh:
			logger.Info("PVC GC loop stopping")
			return
		case <-m.ctx.Done():
			logger.Info("PVC GC loop context cancelled")
			return
		case <-ticker.C:
			m.PerformGC()
		}
	}
}

// PerformGC performs one PVC garbage collection cycle
func (m *PVCGCManager) PerformGC() {
	startTime := time.Now()

	logger.Debug("Starting PVC garbage collection cycle")

	// Use the new Perform interface - detection and cleanup are now integrated
	err := m.pvcDetector.Perform()
	if err != nil {
		logger.Errorf("Failed to perform PVC cleanup: %v", err)
		return
	}

	duration := time.Since(startTime)
	logger.Infof("PVC GC cycle complete in %v", duration)
}
