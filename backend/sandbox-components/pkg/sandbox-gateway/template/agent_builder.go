package template

import (
	"context"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/models"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/auth"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/storage"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type Builder struct {
	authClient    *auth.AuthClient
	clientManager *k8s.ClientManager
	config        *config.Config
}

func NewBuilder(clientManager *k8s.ClientManager, config *config.Config) *Builder {
	return &Builder{
		authClient:    auth.NewAuthClient(config),
		clientManager: clientManager,
		config:        config,
	}
}

// buildResourceRequirements creates ResourceRequirements from config strings
func (b *Builder) buildResourceRequirements(cpuRequest, cpuLimit, memoryRequest, memoryLimit string) (corev1.ResourceRequirements, error) {
	resources := corev1.ResourceRequirements{
		Requests: make(corev1.ResourceList),
		Limits:   make(corev1.ResourceList),
	}

	// Parse CPU request
	if cpuRequest != "" {
		cpuReq, err := resource.ParseQuantity(cpuRequest)
		if err != nil {
			return resources, fmt.Errorf("failed to parse CPU request '%s': %w", cpuRequest, err)
		}
		resources.Requests[corev1.ResourceCPU] = cpuReq
	}

	// Parse CPU limit
	if cpuLimit != "" {
		cpuLim, err := resource.ParseQuantity(cpuLimit)
		if err != nil {
			return resources, fmt.Errorf("failed to parse CPU limit '%s': %w", cpuLimit, err)
		}
		resources.Limits[corev1.ResourceCPU] = cpuLim
	}

	// Parse Memory request
	if memoryRequest != "" {
		memReq, err := resource.ParseQuantity(memoryRequest)
		if err != nil {
			return resources, fmt.Errorf("failed to parse memory request '%s': %w", memoryRequest, err)
		}
		resources.Requests[corev1.ResourceMemory] = memReq
	}

	// Parse Memory limit
	if memoryLimit != "" {
		memLim, err := resource.ParseQuantity(memoryLimit)
		if err != nil {
			return resources, fmt.Errorf("failed to parse memory limit '%s': %w", memoryLimit, err)
		}
		resources.Limits[corev1.ResourceMemory] = memLim
	}

	return resources, nil
}

func (b *Builder) BuildSandboxPod(ctx context.Context, req models.SandboxCreateRequest) (*corev1.Pod, error) {
	sandboxID := req.GetSandboxID()
	projectID := req.ProjectID
	projectOSSPath := req.GetProjectOSSPath()
	needWorkspaceStorage := projectOSSPath != ""

	podName := models.BuildPodName(sandboxID)
	namespace := b.config.Namespace

	var containers []corev1.Container

	// Add fuse container first if storage is needed
	if needWorkspaceStorage {
		fuseContainer, err := b.buildFuseContainer(ctx, sandboxID, projectOSSPath)
		if err != nil {
			return nil, fmt.Errorf("failed to build fuse container: %w", err)
		}
		containers = append(containers, fuseContainer)
	}

	// Add playwright container after fuse (if storage is needed) so it can access mounted files
	playwrightContainer, err := b.buildPlaywrightContainer(ctx, needWorkspaceStorage)
	if err != nil {
		return nil, fmt.Errorf("failed to build playwright container: %w", err)
	}
	containers = append(containers, playwrightContainer)

	// Add agent container last
	agentContainer, err := b.buildAgentContainer(ctx, req, needWorkspaceStorage)
	if err != nil {
		return nil, fmt.Errorf("failed to build agent container: %w", err)
	}
	containers = append(containers, agentContainer)

	// Temporarily disable qdrant container
	// qdrantContainer, err := b.buildQdrantContainer(ctx)
	// if err != nil {
	//	return nil, fmt.Errorf("failed to build qdrant container: %w", err)
	// }
	// containers = append(containers, qdrantContainer)

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":                        "sandbox",
				"sandbox-id":                 sandboxID,
				"project-id":                 projectID,
				"managed-by":                 "sandbox-gateway",
				"app.kubernetes.io/instance": fmt.Sprintf("sandbox-%s", sandboxID),
				"app.kubernetes.io/name":     "sandbox",
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers:    containers,
			ImagePullSecrets: []corev1.LocalObjectReference{
				{
					Name: b.config.ImagePullSecretName,
				},
			},
			Volumes: b.buildPodVolumes(sandboxID, needWorkspaceStorage),
		},
	}

	logger.Infof("Built sandbox pod template: podName=%s, sandboxID=%s, projectID=%s, needWorkspaceStorage=%t, containers=%d",
		podName, sandboxID, projectID, needWorkspaceStorage, len(containers))

	return pod, nil
}

