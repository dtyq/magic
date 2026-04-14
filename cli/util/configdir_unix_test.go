//go:build !windows

package util

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConfigDir_XDGOverrides(t *testing.T) {
	home := t.TempDir()
	xdg := filepath.Join(home, "xdg-config")
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", xdg)

	assert.Equal(t, xdg, ConfigDir())
}

func TestConfigDir_UnixDefaultUnderHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")

	want := filepath.Join(home, ".config")
	assert.Equal(t, want, ConfigDir())
}

func TestConfigDir_XDGWhitespaceOnlyFallsBackToDefault(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "  \t ")

	want := filepath.Join(home, ".config")
	assert.Equal(t, want, ConfigDir())
}

func TestConfigDir_XDGCleansDotDotAndRedundantSegments(t *testing.T) {
	home := t.TempDir()
	dirty := filepath.Join(home, "nest", "..", ".", "xdg-config")
	want := filepath.Clean(dirty)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, ConfigDir())
}

func TestConfigDir_XDGCleansRedundantSeparators(t *testing.T) {
	home := t.TempDir()
	dirty := home + string(filepath.Separator) + "cfg" + string(filepath.Separator) + string(filepath.Separator) + "name"
	want := filepath.Clean(dirty)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, ConfigDir())
}

func TestConfigDir_CleansBasePath(t *testing.T) {
	home := t.TempDir()
	dirty := filepath.Join(home, "a", "..", "b", "xdg")
	want := filepath.Clean(dirty)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", dirty)

	assert.Equal(t, want, ConfigDir())
}
