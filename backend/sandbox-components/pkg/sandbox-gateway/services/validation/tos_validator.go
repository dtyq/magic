package validation

import (
	"context"
	"fmt"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

// TOSValidator implements StorageValidator for TOS storage
type TOSValidator struct{}

// NewTOSValidator creates a new TOS validator
func NewTOSValidator() *TOSValidator {
	return &TOSValidator{}
}

// GetStorageType returns the storage type this validator handles
func (tv *TOSValidator) GetStorageType() string {
	return "tos"
}

// ValidateStorage validates TOS storage configuration and prerequisites
func (tv *TOSValidator) ValidateStorage(ctx context.Context, config *config.Config) error {
	// Initialize Kubernetes client manager
	clientManager, err := tv.initializeClientManager(config)
	if err != nil {
		return fmt.Errorf("failed to initialize Kubernetes client manager: %w", err)
	}

	// Check if TOS secret exists
	if err := tv.validateTOSSecret(ctx, config, clientManager); err != nil {
		return fmt.Errorf("TOS secret validation failed: %w", err)
	}

	logger.Infof("TOS storage validation completed successfully")
	return nil
}

// initializeClientManager initializes the Kubernetes client manager
func (tv *TOSValidator) initializeClientManager(config *config.Config) (*k8s.ClientManager, error) {
	logger.Info("Initializing Kubernetes client manager for TOS validation")

	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: config.GetKubeConfigPath(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client manager: %w", err)
	}

	// Validate Kubernetes client connection
	logger.Info("Validating Kubernetes client connection")
	if err := clientManager.ValidateConnection(); err != nil {
		logger.Errorf("Kubernetes client connection validation failed: %v", err)
		return nil, fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}
	logger.Info("Kubernetes client connection validated successfully")

	return clientManager, nil
}

// validateTOSSecret validates TOS secret existence
func (tv *TOSValidator) validateTOSSecret(ctx context.Context, config *config.Config, clientManager *k8s.ClientManager) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := clientManager.CheckSecretExists(ctx, config.TOSSecretNamespace, config.TOSSecretName); err != nil {
		logger.Errorf("TOS secret validation failed: %v", err)
		logger.Errorf("Please ensure the secret '%s' exists in namespace '%s'",
			config.TOSSecretName, config.TOSSecretNamespace)
		logger.Errorf("The secret should contain the necessary credentials for TOS storage access")
		return err
	}

	logger.Infof("TOS secret validation passed successfully")
	return nil
}
