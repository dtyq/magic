package code

import (
	"context"
	"fmt"

	"go.yaml.in/yaml/v3"
)

type SubtreeSplit struct {
	Prefix   string
	DestPath string
}

type subtreeSpliter interface {
	Split(ctx context.Context, code *Code, subtreeSplit SubtreeSplit, force bool) error
}

type subtreeKind string

type dummySubtreeSpliter struct {
	Kind subtreeKind `yaml:"kind"`
}

func newSubtreeSpliter(node yaml.Node) (subtreeSpliter, error) {
	dummyCfg := dummySubtreeSpliter{}
	err := node.Decode(&dummyCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to decode dummy subtree spliter config: %w", err)
	}

	switch dummyCfg.Kind {
	default:
		return nil, fmt.Errorf("unknown subtree spliter kind: %s", dummyCfg.Kind)
	}
}
