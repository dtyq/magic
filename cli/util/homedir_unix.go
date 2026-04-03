//go:build !windows

package util

import (
	"os"
	"path/filepath"
)

// HomeDir returns the home directory for the current user.
//
// On Unix-like systems, $HOME is preferred when set; otherwise os.UserHomeDir is used.
// The lookup runs inside NoSudo so behavior stays consistent with sudo elevation on Linux/macOS.
//
// Non-empty results are passed through filepath.Clean.
func HomeDir() string {
	s := NoSudo(homeDirUnix)
	if s != "" {
		return filepath.Clean(s)
	}
	return ""
}

func homeDirUnix() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	dir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return dir
}
