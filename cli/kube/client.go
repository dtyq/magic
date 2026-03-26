package kube

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// HasPodsWithImagePullFailure returns true if any pods matching labelSelector in
// namespace have at least one container (init or regular) stuck in ImagePullBackOff
// or ErrImagePull, or if the pod itself is in Failed phase.
func (c *Client) HasPodsWithImagePullFailure(ctx context.Context, namespace, labelSelector string) (bool, error) {
	pods, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return false, fmt.Errorf("list pods (selector=%s): %w", labelSelector, err)
	}
	for _, pod := range pods.Items {
		if podHasImagePullFailure(pod) {
			return true, nil
		}
	}
	return false, nil
}

func podHasImagePullFailure(pod corev1.Pod) bool {
	if pod.Status.Phase == corev1.PodFailed {
		return true
	}
	for _, cs := range pod.Status.InitContainerStatuses {
		if isImagePullFailureReason(cs.State) {
			return true
		}
	}
	for _, cs := range pod.Status.ContainerStatuses {
		if isImagePullFailureReason(cs.State) {
			return true
		}
	}
	return false
}

func isImagePullFailureReason(s corev1.ContainerState) bool {
	if s.Waiting == nil {
		return false
	}
	switch s.Waiting.Reason {
	case "ImagePullBackOff", "ErrImagePull", "CrashLoopBackOff":
		return true
	}
	return false
}

// DeletePodsByLabel deletes all pods in namespace matching labelSelector.
// Not-found errors are silently ignored so the call is idempotent.
// For pods owned by a DaemonSet the controller will immediately recreate them.
func (c *Client) DeletePodsByLabel(ctx context.Context, namespace, labelSelector string) error {
	pods, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return fmt.Errorf("list pods (selector=%s): %w", labelSelector, err)
	}
	for _, pod := range pods.Items {
		if err := c.cs.CoreV1().Pods(namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("delete pod %s/%s: %w", namespace, pod.Name, err)
		}
	}
	return nil
}

// Client wraps a Kubernetes clientset and the rest.Config used to build it.
type Client struct {
	cs     kubernetes.Interface
	config *rest.Config
}

// NewClient builds a Client from raw kubeconfig bytes.
func NewClient(kubeconfig []byte) (*Client, error) {
	cfg, err := clientcmd.RESTConfigFromKubeConfig(kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("parse kubeconfig: %w", err)
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create clientset: %w", err)
	}
	return &Client{cs: cs, config: cfg}, nil
}

// RESTConfig returns the rest.Config used to build this client (for use with Helm etc.).
func (c *Client) RESTConfig() *rest.Config {
	return c.config
}

// EnsureNamespace creates the namespace if it does not exist.
func (c *Client) EnsureNamespace(ctx context.Context, name string) error {
	_, err := c.cs.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err == nil {
		return nil
	}
	if !apierrors.IsNotFound(err) {
		return fmt.Errorf("get namespace %s: %w", name, err)
	}
	ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: name}}
	_, err = c.cs.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("create namespace %s: %w", name, err)
	}
	return nil
}

// GetService returns a service by namespace/name.
func (c *Client) GetService(ctx context.Context, namespace, name string) (*corev1.Service, error) {
	svc, err := c.cs.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get service %s/%s: %w", namespace, name, err)
	}
	return svc, nil
}

// Annotation marking the "standard" StorageClass as managed by magicrew-cli.
// If present, RecreateStandardStorageClass skips delete+create to avoid repeating on every deploy.
const standardStorageClassManagedAnnotation = "magicrew-cli/default-storageclass"
const podWaitPollInterval = 1 * time.Second

