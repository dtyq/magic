package models

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
)

const (
	LabelProjectID = "project-id"
	LabelSandboxID = "sandbox-id"

	PodNamePrefix = "sandbox-"

	ContainerNameFuse       = "s3fs-fuse"
	ContainerNameAgent      = "agent"
	ContainerNameQdrant     = "qdrant"
	ContainerNamePlaywright = "playwright"
)

const (
	VolumeNameSharedStorage      = "s3fs-mount"
	VolumeNameS3Credentials      = "s3-credentials"
	VolumeNameDevFuse            = "dev-fuse"
	VolumeNameLocalSymlinkMounts = "local-symlink-mounts"
)

type SandboxPod struct {
	*corev1.Pod
}

func NewSandboxPod(pod *corev1.Pod) *SandboxPod {
	return &SandboxPod{Pod: pod}
}

func BuildPodName(sandboxID string) string {
	return fmt.Sprintf("%s%s", PodNamePrefix, sandboxID)
}
