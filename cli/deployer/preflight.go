package deployer

import (
	"context"
	"fmt"
	"os"

	"github.com/dtyq/magicrew-cli/util"
)

const minDiskSpaceBytes = 40 * 1024 * 1024 * 1024

// PreflightStage checks system preconditions and resolves chart references.
type PreflightStage struct {
	BaseStage
	d *Deployer
}

func newPreflightStage(d *Deployer) *PreflightStage {
	return &PreflightStage{BaseStage: BaseStage{"preflight"}, d: d}
}

func (s *PreflightStage) Exec(ctx context.Context) error {
	dockerCheck := util.Command{Args: []string{"docker", "info"}}
	if err := dockerCheck.Run(ctx); err != nil {
		return fmt.Errorf("Docker is not running. Please start Docker and try again")
	}

	if err := s.ensureDataDirReady(); err != nil {
		s.d.log.Logw("deploy", "%v", err)
	}

	s.checkDiskSpace()

	s.d.log.Logi("deploy", "checking docker daemon network...")
	if err := checkDockerDaemonNetwork(ctx); err != nil {
		s.d.log.Logw("deploy", "%s", err)
	}

	s.d.opts.proxy = inheritEnvProxy(s.d.opts.proxy)
	s.d.opts.proxy.Container.URL = resolveContainerProxy(ctx, s.d.log, s.d.opts.proxy)

	if s.d.opts.proxy.Policy.UseHostProxy && s.d.opts.proxy.Host.URL != "" {
		if err := applyHostProxyForProcess(s.d.opts.proxy.Host.URL, s.d.opts.proxy.Host.NoProxy); err != nil {
			s.d.log.Logw("deploy", "apply host proxy: %v", err)
		}
	}

	if err := patchConfigProxySection(s.d.opts.configFile, s.d.opts.proxy); err != nil {
		s.d.log.Logw("deploy", "persist proxy config: %v", err)
	}

	return s.d.resolveChartRefs()
}

func (s *PreflightStage) ensureDataDirReady() error {
	dataDir := s.d.opts.dataDir

	fi, err := os.Stat(dataDir)
	if err != nil {
		if os.IsNotExist(err) {
			if mkErr := os.MkdirAll(dataDir, 0o755); mkErr != nil {
				return fmt.Errorf("failed to create data dir %s: %w", dataDir, mkErr)
			}
			s.d.log.Logi("deploy", "data dir not found, created: %s", dataDir)
		} else {
			return fmt.Errorf("failed to stat data dir %s: %w", dataDir, err)
		}
	} else if !fi.IsDir() {
		if mkErr := os.MkdirAll(dataDir, 0o755); mkErr != nil {
			return fmt.Errorf("failed to create data dir %s: %w", dataDir, mkErr)
		}
	}
	return nil
}

func (s *PreflightStage) checkDiskSpace() {
	availableBytes, err := util.GetDiskAvailableBytes(s.d.opts.dataDir)
	if err != nil {
		s.d.log.Logw("deploy", "failed to check free disk space: %v", err)
		return
	}
	if availableBytes < minDiskSpaceBytes {
		s.d.log.Logw("deploy", "low disk space: only %s available (recommend >= %s)", util.HumanSize(availableBytes), util.HumanSize(minDiskSpaceBytes))
	}
}
