//go:build windows

package util

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/windows"
)

func TestConfigDir_WindowsMatchesKnownFolderPath(t *testing.T) {
	want, err := windows.KnownFolderPath(windows.FOLDERID_RoamingAppData, windows.KF_FLAG_DEFAULT)
	require.NoError(t, err)
	require.NotEmpty(t, want)
	assert.Equal(t, filepath.Clean(want), ConfigDir())
}

func TestConfigDir_WindowsIgnoresXdgAppDataUserProfile(t *testing.T) {
	want, err := windows.KnownFolderPath(windows.FOLDERID_RoamingAppData, windows.KF_FLAG_DEFAULT)
	require.NoError(t, err)
	require.NotEmpty(t, want)

	t.Setenv("XDG_CONFIG_HOME", `C:\bogus\xdg-config`)
	t.Setenv("APPDATA", `C:\bogus\AppData\Roaming`)
	t.Setenv("USERPROFILE", `C:\bogus\Users\someone`)

	assert.Equal(t, filepath.Clean(want), ConfigDir())
}
