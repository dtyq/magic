package validation

import (
	"context"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
)

// StorageValidator defines the interface for storage validation
type StorageValidator interface {
	// ValidateStorage validates the storage configuration and prerequisites
	ValidateStorage(ctx context.Context, config *config.Config) error

	// GetStorageType returns the storage type this validator handles
	GetStorageType() string
}

// ValidationService manages all storage validators
type ValidationService struct {
	validators map[string]StorageValidator
}

// NewValidationService creates a new validation service
func NewValidationService() *ValidationService {
	return &ValidationService{
		validators: make(map[string]StorageValidator),
	}
}

// RegisterValidator registers a validator for a specific storage type
func (vs *ValidationService) RegisterValidator(storageType string, validator StorageValidator) {
	vs.validators[storageType] = validator
}

// ValidateStorage validates storage based on the configuration
func (vs *ValidationService) ValidateStorage(ctx context.Context, config *config.Config) error {
	validator, exists := vs.validators[config.StorageType]
	if !exists {
		logger.Infof("No validator found for storage type '%s', skipping validation", config.StorageType)
		return nil
	}

	return validator.ValidateStorage(ctx, config)
}
