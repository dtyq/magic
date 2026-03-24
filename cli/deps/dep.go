package deps

import (
	"context"
	"fmt"
)

const (
	LatestVersion = "latest" // no specific version, Update will not be performed if version is latest
)

type Dep interface {
	Resolved(ctx context.Context) bool
	Uptodate(ctx context.Context) bool
	Resolve(ctx context.Context) error
	Update(ctx context.Context, updateLatest bool) error
	GetName() string
	GetVersion() string
	GetDependencies() []Dep
}

type DepData struct {
	Name         string   `yaml:"name"`
	Version      string   `yaml:"version"`
	Dependencies []string `yaml:"dependencies"`
}

func (d *DepData) RegisterDep() error {
	var dep Dep
	var err error
	switch d.Name {
	case "common_tool":
		dep, err = newCommonToolDep()
	default:
		err = fmt.Errorf("unknown dependency: %s", d.Name)
	}

	DepsMap[d.Name] = dep
	return err
}

var DepsMap = make(map[string]Dep)

func InitDepsMap(depsData []DepData) error {
	for _, d := range depsData {
		err := d.RegisterDep()
		if err != nil {
			return fmt.Errorf("error registering dependency: %s", d.Name)
		}
	}
	return nil
}
