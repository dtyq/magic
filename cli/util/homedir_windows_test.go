//go:build windows

package util

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHomeDir_WindowsPrefersPathWithKubeconfig(t *testing.T) {
	withoutKube := t.TempDir()
	withKube := t.TempDir()
	kubeDir := filepath.Join(withKube, ".kube")
	if err := os.MkdirAll(kubeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(kubeDir, "config"), []byte("apiVersion: v1\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", withoutKube)
	t.Setenv("USERPROFILE", withKube)
	t.Setenv("HOMEDRIVE", "")
	t.Setenv("HOMEPATH", "")

	if got := HomeDir(); got != withKube {
		t.Fatalf("HomeDir() = %q, want %q (directory holding .kube/config)", got, withKube)
	}
}

func TestHomeDir_WindowsFallbackOrder(t *testing.T) {
	t.Run("writablePrefersHOMEOverUSERPROFILEWhenNeitherHasKube", func(t *testing.T) {
		home := t.TempDir()
		prof := t.TempDir()
		t.Setenv("HOME", home)
		t.Setenv("USERPROFILE", prof)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		if got := HomeDir(); got != home {
			t.Fatalf("HomeDir() = %q, want HOME %q", got, home)
		}
	})

	t.Run("skipsNonexistentHOMEUsesExistingUSERPROFILE", func(t *testing.T) {
		t.Setenv("HOME", filepath.Join(t.TempDir(), "missing-subdir", "nope"))
		prof := t.TempDir()
		t.Setenv("USERPROFILE", prof)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		if got := HomeDir(); got != prof {
			t.Fatalf("HomeDir() = %q, want USERPROFILE %q", got, prof)
		}
	})

	t.Run("returnsFirstSetWhenNoneExist", func(t *testing.T) {
		t.Setenv("HOME", filepath.Join(t.TempDir(), "ghost-a"))
		t.Setenv("USERPROFILE", filepath.Join(t.TempDir(), "ghost-b"))
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		want := os.Getenv("HOME")
		if got := HomeDir(); got != want {
			t.Fatalf("HomeDir() = %q, want first set (HOME) %q", got, want)
		}
	})
}
