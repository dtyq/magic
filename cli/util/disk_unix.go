//go:build !windows

package util

import "syscall"

func GetDiskAvailableGB() (uint64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return 0, err
	}
	return stat.Bavail * uint64(stat.Bsize) / (1024 * 1024 * 1024), nil
}
