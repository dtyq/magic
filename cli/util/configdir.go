package util

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// BaseConfigDir returns the base directory for user configuration (XDG config home),
// before per-application segments such as "magicrew".
//
// Windows order: XDG_CONFIG_HOME, then APPDATA, then USERPROFILE/.config, then
// filepath.Join(HomeDir(), ".config") when USERPROFILE is empty.
//
// Unix order: XDG_CONFIG_HOME, else filepath.Join(HomeDir(), ".config").
// HomeDir is the unified home resolution entry point (including NoSudo on Unix).
func BaseConfigDir() string {
	if v := strings.TrimSpace(os.Getenv("XDG_CONFIG_HOME")); v != "" {
		return filepath.Clean(v)
	}
	if runtime.GOOS == "windows" {
		if v := strings.TrimSpace(os.Getenv("APPDATA")); v != "" {
			return filepath.Clean(v)
		}
		if profile := strings.TrimSpace(os.Getenv("USERPROFILE")); profile != "" {
			return filepath.Clean(filepath.Join(profile, ".config"))
		}
	}
	if h := HomeDir(); h != "" {
		return filepath.Clean(filepath.Join(h, ".config"))
	}
	return ""
}

// ConfigDir returns the application config directory for magicrew.
func ConfigDir() string {
	base := BaseConfigDir()
	if base == "" {
		return ""
	}
	return filepath.Clean(filepath.Join(base, "magicrew"))
}
