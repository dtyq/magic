package deployer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
)

// BootstrapRegistryStage ensures the local Docker registry is running.
type BootstrapRegistryStage struct {
	BaseStage
	d *Deployer
}

func newBootstrapRegistryStage(d *Deployer) *BootstrapRegistryStage {
	return &BootstrapRegistryStage{BaseStage: BaseStage{"bootstrap registry"}, d: d}
}

func (s *BootstrapRegistryStage) Exec(ctx context.Context) error {
	cfg := s.d.opts.Registry

	dataDir, err := resolveRegistryDataDir(cfg.DataDir)
	if err != nil {
		return err
	}
	cfg.DataDir = dataDir

	s.d.log.Logi("deploy", "Ensuring registry %s is running at %s...", cfg.Name, registry.HostEndpoint(cfg))
	if err := registry.EnsureRunning(ctx, cfg); err != nil {
		return fmt.Errorf("ensure registry running: %w", err)
	}
	if err := registry.WaitForHostEndpoint(ctx, cfg, 15*time.Second); err != nil {
		return fmt.Errorf("wait registry ready: %w", err)
	}
	return nil
}

func resolveRegistryDataDir(configured string) (string, error) {
	if configured != "" {
		return configured, nil
	}
	var dir string
	err := util.NoSudo(func() error {
		homeDir, e := os.UserHomeDir()
		if e != nil {
			return fmt.Errorf("get home dir: %w", e)
		}
		dir = filepath.Join(homeDir, ".magicrew", "docker", "registry-data")
		if e := os.MkdirAll(dir, 0o755); e != nil {
			return fmt.Errorf("create registry data dir %s: %w", dir, e)
		}
		return nil
	})
	return dir, err
}
