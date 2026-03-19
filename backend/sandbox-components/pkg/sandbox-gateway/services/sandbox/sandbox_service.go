package sandbox

import (
	"context"
	"fmt"
	"net/http"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	storageService "github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/storage"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/util"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/template"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type SandboxService struct {
	clientManager  *k8s.ClientManager
	clientset      *kubernetes.Clientset
	builder        *template.Builder
	config         *config.Config
	namespace      string
	storageService *storageService.StorageService
}

func NewSandboxService(clientManager *k8s.ClientManager, config *config.Config) *SandboxService {
	return &SandboxService{
		clientManager:  clientManager,
		clientset:      clientManager.GetClientset(),
		builder:        template.NewBuilder(clientManager, config),
		config:         config,
		namespace:      config.Namespace,
		storageService: storageService.NewStorageService(clientManager.GetClientset(), clientManager, config),
	}
}

func (s *SandboxService) CreateSandbox(req models.SandboxCreateRequest) (*models.SandboxCreateResponse, error) {
	sandboxID := req.GetSandboxID()
	projectID := req.ProjectID
	enableReadiness := req.GetEnableReadiness()
	enableFileNotification := req.GetEnableFileNotification()
	userID := req.GetMagicUserID()
	orgCode := req.GetMagicOrgCode()

	agentPort := int32(s.config.AgentPort)
	logger.Infof("Creating sandbox: sandboxID=%s, projectID=%s, agentPort=%d, enableReadiness=%t, enableFileNotification=%t, userID=%s, orgCode=%s",
		sandboxID, projectID, agentPort, enableReadiness, enableFileNotification, userID, orgCode)

	response, err := s.createSandboxPod(req)
	if err != nil {
		logger.Errorf("Failed to create sandbox pod: sandboxID=%s, projectID=%s, userID=%s, error=%s",
			sandboxID, projectID, userID, err.Error())
		return nil, err
	}

	logger.Infof("Successfully created sandbox: sandboxID=%s, projectID=%s, userID=%s",
		response.SandboxID, projectID, userID)

	return response, nil
}

func (s *SandboxService) createSandboxPod(req models.SandboxCreateRequest) (*models.SandboxCreateResponse, error) {
	sandboxID := req.GetSandboxID()
	projectID := req.ProjectID
	enableReadiness := req.GetEnableReadiness()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create sandbox Pod
	sandboxPod, err := s.newSandboxPod(ctx, req)
	if err != nil {
		logger.Errorf("Failed to create sandbox pod template: %v", err)
		return nil, fmt.Errorf("failed to create pod template: %w", err)
	}

	logger.Infof("Processing sandbox pod with SandboxID: %s, ProjectID: %s, PodName: %s in namespace: %s",
		sandboxID, projectID, sandboxPod.ObjectMeta.Name, sandboxPod.ObjectMeta.Namespace)

	// Try to get existing Pod
	namespace := s.namespace
	existingPod, err := s.clientset.CoreV1().Pods(namespace).Get(ctx, sandboxPod.ObjectMeta.Name, metav1.GetOptions{})

	var resultPod *corev1.Pod

	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Pod does not exist, creating new pod: %s/%s", namespace, sandboxPod.ObjectMeta.Name)

			resultPod, err = s.clientset.CoreV1().Pods(namespace).Create(ctx, sandboxPod.Pod, metav1.CreateOptions{})
			if err != nil {
				logger.Errorf("Failed to create sandbox pod: %v", err)
				return nil, fmt.Errorf("failed to create sandbox pod: %w", err)
			}

			logger.Infof("Successfully created sandbox pod: %s/%s with SandboxID: %s",
				resultPod.ObjectMeta.Namespace, resultPod.ObjectMeta.Name, sandboxID)
		} else {
			return nil, fmt.Errorf("failed to get existing pod: %w", err)
		}
	} else {
		logger.Infof("Pod already exists: %s/%s with SandboxID: %s, current phase: %s",
			existingPod.ObjectMeta.Namespace, existingPod.ObjectMeta.Name, sandboxID, existingPod.Status.Phase)

		// Check if agent container has exited, even if pod is running
		if s.hasAgentContainerExited(existingPod) {
			logger.Infof("Agent container has exited in existing pod %s/%s, recreating sandbox",
				existingPod.ObjectMeta.Namespace, existingPod.ObjectMeta.Name)

			// Use ClientManager's RecreatePod method for clean pod recreation
			resultPod, err = s.clientManager.RecreatePod(ctx, namespace, existingPod, sandboxPod.Pod)
			if err != nil {
				logger.Errorf("Failed to recreate sandbox pod: %v", err)
				return nil, fmt.Errorf("failed to recreate sandbox pod: %w", err)
			}

			logger.Infof("Successfully recreated sandbox pod: %s/%s with SandboxID: %s",
				resultPod.ObjectMeta.Namespace, resultPod.ObjectMeta.Name, sandboxID)
		} else {
			logger.Infof("Agent container is running normally in existing pod %s/%s",
				existingPod.ObjectMeta.Namespace, existingPod.ObjectMeta.Name)
			resultPod = existingPod
		}
	}

	// Wait for pod to reach Running
	runningPod, err := s.clientManager.WaitForPodRunning(ctx, namespace, resultPod.ObjectMeta.Name, 30*time.Second)
	if err != nil {
		logger.Errorf("Failed to wait for pod to reach Running state: %v", err)
		return nil, fmt.Errorf("failed to wait for pod to reach Running state: %w", err)
	}

	// Create Service for the sandbox with Pod as owner
	sandboxService, err := s.newSandboxService(ctx, sandboxID, projectID, runningPod)
	if err != nil {
		logger.Errorf("Failed to create sandbox service template: %v", err)
		return nil, fmt.Errorf("failed to create service template: %w", err)
	}

	// Try to get existing Service
	existingService, err := s.clientset.CoreV1().Services(namespace).Get(ctx, sandboxService.ObjectMeta.Name, metav1.GetOptions{})

	var resultService *corev1.Service

	if err != nil {
		if errors.IsNotFound(err) {
			logger.Infof("Service does not exist, creating new service: %s/%s", namespace, sandboxService.ObjectMeta.Name)

			resultService, err = s.clientset.CoreV1().Services(namespace).Create(ctx, sandboxService, metav1.CreateOptions{})
			if err != nil {
				logger.Errorf("Failed to create sandbox service: %v", err)
				return nil, fmt.Errorf("failed to create sandbox service: %w", err)
			}

			logger.Infof("Successfully created sandbox service: %s/%s with SandboxID: %s",
				resultService.ObjectMeta.Namespace, resultService.ObjectMeta.Name, sandboxID)
		} else {
			return nil, fmt.Errorf("failed to get existing service: %w", err)
		}
	} else {
		logger.Infof("Service already exists: %s/%s with SandboxID: %s",
			existingService.ObjectMeta.Namespace, existingService.ObjectMeta.Name, sandboxID)
		resultService = existingService
	}

	// Perform agent health check only if enableReadiness is true
	if enableReadiness {
		if err := s.waitForAgentHealth(ctx, namespace, sandboxID); err != nil {
			logger.Errorf("Failed to wait for agent health: %v", err)
			return nil, fmt.Errorf("failed to wait for agent health: %w", err)
		}
	} else {
		logger.Infof("Skipping agent health check for sandbox: %s (enableReadiness=false)", sandboxID)
	}

	response := &models.SandboxCreateResponse{
		Namespace: resultPod.ObjectMeta.Namespace,
		PodName:   resultPod.ObjectMeta.Name,
		SandboxID: sandboxID,
	}

	return response, nil
}

