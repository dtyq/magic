package deployer

import (
	"context"
	"fmt"

	"github.com/dtyq/magicrew-cli/util"
)

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

	s.d.log.Logi("deploy", "checking docker daemon network...")
	if err := checkDockerDaemonNetwork(ctx); err != nil {
		s.d.log.Logw("deploy", "%s", err)
	}

	s.d.opts.Proxy = inheritEnvProxy(s.d.opts.Proxy)
	s.d.opts.Proxy.Container.URL = resolveContainerProxy(ctx, s.d.log, s.d.opts.Proxy)

	if s.d.opts.Proxy.Policy.UseHostProxy && s.d.opts.Proxy.Host.URL != "" {
		if err := applyHostProxyForProcess(s.d.opts.Proxy.Host.URL, s.d.opts.Proxy.Host.NoProxy); err != nil {
			s.d.log.Logw("deploy", "apply host proxy: %v", err)
		}
	}

	if err := patchConfigProxySection(s.d.opts.ConfigFile, s.d.opts.Proxy); err != nil {
		s.d.log.Logw("deploy", "persist proxy config: %v", err)
	}

	return s.d.resolveChartRefs()
}
