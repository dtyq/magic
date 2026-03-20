//go:build linux

package util

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/apparentlymart/go-shquot/shquot"
	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/joho/godotenv"
)

type PackageManagerType string

const (
	PackageManagerTypeUnknown PackageManagerType = "unknown"
	PackageManagerTypeAPK     PackageManagerType = "apk"
	PackageManagerTypeDEB     PackageManagerType = "deb"
	PackageManagerTypeRPM     PackageManagerType = "rpm"
	PackageManagerTypePacman  PackageManagerType = "pacman"
)

type Distro struct {
	Name           string
	Version        string
	IDs            []string
	PackageManager PackageManagerType

	// for rpm distros
	rpmType string
}

const (
	osReleaseFile = "/etc/os-release"
)

var spaceRegex = regexp.MustCompile(`\s+`)

func GetDistro(ctx context.Context) (*Distro, error) {
	distro := &Distro{
		PackageManager: PackageManagerTypeUnknown,
	}

	// for distros we support, there are always lsb /etc/os-release files
	envMap, err := godotenv.Read(osReleaseFile)
	if err != nil {
		return nil, err
	}

	var ok bool
	distro.Name, ok = envMap["NAME"]
	if !ok {
		// TODO: support other distros
		distro.Name = "Unknown"
	}

	distro.Version = "Unknown"
	for _, maybeVersionKey := range []string{"VERSION_ID", "VERSION", "BUILD_ID"} {
		distro.Version, ok = envMap[maybeVersionKey]
		if ok {
			break
		}
	}

	idLikesStr, ok := envMap["ID_LIKE"]
	if !ok {
		idLikesStr = ""
	}
	idLikes := spaceRegex.Split(idLikesStr, -1)

	idStr, ok := envMap["ID"]
	if ok {
		distro.IDs = append(distro.IDs, idStr)
	}
	distro.IDs = append(distro.IDs, idLikes...)
	if len(distro.IDs) > 0 {
		for _, id := range distro.IDs {
			switch id {
			case "ubuntu", "debian", "deepin", "uos", "raspbian", "armbian", "linuxmint":
				distro.PackageManager = PackageManagerTypeDEB
			case "rhel", "fedora", "centos", "rocky", "almalinux", "oraclelinux":
				distro.PackageManager = PackageManagerTypeRPM
				cmd := Command{
					Args: []string{"dnf", "--version"},
				}
				if err := cmd.Run(ctx); err == nil {
					distro.rpmType = "dnf"
				} else {
					cmd := Command{
						Args: []string{"yum", "--version"},
					}
					if err := cmd.Run(ctx); err == nil {
						distro.rpmType = "yum"
					}
				}
			case "arch", "manjaro":
				distro.PackageManager = PackageManagerTypePacman
			case "alpine":
				distro.PackageManager = PackageManagerTypeAPK
			}
		}
	}

	return distro, nil
}

var ErrNoPermissionForPackageManager = errors.New("no permission for package manager")
var (
	// case-based artificial idiot
	apkNoPermissionRegexp    = regexp.MustCompile(`(?i)permission denied`)
	debNoPermissionRegexp    = regexp.MustCompile(`are you root\?`)
	rpmNoPermissionRegexp    = regexp.MustCompile(`(?i)has to be run with superuser privileges`)
	pacmanNoPermissionRegexp = regexp.MustCompile(`(?i)unless you are root`)
)

func (d *Distro) actionPackages(ctx context.Context, verb string, packages []string, confirm bool) error {
	var args []string
	switch d.PackageManager {
	case PackageManagerTypeAPK:
		args = []string{"apk", verb}
		if confirm {
			args = append(args, "--interactive")
		}
	case PackageManagerTypeDEB:
		args = []string{"apt-get", verb}
		if !confirm {
			args = append(args, "--yes")
		}
	case PackageManagerTypeRPM:
		switch d.rpmType {
		case "dnf":
			args = []string{"dnf", verb}
			if !confirm {
				args = append(args, "--assumeyes")
			}
		case "yum":
			args = []string{"yum", verb}
			if !confirm {
				args = append(args, "--assumeyes")
			}
		default:
			return fmt.Errorf("unknown rpm type: %s", d.rpmType)
		}
	case PackageManagerTypePacman:
		args = []string{"pacman", verb}
		if !confirm {
			args = append(args, "--noconfirm")
		}
	}
	args = append(args, packages...)

	stderrBuf := bytes.NewBufferString("")
	multiStderr := io.MultiWriter(os.Stderr, stderrBuf)
	localEnv := os.Environ()
	localEnvMap := make(map[string]string)
	for _, env := range localEnv {
		key, value, _ := strings.Cut(env, "=")
		localEnvMap[key] = value
	}
	localEnvMap["LC_ALL"] = "C.UTF-8"
	cmd := Command{
		Args:   args,
		Stdout: os.Stdout,
		Stderr: multiStderr,
		Env:    localEnvMap,
	}

	err := cmd.Run(ctx)
	if err != nil {
		if (d.PackageManager == PackageManagerTypeAPK && apkNoPermissionRegexp.MatchString(stderrBuf.String())) ||
			(d.PackageManager == PackageManagerTypeDEB && debNoPermissionRegexp.MatchString(stderrBuf.String())) ||
			(d.PackageManager == PackageManagerTypeRPM && rpmNoPermissionRegexp.MatchString(stderrBuf.String())) ||
			(d.PackageManager == PackageManagerTypePacman && pacmanNoPermissionRegexp.MatchString(stderrBuf.String())) {
			loggerGroup, ok := ctx.Value(ContextTypeLoggerGroup{}).(LoggerGroup)
			if ok {
				loggerGroup.Loge("systeminfo", "%s", i18n.L("noPermissionForPackageManager", d.PackageManager, packages))
				sudoCmd := append([]string{"sudo"}, args...)
				loggerGroup.Loge("systeminfo", "%s", i18n.L("youMayTryInstallItAsRoot", shquot.POSIXShell(sudoCmd)))
			}
			return ErrNoPermissionForPackageManager
		}
		return err
	}
	return nil
}

func (d *Distro) InstallPackages(ctx context.Context, packages []string, confirm bool) error {
	var verb string
	switch d.PackageManager {
	case PackageManagerTypeAPK:
		verb = "add"
	case PackageManagerTypeDEB, PackageManagerTypeRPM:
		verb = "install"
	case PackageManagerTypePacman:
		verb = "-S"
	}
	return d.actionPackages(ctx, verb, packages, confirm)
}

func (d *Distro) UpdatePackages(ctx context.Context, packages []string, confirm bool) error {
	var verb string
	switch d.PackageManager {
	case PackageManagerTypeAPK, PackageManagerTypeDEB, PackageManagerTypeRPM:
		verb = "upgrade"
	case PackageManagerTypePacman:
		verb = "-Syu"
	}
	return d.actionPackages(ctx, verb, packages, confirm)
}
