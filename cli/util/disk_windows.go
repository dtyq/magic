//go:build windows

package util

import "golang.org/x/sys/windows"

func GetDiskAvailableGB() (uint64, error) {
	rootPtr, err := windows.UTF16PtrFromString(`C:\`)
	if err != nil {
		return 0, err
	}
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	if err := windows.GetDiskFreeSpaceEx(rootPtr, &freeBytesAvailable, &totalBytes, &totalFreeBytes); err != nil {
		return 0, err
	}
	return freeBytesAvailable / (1024 * 1024 * 1024), nil
}
