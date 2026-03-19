package k8s

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type ClientManager struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
	restConfig    *rest.Config
}

type ClientConfig struct {
	KubeConfigPath string
}

func NewClientManager(config ClientConfig) (*ClientManager, error) {
	logrus.Info("Initializing Kubernetes client manager")

	kubeConfigPath := config.KubeConfigPath
	if kubeConfigPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			logrus.Debug("Failed to get user home directory, will try in-cluster config")
		} else {
			kubeConfigPath = filepath.Join(home, ".kube", "config")
		}
	}

	// Check if kubeconfig file exists, if not, set kubeConfigPath to empty string
	// This way BuildConfigFromFlags will automatically try in-cluster config
	if _, err := os.Stat(kubeConfigPath); err != nil {
		logrus.Infof("Kubeconfig file not found at %s, will try in-cluster configuration", kubeConfigPath)
		kubeConfigPath = ""
	} else {
		logrus.Infof("Using kubeconfig file: %s", kubeConfigPath)
	}

	logrus.Infof("Attempting to create client config (kubeconfig: %s)", kubeConfigPath)
	restConfig, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create client config: %w", err)
	}

	// Configure client rate limiting and timeout
	// QPS: Maximum queries per second to API server (平均每秒请求数)
	// Burst: Maximum burst for throttle (突发请求数，短时间内允许的最大请求数)
	// Timeout: Global request timeout (全局请求超时时间)
	restConfig.QPS = 100
	restConfig.Burst = 200
	restConfig.Timeout = 30 * time.Second

	logrus.Infof("Kubernetes client configured: QPS=%.0f, Burst=%d, Timeout=%v",
		restConfig.QPS, restConfig.Burst, restConfig.Timeout)

	// Create clientset
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	manager := &ClientManager{
		clientset:     clientset,
		dynamicClient: dynamicClient,
		restConfig:    restConfig,
	}

	if err := manager.ValidateConnection(); err != nil {
		return nil, fmt.Errorf("failed to validate connection: %w", err)
	}

	logrus.Info("Kubernetes client manager initialized successfully")
	return manager, nil
}

func (c *ClientManager) ValidateConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := c.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}

	logrus.Info("Successfully connected to Kubernetes API")
	return nil
}

func (c *ClientManager) GetClientset() *kubernetes.Clientset {
	return c.clientset
}

func (c *ClientManager) WaitForPodRunning(ctx context.Context, namespace, podName string, timeout time.Duration) (*corev1.Pod, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	logrus.Infof("Starting to check pod %s in namespace %s until Running state", podName, namespace)

	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("timeout waiting for pod %s to reach Running state", podName)
		case <-ticker.C:
			pod, err := c.clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
			if err != nil {
				if k8serrors.IsNotFound(err) {
					logrus.Debugf("Pod %s not found yet, waiting for creation", podName)
					continue
				}
				return nil, fmt.Errorf("failed to get pod %s: %w", podName, err)
			}

			logrus.Debugf("Pod %s current phase: %s", podName, pod.Status.Phase)

			switch pod.Status.Phase {
			case corev1.PodRunning:
				logrus.Infof("Pod %s reached Running state", podName)
				return pod, nil
			case corev1.PodFailed:
				return nil, fmt.Errorf("pod %s failed: %s", podName, pod.Status.Message)
			case corev1.PodSucceeded:
				return nil, fmt.Errorf("pod %s completed successfully but is not running", podName)
			default:
				// Continue checking for other phases (Pending, etc.)
				continue
			}
		}
	}
}

