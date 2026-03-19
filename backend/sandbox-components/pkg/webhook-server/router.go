package webhookserver

import (
	"github.com/dtyq/sandbox-components/pkg/webhook-server/logger"
	"github.com/gin-gonic/gin"
)

func (s *WebhookServer) setupRoutes() {
	// Basic middleware
	s.router.Use(gin.Logger())
	s.router.Use(gin.Recovery())

	// Health check endpoint
	s.router.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	webhookGroup := s.router.Group("/webhook")
	{
		webhookGroup.POST("/images", s.webhookImageController.UpdateAgentImage)
	}

	logger.Info("All routes configured successfully")
}
