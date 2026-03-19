package services

import (
	"context"
	"fmt"

	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/config"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/logger"
)

const (
	// SandboxGatewayConfigMapName is the default name of the sandbox gateway ConfigMap
	SandboxGatewayConfigMapName = "sandbox-gateway"
	// AgentImageKey is the key for agent image in ConfigMap
	AgentImageKey = "AGENT_IMAGE"
)

// ConfigMapService handles ConfigMap operations
type ConfigMapService struct {
	clientManager *k8s.ClientManager
	config        *config.Config
}

// NewConfigMapService creates a new ConfigMap service instance
func NewConfigMapService(clientManager *k8s.ClientManager, cfg *config.Config) *ConfigMapService {
	return &ConfigMapService{
		clientManager: clientManager,
		config:        cfg,
	}
}

// UpdateAgentImage updates the AGENT_IMAGE in the sandbox gateway ConfigMap
func (s *ConfigMapService) UpdateAgentImage(ctx context.Context, namespace, agentImage string) error {
	logger.Infof("Updating %s in ConfigMap %s (namespace: %s) to: %s",
		AgentImageKey, SandboxGatewayConfigMapName, namespace, agentImage)

	// Use the k8s client manager to update the ConfigMap
	err := s.clientManager.UpdateConfigMapData(ctx, namespace, SandboxGatewayConfigMapName, AgentImageKey, agentImage)
	if err != nil {
		logger.Errorf("Failed to update %s in ConfigMap: %v", AgentImageKey, err)
		return fmt.Errorf("failed to update %s in ConfigMap %s: %w", AgentImageKey, SandboxGatewayConfigMapName, err)
	}

	logger.Infof("Successfully updated %s in ConfigMap %s to: %s",
		AgentImageKey, SandboxGatewayConfigMapName, agentImage)
	return nil
}