// RecreateStandardStorageClass ensures the default "standard" StorageClass is the magicrew-cli
// version (rancher.io/local-path + pathPattern). If it already has our managed annotation, skip.
// Otherwise deletes the existing one if present and creates ours with the annotation.
func (c *Client) RecreateStandardStorageClass(ctx context.Context) error {
	existing, err := c.cs.StorageV1().StorageClasses().Get(ctx, "standard", metav1.GetOptions{})
	if err == nil && existing.Annotations[standardStorageClassManagedAnnotation] == "true" {
		return nil // already our version, no-op
	}
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("get storageclass standard: %w", err)
	}
	if err := c.cs.StorageV1().StorageClasses().Delete(ctx, "standard", metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("delete storageclass standard: %w", err)
	}
	reclaimPolicy := corev1.PersistentVolumeReclaimDelete
	bindingMode := storagev1.VolumeBindingWaitForFirstConsumer
	pathPattern := `{{ with index .PVC.Annotations "volume-path" }}{{ . }}{{ else }}{{ .PVC.Namespace }}/{{ .PVC.Name }}{{ end }}`
	sc := &storagev1.StorageClass{
		ObjectMeta: metav1.ObjectMeta{
			Name: "standard",
			Annotations: map[string]string{
				"storageclass.kubernetes.io/is-default-class": "true",
				standardStorageClassManagedAnnotation:         "true",
			},
		},
		Provisioner:       "rancher.io/local-path",
		ReclaimPolicy:     &reclaimPolicy,
		VolumeBindingMode: &bindingMode,
		Parameters: map[string]string{
			"allowUnsafePathPattern": "true",
			"pathPattern":            pathPattern,
		},
	}
	if _, err := c.cs.StorageV1().StorageClasses().Create(ctx, sc, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("create storageclass standard: %w", err)
	}
	return nil
}

// WaitForPodsScheduled polls until all pods matching labelSelector in the given
// namespace are scheduled, or until the timeout is exceeded.
// This is useful for non-blocking warm-up checks where Ready may take a long time.
func (c *Client) WaitForPodsScheduled(ctx context.Context, namespace, labelSelector string, timeout time.Duration, reporter func([]corev1.Pod)) error {
	deadline := time.Now().Add(timeout)
	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for pods scheduled in %s (selector: %s)", namespace, labelSelector)
		}

		pods, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
		if err != nil {
			return fmt.Errorf("list pods: %w", err)
		}

		if reporter != nil {
			reporter(pods.Items)
		}

		if len(pods.Items) > 0 && allScheduled(pods.Items) {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(podWaitPollInterval):
		}
	}
}

// WaitForPodsReady polls until all pods matching labelSelector in the given
// namespace are Ready, or until the context deadline is exceeded.
// If reporter is non-nil, it is called after each poll with the current pod list.
func (c *Client) WaitForPodsReady(ctx context.Context, namespace, labelSelector string, timeout time.Duration, reporter func([]corev1.Pod)) error {
	deadline := time.Now().Add(timeout)
	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for pods ready in %s (selector: %s)", namespace, labelSelector)
		}

		pods, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
		if err != nil {
			return fmt.Errorf("list pods: %w", err)
		}

		if reporter != nil {
			reporter(pods.Items)
		}

		if len(pods.Items) > 0 && allReady(pods.Items) {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(podWaitPollInterval):
		}
	}
}

func allReady(pods []corev1.Pod) bool {
	for _, pod := range pods {
		if !isPodReadyOrCompleted(pod) {
			return false
		}
	}
	return true
}

func allScheduled(pods []corev1.Pod) bool {
	for _, pod := range pods {
		if !isPodScheduled(pod) {
			return false
		}
	}
	return true
}

func isPodReadyOrCompleted(pod corev1.Pod) bool {
	// Job pods usually end in Succeeded and will never report Ready=True.
	// Treat them as completed so deploy stage waiting can continue.
	if pod.Status.Phase == corev1.PodSucceeded {
		return true
	}
	if pod.Status.Phase != corev1.PodRunning {
		return false
	}
	for _, cond := range pod.Status.Conditions {
		if cond.Type == corev1.PodReady {
			return cond.Status == corev1.ConditionTrue
		}
	}
	return false
}

func isPodScheduled(pod corev1.Pod) bool {
	for _, cond := range pod.Status.Conditions {
		if cond.Type == corev1.PodScheduled {
			return cond.Status == corev1.ConditionTrue
		}
	}
	return false
}