func (b *Builder) buildFuseContainer(ctx context.Context, sandboxID string, projectOSSPath string) (corev1.Container, error) {
	var bucket, url, secretName string
	storageType := storage.StorageType(b.config.StorageType)
	switch storageType {
	case storage.StorageTypeS3:
		bucket = b.config.S3Bucket
		url = b.config.S3URL
		secretName = b.config.S3SecretName
	case storage.StorageTypeTOS:
		bucket = b.config.TOSBucket
		url = b.config.TOSURL
		secretName = b.config.TOSSecretName
	case storage.StorageTypeOSS:
		bucket = b.config.OSSBucket
		url = b.config.OSSURL
		secretName = b.config.OSSSecretName
	default:
		return corev1.Container{}, fmt.Errorf("unsupported storage type: %s", b.config.StorageType)
	}

	if bucket == "" || url == "" || secretName == "" {
		return corev1.Container{}, fmt.Errorf("incomplete storage configuration for type: %s", b.config.StorageType)
	}

	envVars := []corev1.EnvVar{
		{
			Name:  "S3_BUCKET",
			Value: bucket,
		},
		{
			Name:  "S3_PATH",
			Value: projectOSSPath,
		},
		{
			Name:  "S3_URL",
			Value: url,
		},
		{
			Name:  "aliyun_logs_sandbox",
			Value: "stdout",
		},
	}

	postStartScript := fmt.Sprintf(`
LOG_FILE="/tmp/poststart.log"
exec > "$LOG_FILE" 2>&1

echo "PostStart: Waiting for s3fs mount to complete..."
echo "PostStart: Start time: $(date)"
MOUNT_PATH="%s"
MAX_RETRIES=%d

for i in $(seq 1 $MAX_RETRIES); do
  if mountpoint -q "$MOUNT_PATH"; then
    echo "PostStart: Path is a mount point: $MOUNT_PATH"
    # Check if it's an s3fs mount
    MOUNT_TYPE=$(mount | grep "$MOUNT_PATH" | grep -o 'type [^ ]*' | cut -d' ' -f2)
    echo "PostStart: Mount type: $MOUNT_TYPE"
    if echo "$MOUNT_TYPE" | grep -q "fuse.s3fs"; then
      echo "PostStart: Verified s3fs mount successfully"
      if touch "$MOUNT_PATH/.mount_test" 2>/dev/null; then
        rm -f "$MOUNT_PATH/.mount_test"
        echo "PostStart: Mount point read-write test passed"
        echo "PostStart: End time: $(date)"
        exit 0
      else
        echo "PostStart: Mount point not writable, continuing to wait..."
      fi
    else
      echo "PostStart: Not an s3fs mount, continuing to wait..."
    fi
  fi
  echo "PostStart: Waiting for s3fs mount... ($i/$MAX_RETRIES)"
  sleep 0.3
done

echo "PostStart: Wait timeout, s3fs mount failed"
echo "PostStart: End time: $(date)"
exit 1`, b.config.FuseMountPath, b.config.FuseMountMaxRetries)

	// Build extra s3fs options
	extraOptions := ""
	if b.config.FuseExtraOptions != "" {
		extraOptions = fmt.Sprintf(" \\\n  %s", b.config.FuseExtraOptions)
	}

	// Build http_notify_exclude_path option
	httpNotifyExcludePathOption := b.buildHttpNotifyExcludePathOption()

	// Build local_symlink_path option
	localSymlinkPathOption := b.buildLocalSymlinkPathOption()

	startupScript := fmt.Sprintf(`
echo "StartupScript: Initializing S3 FUSE mount - Bucket: ${S3_BUCKET}, Path: ${S3_PATH}"

echo "StartupScript: Setting up s3fs credentials and configuration..."
mkdir -p /etc/s3fs
echo "${S3_BUCKET}:$(cat /tmp/s3fs/credentials/akId):$(cat /tmp/s3fs/credentials/akSecret)" > /etc/s3fs/credentials
chmod 600 /etc/s3fs/credentials

echo "StartupScript: Starting s3fs mount to %s..."

# Use double quotes to protect variables from shell expansion and prevent command injection
exec /usr/bin/s3fs -f "${S3_BUCKET}:${S3_PATH}" %s \
  -o url="${S3_URL}" \
  -o dbglevel=info \
  -o passwd_file=/etc/s3fs/credentials \
  -o http_notify_url=127.0.0.1:%d/api/v1/files/notifications%s%s \
  -o compat_dir \
  -o allow_other,umask=022%s`, b.config.FuseMountPath, b.config.FuseMountPath, b.config.AgentPort, httpNotifyExcludePathOption, localSymlinkPathOption, extraOptions)

	// Build resource requirements
	resources, err := b.buildResourceRequirements(
		b.config.FuseCPURequest,
		b.config.FuseCPULimit,
		b.config.FuseMemoryRequest,
		b.config.FuseMemoryLimit,
	)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to build fuse resource requirements: %w", err)
	}

	container := corev1.Container{
		Name:            models.ContainerNameFuse,
		Image:           b.config.FuseImage,
		ImagePullPolicy: corev1.PullIfNotPresent,
		Env:             envVars,
		SecurityContext: &corev1.SecurityContext{
			Privileged: &[]bool{true}[0],
			Capabilities: &corev1.Capabilities{
				Add: []corev1.Capability{"SYS_ADMIN"},
			},
		},
		VolumeMounts: b.buildFuseVolumeMounts(),
		Command:      []string{"/usr/bin/tini", "--"},
		Args:         []string{"/bin/sh", "-c", startupScript},
		Lifecycle: &corev1.Lifecycle{
			PostStart: &corev1.LifecycleHandler{
				Exec: &corev1.ExecAction{
					Command: []string{"/bin/sh", "-c", postStartScript},
				},
			},
		},
		Resources: resources,
	}

	if b.config.FuseExtraOptions != "" {
		logger.Infof("Built fuse container for sandboxID: %s, bucket: %s, url: %s, extraOptions: %s",
			sandboxID, bucket, url, b.config.FuseExtraOptions)
	} else {
		logger.Infof("Built fuse container for sandboxID: %s, bucket: %s, url: %s", sandboxID, bucket, url)
	}
	return container, nil
}

