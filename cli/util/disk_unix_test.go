//go:build !windows

package util

import (
	"testing"
)

func TestGetDiskAvailableBytes(t *testing.T) {
	availableBytes, err := GetDiskAvailableBytes(".")
	if err != nil {
		t.Fatalf("failed to get disk available bytes: %v", err)
	}
	t.Logf("disk available bytes: %d", availableBytes)
}
