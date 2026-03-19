package controllers

import (
	"time"

	"github.com/dtyq/sandbox-components/pkg/response"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/gin-gonic/gin"
)

type HealthController struct {
	startTime time.Time
}

func NewHealthController(startTime time.Time) *HealthController {
	logger.Info("Initializing health controller")
	return &HealthController{
		startTime: startTime,
	}
}

func (hc *HealthController) HealthCheck(c *gin.Context) {
	uptime := time.Since(hc.startTime)

	healthData := map[string]interface{}{
		"status":    "healthy",
		"service":   "sandbox-gateway",
		"version":   "1.0.0",
		"uptime":    uptime.String(),
		"timestamp": time.Now().Format(time.RFC3339),
	}

	logger.Infof("Health check successful: uptime=%s", uptime.String())

	response.SuccessResponse(c, "Health check successful", healthData)
}