// CheckSecretExists checks if a secret exists in the specified namespace
func (c *ClientManager) CheckSecretExists(ctx context.Context, namespace, secretName string) error {
	logrus.Infof("Checking if secret '%s' exists in namespace '%s'", secretName, namespace)

	secret, err := c.clientset.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			logrus.Warnf("Secret '%s' not found in namespace '%s'", secretName, namespace)
			return fmt.Errorf("secret '%s' not found in namespace '%s'", secretName, namespace)
		}
		if k8serrors.IsUnauthorized(err) {
			logrus.Errorf("Unauthorized access when checking secret '%s' in namespace '%s'", secretName, namespace)
			return fmt.Errorf("unauthorized access to secret '%s' in namespace '%s': %w", secretName, namespace, err)
		}
		if k8serrors.IsForbidden(err) {
			logrus.Errorf("Forbidden access when checking secret '%s' in namespace '%s'", secretName, namespace)
			return fmt.Errorf("forbidden access to secret '%s' in namespace '%s': %w", secretName, namespace, err)
		}
		logrus.Errorf("Failed to check secret '%s' in namespace '%s': %v", secretName, namespace, err)
		return fmt.Errorf("failed to check secret '%s' in namespace '%s': %w", secretName, namespace, err)
	}

	logrus.Infof("Secret '%s' exists in namespace '%s' (created: %s)",
		secretName, namespace, secret.CreationTimestamp.Format("2006-01-02 15:04:05"))
	return nil
}

// UpdateConfigMapData updates specific data in a ConfigMap
func (c *ClientManager) UpdateConfigMapData(ctx context.Context, namespace, configMapName, key, value string) error {
	logrus.Infof("Updating ConfigMap %s in namespace %s: %s=%s", configMapName, namespace, key, value)

	// Get current ConfigMap
	configMap, err := c.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get configmap %s in namespace %s: %w", configMapName, namespace, err)
	}

	// Update the data
	if configMap.Data == nil {
		configMap.Data = make(map[string]string)
	}
	configMap.Data[key] = value

	// Update the ConfigMap
	_, err = c.clientset.CoreV1().ConfigMaps(namespace).Update(ctx, configMap, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update configmap %s in namespace %s: %w", configMapName, namespace, err)
	}

	logrus.Infof("Successfully updated ConfigMap %s in namespace %s: %s=%s", configMapName, namespace, key, value)
	return nil
}

// RecreatePod deletes an existing pod and creates a new one with the same spec
func (c *ClientManager) RecreatePod(ctx context.Context, namespace string, oldPod, newPod *corev1.Pod) (*corev1.Pod, error) {
	logrus.Infof("Recreating pod %s/%s", namespace, oldPod.Name)

	// Delete the existing pod
	err := c.clientset.CoreV1().Pods(namespace).Delete(ctx, oldPod.Name, metav1.DeleteOptions{})
	if err != nil {
		logrus.Errorf("Failed to delete pod %s/%s: %v", namespace, oldPod.Name, err)
		return nil, fmt.Errorf("failed to delete pod %s/%s: %w", namespace, oldPod.Name, err)
	}

	logrus.Infof("Successfully deleted pod %s/%s", namespace, oldPod.Name)

	// Wait for pod to be completely deleted
	if err := c.waitForPodDeleted(ctx, namespace, oldPod.Name); err != nil {
		logrus.Errorf("Failed to wait for pod deletion: %v", err)
		return nil, fmt.Errorf("failed to wait for pod deletion: %w", err)
	}

	// Create new pod
	resultPod, err := c.clientset.CoreV1().Pods(namespace).Create(ctx, newPod, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("Failed to create new pod %s/%s: %v", namespace, newPod.Name, err)
		return nil, fmt.Errorf("failed to create new pod %s/%s: %w", namespace, newPod.Name, err)
	}

	logrus.Infof("Successfully recreated pod %s/%s", namespace, resultPod.Name)
	return resultPod, nil
}

// waitForPodDeleted waits for a pod to be completely deleted
func (c *ClientManager) waitForPodDeleted(ctx context.Context, namespace, podName string) error {
	logrus.Infof("Waiting for pod %s/%s to be deleted", namespace, podName)

	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for pod %s/%s to be deleted", namespace, podName)
		case <-ticker.C:
			_, err := c.clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
			if err != nil {
				if k8serrors.IsNotFound(err) {
					logrus.Infof("Pod %s/%s has been successfully deleted", namespace, podName)
					return nil
				}
				logrus.Debugf("Error checking pod deletion status: %v", err)
			}
			logrus.Debugf("Pod %s/%s still exists, continuing to wait", namespace, podName)
		}
	}
}
