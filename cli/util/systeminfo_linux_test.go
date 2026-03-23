//go:build linux

package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetDistro(t *testing.T) {
	ctx := getLogContext()

	distro, err := GetDistro(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to get distro: %v", err)
	}
	assert.NotEqual(t, "", distro.Name)
	assert.NotEqual(t, "Unknown", distro.Name)
	assert.NotEqual(t, "", distro.Version)
	assert.NotEqual(t, "Unknown", distro.Version)
	assert.NotEqual(t, "", distro.PackageManager)
	assert.NotEqual(t, PackageManagerTypeUnknown, distro.PackageManager)
	if distro.PackageManager == PackageManagerTypeRPM {
		assert.NotEqual(t, "", distro.rpmType)
		assert.NotEqual(t, "unknown", distro.rpmType)
	}
	assert.NotEqual(t, "", distro.IDs)
	assert.NotEqual(t, []string{}, distro.IDs)
}

func TestInstallPackage(t *testing.T) {
	// t.Skip("测不了一点")

	ctx := getLogContext()

	distro, err := GetDistro(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to get distro: %v", err)
	}

	err = distro.InstallPackages(ctx, []string{"git"}, false)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to install package: %v", err)
	}
}
