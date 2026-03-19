package models

// WebhookImageRequest represents the request payload for updating agent image via webhook
type WebhookImageRequest struct {
	AgentRepository string `json:"agentRepository" binding:"required"`
	AgentImageTag   string `json:"agentImageTag" binding:"required"`
	AgentNamespace  string `json:"agentNamespace" binding:"required"`
}

// WebhookImageResponse represents the response for webhook image update requests
type WebhookImageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}
