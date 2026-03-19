package storage

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/util"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type Manager struct {
	clientset     *kubernetes.Clientset
	factory       *StorageFactory
	config        *config.Config
	namespace     string
	clientManager *k8s.ClientManager
}

func NewManager(clientset *kubernetes.Clientset, clientManager *k8s.ClientManager, config *config.Config) *Manager {
	factory := NewStorageFactory()

	return &Manager{
		clientset:     clientset,
		factory:       factory,
		config:        config,
		namespace:     config.Namespace,
		clientManager: clientManager,
	}
}

func (m *Manager) RegisterProvider(storageType StorageType, provider StorageProvider) {
	m.factory.RegisterProvider(storageType, provider)
}

func (m *Manager) CreatePersistentVolume(ctx context.Context, sandboxID string, projectID string, config *StorageConfig) (*corev1.PersistentVolume, error) {
	logger.Infof("Creating PV for sandbox: %s, project: %s, storageType: %s", sandboxID, projectID, config.StorageType)

	provider, err := m.factory.GetProvider(config.StorageType)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage provider: %w", err)
	}

	if err := provider.ValidateConfig(config); err != nil {
		return nil, fmt.Errorf("invalid storage config: %w", err)
	}

	if config.VolumeHandle == "" {
		config.VolumeHandle = models.GenerateWorkspacePVName(sandboxID)
	}

	pv, err := provider.CreatePV(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create PV template: %w", err)
	}

	if pv.ObjectMeta.Labels == nil {
		pv.ObjectMeta.Labels = make(map[string]string)
	}
	pv.ObjectMeta.Labels["app"] = "sandbox"
	pv.ObjectMeta.Labels["sandbox-id"] = sandboxID
	pv.ObjectMeta.Labels["project-id"] = projectID
	pv.ObjectMeta.Labels["managed-by"] = "sandbox-gateway"
	pv.ObjectMeta.Labels["storage-type"] = string(config.StorageType)

	existingPV, err := m.clientset.CoreV1().PersistentVolumes().Get(ctx, pv.ObjectMeta.Name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Creating new PV: %s", pv.ObjectMeta.Name)
			createdPV, err := m.clientset.CoreV1().PersistentVolumes().Create(ctx, pv, metav1.CreateOptions{})
			if err != nil {
				logger.Errorf("Failed to create PV %s: %v", pv.ObjectMeta.Name, err)
				return nil, fmt.Errorf("failed to create PV: %w", err)
			}

			logger.Infof("Successfully created PV: %s", createdPV.ObjectMeta.Name)
			return createdPV, nil
		} else {
			return nil, fmt.Errorf("failed to get existing PV: %w", err)
		}
	} else {
		// Check if PV is in Released or Failed state
		if existingPV.Status.Phase == corev1.VolumeReleased || existingPV.Status.Phase == corev1.VolumeFailed {
			logger.Infof("PV %s is in %s state, deleting it first", existingPV.ObjectMeta.Name, existingPV.Status.Phase)

			// Delete the released/failed PV
			err := m.DeletePersistentVolume(ctx, existingPV.ObjectMeta.Name)
			if err != nil {
				return nil, fmt.Errorf("failed to delete PV in %s state: %w", existingPV.Status.Phase, err)
			}

			// Create new PV after deletion
			logger.Infof("Creating new PV after deleting PV in %s state: %s", existingPV.Status.Phase, pv.ObjectMeta.Name)
			createdPV, err := m.clientset.CoreV1().PersistentVolumes().Create(ctx, pv, metav1.CreateOptions{})
			if err != nil {
				logger.Errorf("Failed to create PV %s: %v", pv.ObjectMeta.Name, err)
				return nil, fmt.Errorf("failed to create PV: %w", err)
			}

			logger.Infof("Successfully created PV: %s", createdPV.ObjectMeta.Name)
			return createdPV, nil
		} else {
			logger.Infof("PV already exists: %s, verifying availability", existingPV.ObjectMeta.Name)

			return existingPV, nil
		}
	}
}

func (m *Manager) CreatePersistentVolumeClaim(ctx context.Context, sandboxID string, projectID string, config *StorageConfig) (*corev1.PersistentVolumeClaim, error) {
	logger.Infof("Creating PVC for sandbox: %s, project: %s, storageType: %s", sandboxID, projectID, config.StorageType)

	provider, err := m.factory.GetProvider(config.StorageType)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage provider: %w", err)
	}

	pvc, err := provider.CreatePVC(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create PVC template: %w", err)
	}

	pvcName := models.GenerateWorkspacePVCName(sandboxID)
	pvc.ObjectMeta.Name = pvcName
	pvc.ObjectMeta.Namespace = m.namespace

	if pvc.ObjectMeta.Labels == nil {
		pvc.ObjectMeta.Labels = make(map[string]string)
	}
	pvc.ObjectMeta.Labels["app"] = "sandbox"
	pvc.ObjectMeta.Labels["sandbox-id"] = sandboxID
	pvc.ObjectMeta.Labels["project-id"] = projectID
	pvc.ObjectMeta.Labels["managed-by"] = "sandbox-gateway"
	pvc.ObjectMeta.Labels["storage-type"] = string(config.StorageType)

	existingPVC, err := m.clientset.CoreV1().PersistentVolumeClaims(m.namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Creating new PVC: %s", pvcName)
			createdPVC, err := m.clientset.CoreV1().PersistentVolumeClaims(m.namespace).Create(ctx, pvc, metav1.CreateOptions{})
			if err != nil {
				logger.Errorf("Failed to create PVC %s: %v", pvcName, err)
				return nil, fmt.Errorf("failed to create PVC: %w", err)
			}

			logger.Infof("Successfully created PVC: %s", createdPVC.ObjectMeta.Name)
			return createdPVC, nil
		} else {
			return nil, fmt.Errorf("failed to get existing PVC: %w", err)
		}
	} else {
		logger.Infof("PVC already exists: %s", existingPVC.ObjectMeta.Name)
		return existingPVC, nil
	}
}

