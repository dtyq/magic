package util

import (
	"path/filepath"
	"strings"
)

// NormalizePath trims surrounding ASCII whitespace; returns "" if the result is empty.
// Otherwise expands a leading ~/ or ~\ via ExpandTilde, then applies filepath.Clean.
func NormalizePath(path string) string {
	s := strings.TrimSpace(path)
	if s == "" {
		return ""
	}
	return filepath.Clean(ExpandTilde(s))
}

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
