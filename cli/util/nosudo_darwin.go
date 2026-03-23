//go:build darwin

package util

import (
	"os"
	"runtime"
	"strconv"
	"syscall"
)

func NoSudo[T any](callback func() T) T {
	// Not running as root, nothing to do.
	if syscall.Geteuid() != 0 {
		return callback()
	}

	ruid, errUID := strconv.Atoi(os.Getenv("SUDO_UID"))
	rgid, errGID := strconv.Atoi(os.Getenv("SUDO_GID"))
	if errUID != nil || errGID != nil || ruid <= 0 || rgid <= 0 {
		// Missing sudo context or invalid values.
		return callback()
	}

	// Restore HOME for the original user if available.
	if sudoHome := os.Getenv("SUDO_HOME"); sudoHome != "" {
		_ = os.Setenv("HOME", sudoHome)
	}

	resultChan := make(chan T, 1)
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		// Best effort: if privilege drop fails, keep current identity.
		if err := syscall.Setgid(rgid); err != nil {
			resultChan <- callback()
			return
		}
		if err := syscall.Setuid(ruid); err != nil {
			resultChan <- callback()
			return
		}
		resultChan <- callback()
	}()

	return <-resultChan
}
