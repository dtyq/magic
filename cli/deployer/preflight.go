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
	if err := CheckDockerDaemonNetwork(ctx); err != nil {
		s.d.log.Logw("deploy", "%s", err)
	}

	plan, err := BuildProxyPlan(ctx)
	if err != nil {
		s.d.log.Logw("deploy", "build proxy plan failed: %v", err)
	} else {
		s.d.proxyPlan = plan
		for _, w := range plan.Warnings {
			s.d.log.Logw("deploy", "%s", w)
		}
		if plan.ContainerProxyURL != "" {
			s.d.log.Logi("deploy", "container proxy selected: %s", maskProxyURLForLog(plan.ContainerProxyURL))
		}
	}
	return s.d.resolveChartRefs()
}
