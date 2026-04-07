package deployer

import (
	"context"
	"fmt"
	"os"
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

	dataDir, err := s.d.resolveRegistryDataDir(cfg.DataDir)
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

func (d *Deployer) resolveRegistryDataDir(configured string) (string, error) {
	if configured != "" {
		return util.NormalizePath(configured), nil
	}
	dir := d.dataPath("docker", "registry-data")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create registry data dir %s: %w", dir, err)
	}
	return dir, nil
}
