package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/caarlos0/env/v11"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/gc"
	"github.com/joho/godotenv"
	"k8s.io/apimachinery/pkg/api/resource"
)

var (
	globalConfig *Config
	once         sync.Once
)

// Config holds all configuration for the application
type Config struct {
	Port     int    `env:"PORT" envDefault:"39003" json:"port"`
	LogLevel string `env:"LOG_LEVEL" envDefault:"info" json:"logLevel"`

	// K8s client configuration
	KubeConfig string `env:"KUBE_CONFIG" json:"kubeConfig"`

	Namespace string `env:"NAMESPACE" envDefault:"default" json:"namespace"`
	Env       string `env:"APP_ENV" envDefault:"dev" json:"env"`

	// Authentication configuration
	APIToken string `env:"API_TOKEN" json:"apiToken,omitempty"`

	// Magic Gateway authentication configuration
	MagicGatewayBaseURL string `env:"MAGIC_GATEWAY_BASE_URL" json:"magicGatewayBaseURL,omitempty"`
	MagicGatewayAPIKey  string `env:"MAGIC_GATEWAY_API_KEY" json:"magicGatewayAPIKey,omitempty"`

	// Storage type configuration
	StorageType string `env:"STORAGE_TYPE,required" json:"storageType"`

	// TOS storage configuration
	TOSCSIDriver       string `env:"TOS_CSI_DRIVER" json:"tosCSIDriver"`
	TOSSecretName      string `env:"TOS_SECRET_NAME" json:"tosSecretName"`
	TOSSecretNamespace string `env:"TOS_SECRET_NAMESPACE" json:"tosSecretNamespace"`
	TOSURL             string `env:"TOS_URL" json:"tosURL"`
	TOSBucket          string `env:"TOS_BUCKET" json:"tosBucket"`

	// OSS storage configuration
	OSSCSIDriver       string `env:"OSS_CSI_DRIVER" json:"ossCSIDriver"`
	OSSSecretName      string `env:"OSS_SECRET_NAME" json:"ossSecretName"`
	OSSSecretNamespace string `env:"OSS_SECRET_NAMESPACE" json:"ossSecretNamespace"`
	OSSURL             string `env:"OSS_URL" json:"ossURL"`
	OSSBucket          string `env:"OSS_BUCKET" json:"ossBucket"`

	// S3 storage configuration
	S3CSIDriver       string `env:"S3_CSI_DRIVER" json:"s3CSIDriver"`
	S3SecretName      string `env:"S3_SECRET_NAME" json:"s3SecretName"`
	S3SecretNamespace string `env:"S3_SECRET_NAMESPACE" json:"s3SecretNamespace"`
	S3URL             string `env:"S3_URL" json:"s3URL"`
	S3Bucket          string `env:"S3_BUCKET" json:"s3Bucket"`

	// Agent configuration
	AgentPort               int    `env:"AGENT_PORT" envDefault:"8002" json:"agentPort"`
	AgentWorkspaceMountPath string `env:"AGENT_WORKSPACE_MOUNT_PATH" envDefault:"/app/.workspace" json:"agentWorkspaceMountPath"`

	// Fuse Pod configuration
	FusePodNamespace string `env:"FUSE_POD_NAMESPACE" envDefault:"sandbox-system" json:"fusePodNamespace"`

	FuseImage                 string `env:"FUSE_IMAGE,required" json:"fuseImage"`
	FuseMountMaxRetries       int    `env:"FUSE_MOUNT_MAX_RETRIES" envDefault:"30" json:"fuseMountMaxRetries"`
	FuseMountPath             string `env:"FUSE_MOUNT_PATH" envDefault:"/mnt/s3" json:"fuseMountPath"`
	FuseExtraOptions          string `env:"FUSE_EXTRA_OPTIONS" envDefault:"" json:"fuseExtraOptions"`
	FuseLocalSymlinkPath      string `env:"FUSE_LOCAL_SYMLINK_PATH" envDefault:"" json:"fuseLocalSymlinkPath"`
	FuseLocalSymlinkMountPath string `env:"FUSE_LOCAL_SYMLINK_MOUNT_PATH" envDefault:"/tmp/s3fs-local-mounts" json:"fuseLocalSymlinkMountPath"`
	FuseHttpNotifyExcludePath string `env:"FUSE_HTTP_NOTIFY_EXCLUDE_PATH" envDefault:"" json:"fuseHttpNotifyExcludePath"`

	// Playwright configuration
	PlaywrightImage string `env:"PLAYWRIGHT_IMAGE,required" json:"playwrightImage"`

	// ConfigMap names
	SandboxGatewayConfigMapName string `env:"SANDBOX_GATEWAY_CONFIGMAP_NAME" envDefault:"sandbox-gateway" json:"sandboxGatewayConfigMapName"`
	SandboxAgentConfigMapName   string `env:"SANDBOX_AGENT_CONFIGMAP_NAME" envDefault:"super-magic" json:"sandboxAgentConfigMapName"`

	// Image pull secrets configuration
	ImagePullSecretName string `env:"IMAGE_PULL_SECRET_NAME" envDefault:"image-registry" json:"imagePullSecretName"`

	// PVC GC configuration
	PVCGC gc.PVCGCConfig `json:"pvcGC" yaml:"pvcGC"`

	// PV GC configuration
	PVGC gc.PVGCConfig `json:"pvGC" yaml:"pvGC"`

	// Agent GC configuration
	AgentGC gc.AgentGCConfig `json:"agentGC" yaml:"agentGC"`

	// Fuse Pod GC configuration
	FusePodGC gc.FusePodGCConfig `json:"fusePodGC" yaml:"fusePodGC"`

	// Task GC configuration

	// Container resource limits configuration
	// Agent container resources
	AgentCPURequest    string `env:"AGENT_CPU_REQUEST" envDefault:"100m" json:"agentCPURequest"`
	AgentCPULimit      string `env:"AGENT_CPU_LIMIT" envDefault:"2" json:"agentCPULimit"`
	AgentMemoryRequest string `env:"AGENT_MEMORY_REQUEST" envDefault:"300Mi" json:"agentMemoryRequest"`
	AgentMemoryLimit   string `env:"AGENT_MEMORY_LIMIT" envDefault:"2Gi" json:"agentMemoryLimit"`

	// Fuse container resources
	FuseCPURequest    string `env:"FUSE_CPU_REQUEST" envDefault:"100m" json:"fuseCPURequest"`
	FuseCPULimit      string `env:"FUSE_CPU_LIMIT" envDefault:"2" json:"fuseCPULimit"`
	FuseMemoryRequest string `env:"FUSE_MEMORY_REQUEST" envDefault:"300Mi" json:"fuseMemoryRequest"`
	FuseMemoryLimit   string `env:"FUSE_MEMORY_LIMIT" envDefault:"2Gi" json:"fuseMemoryLimit"`

	// Qdrant container resources
	QdrantCPURequest    string `env:"QDRANT_CPU_REQUEST" json:"qdrantCPURequest"`
	QdrantCPULimit      string `env:"QDRANT_CPU_LIMIT" json:"qdrantCPULimit"`
	QdrantMemoryRequest string `env:"QDRANT_MEMORY_REQUEST" json:"qdrantMemoryRequest"`
	QdrantMemoryLimit   string `env:"QDRANT_MEMORY_LIMIT" json:"qdrantMemoryLimit"`
}

