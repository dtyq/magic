package detector

import (
	"context"
	"fmt"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// FusePodDetector detects orphaned fuse pods in fuse pod namespace
type FusePodDetector struct {
	client            kubernetes.Interface
	orphanedThreshold time.Duration
	ctx               context.Context
	fusePodNamespace  string
	sandboxNamespace  string
}

// NewFusePodDetector creates a new Fuse Pod detector
func NewFusePodDetector(ctx context.Context, client kubernetes.Interface, fusePodNamespace string, sandboxNamespace string, orphanedThreshold time.Duration) *FusePodDetector {
	return &FusePodDetector{
		client:            client,
		orphanedThreshold: orphanedThreshold,
		ctx:               ctx,
		fusePodNamespace:  fusePodNamespace,
		sandboxNamespace:  sandboxNamespace,
	}
}

// Perform executes the detection and cleanup logic for orphaned fuse pods
func (d *FusePodDetector) Perform() error {
	logger.Info("Starting fuse pod detector performance")

	// Detect orphaned fuse pods
	cleanupTasks, err := d.detectOrphanedFusePods()
	if err != nil {
		logger.Errorf("Failed to detect orphaned fuse pods: %v", err)
		return fmt.Errorf("failed to detect orphaned fuse pods: %w", err)
	}

	if len(cleanupTasks) == 0 {
		logger.Debug("No orphaned fuse pods found, cleanup not needed")
		return nil
	}

	logger.Infof("Found %d orphaned fuse pods to cleanup", len(cleanupTasks))

	// Process cleanup tasks
	processed := 0
	for _, task := range cleanupTasks {
		if err := d.processCleanupTask(task); err != nil {
			logger.Errorf("Failed to cleanup fuse pod %s/%s: %v", task.Pod.Namespace, task.Pod.Name, err)
			continue
		}
		processed++
	}

	logger.Infof("Processed %d/%d fuse pod cleanup tasks", processed, len(cleanupTasks))
	return nil
}

// detectOrphanedFusePods detects fuse pods that need cleanup
func (d *FusePodDetector) detectOrphanedFusePods() ([]*FusePodCleanupTask, error) {
	logger.Info("Starting fuse pod detection in sandbox namespace")

	var cleanupTasks []*FusePodCleanupTask

	// List fuse pods in fuse pod namespace with appropriate label selector
	labelSelector := fmt.Sprintf("app=s3fs-pod,namespace=%s", d.sandboxNamespace)
	podList, err := d.client.CoreV1().Pods(d.fusePodNamespace).List(d.ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list fuse pods: %w", err)
	}

	logger.Infof("Found %d fuse pods in fuse pod namespace %s", len(podList.Items), d.fusePodNamespace)

	currentTime := time.Now()

	for _, pod := range podList.Items {
		// Extract sandbox ID from fuse pod labels
		sandboxID := d.extractSandboxID(&pod)
		if sandboxID == "" {
			logger.Debugf("Fuse pod %s/%s has no sandbox ID, skipping", pod.Namespace, pod.Name)
			continue
		}

		// Check if corresponding sandbox pod exists
		sandboxExists, err := d.sandboxPodExists(sandboxID)
		if err != nil {
			logger.Errorf("Failed to check sandbox pod existence for %s: %v", sandboxID, err)
			continue
		}

		// If sandbox pod exists, this fuse pod is still needed, skip it
		if sandboxExists {
			continue
		}

		// Check if fuse pod is expired (older than threshold)
		if !d.isExpired(&pod, currentTime) {
			continue
		}

		// Sandbox pod doesn't exist and fuse pod is expired, mark for cleanup
		reason := fmt.Sprintf("Fuse pod %s/%s is orphaned (sandbox %s not found) and expired for more than %s",
			pod.Namespace, pod.Name, sandboxID, d.orphanedThreshold)

		cleanupTask := &FusePodCleanupTask{
			Pod:           &pod,
			CleanupReason: reason,
			DetectedAt:    currentTime,
		}

		cleanupTasks = append(cleanupTasks, cleanupTask)

		logger.Infof("Detected orphaned fuse pod: %s/%s, SandboxID: %s, CreatedAt: %s",
			pod.Namespace, pod.Name, sandboxID, pod.CreationTimestamp.Time)
	}

	logger.Infof("Found %d orphaned fuse pods for cleanup", len(cleanupTasks))
	return cleanupTasks, nil
}

// extractSandboxID extracts sandbox ID from fuse pod labels
func (d *FusePodDetector) extractSandboxID(pod *corev1.Pod) string {
	// Extract sandbox ID from labels, try common label keys
	if sandboxID, exists := pod.Labels["sandbox-id"]; exists {
		return sandboxID
	}
	// Fallback: try extracting from pod name if it follows sandbox-<id> pattern
	// This is a common pattern where pod names contain the sandbox ID
	return ""
}

// sandboxPodExists checks if the corresponding sandbox pod exists
func (d *FusePodDetector) sandboxPodExists(sandboxID string) (bool, error) {
	labelSelector := fmt.Sprintf("app=sandbox,sandbox-id=%s", sandboxID)
	podList, err := d.client.CoreV1().Pods(d.sandboxNamespace).List(d.ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return false, fmt.Errorf("failed to list sandbox pods: %w", err)
	}

	return len(podList.Items) > 0, nil
}

// isExpired checks if a fuse pod is older than the expiration threshold
func (d *FusePodDetector) isExpired(pod *corev1.Pod, currentTime time.Time) bool {
	podAge := currentTime.Sub(pod.CreationTimestamp.Time)
	return podAge > d.orphanedThreshold
}

// processCleanupTask processes a single fuse pod cleanup task
func (d *FusePodDetector) processCleanupTask(task *FusePodCleanupTask) error {
	logger.Infof("Processing cleanup for fuse pod %s/%s: %s",
		task.Pod.Namespace, task.Pod.Name, task.CleanupReason)

	// Delete the fuse pod
	deleteOptions := metav1.DeleteOptions{}
	err := d.client.CoreV1().Pods(task.Pod.Namespace).Delete(d.ctx, task.Pod.Name, deleteOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Fuse pod %s/%s already deleted", task.Pod.Namespace, task.Pod.Name)
			return nil
		}
		return fmt.Errorf("failed to delete fuse pod: %w", err)
	}

	logger.Infof("Successfully deleted fuse pod %s/%s", task.Pod.Namespace, task.Pod.Name)
	return nil
}
