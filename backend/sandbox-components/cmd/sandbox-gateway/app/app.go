package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	sandboxgateway "github.com/dtyq/sandbox-components/pkg/sandbox-gateway"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/controllers"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/validation"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	envFile string
)

type SandboxGatewayCommand struct {
	*cobra.Command
	app *App
}

func NewSandboxGatewayCommand(sigCh <-chan os.Signal) *SandboxGatewayCommand {
	sandboxGatewayCmd := &SandboxGatewayCommand{}

	rootCmd := &cobra.Command{
		Use:   "sandbox-gateway",
		Short: "Sandbox Gateway Server",
		Long:  `Sandbox Gateway is a service for managing sandbox environments and proxying requests`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return sandboxGatewayCmd.run(sigCh)
		},
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	rootCmd.Flags().StringVar(&envFile, "env-file", ".env", "Path to environment file (.env)")

	sandboxGatewayCmd.Command = rootCmd
	return sandboxGatewayCmd
}

func (sgc *SandboxGatewayCommand) run(sigCh <-chan os.Signal) error {
	app := NewApp(envFile)
	sgc.app = app

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := app.Run(ctx); err != nil {
		return fmt.Errorf("failed to start application: %w", err)
	}

	if sigCh == nil {
		localSigCh := make(chan os.Signal, 1)
		signal.Notify(localSigCh, syscall.SIGINT, syscall.SIGTERM)
		sigCh = localSigCh
	}

	select {
	case sig := <-sigCh:
		log.Printf("Received signal %s, shutting down...", sig)
		cancel()
		if err := app.Shutdown(ctx); err != nil {
			return fmt.Errorf("error during shutdown: %w", err)
		}
		log.Println("Application gracefully stopped")
		return nil
	case <-ctx.Done():
		log.Println("Context cancelled, shutting down...")
		if err := app.Shutdown(ctx); err != nil {
			return fmt.Errorf("error during shutdown: %w", err)
		}
		return nil
	}
}

func Execute(sigCh <-chan os.Signal) error {
	return NewSandboxGatewayCommand(sigCh).Execute()
}

type App struct {
	config    *config.Config
	server    *sandboxgateway.Server
	startTime time.Time
	envFile   string
}

func NewApp(envFile string) *App {
	return &App{
		startTime: time.Now(),
		envFile:   envFile,
	}
}

func (a *App) Run(ctx context.Context) error {
	log.Println("Starting Sandbox Gateway application...")

	// 1. Load configuration with specified env file
	envFileToLoad := a.envFile
	if envFileToLoad == "" {
		envFileToLoad = ".env"
	}

	log.Printf("Loading configuration from env file: %s", envFileToLoad)
	if err := config.InitConfigWithEnvFile(a.envFile); err != nil {
		return fmt.Errorf("failed to initialize config with env file %s: %w", envFileToLoad, err)
	}

	// 2. Get configuration
	a.config = config.LoadConfig()

	// 3. Initialize logger with configuration
	if level, err := logrus.ParseLevel(strings.ToLower(a.config.LogLevel)); err != nil {
		logger.SetLevel(logrus.InfoLevel)
		logger.Warnf("Invalid log level '%s', using 'info' instead", a.config.LogLevel)
	} else {
		logger.SetLevel(level)
		logger.Infof("Log level set to: %s", level.String())
	}

	logger.Infof("Configuration loaded successfully - env_file=%s, port=%d, namespace=%s, log_level=%s, storage_type=%s",
		envFileToLoad, a.config.Port, a.config.Namespace, a.config.LogLevel, a.config.StorageType)

	// 4. Initialize validation service and validate storage
	validationService := validation.NewDefaultValidationService()
	if err := validationService.ValidateStorage(ctx, a.config); err != nil {
		return fmt.Errorf("storage validation failed: %w", err)
	}

	// 5. Validate ConfigMap configuration
	if err := a.validateConfigMap(ctx); err != nil {
		return fmt.Errorf("configmap validation failed: %w", err)
	}

	// 6. Initialize controllers
	sandboxController := controllers.NewSandboxController(a.config)
	healthController := controllers.NewHealthController(a.startTime)
	fileController := controllers.NewFileController(a.config)
	logger.Info("Controllers initialized successfully")

	// 7. Initialize router with controllers
	router := sandboxgateway.NewRouter(a.config, sandboxController, healthController, fileController)
	logger.Info("Router initialized successfully")

	// 8. Create and start server
	server, err := sandboxgateway.NewServer(ctx, a.config.Port, router, a.config)
	if err != nil {
		return fmt.Errorf("failed to create server: %w", err)
	}
	a.server = server
	if err := a.server.Start(ctx); err != nil {
		return fmt.Errorf("failed to start server: %w", err)
	}

	logger.Info("Application started successfully")
	return nil
}

func (a *App) Shutdown(ctx context.Context) error {
	logger.Info("Shutting down application...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if a.server != nil {
		if err := a.server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("failed to shutdown server: %w", err)
		}
	}

	logger.Info("Application shutdown complete")
	return nil
}

// validateConfigMap checks if the required ConfigMap exists and has AGENT_IMAGE configured
func (a *App) validateConfigMap(ctx context.Context) error {
	logger.Info("Validating ConfigMap configuration...")

	// Create k8s client
	kubeConfigPath := a.config.GetKubeConfigPath()
	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: kubeConfigPath,
	})
	if err != nil {
		return fmt.Errorf("failed to create k8s client manager: %w", err)
	}

	// Check if ConfigMap exists
	configMapName := a.config.SandboxGatewayConfigMapName
	namespace := a.config.Namespace

	configMap, err := clientManager.GetClientset().CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get configmap %s in namespace %s: %w", configMapName, namespace, err)
	}

	// Check if AGENT_IMAGE key exists
	agentImage, exists := configMap.Data["AGENT_IMAGE"]
	if !exists {
		return fmt.Errorf("AGENT_IMAGE key not found in configmap %s", configMapName)
	}

	// Check if AGENT_IMAGE value is not empty
	if agentImage == "" {
		return fmt.Errorf("AGENT_IMAGE value is empty in configmap %s", configMapName)
	}

	// Check if QDRANT_IMAGE key exists
	qdrantImage, exists := configMap.Data["QDRANT_IMAGE"]
	if !exists {
		return fmt.Errorf("QDRANT_IMAGE key not found in configmap %s", configMapName)
	}

	// Check if QDRANT_IMAGE value is not empty
	if qdrantImage == "" {
		return fmt.Errorf("QDRANT_IMAGE value is empty in configmap %s", configMapName)
	}

	logger.Infof("ConfigMap validation passed - configmap: %s, agent_image: %s, qdrant_image: %s", configMapName, agentImage, qdrantImage)

	// Check if agent ConfigMap exists
	agentConfigMapName := a.config.SandboxAgentConfigMapName
	_, err = clientManager.GetClientset().CoreV1().ConfigMaps(namespace).Get(ctx, agentConfigMapName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get agent configmap %s in namespace %s: %w", agentConfigMapName, namespace, err)
	}

	logger.Infof("Agent ConfigMap validation passed - configmap: %s", agentConfigMapName)
	return nil
}
