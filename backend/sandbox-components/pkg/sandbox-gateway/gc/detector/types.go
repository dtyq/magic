package detector

import (
	"time"

	corev1 "k8s.io/api/core/v1"
)

// Detector defines the interface that all detectors must implement
type Detector interface {
	// Perform executes the detection and cleanup logic
	Perform() error
}

// PVCCleanupTask represents a PVC cleanup task
type PVCCleanupTask struct {
	PVC           *corev1.PersistentVolumeClaim
	CleanupReason string
	DetectedAt    time.Time
}

// PVCleanupTask represents a PV cleanup task
type PVCleanupTask struct {
	PV            *corev1.PersistentVolume
	CleanupReason string
	DetectedAt    time.Time
}

// AgentCleanupTask represents a sandbox pod cleanup task with exited agent
type AgentCleanupTask struct {
	Pod           *corev1.Pod
	CleanupReason string
	DetectedAt    time.Time
}

// FusePodCleanupTask represents a fuse pod cleanup task
type FusePodCleanupTask struct {
	Pod           *corev1.Pod
	CleanupReason string
	DetectedAt    time.Time
}
