//go:build !windows

package util

import (
	"path/filepath"
	"syscall"
)

func GetDiskAvailableBytes(path string) (uint64, error) {
	var stat syscall.Statfs_t

	absPath, err := filepath.Abs(path)
	if err != nil {
		return 0, err
	}

	if err := syscall.Statfs(absPath, &stat); err != nil {
		return 0, err
	}
	return stat.Bavail * uint64(stat.Bsize), nil
}
