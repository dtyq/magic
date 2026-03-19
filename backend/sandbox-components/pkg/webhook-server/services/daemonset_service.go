package services

import (
	"context"
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"

	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/config"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/logger"
)

// DaemonSetService handles DaemonSet operations
type DaemonSetService struct {
	clientManager *k8s.ClientManager
	namespace     string
	config        *config.Config
}

// NewDaemonSetService creates a new DaemonSet service instance
func NewDaemonSetService(clientManager *k8s.ClientManager, namespace string, cfg *config.Config) *DaemonSetService {
	return &DaemonSetService{
		clientManager: clientManager,
		namespace:     namespace,
		config:        cfg,
	}
}

// CreateOrUpdateImagePullDaemonSet creates or updates a DaemonSet for image pulling
// Returns the old generation of the DaemonSet (0 for newly created DaemonSets)
func (s *DaemonSetService) CreateOrUpdateImagePullDaemonSet(ctx context.Context, namespace, daemonSetName, imageName string) (int64, error) {
	// Try to get existing DaemonSet
	existingDS, err := s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Get(ctx, daemonSetName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Create new DaemonSet
			logger.Infof("DaemonSet %s not found, creating new one in namespace: %s", daemonSetName, namespace)
			err := s.createImagePullDaemonSet(ctx, namespace, daemonSetName, imageName)
			return 0, err // New DaemonSet, return generation 0
		}
		return 0, fmt.Errorf("failed to get DaemonSet: %w", err)
	}

	// DaemonSet exists, save old generation and update it
	oldGeneration := existingDS.Generation
	logger.Infof("Updating existing DaemonSet %s with image: %s in namespace: %s, old generation: %d", daemonSetName, imageName, namespace, oldGeneration)

	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		// Get the latest version of the DaemonSet
		latestDaemonSet, err := s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Get(ctx, daemonSetName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get latest DaemonSet: %w", err)
		}

		// Build the updated DaemonSet spec
		updatedDaemonSet := s.buildImagePullDaemonSet(namespace, daemonSetName, imageName)

		// Preserve the resource version and other metadata from existing DaemonSet
		updatedDaemonSet.ObjectMeta.ResourceVersion = latestDaemonSet.ObjectMeta.ResourceVersion
		updatedDaemonSet.ObjectMeta.UID = latestDaemonSet.ObjectMeta.UID
		updatedDaemonSet.ObjectMeta.CreationTimestamp = latestDaemonSet.ObjectMeta.CreationTimestamp

		// Update the DaemonSet
		_, err = s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Update(ctx, updatedDaemonSet, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update DaemonSet: %w", err)
		}

		logger.Infof("DaemonSet %s updated successfully in namespace: %s", daemonSetName, namespace)
		return nil
	})

	if err != nil {
		return 0, err
	}

	return oldGeneration, nil
}

// buildImagePullDaemonSet builds a DaemonSet object for image pulling
func (s *DaemonSetService) buildImagePullDaemonSet(namespace, name, imageName string) *appsv1.DaemonSet {
	return &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "image-pull",
				"managed-by": "webhook-server",
			},
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app":  "image-pull",
					"name": name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":  "image-pull",
						"name": name,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "image-puller",
							Image: imageName,
							Command: []string{
								"sh", "-c", "echo 'Image pulled successfully' && sleep infinity",
							},
							ImagePullPolicy: corev1.PullIfNotPresent,
						},
					},
					ImagePullSecrets: []corev1.LocalObjectReference{
						{
							Name: s.config.ImagePullSecretName,
						},
					},
					RestartPolicy: corev1.RestartPolicyAlways,
				},
			},
		},
	}
}

// createImagePullDaemonSet creates a new DaemonSet for image pulling
func (s *DaemonSetService) createImagePullDaemonSet(ctx context.Context, namespace, name, imageName string) error {
	logger.Infof("Creating DaemonSet %s for image: %s in namespace: %s", name, imageName, namespace)

	daemonSet := s.buildImagePullDaemonSet(namespace, name, imageName)

	_, err := s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Create(ctx, daemonSet, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create DaemonSet: %w", err)
	}

	logger.Infof("DaemonSet %s created successfully in namespace: %s", name, namespace)
	return nil
}

// deleteDaemonSet deletes a DaemonSet with force deletion
func (s *DaemonSetService) deleteDaemonSet(ctx context.Context, namespace, daemonSetName string) error {
	logger.Infof("Force deleting DaemonSet %s in namespace: %s", daemonSetName, namespace)

	// Configure delete options for immediate deletion
	gracePeriodSeconds := int64(0)
	deleteOptions := metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriodSeconds,
		PropagationPolicy:  &[]metav1.DeletionPropagation{metav1.DeletePropagationForeground}[0],
	}

	// Delete the DaemonSet immediately
	err := s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Delete(ctx, daemonSetName, deleteOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("DaemonSet %s not found in namespace: %s, assuming already deleted", daemonSetName, namespace)
			return nil
		}
		return fmt.Errorf("failed to force delete DaemonSet: %w", err)
	}

	logger.Infof("DaemonSet %s force deleted successfully in namespace: %s", daemonSetName, namespace)
	return nil
}

// WaitForDaemonSetReady waits for DaemonSet to be ready
// oldGeneration: the generation before update (0 for newly created DaemonSets)
func (s *DaemonSetService) WaitForDaemonSetReady(ctx context.Context, namespace, daemonSetName string, oldGeneration int64, timeout time.Duration) error {
	logger.Infof("Waiting for DaemonSet %s to be ready in namespace: %s, old generation: %d", daemonSetName, namespace, oldGeneration)

	return wait.PollUntilContextTimeout(ctx, 5*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		ds, err := s.clientManager.GetClientset().AppsV1().DaemonSets(namespace).Get(ctx, daemonSetName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		// If this is an updated DaemonSet (oldGeneration > 0), first ensure Generation has been updated
		if oldGeneration > 0 && ds.Generation <= oldGeneration {
			logger.Infof("DaemonSet %s generation not updated yet: current %d, old %d in namespace: %s",
				daemonSetName, ds.Generation, oldGeneration, namespace)
			return false, nil
		}

		// Check if DaemonSet is ready (removed ds.Generation == ds.Status.ObservedGeneration condition)
		if ds.Status.DesiredNumberScheduled == ds.Status.NumberReady &&
			ds.Status.NumberReady > 0 &&
			ds.Status.UpdatedNumberScheduled == ds.Status.DesiredNumberScheduled {
			logger.Infof("DaemonSet %s is ready: %d/%d pods ready, generation: %d in namespace: %s",
				daemonSetName, ds.Status.NumberReady, ds.Status.DesiredNumberScheduled, ds.Generation, namespace)
			return true, nil
		}

		logger.Infof("DaemonSet %s not ready yet: %d/%d pods ready, %d updated, generation: %d in namespace: %s",
			daemonSetName, ds.Status.NumberReady, ds.Status.DesiredNumberScheduled, ds.Status.UpdatedNumberScheduled, ds.Generation, namespace)
		return false, nil
	})
}
