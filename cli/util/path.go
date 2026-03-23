package util

import (
	"os"
	"path/filepath"
	"strings"
)

// ExpandTilde replaces a leading "~/" with the current user's home directory.
// Returns the path unchanged if it does not start with "~/" or home dir lookup fails.
// Uses NoSudo to ensure the correct home dir is resolved even when running under sudo.
func ExpandTilde(path string) string {
	if len(path) == 0 {
		return ""
	}
	if !strings.HasPrefix(path, "~/") {
		return path
	}
	return NoSudo(func() string {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(homeDir, path[2:])
	})
}