func (b *Builder) buildAgentContainer(ctx context.Context, req models.SandboxCreateRequest, needWorkspaceStorage bool) (corev1.Container, error) {
	sandboxID := req.GetSandboxID()
	userID := req.GetMagicUserID()
	orgCode := req.GetMagicOrgCode()

	envVars := []corev1.EnvVar{
		{
			Name:  "APP_ENV",
			Value: b.config.Env,
		},
		{
			Name:  "SANDBOX_ID",
			Value: sandboxID,
		},
		{
			Name:  "aliyun_logs_sandbox",
			Value: "stdout",
		},
	}

	agentImage, err := b.getAgentImageFromConfigMap(ctx)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to get agent image from ConfigMap: %w", err)
	}

	logger.Infof("Building agent container with image: %s for sandboxID: %s, userID: %s, orgCode: %s",
		agentImage, sandboxID, userID, orgCode)

	authToken, err := b.authClient.GetAuthToken(ctx, userID, orgCode)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to get authentication token: %w", err)
	}

	if authToken != "" {
		envVars = append(envVars, corev1.EnvVar{
			Name:  "MAGIC_AUTHORIZATION",
			Value: authToken,
		})
	}

	// Build resource requirements
	resources, err := b.buildResourceRequirements(
		b.config.AgentCPURequest,
		b.config.AgentCPULimit,
		b.config.AgentMemoryRequest,
		b.config.AgentMemoryLimit,
	)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to build agent resource requirements: %w", err)
	}

	container := corev1.Container{
		Name:  models.ContainerNameAgent,
		Image: agentImage,
		Env:   envVars,
		EnvFrom: []corev1.EnvFromSource{
			{
				ConfigMapRef: &corev1.ConfigMapEnvSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: b.config.SandboxAgentConfigMapName,
					},
				},
			},
		},
		VolumeMounts:    b.buildAgentVolumeMounts(needWorkspaceStorage),
		ImagePullPolicy: corev1.PullIfNotPresent,
		Resources:       resources,
	}

	// Add PostStart lifecycle hook to check workspace mount point when storage is needed
	if needWorkspaceStorage {
		container.Lifecycle = b.buildAgentLifecycle()
	}

	return container, nil
}

