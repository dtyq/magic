//go:build windows

package util

import (
	"path/filepath"

	"golang.org/x/sys/windows"
)

func GetDiskAvailableBytes(path string) (uint64, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return 0, err
	}
	rootPtr, err := windows.UTF16PtrFromString(absPath)
	if err != nil {
		return 0, err
	}
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	if err := windows.GetDiskFreeSpaceEx(rootPtr, &freeBytesAvailable, &totalBytes, &totalFreeBytes); err != nil {
		return 0, err
	}
	return freeBytesAvailable, nil
}
