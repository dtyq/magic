package controllers

import (
	"fmt"

	"github.com/dtyq/sandbox-components/pkg/response"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/proxy"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/sandbox"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/gin-gonic/gin"
)

type SandboxController struct {
	sandboxService *sandbox.SandboxService
	proxyService   *proxy.ProxyService
	config         *config.Config
}

func NewSandboxController(cfg *config.Config) *SandboxController {
	logger.Info("Initializing sandbox controller")

	kubeConfigPath := cfg.GetKubeConfigPath()
	clientManager, err := k8s.NewClientManager(k8s.ClientConfig{
		KubeConfigPath: kubeConfigPath,
	})
	if err != nil {
		logger.Fatalf("Failed to create K8s client manager: %v", err)
	}

	sandboxService := sandbox.NewSandboxService(clientManager, cfg)
	proxyService := proxy.NewProxyService(clientManager, cfg)

	return &SandboxController{
		sandboxService: sandboxService,
		proxyService:   proxyService,
		config:         cfg,
	}
}

func (sc *SandboxController) CreateSandbox(c *gin.Context) {
	var req models.SandboxCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("Failed to bind request: %v", err)
		response.ErrorResponse(c, fmt.Sprintf("Invalid request format: %v", err), err)
		return
	}

	magicUserID := c.GetHeader("magic-user-id")
	magicOrgCode := c.GetHeader("magic-organization-code")
	req.SetUserInfo(magicUserID, magicOrgCode)

	logger.Infof("Extracted user info from headers: userID=%s, orgCode=%s", magicUserID, magicOrgCode)

	// Validate project_oss_path for security (prevent command injection)
	if err := req.ValidateProjectOSSPath(); err != nil {
		logger.Errorf("Security validation failed for project_oss_path from user %s: %v", magicUserID, err)
		response.ErrorResponse(c, fmt.Sprintf("Security validation failed: %v", err), err)
		return
	}

	// Log successful validation for audit purposes
	if req.ProjectOSSPath != "" {
		logger.Infof("Project OSS path validated successfully: userID=%s, path=%s", magicUserID, req.ProjectOSSPath)
	}

	enableReadiness := req.GetEnableReadiness()
	enableFileNotification := req.GetEnableFileNotification()
	sandboxID := req.GetSandboxID()
	projectOSSPath := req.GetProjectOSSPath()

	logger.Infof("Controller: Creating sandbox: sandboxID=%s, projectID=%s, projectOSSPath=%s, enableReadiness=%t, enableFileNotification=%t, userID=%s, orgCode=%s",
		sandboxID, req.ProjectID, projectOSSPath, enableReadiness, enableFileNotification, req.GetMagicUserID(), req.GetMagicOrgCode())

	sandbox, err := sc.sandboxService.CreateSandbox(req)
	if err != nil {
		logger.Errorf("Controller: Failed to create sandbox: sandboxID=%s, projectID=%s, userID=%s, error=%s",
			sandboxID, req.ProjectID, req.GetMagicUserID(), err.Error())
		response.ErrorResponse(c, err.Error(), err)
		return
	}

	logger.Infof("Controller: Successfully created sandbox: sandboxID=%s, projectID=%s, userID=%s",
		sandbox.SandboxID, req.ProjectID, req.GetMagicUserID())
	response.SuccessResponse(c, "Sandbox created successfully", sandbox)
}

func (sc *SandboxController) GetSandbox(c *gin.Context) {
	sandboxID := c.Param("id")

	if sandboxID == "" {
		logger.Error("Missing sandbox ID in request")
		response.ErrorResponse(c, "Bad Request: missing sandbox ID", nil)
		return
	}

	logger.Infof("Controller: Getting sandbox status: sandboxID=%s", sandboxID)

	namespace := sc.config.Namespace

	status, err := sc.sandboxService.GetSandboxStatus(sandboxID, namespace)
	if err != nil {
		logger.Errorf("Failed to get sandbox status for %s: %v", sandboxID, err)
		response.ErrorResponse(c, err.Error(), err)
		return
	}

	logger.Infof("Successfully retrieved sandbox status: %s", sandboxID)
	response.SuccessResponse(c, "Sandbox status retrieved successfully", status)
}

func (sc *SandboxController) QuerySandboxes(c *gin.Context) {
	var req models.BatchSandboxStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("Failed to bind request: %v", err)
		response.ErrorResponse(c, fmt.Sprintf("Invalid request format: %v", err), err)
		return
	}

	logger.Infof("Controller: Querying sandbox statuses: sandboxIDs=%v, count=%d",
		req.SandboxIDs, len(req.SandboxIDs))

	namespace := sc.config.Namespace

	statuses, err := sc.sandboxService.GetBatchSandboxStatus(req.SandboxIDs, namespace)
	if err != nil {
		logger.Errorf("Failed to query sandbox status: %v", err)
		response.ErrorResponse(c, err.Error(), err)
		return
	}

	logger.Infof("Successfully queried sandbox status for %d sandboxes", len(req.SandboxIDs))
	response.SuccessResponse(c, "Sandbox status query completed successfully", statuses)
}

func (sc *SandboxController) ProxyHTTP(c *gin.Context) {
	sandboxID := c.Param("id")
	proxyPath := c.Param("proxyPath")

	if sandboxID == "" {
		logger.Error("Sandbox ID is required for proxy")
		response.ErrorResponse(c, "Sandbox ID is required", nil)
		return
	}

	logger.Infof("Controller: HTTP proxy request: sandboxID=%s, proxyPath=%s, method=%s",
		sandboxID, proxyPath, c.Request.Method)

	// Verify sandbox exists before proxying
	namespace := sc.config.Namespace
	_, err := sc.sandboxService.GetSandboxStatus(sandboxID, namespace)
	if err != nil {
		logger.Errorf("Sandbox verification failed for %s: %v", sandboxID, err)
		response.ErrorResponse(c, fmt.Sprintf("Sandbox not found or unavailable: %v", err), err)
		return
	}

	if err := sc.proxyService.ProxyHTTP(c.Writer, c.Request, sandboxID, proxyPath); err != nil {
		logger.Errorf("HTTP proxy failed for sandbox %s: %v", sandboxID, err)
		response.ErrorResponse(c, fmt.Sprintf("Proxy failed: %v", err), err)
		return
	}

	logger.Infof("HTTP proxy request completed successfully: sandboxID=%s, proxyPath=%s",
		sandboxID, proxyPath)
}