func (b *Builder) buildQdrantContainer(ctx context.Context) (corev1.Container, error) {
	qdrantImage, err := b.getQdrantImageFromConfigMap(ctx)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to get qdrant image from configmap: %w", err)
	}

	// Build resource requirements
	resources, err := b.buildResourceRequirements(
		b.config.QdrantCPURequest,
		b.config.QdrantCPULimit,
		b.config.QdrantMemoryRequest,
		b.config.QdrantMemoryLimit,
	)
	if err != nil {
		return corev1.Container{}, fmt.Errorf("failed to build qdrant resource requirements: %w", err)
	}

	return corev1.Container{
		Name:            models.ContainerNameQdrant,
		Image:           qdrantImage,
		ImagePullPolicy: corev1.PullIfNotPresent,
		Env: []corev1.EnvVar{
			{
				Name:  "aliyun_logs_sandbox",
				Value: "stdout",
			},
		},
		Resources: resources,
	}, nil
}

func (b *Builder) buildPlaywrightContainer(ctx context.Context, needWorkspaceStorage bool) (corev1.Container, error) {
	startupScript := `cd /home/pwuser
exec npx -y playwright@1.57.0 run-server --port 3000`

	container := corev1.Container{
		Name:            models.ContainerNamePlaywright,
		Image:           b.config.PlaywrightImage,
		ImagePullPolicy: corev1.PullAlways,
		Command:         []string{"/usr/bin/tini", "--"},
		Args:            []string{"/bin/sh", "-c", startupScript},
		Env: []corev1.EnvVar{
			{
				Name:  "aliyun_logs_sandbox",
				Value: "stdout",
			},
		},
		VolumeMounts: b.buildPlaywrightVolumeMounts(needWorkspaceStorage),
	}

	// Add PostStart lifecycle hook to check workspace mount point when storage is needed
	if needWorkspaceStorage {
		container.Lifecycle = b.buildPlaywrightLifecycle()
	}

	logger.Infof("Built playwright container with image: %s", b.config.PlaywrightImage)
	return container, nil
}

// getAgentImageFromConfigMap retrieves the agent image from the ConfigMap
func (b *Builder) getAgentImageFromConfigMap(ctx context.Context) (string, error) {
	configMapName := b.config.SandboxGatewayConfigMapName
	namespace := b.config.Namespace

	configMap, err := b.clientManager.GetClientset().CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get configmap %s in namespace %s: %w", configMapName, namespace, err)
	}

	agentImage, exists := configMap.Data["AGENT_IMAGE"]
	if !exists {
		return "", fmt.Errorf("AGENT_IMAGE key not found in configmap %s", configMapName)
	}

	if agentImage == "" {
		return "", fmt.Errorf("AGENT_IMAGE value is empty in configmap %s", configMapName)
	}

	logger.Infof("Retrieved agent image from ConfigMap: %s", agentImage)
	return agentImage, nil
}

