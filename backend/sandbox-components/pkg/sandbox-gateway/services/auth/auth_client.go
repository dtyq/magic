package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
)

type AuthClient struct {
	client *http.Client
	config *config.Config
}

type AuthResponse struct {
	Token string `json:"token"`
}

func NewAuthClient(cfg *config.Config) *AuthClient {
	return &AuthClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		config: cfg,
	}
}

func (a *AuthClient) GetAuthToken(ctx context.Context, userID, orgCode string) (string, error) {
	if a.config.MagicGatewayBaseURL == "" {
		logger.Info("MAGIC_GATEWAY_BASE_URL environment variable not set, skipping authentication")
		return "", nil
	}

	if a.config.MagicGatewayAPIKey == "" {
		logger.Error("MAGIC_GATEWAY_API_KEY environment variable not set, cannot authenticate")
		return "", fmt.Errorf("MAGIC_GATEWAY_API_KEY environment variable not set, cannot authenticate")
	}

	authURL := fmt.Sprintf("%s/auth", a.config.MagicGatewayBaseURL)
	logger.Infof("Requesting authentication service: %s with userID=%s, orgCode=%s", authURL, userID, orgCode)

	req, err := http.NewRequestWithContext(ctx, "POST", authURL, nil)
	if err != nil {
		logger.Errorf("Failed to create authentication request: %v", err)
		return "", fmt.Errorf("failed to create auth request: %w", err)
	}

	req.Header.Set("X-Gateway-API-Key", a.config.MagicGatewayAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("magic-user-id", userID)
	req.Header.Set("magic-organization-code", orgCode)

	resp, err := a.client.Do(req)
	if err != nil {
		logger.Errorf("Authentication service request failed: %v", err)
		return "", fmt.Errorf("authentication service request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		logger.Errorf("Authentication service returned status code %d for userID=%s, orgCode=%s", resp.StatusCode, userID, orgCode)
		return "", fmt.Errorf("authentication service request failed with status code: %d", resp.StatusCode)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		logger.Errorf("Failed to decode authentication response: %v", err)
		return "", fmt.Errorf("failed to decode authentication response: %w", err)
	}

	if authResp.Token == "" {
		logger.Error("Authentication service response missing token field")
		return "", fmt.Errorf("authentication service response missing token field")
	}

	logger.Infof("Successfully obtained authentication token for userID=%s, orgCode=%s", userID, orgCode)
	return authResp.Token, nil
}
