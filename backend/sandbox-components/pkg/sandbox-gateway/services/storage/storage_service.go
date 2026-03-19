package storage

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage/oss"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type StorageService struct {
	manager *storage.Manager
	config  *config.Config
}

func NewStorageService(clientset *kubernetes.Clientset, clientManager *k8s.ClientManager, config *config.Config) *StorageService {
	manager := storage.NewManager(clientset, clientManager, config)

	manager.RegisterProvider(storage.StorageTypeTOS, oss.NewTOSProvider())
	manager.RegisterProvider(storage.StorageTypeOSS, oss.NewOSSProvider())
	manager.RegisterProvider(storage.StorageTypeS3, oss.NewS3Provider())

	return &StorageService{
		manager: manager,
		config:  config,
	}
}

// checkExistingPVC checks if a PVC already exists and is in Bound state
// Returns the existing PVC and PV if found and bound, otherwise returns nil
func (s *StorageService) checkExistingPVC(ctx context.Context, sandboxID string, projectID string, storageType storage.StorageType) (*WorkspaceStorage, error) {
	// Generate PVC name using the same logic as Manager
	pvcName := models.GenerateWorkspacePVCName(sandboxID)

	logger.Infof("Checking existing PVC: %s for sandbox: %s, project: %s", pvcName, sandboxID, projectID)

	// Try to get existing PVC
	existingPVC, err := s.manager.GetClientset().CoreV1().PersistentVolumeClaims(s.config.Namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("PVC %s not found, will create new one", pvcName)
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get existing PVC %s: %w", pvcName, err)
	}

	// Check PVC phase
	logger.Infof("Found existing PVC %s with phase: %s", pvcName, existingPVC.Status.Phase)

	if existingPVC.Status.Phase != corev1.ClaimBound {
		logger.Infof("PVC %s is not in Bound state (current: %s), will recreate", pvcName, existingPVC.Status.Phase)
		return nil, nil
	}

	// PVC is bound, get the associated PV
	if existingPVC.Spec.VolumeName == "" {
		logger.Warnf("PVC %s is bound but has no volume name", pvcName)
		return nil, nil
	}

	pvName := existingPVC.Spec.VolumeName
	logger.Infof("PVC %s is bound to PV: %s", pvcName, pvName)

	existingPV, err := s.manager.GetClientset().CoreV1().PersistentVolumes().Get(ctx, pvName, metav1.GetOptions{})
	if err != nil {
		logger.Errorf("Failed to get PV %s bound to PVC %s: %v", pvName, pvcName, err)
		return nil, nil // PV not found, proceed with creation
	}

	logger.Infof("Successfully found existing bound PVC %s and PV %s", pvcName, pvName)

	return &WorkspaceStorage{
		ProjectID:   projectID,
		StorageType: storageType,
		PV:          existingPV,
		PVC:         existingPVC,
	}, nil
}

func (s *StorageService) CreateWorkspaceStorage(ctx context.Context, projectID string, sandboxID string, projectOSSPath string, enableFileNotification bool) (*WorkspaceStorage, error) {
	logger.Infof("Creating workspace storage for project: %s, sandbox: %s, enableFileNotification: %t", projectID, sandboxID, enableFileNotification)

	storageType := storage.StorageType(s.config.StorageType)

	// Check if PVC already exists and is bound
	existingStorage, err := s.checkExistingPVC(ctx, sandboxID, projectID, storageType)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing PVC: %w", err)
	}

	if existingStorage != nil {
		logger.Infof("Found existing bound PVC for sandbox %s, returning existing storage", sandboxID)
		return existingStorage, nil
	}

	// Continue with normal creation flow if PVC doesn't exist or is not bound
	logger.Infof("No existing bound PVC found for sandbox %s, proceeding with creation", sandboxID)

	storageConfig, err := s.manager.BuildStorageConfig(sandboxID, projectID, storageType, projectOSSPath, enableFileNotification)
	if err != nil {
		return nil, fmt.Errorf("failed to build storage config: %w", err)
	}

	var pv *corev1.PersistentVolume
	var pvc *corev1.PersistentVolumeClaim

	// 1. Create PV (CreatePersistentVolume now ensures PV is available before returning)
	pv, err = s.manager.CreatePersistentVolume(ctx, sandboxID, projectID, storageConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create PV: %w", err)
	}

	// 2. Create PVC (PV is guaranteed to be available from CreatePersistentVolume)
	logger.Infof("PV %s is available, proceeding to create PVC", pv.Name)
	pvc, err = s.manager.CreatePersistentVolumeClaim(ctx, sandboxID, projectID, storageConfig)
	if err != nil {
		logger.Errorf("Failed to create PVC for sandbox %s: %v", sandboxID, err)
		if cleanupErr := s.manager.DeletePersistentVolume(ctx, pv.Name); cleanupErr != nil {
			logger.Errorf("Failed to cleanup PV after PVC creation failure: %v", cleanupErr)
		}
		return nil, fmt.Errorf("failed to create PVC: %w", err)
	}

	result := &WorkspaceStorage{
		ProjectID:   projectID,
		StorageType: storageType,
		PV:          pv,
		PVC:         pvc,
	}

	logger.Infof("Successfully created workspace storage for project: %s, sandbox: %s, PV: %s, PVC: %s",
		projectID, sandboxID, pv.Name, pvc.Name)
	return result, nil
}

type WorkspaceStorage struct {
	ProjectID   string                        `json:"projectId"`
	StorageType storage.StorageType           `json:"storageType"`
	PV          *corev1.PersistentVolume      `json:"pv,omitempty"`
	PVC         *corev1.PersistentVolumeClaim `json:"pvc"`
}