// getQdrantImageFromConfigMap retrieves the qdrant image from the ConfigMap
func (b *Builder) getQdrantImageFromConfigMap(ctx context.Context) (string, error) {
	configMapName := b.config.SandboxGatewayConfigMapName
	namespace := b.config.Namespace

	configMap, err := b.clientManager.GetClientset().CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get configmap %s in namespace %s: %w", configMapName, namespace, err)
	}

	qdrantImage, exists := configMap.Data["QDRANT_IMAGE"]
	if !exists {
		return "", fmt.Errorf("QDRANT_IMAGE key not found in configmap %s", configMapName)
	}

	if qdrantImage == "" {
		return "", fmt.Errorf("QDRANT_IMAGE value is empty in configmap %s", configMapName)
	}

	logger.Infof("Retrieved qdrant image from ConfigMap: %s", qdrantImage)
	return qdrantImage, nil
}

func (b *Builder) buildPodVolumes(sandboxID string, needWorkspaceStorage bool) []corev1.Volume {
	var volumes []corev1.Volume

	if needWorkspaceStorage {
		volumes = append(volumes, corev1.Volume{
			Name: models.VolumeNameSharedStorage,
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		})

		secretName := b.getStorageSecretName()
		if secretName != "" {
			volumes = append(volumes, corev1.Volume{
				Name: models.VolumeNameS3Credentials,
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName: secretName,
					},
				},
			})
		}

		volumes = append(volumes, corev1.Volume{
			Name: models.VolumeNameDevFuse,
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/dev/fuse",
					Type: &[]corev1.HostPathType{corev1.HostPathType("CharDevice")}[0],
				},
			},
		})

		// Add local symlink mounts volume if local symlink path is configured
		if b.config.FuseLocalSymlinkPath != "" {
			volumes = append(volumes, corev1.Volume{
				Name: models.VolumeNameLocalSymlinkMounts,
				VolumeSource: corev1.VolumeSource{
					EmptyDir: &corev1.EmptyDirVolumeSource{},
				},
			})
		}
	}

	return volumes
}

func (b *Builder) buildAgentVolumeMounts(needWorkspaceStorage bool) []corev1.VolumeMount {
	var volumeMounts []corev1.VolumeMount

	if needWorkspaceStorage {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      models.VolumeNameSharedStorage,
			MountPath: b.config.AgentWorkspaceMountPath,
			ReadOnly:  false,
		})

		// Add local symlink mounts volume mount if local symlink path is configured
		if b.config.FuseLocalSymlinkPath != "" {
			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      models.VolumeNameLocalSymlinkMounts,
				MountPath: b.config.FuseLocalSymlinkMountPath,
				ReadOnly:  false,
			})
		}
	}

	return volumeMounts
}

// buildPlaywrightVolumeMounts builds volume mounts for the playwright container
func (b *Builder) buildPlaywrightVolumeMounts(needWorkspaceStorage bool) []corev1.VolumeMount {
	var volumeMounts []corev1.VolumeMount

	if needWorkspaceStorage {
		// Mount the same shared storage as agent container so playwright can access files
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      models.VolumeNameSharedStorage,
			MountPath: b.config.AgentWorkspaceMountPath,
			ReadOnly:  true, // Playwright only needs read access
		})
	}

	return volumeMounts
}

