package storage

import (
	corev1 "k8s.io/api/core/v1"
)

type StorageProvider interface {
	GetStorageType() StorageType

	CreatePV(config *StorageConfig) (*corev1.PersistentVolume, error)

	CreatePVC(config *StorageConfig) (*corev1.PersistentVolumeClaim, error)

	ValidateConfig(config *StorageConfig) error
}

type VolumeManager interface {
	CreatePersistentVolume(sandboxID string, projectID string, config *StorageConfig) (*corev1.PersistentVolume, error)

	CreatePersistentVolumeClaim(sandboxID string, projectID string, config *StorageConfig) (*corev1.PersistentVolumeClaim, error)

	GetProvider(storageType StorageType) (StorageProvider, error)
}