func (s *SandboxService) GetSandboxStatus(sandboxID string, namespace string) (*models.SandboxStatusResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	podName := models.BuildPodName(sandboxID)

	pod, err := s.clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		logger.Errorf("Failed to get sandbox pod %s/%s: %v", namespace, podName, err)
		return nil, err
	}

	status := string(pod.Status.Phase)

	response := &models.SandboxStatusResponse{
		SandboxID: sandboxID,
		Status:    status,
	}

	return response, nil
}

func (s *SandboxService) GetBatchSandboxStatus(sandboxIDs []string, namespace string) (models.BatchSandboxStatusResponse, error) {
	responses := make([]models.SandboxStatusResponse, 0, len(sandboxIDs))

	for _, sandboxID := range sandboxIDs {
		response, err := s.GetSandboxStatus(sandboxID, namespace)
		if err != nil {
			continue
		}
		responses = append(responses, *response)
	}

	return models.BatchSandboxStatusResponse(responses), nil
}

func (s *SandboxService) newSandboxPod(ctx context.Context, req models.SandboxCreateRequest) (*models.SandboxPod, error) {
	pod, err := s.builder.BuildSandboxPod(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to build sandbox pod: %w", err)
	}
	return models.NewSandboxPod(pod), nil
}

func (s *SandboxService) newSandboxService(ctx context.Context, sandboxID, projectID string, ownerPod *corev1.Pod) (*corev1.Service, error) {
	service, err := s.builder.BuildSandboxService(ctx, sandboxID, projectID, ownerPod)
	if err != nil {
		return nil, fmt.Errorf("failed to build sandbox service: %w", err)
	}
	return service, nil
}

func (s *SandboxService) waitForAgentHealth(ctx context.Context, namespace, sandboxID string) error {
	agentPort := s.config.AgentPort
	serviceName := fmt.Sprintf("sandbox-%s", sandboxID)

	logger.Infof("Starting health check for agent: sandboxID=%s, serviceName=%s", sandboxID, serviceName)

	// Build health check URL using service name
	healthURL := util.BuildServiceURL(serviceName, namespace, agentPort, "/api/health")

	// Wait for agent health check to pass
	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: 2 * time.Second,
	}

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for agent health check")
		case <-ticker.C:
			// Perform health check
			resp, err := client.Get(healthURL)
			if err != nil {
				logger.Infof("Health check failed for %s: %v", healthURL, err)
				continue
			}
			resp.Body.Close()

			if resp.StatusCode == 200 {
				logger.Infof("Agent health check passed: sandboxID=%s, serviceName=%s, healthURL=%s",
					sandboxID, serviceName, healthURL)
				return nil
			}

			logger.Debugf("Health check returned status: %d for %s", resp.StatusCode, healthURL)
		}
	}
}

// hasAgentContainerExited checks if the agent container in sandbox pod has exited
func (s *SandboxService) hasAgentContainerExited(pod *corev1.Pod) bool {
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
	return false
}
