package sandboxgateway

import (
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/controllers"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/middleware"
	"github.com/gin-gonic/gin"
)

type Router struct {
	config            *config.Config
	sandboxController *controllers.SandboxController
	healthController  *controllers.HealthController
	fileController    *controllers.FileController
}

func NewRouter(cfg *config.Config, sandboxController *controllers.SandboxController, healthController *controllers.HealthController, fileController *controllers.FileController) *Router {
	return &Router{
		config:            cfg,
		sandboxController: sandboxController,
		healthController:  healthController,
		fileController:    fileController,
	}
}

// SetupRouter initializes and configures the Gin router
func (r *Router) SetupRouter() *gin.Engine {
	// Create gin router
	router := gin.New()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(middleware.RequestLoggingMiddleware())

	router.GET("/healthz", r.healthController.HealthCheck)

	v1 := router.Group("/api/v1")
	v1.Use(middleware.TokenAuthMiddleware())
	{
		sandboxes := v1.Group("/sandboxes")
		{
			sandboxes.POST("", r.sandboxController.CreateSandbox)                 // Create sandbox
			sandboxes.GET("/:id", r.sandboxController.GetSandbox)                 // Get sandbox status
			sandboxes.POST("/queries", r.sandboxController.QuerySandboxes)        // Batch query
			sandboxes.Any("/:id/proxy/*proxyPath", r.sandboxController.ProxyHTTP) // HTTP proxy
		}

		files := v1.Group("/files")
		{
			fileCopy := files.Group("/copy")
			{
				fileCopy.POST("", r.fileController.CreateFileCopy) // Create file copy operation (synchronous)
			}
		}
	}

	return router
}
