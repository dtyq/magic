package controllers

import (
	"context"
	"time"

	"github.com/dtyq/sandbox-components/pkg/response"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/config"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/logger"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/models"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/services"
	"github.com/gin-gonic/gin"
)

// WebhookImageController handles webhook image update requests
type WebhookImageController struct {
	daemonSetService *services.DaemonSetService
	configMapService *services.ConfigMapService
	config           *config.Config
}

// NewWebhookImageController creates a new webhook image controller instance
func NewWebhookImageController(cfg *config.Config) *WebhookImageController {
	logger.Info("Initializing webhook image controller")

	kubeConfigPath := cfg.GetKubeConfigPath()
	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: kubeConfigPath,
	})
	if err != nil {
		logger.Fatalf("Failed to create K8s client manager: %v", err)
	}

	daemonSetService := services.NewDaemonSetService(clientManager, "", cfg)
	configMapService := services.NewConfigMapService(clientManager, cfg)

	return &WebhookImageController{
		daemonSetService: daemonSetService,
		configMapService: configMapService,
		config:           cfg,
	}
}

// UpdateAgentImage handles webhook requests to update the agent image
func (c *WebhookImageController) UpdateAgentImage(ctx *gin.Context) {
	var req models.WebhookImageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf("Failed to bind webhook request: %v", err)
		response.ErrorResponse(ctx, "Invalid request format", err)
		return
	}

	logger.Infof("Received webhook image update request for repository: %s, tag: %s, namespace: %s",
		req.AgentRepository, req.AgentImageTag, req.AgentNamespace)

	ctxWithTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Construct full image name
	fullImageName := req.AgentRepository + ":" + req.AgentImageTag
	logger.Infof("Updating image to: %s in namespace: %s", fullImageName, req.AgentNamespace)

	// Use a default DaemonSet name for agent deployment
	daemonSetName := "super-magic-image-puller"

	// Create or update DaemonSet for image pulling
	oldGeneration, err := c.daemonSetService.CreateOrUpdateImagePullDaemonSet(ctxWithTimeout, req.AgentNamespace, daemonSetName, fullImageName)
	if err != nil {
		logger.Errorf("Failed to create/update DaemonSet: %v", err)
		response.ErrorResponse(ctx, "Failed to create/update DaemonSet", err)
		return
	}

	// Wait for DaemonSet to be ready
	err = c.daemonSetService.WaitForDaemonSetReady(ctxWithTimeout, req.AgentNamespace, daemonSetName, oldGeneration, 3*time.Minute)
	if err != nil {
		logger.Errorf("DaemonSet failed to become ready: %v", err)
		response.ErrorResponse(ctx, "DaemonSet failed to become ready", err)
		return
	}

	// Update ConfigMap with new agent image
	err = c.configMapService.UpdateAgentImage(ctxWithTimeout, req.AgentNamespace, fullImageName)
	if err != nil {
		logger.Errorf("Failed to update ConfigMap: %v", err)
		response.ErrorResponse(ctx, "Failed to update ConfigMap", err)
		return
	}

	logger.Infof("Successfully updated agent image: %s in namespace: %s", fullImageName, req.AgentNamespace)
	response.SuccessResponse(ctx, "Image updated successfully", map[string]interface{}{
		"image":     fullImageName,
		"namespace": req.AgentNamespace,
	})
}
