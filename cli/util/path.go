package util

import (
	"path/filepath"
	"strings"
)

// ExpandTilde replaces a leading "~/" or "~\" with the current user's home directory.
// Returns the path unchanged if it does not start with those prefixes or home resolution yields empty.
func ExpandTilde(path string) string {
	if len(path) == 0 {
		return ""
	}
	var rest string
	switch {
	case strings.HasPrefix(path, "~/"):
		rest = path[2:]
	case strings.HasPrefix(path, `~\`):
		rest = path[2:]
	default:
		return path
	}
	homeDir := HomeDir()
	if homeDir == "" {
		return path
	}
	return filepath.Join(homeDir, rest)
}
