package sandboxgateway

import (
	"context"
	"fmt"
	"net/http"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

// Server represents the HTTP server
type Server struct {
	server           *http.Server
	port             int
	router           *Router
	clientManager    *k8s.ClientManager
	pvcGCManager     *gc.PVCGCManager
	pvGCManager      *gc.PVGCManager
	agentGCManager   *gc.AgentGCManager
	fusePodGCManager *gc.FusePodGCManager

	config *config.Config
}

// NewServer creates a new HTTP server instance
func NewServer(ctx context.Context, port int, router *Router, cfg *config.Config) (*Server, error) {
	// Initialize Kubernetes client manager
	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: cfg.GetKubeConfigPath(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client manager: %w", err)
	}

	// Initialize PVC GC Manager
	pvcGCManager := gc.NewPVCGCManager(ctx, clientManager.GetClientset(), cfg.PVCGC, cfg.Namespace)

	// Initialize PV GC Manager
	pvGCManager := gc.NewPVGCManager(ctx, clientManager.GetClientset(), cfg.PVGC)

	// Initialize Agent GC Manager
	agentGCManager := gc.NewAgentGCManager(ctx, clientManager.GetClientset(), cfg.Namespace, cfg.AgentGC)

	// Initialize Fuse Pod GC Manager
	fusePodGCManager := gc.NewFusePodGCManager(ctx, clientManager.GetClientset(), cfg.FusePodGC, cfg.Namespace, cfg.FusePodNamespace)

	return &Server{
		port:             port,
		router:           router,
		clientManager:    clientManager,
		pvcGCManager:     pvcGCManager,
		pvGCManager:      pvGCManager,
		agentGCManager:   agentGCManager,
		fusePodGCManager: fusePodGCManager,

		config: cfg,
	}, nil
}

// Start starts the HTTP server
func (s *Server) Start(ctx context.Context) error {
	// Start PVC GC Manager
	if err := s.pvcGCManager.Start(); err != nil {
		logger.Errorf("Failed to start PVC GC Manager: %v", err)
		return fmt.Errorf("failed to start PVC GC Manager: %w", err)
	}

	// Start PV GC Manager
	if err := s.pvGCManager.Start(); err != nil {
		logger.Errorf("Failed to start PV GC Manager: %v", err)
		return fmt.Errorf("failed to start PV GC Manager: %w", err)
	}

	// Start Agent GC Manager
	s.agentGCManager.Start()

	// Start Fuse Pod GC Manager
	if err := s.fusePodGCManager.Start(); err != nil {
		logger.Errorf("Failed to start Fuse Pod GC Manager: %v", err)
		return fmt.Errorf("failed to start Fuse Pod GC Manager: %w", err)
	}

	// Start Task GC Manager

	// Setup router with all routes
	routerEngine := s.router.SetupRouter()

	s.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: routerEngine,
	}

	// Start server in a goroutine
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("Server failed to start: %v", err)
		}
	}()

	logger.Infof("Server started on port %d", s.port)
	return nil
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	logger.Info("Shutting down server...")

	// Stop PVC GC Manager first
	if s.pvcGCManager != nil {
		s.pvcGCManager.Stop()
	}

	// Stop PV GC Manager
	if s.pvGCManager != nil {
		s.pvGCManager.Stop()
	}

	// Stop Agent GC Manager
	if s.agentGCManager != nil {
		s.agentGCManager.Stop()
	}

	// Stop Fuse Pod GC Manager
	if s.fusePodGCManager != nil {
		s.fusePodGCManager.Stop()
	}

	// Stop Task GC Manager

	if s.server == nil {
		return nil
	}

	return s.server.Shutdown(ctx)
}
