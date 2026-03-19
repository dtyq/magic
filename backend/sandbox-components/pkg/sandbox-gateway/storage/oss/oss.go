package oss

import (
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage"
)

type OSSProvider struct{}

func NewOSSProvider() storage.StorageProvider {
	return &OSSProvider{}
}

func (p *OSSProvider) GetStorageType() storage.StorageType {
	return storage.StorageTypeOSS
}

func (p *OSSProvider) CreatePV(config *storage.StorageConfig) (*corev1.PersistentVolume, error) {
	if config.OSSConfig == nil {
		return nil, fmt.Errorf("OSS config is required for OSS storage")
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
					VolumeAttributes: buildOSSVolumeAttributes(config.OSSConfig),
				},
			},
			VolumeMode: &[]corev1.PersistentVolumeMode{corev1.PersistentVolumeFilesystem}[0],
		},
	}

	return pv, nil
}

func (p *OSSProvider) CreatePVC(config *storage.StorageConfig) (*corev1.PersistentVolumeClaim, error) {
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

func (p *OSSProvider) ValidateConfig(config *storage.StorageConfig) error {
	if config.OSSConfig == nil {
		return fmt.Errorf("OSS config is required for OSS storage")
	}

	if config.OSSConfig.Bucket == "" {
		return fmt.Errorf("bucket is required for OSS storage")
	}

	if config.OSSConfig.URL == "" {
		return fmt.Errorf("URL is required for OSS storage")
	}

	if config.OSSConfig.SecretName == "" {
		return fmt.Errorf("secret name is required for OSS storage")
	}

	if config.OSSConfig.SecretNamespace == "" {
		return fmt.Errorf("secret namespace is required for OSS storage")
	}

	if config.OSSConfig.Path == "" {
		return fmt.Errorf("path is required for OSS storage")
	}

	if !strings.Contains(config.OSSConfig.URL, "oss-") {
		return fmt.Errorf("invalid OSS URL format: %s", config.OSSConfig.URL)
	}

	return nil
}

func buildOSSVolumeAttributes(ossConfig *storage.OSSConfig) map[string]string {
	attrs := map[string]string{
		"bucket":    ossConfig.Bucket,
		"url":       ossConfig.URL,
		"path":      ossConfig.Path,
		"otherOpts": "-o allow_other,umask=022",
	}

	if ossConfig.HttpNotifyURL != "" {
		attrs["otherOpts"] += fmt.Sprintf(",http_notify_url=%s", ossConfig.HttpNotifyURL)
	}

	return attrs
}
