package storage

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

type StorageType string

const (
	StorageTypeTOS StorageType = "tos"
	StorageTypeS3  StorageType = "s3"
	StorageTypeOSS StorageType = "oss"
)

type StorageConfig struct {
	// Basic configuration
	StorageType StorageType                         `json:"storageType"`
	Size        resource.Quantity                   `json:"size"`
	AccessModes []corev1.PersistentVolumeAccessMode `json:"accessModes"`

	// CSI related configuration
	CSIDriver    string `json:"csiDriver"`
	VolumeHandle string `json:"volumeHandle"`

	// Sandbox identification for FUSE pod labels
	SandboxID string `json:"sandboxID,omitempty"`
	ProjectID string `json:"projectID,omitempty"`
	Namespace string `json:"namespace,omitempty"`

	// OSS specific configuration
	OSSConfig *OSSConfig `json:"ossConfig,omitempty"`
}

type OSSConfig struct {
	// Authentication configuration
	SecretName      string `json:"secretName"`
	SecretNamespace string `json:"secretNamespace"`

	// Bucket configuration
	Bucket string `json:"bucket"`
	Path   string `json:"path"`
	URL    string `json:"url"`

	// S3FS notification configuration
	HttpNotifyURL string `json:"httpNotifyUrl,omitempty"`
}
