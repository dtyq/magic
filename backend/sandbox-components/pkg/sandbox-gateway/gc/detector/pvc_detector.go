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

// PVCDetector detects PVCs that should be cleaned up
type PVCDetector struct {
	client          kubernetes.Interface
	ctx             context.Context
	unusedThreshold time.Duration
	namespace       string
}

// NewPVCDetector creates a new PVC detector
func NewPVCDetector(ctx context.Context, client kubernetes.Interface, unusedThreshold time.Duration, namespace string) *PVCDetector {
	return &PVCDetector{
		client:          client,
		ctx:             ctx,
		unusedThreshold: unusedThreshold,
		namespace:       namespace,
	}
}

// Perform executes the detection and cleanup logic for unused PVCs
func (d *PVCDetector) Perform() error {
	logger.Debug("Starting PVC detector performance")

	// Detect unused PVCs
	cleanupTasks, err := d.detectUnusedPVCs()
	if err != nil {
		logger.Errorf("Failed to detect unused PVCs: %v", err)
		return fmt.Errorf("failed to detect unused PVCs: %w", err)
	}

	if len(cleanupTasks) == 0 {
		logger.Debug("No unused PVCs found, cleanup not needed")
		return nil
	}

	logger.Infof("Found %d unused PVCs to cleanup", len(cleanupTasks))

	// Process cleanup tasks
	processed := 0
	for _, task := range cleanupTasks {
		if err := d.processCleanupTask(task); err != nil {
			logger.Errorf("Failed to cleanup PVC %s/%s: %v", task.PVC.Namespace, task.PVC.Name, err)
			continue
		}
		processed++
	}

	logger.Infof("Processed %d/%d PVC cleanup tasks", processed, len(cleanupTasks))
	return nil
}

// processCleanupTask processes a single PVC cleanup task
func (d *PVCDetector) processCleanupTask(task PVCCleanupTask) error {
	logger.Infof("Processing cleanup for PVC %s/%s: %s",
		task.PVC.Namespace, task.PVC.Name, task.CleanupReason)

	// Delete the PVC
	deleteOptions := metav1.DeleteOptions{}
	err := d.client.CoreV1().PersistentVolumeClaims(task.PVC.Namespace).Delete(d.ctx, task.PVC.Name, deleteOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("PVC %s/%s already deleted", task.PVC.Namespace, task.PVC.Name)
			return nil
		}
		return fmt.Errorf("failed to delete PVC: %w", err)
	}

	logger.Infof("Successfully deleted PVC %s/%s", task.PVC.Namespace, task.PVC.Name)
	return nil
}

// detectUnusedPVCs detects PVCs that are not used by any pod
func (d *PVCDetector) detectUnusedPVCs() ([]PVCCleanupTask, error) {
	logger.Debug("Starting PVC detection")

	// Step 1: Get all PVCs
	allPVCs, err := d.getAllPVCs()
	if err != nil {
		return nil, fmt.Errorf("failed to get all PVCs: %w", err)
	}

	logger.Debugf("Found %d total PVCs", len(allPVCs))

	if len(allPVCs) == 0 {
		logger.Debug("No PVCs found, skipping detection")
		return nil, nil
	}

	// Step 2: Get all pods
	allPods, err := d.getAllPods()
	if err != nil {
		return nil, fmt.Errorf("failed to get all pods: %w", err)
	}

	logger.Debugf("Found %d total pods", len(allPods))

	// Step 3: Build PVC usage map from pods
	pvcUsageMap := d.buildPVCUsageMap(allPods)
	logger.Debugf("Built usage map for %d PVCs", len(pvcUsageMap))

	// Step 4: Find unused PVCs that exceed threshold
	var cleanupTasks []PVCCleanupTask
	detectedAt := time.Now()

	for _, pvc := range allPVCs {
		pvcKey := fmt.Sprintf("%s/%s", pvc.Namespace, pvc.Name)

		if !pvcUsageMap[pvcKey] {
			// PVC is not used by any pod, check if it exceeds threshold
			if d.shouldCleanupPVC(pvc, detectedAt) {
				task := PVCCleanupTask{
					PVC:           pvc,
					CleanupReason: d.getCleanupReason(pvc, detectedAt),
					DetectedAt:    detectedAt,
				}
				cleanupTasks = append(cleanupTasks, task)

				logger.Debugf("PVC %s/%s scheduled for cleanup: %s",
					pvc.Namespace, pvc.Name, task.CleanupReason)
			}
		}
	}

	logger.Infof("PVC detection completed: %d/%d PVCs scheduled for cleanup",
		len(cleanupTasks), len(allPVCs))

	return cleanupTasks, nil
}

// getAllPVCs retrieves all PVCs from current namespace
func (d *PVCDetector) getAllPVCs() ([]*corev1.PersistentVolumeClaim, error) {
	pvcList, err := d.client.CoreV1().PersistentVolumeClaims(d.namespace).List(d.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list PVCs in namespace %s: %w", d.namespace, err)
	}

	var allPVCs []*corev1.PersistentVolumeClaim
	for i := range pvcList.Items {
		allPVCs = append(allPVCs, &pvcList.Items[i])
	}

	return allPVCs, nil
}

// getAllPods retrieves all pods from all namespaces
func (d *PVCDetector) getAllPods() ([]*corev1.Pod, error) {
	logger.Debug("Getting all pods from all namespaces")

	podList, err := d.client.CoreV1().Pods(metav1.NamespaceAll).List(d.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	var allPods []*corev1.Pod
	for i := range podList.Items {
		allPods = append(allPods, &podList.Items[i])
	}

	logger.Debugf("Found %d pods in total", len(allPods))
	return allPods, nil
}

// buildPVCUsageMap builds a map of PVC usage from pod specifications
func (d *PVCDetector) buildPVCUsageMap(pods []*corev1.Pod) map[string]bool {
	pvcUsageMap := make(map[string]bool)

	for _, pod := range pods {
		// Skip pods that are already terminated
		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}

		// Check all volumes in pod spec
		for _, volume := range pod.Spec.Volumes {
			if volume.PersistentVolumeClaim != nil {
				pvcKey := fmt.Sprintf("%s/%s", pod.Namespace, volume.PersistentVolumeClaim.ClaimName)
				pvcUsageMap[pvcKey] = true

				logger.Debugf("PVC %s is used by pod %s/%s",
					pvcKey, pod.Namespace, pod.Name)
			}
		}
	}

	return pvcUsageMap
}

// shouldCleanupPVC determines if a PVC should be cleaned up based on timeout threshold
func (d *PVCDetector) shouldCleanupPVC(pvc *corev1.PersistentVolumeClaim, now time.Time) bool {
	// Check timeout threshold
	age := now.Sub(pvc.CreationTimestamp.Time)
	if age < d.unusedThreshold {
		logger.Debugf("PVC %s/%s has not exceeded timeout threshold (%v < %v)",
			pvc.Namespace, pvc.Name, age, d.unusedThreshold)
		return false
	}

	return true
}

// getCleanupReason returns the reason why this PVC should be cleaned up
func (d *PVCDetector) getCleanupReason(pvc *corev1.PersistentVolumeClaim, now time.Time) string {
	age := now.Sub(pvc.CreationTimestamp.Time)
	return fmt.Sprintf("unused for %v (threshold: %v)", age, d.unusedThreshold)
}