func (m *Manager) GetProvider(storageType StorageType) (StorageProvider, error) {
	return m.factory.GetProvider(storageType)
}

func (m *Manager) GetClientset() *kubernetes.Clientset {
	return m.clientset
}

func (m *Manager) DeletePersistentVolume(ctx context.Context, pvName string) error {
	logger.Infof("Deleting PV: %s", pvName)

	err := m.clientset.CoreV1().PersistentVolumes().Delete(ctx, pvName, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("PV %s not found, already deleted", pvName)
			return nil
		}
		return fmt.Errorf("failed to delete PV %s: %w", pvName, err)
	}

	logger.Infof("Successfully deleted PV: %s", pvName)
	return nil
}

func (m *Manager) DeletePersistentVolumeClaim(ctx context.Context, pvcName string) error {
	logger.Infof("Deleting PVC: %s", pvcName)

	err := m.clientset.CoreV1().PersistentVolumeClaims(m.namespace).Delete(ctx, pvcName, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("PVC %s not found, already deleted", pvcName)
			return nil
		}
		return fmt.Errorf("failed to delete PVC %s: %w", pvcName, err)
	}

	logger.Infof("Successfully deleted PVC: %s", pvcName)
	return nil
}

func (m *Manager) BuildStorageConfig(sandboxID string, projectID string, storageType StorageType, projectOSSPath string, enableFileNotification bool) (*StorageConfig, error) {
	config := &StorageConfig{
		StorageType: storageType,
		SandboxID:   sandboxID,
		ProjectID:   projectID,
		Namespace:   m.namespace,
		Size:        resource.MustParse("10Gi"),
		AccessModes: []corev1.PersistentVolumeAccessMode{
			corev1.ReadWriteMany,
		},
	}

	var httpNotifyURL string
	if enableFileNotification {
		httpNotifyURL = m.buildHttpNotifyURL(sandboxID)
	}

	switch storageType {
	case StorageTypeTOS:
		config.CSIDriver = m.config.TOSCSIDriver
		config.VolumeHandle = models.GenerateWorkspacePVName(sandboxID)
		config.OSSConfig = &OSSConfig{
			SecretName:      m.config.TOSSecretName,
			SecretNamespace: m.config.TOSSecretNamespace,
			Bucket:          m.config.TOSBucket,
			Path:            projectOSSPath,
			URL:             m.config.TOSURL,
			HttpNotifyURL:   httpNotifyURL,
		}
	case StorageTypeOSS:
		config.CSIDriver = m.config.OSSCSIDriver
		config.VolumeHandle = models.GenerateWorkspacePVName(sandboxID)
		config.OSSConfig = &OSSConfig{
			SecretName:      m.config.OSSSecretName,
			SecretNamespace: m.config.OSSSecretNamespace,
			Bucket:          m.config.OSSBucket,
			Path:            projectOSSPath,
			URL:             m.config.OSSURL,
			HttpNotifyURL:   httpNotifyURL,
		}
	case StorageTypeS3:
		config.CSIDriver = m.config.S3CSIDriver
		config.VolumeHandle = models.GenerateWorkspacePVName(sandboxID)
		config.OSSConfig = &OSSConfig{
			SecretName:      m.config.S3SecretName,
			SecretNamespace: m.config.S3SecretNamespace,
			Bucket:          m.config.S3Bucket,
			Path:            projectOSSPath,
			URL:             m.config.S3URL,
			HttpNotifyURL:   httpNotifyURL,
		}
	default:
		return nil, fmt.Errorf("unsupported storage type: %s", storageType)
	}

	return config, nil
}

func (m *Manager) buildHttpNotifyURL(sandboxID string) string {
	serviceName := fmt.Sprintf("sandbox-%s", sandboxID)

	httpNotifyURL := util.BuildServiceURL(serviceName, m.config.Namespace, m.config.AgentPort, "/api/v1/files/notifications")
	logger.Infof("Built HTTP notify URL for sandbox %s: %s", sandboxID, httpNotifyURL)

	return httpNotifyURL
}
