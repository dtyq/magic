package oss

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage"
)

type TOSProvider struct{}

func NewTOSProvider() storage.StorageProvider {
	return &TOSProvider{}
}

func (p *TOSProvider) GetStorageType() storage.StorageType {
	return storage.StorageTypeTOS
}

func (p *TOSProvider) CreatePV(config *storage.StorageConfig) (*corev1.PersistentVolume, error) {
	if config.OSSConfig == nil {
		return nil, fmt.Errorf("OSS config is required for TOS storage")
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
					VolumeAttributes: buildTOSVolumeAttributes(config.OSSConfig),
				},
			},
			VolumeMode: &[]corev1.PersistentVolumeMode{corev1.PersistentVolumeFilesystem}[0],
		},
	}

	return pv, nil
}

func (p *TOSProvider) CreatePVC(config *storage.StorageConfig) (*corev1.PersistentVolumeClaim, error) {
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

func (p *TOSProvider) ValidateConfig(config *storage.StorageConfig) error {
	if config.OSSConfig == nil {
		return fmt.Errorf("OSS config is required for TOS storage")
	}

	if config.OSSConfig.Bucket == "" {
		return fmt.Errorf("bucket is required for TOS storage")
	}

	if config.OSSConfig.URL == "" {
		return fmt.Errorf("URL is required for TOS storage")
	}

	if config.OSSConfig.SecretName == "" {
		return fmt.Errorf("secret name is required for TOS storage")
	}

	return nil
}

func buildTOSVolumeAttributes(ossConfig *storage.OSSConfig) map[string]string {
	attrs := map[string]string{
		"bucket":          ossConfig.Bucket,
		"path":            ossConfig.Path,
		"url":             ossConfig.URL,
		"additional_args": "-o allow_other,umask=022,enable_noobj_cache,stat_cache_expire=10",
	}

	if ossConfig.HttpNotifyURL != "" {
		attrs["additional_args"] += fmt.Sprintf(",http_notify_url=%s", ossConfig.HttpNotifyURL)
	}

	return attrs
}
