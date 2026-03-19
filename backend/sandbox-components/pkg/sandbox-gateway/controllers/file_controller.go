package controllers

import (
	"fmt"

	"github.com/dtyq/sandbox-components/pkg/response"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/file"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/gin-gonic/gin"
)

type FileController struct {
	fileService *file.FileService
	config      *config.Config
}

func NewFileController(cfg *config.Config) *FileController {
	logger.Info("Initializing file controller")

	kubeConfigPath := cfg.GetKubeConfigPath()
	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: kubeConfigPath,
	})
	if err != nil {
		logger.Fatalf("Failed to create K8s client manager: %v", err)
	}

	fileService, err := file.NewFileService(clientManager, cfg)
	if err != nil {
		logger.Fatalf("Failed to create file service: %v", err)
	}

	logger.Info("File controller initialized successfully")

	return &FileController{
		fileService: fileService,
		config:      cfg,
	}
}

// CreateFileCopy handles file copy operation creation
func (fc *FileController) CreateFileCopy(c *gin.Context) {
	var req models.FileCopyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("Failed to bind request: %v", err)
		response.ErrorResponse(c, fmt.Sprintf("Invalid request format: %v", err), err)
		return
	}

	logger.Infof("Controller: Creating file copy operation: filesCount=%d", len(req.Files))

	// Create file copy operation
	err := fc.fileService.CreateFileCopy(req)
	if err != nil {
		logger.Errorf("Controller: Failed to create file copy operation with %d files: error=%s",
			len(req.Files), err.Error())
		response.ErrorResponse(c, err.Error(), err)
		return
	}

	logger.Infof("Controller: Successfully completed file copy operation: copied %d files",
		len(req.Files))
	response.SuccessResponse(c, "File copy operation completed successfully", nil)
}
