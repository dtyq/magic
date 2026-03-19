package file

import (
	"context"
	"fmt"
	"strings"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/s3"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type FileService struct {
	clientManager *k8s.ClientManager
	config        *config.Config
	s3Service     *s3.S3Service
}

func NewFileService(clientManager *k8s.ClientManager, config *config.Config) (*FileService, error) {
	logger.Info("Initializing file service")

	// Create S3 service internally
	s3Service, err := s3.NewS3Service(config, clientManager)
	if err != nil {
		logger.Errorf("Failed to create S3 service in FileService: %v", err)
		return nil, fmt.Errorf("failed to create S3 service: %w", err)
	}

	logger.Info("File service initialized successfully")

	return &FileService{
		clientManager: clientManager,
		config:        config,
		s3Service:     s3Service,
	}, nil
}

// CreateFileCopy creates a file copy operation using direct S3 API calls
func (fs *FileService) CreateFileCopy(req models.FileCopyRequest) error {
	sourceBucket := fs.config.S3Bucket
	targetBucket := fs.config.S3Bucket

	ctx := context.Background()

	logger.Infof("Service: Starting file copy operation: filesCount=%d", len(req.Files))

	// Synchronously copy all files
	for i, fileCopy := range req.Files {
		// Extract source and target paths directly from the file copy item
		sourceKey := strings.TrimPrefix(fileCopy.SourceOSSPath, "/")
		targetKey := strings.TrimPrefix(fileCopy.TargetOSSPath, "/")

		logger.Infof("Copying file (%d/%d): %s -> %s", i+1, len(req.Files), sourceKey, targetKey)

		// Call S3 service to copy
		err := fs.s3Service.CopyObject(ctx, sourceBucket, sourceKey, targetBucket, targetKey)
		if err != nil {
			logger.Errorf("Failed to copy file %s -> %s: %v", sourceKey, targetKey, err)
			return fmt.Errorf("failed to copy file from %s to %s: %w", sourceKey, targetKey, err)
		}

		logger.Infof("Successfully copied file (%d/%d): %s -> %s", i+1, len(req.Files), sourceKey, targetKey)
	}

	logger.Infof("File copy operation completed successfully: copied %d files", len(req.Files))
	return nil
}
