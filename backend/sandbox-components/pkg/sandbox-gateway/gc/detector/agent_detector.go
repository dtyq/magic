package detector

import (
	"context"
	"fmt"
	"time"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// AgentDetector detects expired sandbox pods with exited agents
type AgentDetector struct {
	client           kubernetes.Interface
	expiredThreshold time.Duration
	ctx              context.Context
	namespace        string
}

// NewAgentDetector creates a new Agent detector
func NewAgentDetector(ctx context.Context, client kubernetes.Interface, namespace string, expiredThreshold time.Duration) *AgentDetector {
	return &AgentDetector{
		client:           client,
		expiredThreshold: expiredThreshold,
		ctx:              ctx,
		namespace:        namespace,
	}
}

// Perform executes the detection and cleanup logic for expired sandbox pods with exited agents
func (d *AgentDetector) Perform() error {
	logger.Info("Starting agent detector performance")

	// Detect expired agents
	cleanupTasks, err := d.detectExpiredAgents()
	if err != nil {
		logger.Errorf("Failed to detect expired agents: %v", err)
		return fmt.Errorf("failed to detect expired agents: %w", err)
	}

	if len(cleanupTasks) == 0 {
		logger.Debug("No expired agents found, cleanup not needed")
		return nil
	}

	logger.Infof("Found %d expired agents to cleanup", len(cleanupTasks))

	// Process cleanup tasks
	processed := 0
	for _, task := range cleanupTasks {
		if err := d.processCleanupTask(task); err != nil {
			logger.Errorf("Failed to cleanup pod %s/%s: %v", task.Pod.Namespace, task.Pod.Name, err)
			continue
		}
		processed++
	}

	logger.Infof("Processed %d/%d agent cleanup tasks", processed, len(cleanupTasks))
	return nil
}

// processCleanupTask processes a single agent cleanup task
func (d *AgentDetector) processCleanupTask(task *AgentCleanupTask) error {
	logger.Infof("Processing cleanup for pod %s/%s: %s",
		task.Pod.Namespace, task.Pod.Name, task.CleanupReason)

	// Delete the pod
	deleteOptions := metav1.DeleteOptions{}
	err := d.client.CoreV1().Pods(task.Pod.Namespace).Delete(d.ctx, task.Pod.Name, deleteOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Pod %s/%s already deleted", task.Pod.Namespace, task.Pod.Name)
			return nil
		}
		return fmt.Errorf("failed to delete pod: %w", err)
	}

	logger.Infof("Successfully deleted pod %s/%s", task.Pod.Namespace, task.Pod.Name)
	return nil
}

// detectExpiredAgents detects expired sandbox pods with exited agents that need cleanup
func (d *AgentDetector) detectExpiredAgents() ([]*AgentCleanupTask, error) {
	logger.Info("Starting sandbox pod detection for exited agents")

	var cleanupTasks []*AgentCleanupTask

	// List sandbox pods by label selector
	labelSelector := "app=sandbox"
	podList, err := d.client.CoreV1().Pods(d.namespace).List(d.ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list sandbox pods: %w", err)
	}

	logger.Infof("Found %d sandbox pods in namespace %s", len(podList.Items), d.namespace)

	currentTime := time.Now()

	for _, pod := range podList.Items {
		agentExited := d.hasAgentContainerExited(&pod)
		isRunning := d.isRunning(&pod)

		logger.Debugf("Pod %s/%s: agent exited=%v, is running=%v, phase=%s",
			pod.Namespace, pod.Name, agentExited, isRunning, pod.Status.Phase)

		// Check if agent container has exited OR pod is not running
		shouldCheckExpired := agentExited || !isRunning
		if !shouldCheckExpired {
			continue
		}

		// Check if pod is expired (older than threshold)
		if !d.isExpired(&pod, currentTime) {
			continue
		}

		// Create cleanup task with appropriate reason
		var reason string
		if agentExited {
			reason = fmt.Sprintf("Sandbox pod %s/%s has agent container exited for more than %s",
				pod.Namespace, pod.Name, d.expiredThreshold)
		} else {
			reason = fmt.Sprintf("Sandbox pod %s/%s is not running and expired for more than %s",
				pod.Namespace, pod.Name, d.expiredThreshold)
		}

		cleanupTask := &AgentCleanupTask{
			Pod:           &pod,
			CleanupReason: reason,
			DetectedAt:    currentTime,
		}

		cleanupTasks = append(cleanupTasks, cleanupTask)

		logger.Infof("Detected expired sandbox pod with exited agent: %s/%s, CreatedAt: %s",
			pod.Namespace, pod.Name, pod.CreationTimestamp.Time)
	}

	logger.Infof("Found %d expired sandbox pods for cleanup", len(cleanupTasks))

	return cleanupTasks, nil
}

// hasAgentContainerExited checks if the agent container in sandbox pod has exited
func (d *AgentDetector) hasAgentContainerExited(pod *corev1.Pod) bool {
	// Check container statuses
	for _, containerStatus := range pod.Status.ContainerStatuses {
		// Find the agent container
		if containerStatus.Name == models.ContainerNameAgent {
			// Check if the container has terminated
			if containerStatus.State.Terminated != nil {
				return true
			}
			// Check if the container is not running and not waiting (likely exited)
			if containerStatus.State.Running == nil && containerStatus.State.Waiting == nil {
				return true
			}
		}
	}

	// If agent container not found or not exited, return false
	return false
}

// isExpired checks if a pod is older than the expiration threshold
func (d *AgentDetector) isExpired(pod *corev1.Pod, currentTime time.Time) bool {
	podAge := currentTime.Sub(pod.CreationTimestamp.Time)
	return podAge > d.expiredThreshold
}

// isRunning checks if a pod is in Running phase
func (d *AgentDetector) isRunning(pod *corev1.Pod) bool {
	return pod.Status.Phase == corev1.PodRunning
}
