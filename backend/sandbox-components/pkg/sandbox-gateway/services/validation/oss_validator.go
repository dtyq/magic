package validation

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

// OSSValidator implements StorageValidator for OSS storage
type OSSValidator struct{}

// NewOSSValidator creates a new OSS validator
func NewOSSValidator() *OSSValidator {
	return &OSSValidator{}
}

// GetStorageType returns the storage type this validator handles
func (v *OSSValidator) GetStorageType() string {
	return "oss"
}

// ValidateStorage validates OSS storage configuration and prerequisites
func (v *OSSValidator) ValidateStorage(ctx context.Context, config *config.Config) error {
	logger.Infof("Validating OSS storage configuration")

	// Validate OSS configuration completeness
	if err := v.validateOSSConfig(config); err != nil {
		return fmt.Errorf("OSS configuration validation failed: %w", err)
	}

	// Validate OSS URL format
	if err := v.validateOSSURL(config.OSSURL); err != nil {
		return fmt.Errorf("OSS URL validation failed: %w", err)
	}

	// Validate OSS CSI Driver configuration
	if err := v.validateOSSCSIDriver(config.OSSCSIDriver); err != nil {
		return fmt.Errorf("OSS CSI Driver validation failed: %w", err)
	}

	// Initialize Kubernetes client manager
	clientManager, err := v.initializeClientManager(config)
	if err != nil {
		return fmt.Errorf("failed to initialize Kubernetes client manager: %w", err)
	}

	// Check if OSS secret exists
	if err := v.validateOSSSecret(ctx, config, clientManager); err != nil {
		return fmt.Errorf("OSS secret validation failed: %w", err)
	}

	logger.Infof("OSS storage configuration validation passed")
	return nil
}

// validateOSSConfig validates OSS configuration completeness
func (v *OSSValidator) validateOSSConfig(config *config.Config) error {
	if config.OSSCSIDriver == "" {
		return fmt.Errorf("OSS CSI Driver is required")
	}

	if config.OSSSecretName == "" {
		return fmt.Errorf("OSS secret name is required")
	}

	if config.OSSSecretNamespace == "" {
		return fmt.Errorf("OSS secret namespace is required")
	}

	if config.OSSURL == "" {
		return fmt.Errorf("OSS URL is required")
	}

	if config.OSSBucket == "" {
		return fmt.Errorf("OSS bucket is required")
	}

	return nil
}

// validateOSSURL validates OSS URL format
func (v *OSSValidator) validateOSSURL(url string) error {
	if url == "" {
		return fmt.Errorf("OSS URL cannot be empty")
	}

	// Validate URL format matches OSS endpoint format
	if !strings.Contains(url, "oss-") {
		return fmt.Errorf("invalid OSS URL format: %s, expected format: oss-<region>.aliyuncs.com", url)
	}

	// Validate contains Alibaba Cloud domain
	if !strings.Contains(url, "aliyuncs.com") {
		return fmt.Errorf("invalid OSS URL: %s, must be an Alibaba Cloud OSS endpoint", url)
	}

	return nil
}

// validateOSSCSIDriver validates OSS CSI Driver configuration
func (v *OSSValidator) validateOSSCSIDriver(driver string) error {
	if driver == "" {
		return fmt.Errorf("OSS CSI Driver cannot be empty")
	}

	// Validate CSI Driver name format
	expectedDriver := "ossplugin.csi.alibabacloud.com"
	if driver != expectedDriver {
		logger.Warnf("OSS CSI Driver '%s' does not match expected driver '%s'", driver, expectedDriver)
	}

	return nil
}

// initializeClientManager initializes the Kubernetes client manager
func (v *OSSValidator) initializeClientManager(config *config.Config) (*k8s.ClientManager, error) {
	logger.Info("Initializing Kubernetes client manager for OSS validation")

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

// validateOSSSecret validates OSS secret existence
func (v *OSSValidator) validateOSSSecret(ctx context.Context, config *config.Config, clientManager *k8s.ClientManager) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := clientManager.CheckSecretExists(ctx, config.OSSSecretNamespace, config.OSSSecretName); err != nil {
		logger.Errorf("OSS secret validation failed: %v", err)
		logger.Errorf("Please ensure the secret '%s' exists in namespace '%s'",
			config.OSSSecretName, config.OSSSecretNamespace)
		logger.Errorf("The secret should contain the necessary credentials for OSS storage access")
		return err
	}

	logger.Infof("OSS secret validation passed successfully")
	return nil
}