// BuildSandboxService creates a Service for the sandbox
func (b *Builder) BuildSandboxService(ctx context.Context, sandboxID, projectID string, ownerPod *corev1.Pod) (*corev1.Service, error) {
	serviceName := models.BuildPodName(sandboxID) // Keep service name same as pod name
	namespace := b.config.Namespace

	// Set up owner reference to Pod
	ownerRef := metav1.OwnerReference{
		APIVersion: "v1",
		Kind:       "Pod",
		Name:       ownerPod.Name,
		UID:        ownerPod.UID,
		Controller: &[]bool{false}[0], // Service is not controlled by Pod, just owned
	}

	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      serviceName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "sandbox",
				"sandbox-id": sandboxID,
				"project-id": projectID,
				"managed-by": "sandbox-gateway",
			},
			OwnerReferences: []metav1.OwnerReference{ownerRef},
		},
		Spec: corev1.ServiceSpec{
			ClusterIP:                "None", // Headless service
			PublishNotReadyAddresses: true,
			Selector: map[string]string{
				"app":        "sandbox",
				"sandbox-id": sandboxID,
			},
			Ports: []corev1.ServicePort{
				{
					Name:       "agent-http",
					Port:       int32(b.config.AgentPort), // Default 8002
					TargetPort: intstr.FromInt(b.config.AgentPort),
					Protocol:   corev1.ProtocolTCP,
				},
			},
		},
	}

	logger.Infof("Built headless sandbox service template with owner reference: serviceName=%s, sandboxID=%s, projectID=%s, ownerPod=%s",
		serviceName, sandboxID, projectID, ownerPod.Name)

	return service, nil
}

// getStorageSecretName returns the secret name for the current storage type
func (b *Builder) getStorageSecretName() string {
	storageType := storage.StorageType(b.config.StorageType)
	switch storageType {
	case storage.StorageTypeS3:
		return b.config.S3SecretName
	case storage.StorageTypeTOS:
		return b.config.TOSSecretName
	case storage.StorageTypeOSS:
		return b.config.OSSSecretName
	default:
		return ""
	}
}

// buildHttpNotifyExcludePathOption builds the http_notify_exclude_path option for s3fs
// It combines FuseHttpNotifyExcludePath and FuseLocalSymlinkPath
func (b *Builder) buildHttpNotifyExcludePathOption() string {
	var excludePaths []string

	if b.config.FuseHttpNotifyExcludePath != "" {
		excludePaths = append(excludePaths, b.config.FuseHttpNotifyExcludePath)
	}

	if b.config.FuseLocalSymlinkPath != "" {
		excludePaths = append(excludePaths, b.config.FuseLocalSymlinkPath)
	}

	if len(excludePaths) == 0 {
		return ""
	}

	combinedPaths := strings.Join(excludePaths, ":")
	return fmt.Sprintf(" \\\n  -o http_notify_exclude_path=%s", combinedPaths)
}

// buildLocalSymlinkPathOption builds the local_symlink_path option for s3fs
func (b *Builder) buildLocalSymlinkPathOption() string {
	if b.config.FuseLocalSymlinkPath == "" {
		return ""
	}
	return fmt.Sprintf(" \\\n  -o local_symlink_path=%s", b.config.FuseLocalSymlinkPath)
}

// buildFuseVolumeMounts builds volume mounts for the fuse container
func (b *Builder) buildFuseVolumeMounts() []corev1.VolumeMount {
	volumeMounts := []corev1.VolumeMount{
		{
			Name:             models.VolumeNameSharedStorage,
			MountPath:        b.config.FuseMountPath,
			MountPropagation: &[]corev1.MountPropagationMode{corev1.MountPropagationBidirectional}[0],
		},
		{
			Name:      models.VolumeNameS3Credentials,
			MountPath: "/tmp/s3fs/credentials",
			ReadOnly:  true,
		},
		{
			Name:      models.VolumeNameDevFuse,
			MountPath: "/dev/fuse",
		},
	}

	// Add local symlink mounts volume mount if local symlink path is configured
	if b.config.FuseLocalSymlinkPath != "" {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      models.VolumeNameLocalSymlinkMounts,
			MountPath: b.config.FuseLocalSymlinkMountPath,
			ReadOnly:  false,
		})
	}

	return volumeMounts
}

