package gc

import (
	"context"
	"sync"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc/detector"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"k8s.io/client-go/kubernetes"
)

// AgentGCManager manages Agent garbage collection for sandbox pods
type AgentGCManager struct {
	agentDetector *detector.AgentDetector
	client        kubernetes.Interface

	checkInterval    time.Duration
	expiredThreshold time.Duration
	enabled          bool

	ctx    context.Context
	cancel context.CancelFunc
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewAgentGCManager creates a new Agent garbage collection manager
func NewAgentGCManager(
	parentCtx context.Context,
	client kubernetes.Interface,
	namespace string,
	config AgentGCConfig,
) *AgentGCManager {
	ctx, cancel := context.WithCancel(parentCtx)

	agentDetector := detector.NewAgentDetector(ctx, client, namespace, config.ExpiredThreshold)

	return &AgentGCManager{
		agentDetector:    agentDetector,
		client:           client,
		checkInterval:    config.CheckInterval,
		expiredThreshold: config.ExpiredThreshold,
		enabled:          config.Enabled,
		ctx:              ctx,
		cancel:           cancel,
		stopCh:           make(chan struct{}),
	}
}

// Start starts the Agent GC manager
func (m *AgentGCManager) Start() {
	if !m.enabled {
		logger.Info("Agent GC Manager is disabled")
		return
	}

	logger.Info("Starting Agent GC Manager")
	logger.Infof("Agent GC will cleanup expired sandbox pods with exited agents older than %v", m.expiredThreshold)
	logger.Infof("Agent GC check interval: %v", m.checkInterval)

	m.wg.Add(1)
	go m.run()
}

// Stop stops the Agent GC manager
func (m *AgentGCManager) Stop() {
	if !m.enabled {
		return
	}

	logger.Info("Stopping Agent GC Manager")

	m.cancel()
	close(m.stopCh)
	m.wg.Wait()

	logger.Info("Agent GC Manager stopped")
}

// run is the main loop of the Agent GC manager
func (m *AgentGCManager) run() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.checkInterval)
	defer ticker.Stop()

	// Run initial cleanup
	m.performCleanup()

	for {
		select {
		case <-m.ctx.Done():
			logger.Info("Agent GC Manager context cancelled")
			return
		case <-m.stopCh:
			logger.Info("Agent GC Manager received stop signal")
			return
		case <-ticker.C:
			m.performCleanup()
		}
	}
}

// performCleanup performs the actual cleanup of expired sandbox pods with exited agents
func (m *AgentGCManager) performCleanup() {
	logger.Info("Starting Agent GC cleanup cycle")

	// Use the new Perform interface - detection and cleanup are now integrated
	err := m.agentDetector.Perform()
	if err != nil {
		logger.Errorf("Failed to perform agent cleanup: %v", err)
		return
	}

	logger.Info("Agent GC cleanup cycle completed")
}