func (c *Config) GetKubeConfigPath() string {
	if c.KubeConfig != "" {
		return c.KubeConfig
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".kube", "config")
}

func (c *Config) IsTokenAuthEnabled() bool {
	return c.APIToken != ""
}

func (c *Config) ValidateMagicGatewayConfig() error {
	if c.MagicGatewayBaseURL != "" && c.MagicGatewayAPIKey == "" {
		return fmt.Errorf("MAGIC_GATEWAY_API_KEY is required when MAGIC_GATEWAY_BASE_URL is set")
	}
	return nil
}

func GetConfig() *Config {
	once.Do(func() {
		cfg, err := LoadConfigFromEnv()
		if err != nil {
			panic(fmt.Sprintf("Failed to load config from env: %v", err))
		}
		globalConfig = cfg
	})
	return globalConfig
}

func InitConfig(cfg *Config) {
	globalConfig = cfg
	once.Do(func() {})
}

func LoadConfig() *Config {
	return GetConfig()
}

// LoadEnvFile loads environment variables from .env file
func LoadEnvFile(envFilePath string) error {
	if envFilePath == "" {
		envFilePath = ".env"
	}

	// Check if file exists
	if _, err := os.Stat(envFilePath); os.IsNotExist(err) {
		// .env file doesn't exist, log info and continue with system environment variables
		fmt.Printf("Info: .env file not found at %s, using system environment variables\n", envFilePath)
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to check .env file status at %s: %w", envFilePath, err)
	}

	// Load .env file
	if err := godotenv.Load(envFilePath); err != nil {
		return fmt.Errorf("failed to load .env file from %s: %w", envFilePath, err)
	}

	fmt.Printf("Info: Successfully loaded environment variables from %s\n", envFilePath)
	return nil
}

func LoadConfigFromEnv() (*Config, error) {
	return LoadConfigFromEnvWithFile("")
}

