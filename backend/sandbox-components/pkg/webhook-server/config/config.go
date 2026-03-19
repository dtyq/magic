package config

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/caarlos0/env/v11"
	"github.com/sirupsen/logrus"
)

const (
	// Default port for Webhook Server
	DefaultWebhookServerPort = 39006
)

var (
	globalConfig *Config
	once         sync.Once
)

type Config struct {
	BindAddress string `env:"BIND_ADDRESS" envDefault:"0.0.0.0" json:"bindAddress"`
	Port        int    `env:"PORT" envDefault:"39006" json:"port"`
	LogLevel    string `env:"LOG_LEVEL" envDefault:"info" json:"logLevel"`

	KubeConfig string `env:"KUBE_CONFIG" json:"kubeConfig"`

	// Image pull secrets configuration
	ImagePullSecretName string `env:"IMAGE_PULL_SECRET_NAME" envDefault:"image-registry" json:"imagePullSecretName"`
}

func GetConfig() *Config {
	once.Do(func() {
		cfg, err := LoadConfigFromEnv()
		if err != nil {
			logrus.Fatalf("Failed to load config from env: %v", err)
		} else {
			globalConfig = cfg
		}
	})
	return globalConfig
}

func InitConfig(cfg *Config) {
	globalConfig = cfg
	once.Do(func() {})
}

func ResetConfig() {
	globalConfig = nil
	once = sync.Once{}
}

func LoadConfigFromEnv() (*Config, error) {
	cfg := Config{}
	if err := env.Parse(&cfg); err != nil {
		return nil, err
	}

	// Apply default port from constant if not set by environment variable
	if cfg.Port == 0 {
		cfg.Port = DefaultWebhookServerPort
	}

	return &cfg, nil
}

// GetKubeConfigPath returns the kubeconfig path, defaulting to ~/.kube/config if not set
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
