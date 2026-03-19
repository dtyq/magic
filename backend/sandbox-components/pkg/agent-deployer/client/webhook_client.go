package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/dtyq/sandbox-components/pkg/agent-deployer/config"
	"github.com/dtyq/sandbox-components/pkg/agent-deployer/logger"
)

// WebhookImageRequest represents the request payload for webhook server
type WebhookImageRequest struct {
	AgentRepository string `json:"agentRepository"`
	AgentImageTag   string `json:"agentImageTag"`
	AgentNamespace  string `json:"agentNamespace"`
}

// WebhookClient handles communication with webhook server
type WebhookClient struct {
	httpClient *http.Client
	config     *config.Config
}

// NewWebhookClient creates a new webhook client instance
func NewWebhookClient(cfg *config.Config) *WebhookClient {
	httpClient := &http.Client{}

	return &WebhookClient{
		httpClient: httpClient,
		config:     cfg,
	}
}

// CreateAgentDaemonSet sends a request to webhook server to create agent DaemonSet
func (c *WebhookClient) CreateAgentDaemonSet(ctx context.Context) error {
	logger.Infof("Triggering webhook server to create agent DaemonSet with image: %s:%s",
		c.config.AgentRepository, c.config.AgentImageTag)

	if err := c.sendWebhookRequest(ctx); err != nil {
		return fmt.Errorf("failed to send webhook request: %w", err)
	}

	logger.Info("Agent DaemonSet creation request completed successfully")
	return nil
}

// sendWebhookRequest sends the actual HTTP request to webhook server
func (c *WebhookClient) sendWebhookRequest(ctx context.Context) error {
	// Prepare request payload
	request := WebhookImageRequest{
		AgentRepository: c.config.AgentRepository,
		AgentImageTag:   c.config.AgentImageTag,
		AgentNamespace:  c.config.AgentNamespace,
	}

	// Marshal request to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook request: %w", err)
	}

	// Create HTTP request
	webhookURL := c.config.WebhookServerAddress + "/webhook/images"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request to webhook server: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("webhook server returned error status: %d", resp.StatusCode)
	}

	logger.Info("Webhook server successfully created agent DaemonSet")
	return nil
}
