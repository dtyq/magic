package validation

// NewDefaultValidationService creates a validation service with default validators
func NewDefaultValidationService() *ValidationService {
	service := NewValidationService()

	// Register TOS validator
	tosValidator := NewTOSValidator()
	service.RegisterValidator(tosValidator.GetStorageType(), tosValidator)

	// Register OSS validator
	ossValidator := NewOSSValidator()
	service.RegisterValidator(ossValidator.GetStorageType(), ossValidator)

	// Register S3 validator
	s3Validator := NewS3Validator()
	service.RegisterValidator(s3Validator.GetStorageType(), s3Validator)

	// Future validators can be registered here

	return service
}
