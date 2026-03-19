package models

import (
	"fmt"
	"strings"

	"github.com/dtyq/sandbox-components/pkg/util/validator"
)

type SandboxCreateResponse struct {
	Namespace string `json:"namespace"`
	PodName   string `json:"pod_name"`
	SandboxID string `json:"sandbox_id"`
}

type SandboxCreateRequest struct {
	SandboxID              string `json:"sandbox_id" binding:"required"`
	ProjectID              string `json:"project_id" binding:"required"`
	ProjectOSSPath         string `json:"project_oss_path" binding:"omitempty"`
	EnableReadiness        *bool  `json:"enable_readiness,omitempty"`
	EnableFileNotification *bool  `json:"enable_file_notification,omitempty"`

	// User information fields - set from request headers, not from JSON binding
	MagicUserID  string `json:"-"`
	MagicOrgCode string `json:"-"`
}

func (r *SandboxCreateRequest) GetEnableReadiness() bool {
	if r.EnableReadiness == nil {
		return true
	}
	return *r.EnableReadiness
}

func (r *SandboxCreateRequest) GetEnableFileNotification() bool {
	if r.EnableFileNotification == nil {
		return true
	}
	return *r.EnableFileNotification
}

func (r *SandboxCreateRequest) GetProjectOSSPath() string {
	path := r.ProjectOSSPath

	// Ensure path starts with '/'
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	// Ensure path ends with '/'
	if !strings.HasSuffix(path, "/") {
		path = path + "/"
	}

	return path
}

// GetSandboxID returns the sandbox ID
func (r *SandboxCreateRequest) GetSandboxID() string {
	return r.SandboxID
}

type SandboxStatusResponse struct {
	SandboxID string `json:"sandbox_id"`
	Status    string `json:"status"`
}

type BatchSandboxStatusRequest struct {
	SandboxIDs []string `json:"sandbox_ids" binding:"required,dive,required"`
}

type BatchSandboxStatusResponse []SandboxStatusResponse

func NewSandboxCreateResponse(namespace, podName, sandboxID string) *SandboxCreateResponse {
	return &SandboxCreateResponse{
		Namespace: namespace,
		PodName:   podName,
		SandboxID: sandboxID,
	}
}

func NewSandboxStatusResponse(sandboxID, status string) *SandboxStatusResponse {
	return &SandboxStatusResponse{
		SandboxID: sandboxID,
		Status:    status,
	}
}

func NewBatchSandboxStatusResponse(responses []SandboxStatusResponse) BatchSandboxStatusResponse {
	return BatchSandboxStatusResponse(responses)
}

// GenerateWorkspacePVName generates a consistent PV name for the given sandbox ID
func GenerateWorkspacePVName(sandboxID string) string {
	return fmt.Sprintf("workspace-pv-%s", sandboxID)
}

// GenerateWorkspacePVCName generates a consistent PVC name for the given sandbox ID
func GenerateWorkspacePVCName(sandboxID string) string {
	return fmt.Sprintf("workspace-pvc-%s", sandboxID)
}

// GetMagicUserID returns the magic user ID
func (r *SandboxCreateRequest) GetMagicUserID() string {
	return r.MagicUserID
}

// GetMagicOrgCode returns the magic organization code
func (r *SandboxCreateRequest) GetMagicOrgCode() string {
	return r.MagicOrgCode
}

// SetUserInfo sets the user information from request headers
func (r *SandboxCreateRequest) SetUserInfo(userID, orgCode string) {
	r.MagicUserID = userID
	r.MagicOrgCode = orgCode
}

// ValidateProjectOSSPath validates the project_oss_path for security
func (r *SandboxCreateRequest) ValidateProjectOSSPath() error {
	pathValidator := validator.NewPathValidator()

	// Validate before normalization
	if err := pathValidator.ValidateOSSPath(r.ProjectOSSPath); err != nil {
		return fmt.Errorf("invalid project_oss_path: %w", err)
	}

	return nil
}
