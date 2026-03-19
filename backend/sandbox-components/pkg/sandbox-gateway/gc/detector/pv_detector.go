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

// PVDetector detects PVs that should be cleaned up
type PVDetector struct {
	client            kubernetes.Interface
	ctx               context.Context
	releasedThreshold time.Duration
}

// NewPVDetector creates a new PV detector
func NewPVDetector(ctx context.Context, client kubernetes.Interface, releasedThreshold time.Duration) *PVDetector {
	return &PVDetector{
		client:            client,
		ctx:               ctx,
		releasedThreshold: releasedThreshold,
	}
}

// Perform executes the detection and cleanup logic for released PVs
func (d *PVDetector) Perform() error {
	logger.Debug("Starting PV detector performance")

	// Detect released PVs
	cleanupTasks, err := d.detectReleasedPVs()
	if err != nil {
		logger.Errorf("Failed to detect released PVs: %v", err)
		return fmt.Errorf("failed to detect released PVs: %w", err)
	}

	if len(cleanupTasks) == 0 {
		logger.Debug("No released PVs found, cleanup not needed")
		return nil
	}

	logger.Infof("Found %d released PVs to cleanup", len(cleanupTasks))

	// Process cleanup tasks
	processed := 0
	for _, task := range cleanupTasks {
		if err := d.processCleanupTask(task); err != nil {
			logger.Errorf("Failed to cleanup PV %s: %v", task.PV.Name, err)
			continue
		}
		processed++
	}

	logger.Infof("Processed %d/%d PV cleanup tasks", processed, len(cleanupTasks))
	return nil
}

// processCleanupTask processes a single PV cleanup task
func (d *PVDetector) processCleanupTask(task PVCleanupTask) error {
	logger.Infof("Processing cleanup for PV %s: %s", task.PV.Name, task.CleanupReason)

	// Delete the PV
	deleteOptions := metav1.DeleteOptions{}
	err := d.client.CoreV1().PersistentVolumes().Delete(d.ctx, task.PV.Name, deleteOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("PV %s already deleted", task.PV.Name)
			return nil
		}
		return fmt.Errorf("failed to delete PV: %w", err)
	}

	logger.Infof("Successfully deleted PV %s", task.PV.Name)
	return nil
}

// detectReleasedPVs detects PVs that are in Released state and exceed threshold
func (d *PVDetector) detectReleasedPVs() ([]PVCleanupTask, error) {
	logger.Debug("Starting PV detection")

	// Step 1: Get all PVs
	allPVs, err := d.getAllPVs()
	if err != nil {
		return nil, fmt.Errorf("failed to get all PVs: %w", err)
	}

	logger.Debugf("Found %d total PVs", len(allPVs))

	if len(allPVs) == 0 {
		logger.Debug("No PVs found, skipping detection")
		return nil, nil
	}

	// Step 2: Find released PVs that exceed threshold
	var cleanupTasks []PVCleanupTask
	detectedAt := time.Now()

	for _, pv := range allPVs {
		if pv.Status.Phase == corev1.VolumeReleased {
			if d.shouldCleanupPV(pv, detectedAt) {
				task := PVCleanupTask{
					PV:            pv,
					CleanupReason: d.getCleanupReason(pv, detectedAt),
					DetectedAt:    detectedAt,
				}
				cleanupTasks = append(cleanupTasks, task)

				logger.Debugf("PV %s scheduled for cleanup: %s",
					pv.Name, task.CleanupReason)
			}
		}
	}

	logger.Infof("PV detection completed: %d/%d PVs scheduled for cleanup",
		len(cleanupTasks), len(allPVs))

	return cleanupTasks, nil
}

// getAllPVs retrieves all PVs from the cluster
func (d *PVDetector) getAllPVs() ([]*corev1.PersistentVolume, error) {
	logger.Debug("Getting all PVs from cluster")

	pvList, err := d.client.CoreV1().PersistentVolumes().List(d.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list PVs: %w", err)
	}

	var allPVs []*corev1.PersistentVolume
	for i := range pvList.Items {
		allPVs = append(allPVs, &pvList.Items[i])
	}

	logger.Debugf("Found %d PVs in total", len(allPVs))
	return allPVs, nil
}

// shouldCleanupPV determines if a PV should be cleaned up based on threshold
func (d *PVDetector) shouldCleanupPV(pv *corev1.PersistentVolume, now time.Time) bool {
	// Check threshold based on creation time (as fallback)
	age := now.Sub(pv.CreationTimestamp.Time)
	if age < d.releasedThreshold {
		logger.Debugf("PV %s has not exceeded threshold (%v < %v)",
			pv.Name, age, d.releasedThreshold)
		return false
	}

	return true
}

// getCleanupReason returns the reason why this PV should be cleaned up
func (d *PVDetector) getCleanupReason(pv *corev1.PersistentVolume, now time.Time) string {
	age := now.Sub(pv.CreationTimestamp.Time)
	return fmt.Sprintf("released for %v (threshold: %v)", age, d.releasedThreshold)
}
