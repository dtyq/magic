package util

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBaseConfigDir_XDGOverrides(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("use TestConfigDir_Windows for Windows-specific env layering")
	}
	home := t.TempDir()
	xdg := filepath.Join(home, "xdg-config")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", xdg)

	assert.Equal(t, xdg, BaseConfigDir())
}

func TestBaseConfigDir_UnixDefaultUnderHome(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows uses APPDATA / USERPROFILE ordering")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")

	want := filepath.Join(home, ".config")
	assert.Equal(t, want, BaseConfigDir())
}

func TestBaseConfigDir_Windows(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows env precedence")
	}
	home := t.TempDir()
	appData := filepath.Join(home, "AppData", "Roaming")
	profile := filepath.Join(home, "profile")

	t.Run("XDG wins over APPDATA", func(t *testing.T) {
		xdg := filepath.Join(home, "xdg")
		t.Setenv("XDG_CONFIG_HOME", xdg)
		t.Setenv("APPDATA", appData)
		t.Setenv("USERPROFILE", profile)
		assert.Equal(t, xdg, BaseConfigDir())
	})

	t.Run("APPDATA when no XDG", func(t *testing.T) {
		t.Setenv("XDG_CONFIG_HOME", "")
		t.Setenv("APPDATA", appData)
		t.Setenv("USERPROFILE", profile)
		assert.Equal(t, appData, BaseConfigDir())
	})

	t.Run("USERPROFILE/.config when no XDG and no APPDATA", func(t *testing.T) {
		t.Setenv("XDG_CONFIG_HOME", "")
		t.Setenv("APPDATA", "")
		t.Setenv("USERPROFILE", profile)
		want := filepath.Join(profile, ".config")
		assert.Equal(t, want, BaseConfigDir())
	})
}

func TestConfigDir_AppDirUnderBase(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("base dir precedence is covered by Windows-specific tests")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")

	want := filepath.Join(home, ".config", "magicrew")
	assert.Equal(t, want, ConfigDir())
}

func TestBaseConfigDir_XDGCleansDotDotAndRedundantSegments(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows XDG clean path covered by TestBaseConfigDir_WindowsXDGClean")
	}
	home := t.TempDir()
	dirty := filepath.Join(home, "nest", "..", ".", "xdg-config")
	want := filepath.Clean(dirty)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, BaseConfigDir())
}

func TestBaseConfigDir_XDGCleansRedundantSeparators(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("separator normalization differs on Windows; XDG branch still uses filepath.Clean")
	}
	home := t.TempDir()
	// Intentionally inject redundant separators; BaseConfigDir must match filepath.Clean.
	dirty := home + string(filepath.Separator) + "cfg" + string(filepath.Separator) + string(filepath.Separator) + "name"
	want := filepath.Clean(dirty)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, BaseConfigDir())
}

func TestConfigDir_JoinsMagicrewAfterCleanBase(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("same clean semantics as Unix; base precedence covered elsewhere")
	}
	home := t.TempDir()
	dirty := filepath.Join(home, "a", "..", "b", "xdg")
	want := filepath.Join(filepath.Clean(dirty), "magicrew")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, ConfigDir())
}

func TestBaseConfigDir_WindowsXDGClean(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows-only")
	}
	home := t.TempDir()
	profile := filepath.Join(home, "profile")
	appData := filepath.Join(home, "AppData", "Roaming")
	dirty := filepath.Join(home, "xdg", "..", ".", "resolved")
	want := filepath.Clean(dirty)

	t.Setenv("XDG_CONFIG_HOME", dirty)
	t.Setenv("APPDATA", appData)
	t.Setenv("USERPROFILE", profile)

	assert.Equal(t, want, BaseConfigDir())
}
