package agentdeployer

import (
	"context"
	"fmt"

	"github.com/dtyq/sandbox-components/pkg/agent-deployer/client"
	"github.com/dtyq/sandbox-components/pkg/agent-deployer/config"
	"github.com/dtyq/sandbox-components/pkg/agent-deployer/logger"
)

// AgentDeployer manages the agent deployment process
type AgentDeployer struct {
	config        *config.Config
	webhookClient *client.WebhookClient
}

// NewAgentDeployer creates a new agent deployer instance
func NewAgentDeployer() (*AgentDeployer, error) {
	logger.Info("Initializing Agent Deployer")

	// Load configuration
	cfg := config.GetConfig()
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	// Initialize logger with configuration
	logger.InitLogger(cfg)

	// Create webhook client
	webhookClient := client.NewWebhookClient(cfg)

	deployer := &AgentDeployer{
		config:        cfg,
		webhookClient: webhookClient,
	}

	logger.Info("Agent Deployer initialized successfully")
	return deployer, nil
}

// Deploy executes the agent deployment process
func (d *AgentDeployer) Deploy(ctx context.Context) error {
	logger.Infof("Starting agent deployment with image: %s", d.config.GetFullImageName())

	// Request webhook server to create agent DaemonSet
	if err := d.webhookClient.CreateAgentDaemonSet(ctx); err != nil {
		return fmt.Errorf("failed to request webhook server to create agent DaemonSet: %w", err)
	}

	logger.Info("Agent deployment completed successfully")
	return nil
}

// GetConfig returns the deployer configuration
func (d *AgentDeployer) GetConfig() *config.Config {
	return d.config
}