func LoadConfigFromEnvWithFile(envFilePath string) (*Config, error) {
	// First load .env file
	if err := LoadEnvFile(envFilePath); err != nil {
		return nil, fmt.Errorf("failed to load .env file: %w", err)
	}

	cfg := Config{}
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse environment variables: %w", err)
	}

	// Initialize PVC GC with default configuration
	cfg.PVCGC = gc.DefaultPVCGCConfig()

	// Initialize PV GC with default configuration
	cfg.PVGC = gc.DefaultPVGCConfig()

	// Initialize Agent GC with default configuration
	cfg.AgentGC = gc.DefaultAgentGCConfig()

	// Initialize Fuse Pod GC with default configuration
	cfg.FusePodGC = gc.DefaultFusePodGCConfig()

	// Initialize Task GC with default configuration

	// Validate Magic Gateway configuration
	if err := cfg.ValidateMagicGatewayConfig(); err != nil {
		return nil, fmt.Errorf("invalid Magic Gateway configuration: %w", err)
	}

	// Validate overall configuration
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	fmt.Println("Info: Configuration validation passed")
	return &cfg, nil
}

func InitConfigWithEnvFile(envFilePath string) error {
	var initErr error
	once.Do(func() {
		cfg, err := LoadConfigFromEnvWithFile(envFilePath)
		if err != nil {
			initErr = fmt.Errorf("failed to load config from env file %s: %w", envFilePath, err)
			return
		}
		globalConfig = cfg
	})
	return initErr
}

func (c *Config) ValidateStorageType() error {
	validTypes := []string{"tos", "s3", "oss"}
	for _, validType := range validTypes {
		if c.StorageType == validType {
			return nil
		}
	}
	return fmt.Errorf("invalid storage type: %s, valid types are: %v", c.StorageType, validTypes)
}

// ValidateResourceLimits validates container resource configurations
func (c *Config) ValidateResourceLimits() error {
	// Validate Agent resources
	if err := c.validateResourceString(c.AgentCPURequest, "AGENT_CPU_REQUEST"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.AgentCPULimit, "AGENT_CPU_LIMIT"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.AgentMemoryRequest, "AGENT_MEMORY_REQUEST"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.AgentMemoryLimit, "AGENT_MEMORY_LIMIT"); err != nil {
		return err
	}

	// Validate Fuse resources
	if err := c.validateResourceString(c.FuseCPURequest, "FUSE_CPU_REQUEST"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.FuseCPULimit, "FUSE_CPU_LIMIT"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.FuseMemoryRequest, "FUSE_MEMORY_REQUEST"); err != nil {
		return err
	}
	if err := c.validateResourceString(c.FuseMemoryLimit, "FUSE_MEMORY_LIMIT"); err != nil {
		return err
	}

	// Validate Qdrant resources (optional, allow empty values)
	if c.QdrantCPURequest != "" {
		if err := c.validateResourceString(c.QdrantCPURequest, "QDRANT_CPU_REQUEST"); err != nil {
			return err
		}
	}
	if c.QdrantCPULimit != "" {
		if err := c.validateResourceString(c.QdrantCPULimit, "QDRANT_CPU_LIMIT"); err != nil {
			return err
		}
	}
	if c.QdrantMemoryRequest != "" {
		if err := c.validateResourceString(c.QdrantMemoryRequest, "QDRANT_MEMORY_REQUEST"); err != nil {
			return err
		}
	}
	if c.QdrantMemoryLimit != "" {
		if err := c.validateResourceString(c.QdrantMemoryLimit, "QDRANT_MEMORY_LIMIT"); err != nil {
			return err
		}
	}

	return nil
}

// validateResourceString validates that a resource string can be parsed
func (c *Config) validateResourceString(value, fieldName string) error {
	if value == "" {
		return fmt.Errorf("%s cannot be empty", fieldName)
	}
	// Use k8s.io/apimachinery/pkg/api/resource to validate
	_, err := resource.ParseQuantity(value)
	if err != nil {
		return fmt.Errorf("invalid %s value '%s': %w", fieldName, value, err)
	}
	return nil
}

func (c *Config) Validate() error {
	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port: %d", c.Port)
	}

	if c.Namespace == "" {
		return fmt.Errorf("namespace cannot be empty")
	}

	if err := c.ValidateStorageType(); err != nil {
		return fmt.Errorf("storage type validation failed: %w", err)
	}

	// Validate container resource limits
	if err := c.ValidateResourceLimits(); err != nil {
		return fmt.Errorf("resource limits validation failed: %w", err)
	}

	// Validate PVC GC configuration
	if c.PVCGC.CheckInterval <= 0 {
		return fmt.Errorf("PVC GC check interval must be positive")
	}

	if c.PVCGC.UnusedThreshold <= 0 {
		return fmt.Errorf("PVC GC unused threshold must be positive")
	}

	// Validate Fuse Pod GC configuration
	if c.FusePodGC.CheckInterval <= 0 {
		return fmt.Errorf("Fuse Pod GC check interval must be positive")
	}

	if c.FusePodGC.OrphanedThreshold <= 0 {
		return fmt.Errorf("Fuse Pod GC orphaned threshold must be positive")
	}

	return nil
}
