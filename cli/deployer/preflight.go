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
	return s.d.resolveChartRefs()
}
