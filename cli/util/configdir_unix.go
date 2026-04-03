//go:build !windows

package util

import (
	"os"
	"path/filepath"
	"strings"
)

// ConfigDir returns the base directory for user configuration (XDG config home),
// before per-application segments such as "magicrew".
//
// If XDG_CONFIG_HOME is set to a non-empty value (after trimming), that path is used.
// Otherwise it is filepath.Join(HomeDir(), ".config"). When HomeDir is empty, returns "".
// Non-empty results are passed through filepath.Clean.
func ConfigDir() string {
	if v := strings.TrimSpace(os.Getenv("XDG_CONFIG_HOME")); v != "" {
		return filepath.Clean(v)
	}
	if h := HomeDir(); h != "" {
		return filepath.Clean(filepath.Join(h, ".config"))
	}
	return ""
}
