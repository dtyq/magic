//go:build windows

package util

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHomeDir_WindowsPrefersPathWithMagicrewConfig(t *testing.T) {
	withoutMagicrew := t.TempDir()
	withMagicrew := t.TempDir()
	cfgDir := filepath.Join(withMagicrew, ".config", "magicrew")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfgDir, "config.yml"), []byte("workdir: .\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", withoutMagicrew)
	t.Setenv("USERPROFILE", withMagicrew)
	t.Setenv("HOMEDRIVE", "")
	t.Setenv("HOMEPATH", "")

	want := filepath.Clean(withMagicrew)
	if got := HomeDir(); got != want {
		t.Fatalf("HomeDir() = %q, want %q (directory holding .config/magicrew/config.yml)", got, want)
	}
}

func TestHomeDir_WindowsUsesWindowsResolverBranch(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", "")
	t.Setenv("HOMEDRIVE", "")
	t.Setenv("HOMEPATH", "")

	want := filepath.Clean(home)
	if got := HomeDir(); got != want {
		t.Fatalf("HomeDir() = %q, want %q from windows resolver branch", got, want)
	}
}
