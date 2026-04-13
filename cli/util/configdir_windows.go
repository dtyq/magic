//go:build windows

package util

import (
	"path/filepath"

	"golang.org/x/sys/windows"
)

// ConfigDir returns the base directory for user configuration,
// before per-application segments such as "magicrew".
//
// It resolves the roaming application data folder via SHGetKnownFolderPath
// (FOLDERID_RoamingAppData, KF_FLAG_DEFAULT) and does not read XDG_CONFIG_HOME,
// APPDATA, or USERPROFILE.
//
// When that API fails or returns an empty path, it falls back to
// filepath.Join(HomeDir(), ".config"). If HomeDir is also empty, returns ""
// so callers never get a lone ".config" relative path.
// Non-empty results are passed through filepath.Clean.
func ConfigDir() string {
	if path, err := windows.KnownFolderPath(windows.FOLDERID_RoamingAppData, windows.KF_FLAG_DEFAULT); err == nil && path != "" {
		return filepath.Clean(path)
	}
	if h := HomeDir(); h != "" {
		return filepath.Clean(filepath.Join(h, ".config"))
	}
	return ""
}
