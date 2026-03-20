//go:build linux

package deps

import (
	"context"
	"fmt"

	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/dtyq/magicrew-cli/util"
)

type commonToolDep struct{}

func newCommonToolDep() (Dep, error) {
	return &commonToolDep{}, nil
}

type commonCommandPackages map[string]map[util.PackageManagerType][]string

var commonCommands = commonCommandPackages{
	// "docker": {
	// 	util.PackageManagerTypeAPK:    {"docker", "docker-cli-compose", "docker-cli-buildx"},
	// 	util.PackageManagerTypeDEB:    {"docker.io", "docker-compose", "docker-buildx"},
	// 	util.PackageManagerTypeRPM:    {"docker-ce", "docker-compose-plugin", "docker-buildx-plugin"},
	// 	util.PackageManagerTypePacman: {"docker", "docker-compose", "docker-buildx"},
	// },
	"git": {
		util.PackageManagerTypeAPK:    {"git"},
		util.PackageManagerTypeDEB:    {"git"},
		util.PackageManagerTypeRPM:    {"git"},
		util.PackageManagerTypePacman: {"git"},
	},
}

var distro *util.Distro

func (c *commonToolDep) resolveGit(ctx context.Context, update bool) error {
	var err error
	lg, _ := ctx.Value(util.ContextTypeLoggerGroup{}).(util.LoggerGroup)

	if distro == nil {
		distro, err = util.GetDistro(ctx)
		if err != nil {
			return err
		}
	}

	gitInstalled := false

	// 看看装了没，能不能用
	cmd := util.Command{
		Args: []string{"git", "version"},
	}
	err = cmd.Run(ctx)
	if err == nil {
		lg.Logi("deps", "%s", i18n.L("depInstalled", "git"))
		gitInstalled = true
	}

	if gitInstalled && !update {
		return nil
	}

	// 用系统包管理装一下
	packages, ok := commonCommands["git"][distro.PackageManager]
	if !ok {
		// 没法通过包管理装，直接就失败
		lg.Loge("deps", "%s", i18n.L("cannotDeterminePackages", distro.PackageManager, "git"))
		lg.Loge("deps", "%s", i18n.L("youMayTryInstallItManually", "git"))
		return fmt.Errorf("git not found for package manager: %s", distro.PackageManager)
	}
	if gitInstalled && update {
		err = distro.UpdatePackages(ctx, packages, false)
	} else {
		err = distro.InstallPackages(ctx, packages, false)
	}
	if err != nil {
		return err
	}

	lg.Logi("deps", "%s", i18n.L("depResolved", "common_tool"))
	return nil
}

func (c *commonToolDep) Resolved(ctx context.Context) bool {
	for _, testArgs := range [][]string{
		{"git", "version"},
	} {
		cmd := util.Command{
			Args: testArgs,
		}
		if err := cmd.Run(ctx); err != nil {
			return false
		}
	}
	return true
}

func (c *commonToolDep) Uptodate(ctx context.Context) bool {
	// always up to date
	return true
}

func (c *commonToolDep) Resolve(ctx context.Context) error {
	lg, _ := ctx.Value(util.ContextTypeLoggerGroup{}).(util.LoggerGroup)
	err := c.resolveGit(ctx, false)
	if err != nil {
		return err
	}
	lg.Logi("deps", "%s", i18n.L("depResolved", "common_tool"))
	return nil
}

func (c *commonToolDep) Update(ctx context.Context, updateLatest bool) error {
	lg, _ := ctx.Value(util.ContextTypeLoggerGroup{}).(util.LoggerGroup)
	if !updateLatest {
		// common tools总是latest，所以默认不需要更新
		// 如果updateLatest为true，则继续尝试更新
		lg.Logi("deps", "%s", i18n.L("depsUpdateAlreadyLatest", "common_tool"))
		return nil
	}

	err := c.resolveGit(ctx, true)
	if err != nil {
		return err
	}
	lg.Logi("deps", "%s", i18n.L("depUpdated", "common_tool"))
	return nil
}

func (c *commonToolDep) GetName() string {
	return "common_tool"
}

func (c *commonToolDep) GetVersion() string {
	return "latest"
}

func (c *commonToolDep) GetDependencies() []Dep {
	// 没有依赖
	return []Dep{}
}
