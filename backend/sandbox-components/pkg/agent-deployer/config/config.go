package config

import (
	"fmt"
	"sync"

	"github.com/caarlos0/env/v11"
	"github.com/sirupsen/logrus"
)

var (
	globalConfig *Config
	once         sync.Once
)

type Config struct {
	LogLevel string `env:"LOG_LEVEL" envDefault:"info" json:"logLevel"`

	// Agent configuration
	AgentRepository string `env:"AGENT_REPOSITORY" json:"agentRepository" binding:"required"`
	AgentImageTag   string `env:"AGENT_IMAGE_TAG" json:"agentImageTag" binding:"required"`
	AgentNamespace  string `env:"AGENT_NAMESPACE" json:"agentNamespace" binding:"required"`

	// Webhook server configuration
	WebhookServerAddress string `env:"WEBHOOK_SERVER_ADDRESS" json:"webhookServerAddress" binding:"required"`
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

	return &cfg, nil
}

// GetFullImageName returns the complete image name with repository and tag
func (c *Config) GetFullImageName() string {
	return c.AgentRepository + ":" + c.AgentImageTag
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.AgentRepository == "" {
		return fmt.Errorf("AGENT_REPOSITORY environment variable is required")
	}
	if c.AgentImageTag == "" {
		return fmt.Errorf("AGENT_IMAGE_TAG environment variable is required")
	}
	if c.AgentNamespace == "" {
		return fmt.Errorf("AGENT_NAMESPACE environment variable is required")
	}
	if c.WebhookServerAddress == "" {
		return fmt.Errorf("WEBHOOK_SERVER_ADDRESS environment variable is required")
	}
	return nil
}
