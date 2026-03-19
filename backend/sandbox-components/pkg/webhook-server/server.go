package webhookserver

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dtyq/sandbox-components/pkg/webhook-server/config"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/controllers"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/logger"
)

// WebhookServer manages the webhook server and its dependencies
type WebhookServer struct {
	config                 *config.Config
	router                 *gin.Engine
	httpServer             *http.Server
	webhookImageController *controllers.WebhookImageController
}

// NewWebhookServer creates a new webhook server instance
func NewWebhookServer() (*WebhookServer, error) {
	logger.Info("Initializing Webhook Server")

	cfg := config.GetConfig()

	gin.SetMode(gin.DebugMode)
	router := gin.New()

	// Create webhook image controller
	webhookImageController := controllers.NewWebhookImageController(cfg)
	logger.Info("Webhook image controller created successfully")

	server := &WebhookServer{
		config:                 cfg,
		router:                 router,
		webhookImageController: webhookImageController,
	}

	server.setupRoutes()

	logger.Info("Webhook Server initialized successfully")
	return server, nil
}

// Run starts the webhook server
func (s *WebhookServer) Run() error {
	addr := fmt.Sprintf("%s:%d", s.config.BindAddress, s.config.Port)

	s.httpServer = &http.Server{
		Addr:           addr,
		Handler:        s.router,
		MaxHeaderBytes: 1 << 20,
	}

	logger.Infof("Webhook Server listening on %s", addr)

	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("Failed to start server: %v", err)
		}
	}()

	return nil
}

// Shutdown gracefully shuts down the server
func (s *WebhookServer) Shutdown(ctx context.Context) error {
	logger.Info("Shutting down Webhook Server...")

	if s.httpServer == nil {
		return nil
	}

	if err := s.httpServer.Shutdown(ctx); err != nil {
		logger.Errorf("Server shutdown error: %v", err)
		return err
	}

	logger.Info("Webhook Server stopped gracefully")
	return nil
}
