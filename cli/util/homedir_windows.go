//go:build windows

package util

import (
	"path/filepath"

	"golang.org/x/sys/windows"
)

// HomeDir returns the current user's profile directory from the Win32 API
// (GetCurrentProcessToken + GetUserProfileDirectory). It does not read
// HOME, HOMEDRIVE, HOMEPATH, or USERPROFILE.
//
// On failure, or if the resolved path is empty, it returns "".
// Non-empty results are passed through filepath.Clean.
func HomeDir() string {
	token := windows.GetCurrentProcessToken()
	dir, err := token.GetUserProfileDirectory()
	if err != nil || dir == "" {
		return ""
	}
	return filepath.Clean(dir)
}