// buildAgentLifecycle builds lifecycle hooks for the agent container
// It checks if the workspace is properly mounted as s3fs before the agent starts
func (b *Builder) buildAgentLifecycle() *corev1.Lifecycle {
	postStartScript := fmt.Sprintf(`
LOG_FILE="/tmp/poststart.log"
exec > "$LOG_FILE" 2>&1

echo "Agent PostStart: Checking workspace s3fs mount point..."
echo "Agent PostStart: Start time: $(date)"
WORKSPACE_PATH="%s"
MAX_RETRIES=%d

for i in $(seq 1 $MAX_RETRIES); do
  if mountpoint -q "$WORKSPACE_PATH"; then
    echo "Agent PostStart: Path is a mount point: $WORKSPACE_PATH"
    # Check if it's an s3fs mount
    MOUNT_TYPE=$(mount | grep "$WORKSPACE_PATH" | grep -o 'type [^ ]*' | cut -d' ' -f2)
    echo "Agent PostStart: Mount type: $MOUNT_TYPE"
    if echo "$MOUNT_TYPE" | grep -q "fuse.s3fs"; then
      echo "Agent PostStart: Verified s3fs mount successfully"
      if [ -r "$WORKSPACE_PATH" ] && [ -w "$WORKSPACE_PATH" ]; then
        echo "Agent PostStart: Workspace is readable and writable"
        echo "Agent PostStart: End time: $(date)"
        exit 0
      else
        echo "Agent PostStart: Workspace is not accessible, continuing to wait..."
      fi
    else
      echo "Agent PostStart: Not an s3fs mount, continuing to wait..."
    fi
  fi
  echo "Agent PostStart: Waiting for s3fs mount... ($i/$MAX_RETRIES)"
  sleep 0.5
done

echo "Agent PostStart: Wait timeout, s3fs mount check failed"
echo "Agent PostStart: End time: $(date)"
exit 1`, b.config.AgentWorkspaceMountPath, b.config.FuseMountMaxRetries)

	return &corev1.Lifecycle{
		PostStart: &corev1.LifecycleHandler{
			Exec: &corev1.ExecAction{
				Command: []string{"/bin/sh", "-c", postStartScript},
			},
		},
	}
}

// buildPlaywrightLifecycle builds lifecycle hooks for the playwright container
// It checks if the workspace is properly mounted as s3fs before playwright starts
func (b *Builder) buildPlaywrightLifecycle() *corev1.Lifecycle {
	postStartScript := fmt.Sprintf(`
LOG_FILE="/tmp/playwright-poststart.log"
exec > "$LOG_FILE" 2>&1

echo "Playwright PostStart: Checking workspace s3fs mount point..."
echo "Playwright PostStart: Start time: $(date)"
WORKSPACE_PATH="%s"
MAX_RETRIES=%d

for i in $(seq 1 $MAX_RETRIES); do
  if mountpoint -q "$WORKSPACE_PATH"; then
    echo "Playwright PostStart: Path is a mount point: $WORKSPACE_PATH"
    # Check if it's an s3fs mount
    MOUNT_TYPE=$(mount | grep "$WORKSPACE_PATH" | grep -o 'type [^ ]*' | cut -d' ' -f2)
    echo "Playwright PostStart: Mount type: $MOUNT_TYPE"
    if echo "$MOUNT_TYPE" | grep -q "fuse.s3fs"; then
      echo "Playwright PostStart: Verified s3fs mount successfully"
      if [ -r "$WORKSPACE_PATH" ]; then
        echo "Playwright PostStart: Workspace is readable"
        echo "Playwright PostStart: End time: $(date)"
        exit 0
      else
        echo "Playwright PostStart: Workspace is not accessible, continuing to wait..."
      fi
    else
      echo "Playwright PostStart: Not an s3fs mount, continuing to wait..."
    fi
  fi
  echo "Playwright PostStart: Waiting for s3fs mount... ($i/$MAX_RETRIES)"
  sleep 0.5
done

echo "Playwright PostStart: Wait timeout, s3fs mount check failed"
echo "Playwright PostStart: End time: $(date)"
exit 1`, b.config.AgentWorkspaceMountPath, b.config.FuseMountMaxRetries)

	return &corev1.Lifecycle{
		PostStart: &corev1.LifecycleHandler{
			Exec: &corev1.ExecAction{
				Command: []string{"/bin/sh", "-c", postStartScript},
			},
		},
	}
}
