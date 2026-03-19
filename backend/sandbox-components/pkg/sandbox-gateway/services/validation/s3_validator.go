package validation

import (
	"context"
	"fmt"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

// S3Validator implements StorageValidator for S3 storage
type S3Validator struct{}

// NewS3Validator creates a new S3 validator
func NewS3Validator() *S3Validator {
	return &S3Validator{}
}

// GetStorageType returns the storage type this validator handles
func (sv *S3Validator) GetStorageType() string {
	return "s3"
}

// ValidateStorage validates S3 storage configuration and prerequisites
func (sv *S3Validator) ValidateStorage(ctx context.Context, config *config.Config) error {
	// Initialize Kubernetes client manager
	clientManager, err := sv.initializeClientManager(config)
	if err != nil {
		return fmt.Errorf("failed to initialize Kubernetes client manager: %w", err)
	}

	// Check if S3 secret exists
	if err := sv.validateS3Secret(ctx, config, clientManager); err != nil {
		return fmt.Errorf("S3 secret validation failed: %w", err)
	}

	logger.Infof("S3 storage validation completed successfully")
	return nil
}

// initializeClientManager initializes the Kubernetes client manager
func (sv *S3Validator) initializeClientManager(config *config.Config) (*k8s.ClientManager, error) {
	logger.Info("Initializing Kubernetes client manager for S3 validation")

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

// validateS3Secret validates S3 secret existence
func (sv *S3Validator) validateS3Secret(ctx context.Context, config *config.Config, clientManager *k8s.ClientManager) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := clientManager.CheckSecretExists(ctx, config.S3SecretNamespace, config.S3SecretName); err != nil {
		logger.Errorf("S3 secret validation failed: %v", err)
		logger.Errorf("Please ensure the secret '%s' exists in namespace '%s'",
			config.S3SecretName, config.S3SecretNamespace)
		logger.Errorf("The secret should contain the necessary credentials for S3 storage access")
		return err
	}

	logger.Infof("S3 secret validation passed successfully")
	return nil
}
