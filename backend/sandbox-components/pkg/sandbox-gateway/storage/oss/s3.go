package oss

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage"
)

type S3Provider struct{}

func NewS3Provider() storage.StorageProvider {
	return &S3Provider{}
}

func (p *S3Provider) GetStorageType() storage.StorageType {
	return storage.StorageTypeS3
}

func (p *S3Provider) CreatePV(config *storage.StorageConfig) (*corev1.PersistentVolume, error) {
	if config.OSSConfig == nil {
		return nil, fmt.Errorf("OSS config is required for S3 storage")
	}

	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{
			Name: config.VolumeHandle,
		},
		Spec: corev1.PersistentVolumeSpec{
			AccessModes: config.AccessModes,
			Capacity: corev1.ResourceList{
				corev1.ResourceStorage: config.Size,
			},
			PersistentVolumeSource: corev1.PersistentVolumeSource{
				CSI: &corev1.CSIPersistentVolumeSource{
					Driver:       config.CSIDriver,
					VolumeHandle: config.VolumeHandle,
					NodePublishSecretRef: &corev1.SecretReference{
						Name:      config.OSSConfig.SecretName,
						Namespace: config.OSSConfig.SecretNamespace,
					},
					NodeStageSecretRef: &corev1.SecretReference{
						Name:      config.OSSConfig.SecretName,
						Namespace: config.OSSConfig.SecretNamespace,
					},
					VolumeAttributes: buildS3VolumeAttributes(config),
				},
			},
			VolumeMode: &[]corev1.PersistentVolumeMode{corev1.PersistentVolumeFilesystem}[0],
		},
	}

	return pv, nil
}

func (p *S3Provider) CreatePVC(config *storage.StorageConfig) (*corev1.PersistentVolumeClaim, error) {
	pvc := &corev1.PersistentVolumeClaim{
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: config.AccessModes,
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: config.Size,
				},
			},
			VolumeName:       config.VolumeHandle,
			StorageClassName: &[]string{""}[0],
		},
	}

	return pvc, nil
}

func (p *S3Provider) ValidateConfig(config *storage.StorageConfig) error {
	if config.OSSConfig == nil {
		return fmt.Errorf("OSS config is required for S3 storage")
	}

	if config.OSSConfig.Bucket == "" {
		return fmt.Errorf("bucket is required for S3 storage")
	}

	if config.OSSConfig.URL == "" {
		return fmt.Errorf("URL is required for S3 storage")
	}

	if config.OSSConfig.SecretName == "" {
		return fmt.Errorf("secret name is required for S3 storage")
	}

	return nil
}

func buildS3VolumeAttributes(config *storage.StorageConfig) map[string]string {
	ossConfig := config.OSSConfig
	attrs := map[string]string{
		"bucket":          ossConfig.Bucket,
		"path":            ossConfig.Path,
		"url":             ossConfig.URL,
		"additional_args": "-o dbglevel=info -o curldbg -o allow_other,umask=022 -o compat_dir",
	}

	if ossConfig.HttpNotifyURL != "" {
		attrs["additional_args"] += fmt.Sprintf(",http_notify_url=%s", ossConfig.HttpNotifyURL)
	}

	// Add fuse_pod_labels configuration with sandbox ID, project ID and namespace
	labelMap := labels.Set{}
	if config.SandboxID != "" {
		labelMap["sandbox-id"] = config.SandboxID
	}
	if config.ProjectID != "" {
		labelMap["project-id"] = config.ProjectID
	}
	if config.Namespace != "" {
		labelMap["namespace"] = config.Namespace
	}

	if len(labelMap) > 0 {
		attrs["fuse_pod_labels"] = labelMap.String()
	}

	return attrs
}
