package image

import (
	"context"
	"fmt"

	"github.com/moby/buildkit/util/progress/progressui"
	"go.yaml.in/yaml/v3"
)

type BuildOptions struct {
	Push         bool
	Pull         bool
	NoCache      bool
	ProgressMode progressui.DisplayMode // this is only for supported builders
}

type Builder interface {
	Build(ctx context.Context, build Build, buildOptions BuildOptions) (string, error)
	SetOption(option string, value any) error
}

type BuilderKind string

type dummyBuilderConfig struct {
	Kind string `yaml:"kind"`
}

func NewBuilder(node yaml.Node) (Builder, error) {
	dummyCfg := dummyBuilderConfig{}
	err := node.Decode(&dummyCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to decode dummy builder config: %w", err)
	}
	kindString := dummyCfg.Kind

	switch kindString {
	case string(BuilderKindDockerBuildKit):
		return newDockerBuildKitBuilder(node)
	default:
		return nil, fmt.Errorf("unknown builder kind: %s", kindString)
	}
}
