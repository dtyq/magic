//go:build !windows

package util

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHomeDir_UnixFallback(t *testing.T) {
	t.Run("prefersHOMEWhenSet", func(t *testing.T) {
		dir := t.TempDir()
		t.Setenv("HOME", dir)
		want := filepath.Clean(dir)
		if got := HomeDir(); got != want {
			t.Fatalf("HomeDir() = %q, want %q", got, want)
		}
	})

	t.Run("cleansHOMEWithTrailingSeparator", func(t *testing.T) {
		dir := t.TempDir()
		t.Setenv("HOME", dir+string(os.PathSeparator))
		want := filepath.Clean(dir)
		if got := HomeDir(); got != want {
			t.Fatalf("HomeDir() = %q, want cleaned %q", got, want)
		}
	})

	t.Run("cleansHOMEWithDotDot", func(t *testing.T) {
		dir := t.TempDir()
		messy := filepath.Join(dir, "sub") + string(os.PathSeparator) + ".."
		want := filepath.Clean(messy)
		t.Setenv("HOME", messy)
		if got := HomeDir(); got != want {
			t.Fatalf("HomeDir() = %q, want cleaned %q", got, want)
		}
	})

	t.Run("fallsBackToUserHomeDirWhenHOMEUnset", func(t *testing.T) {
		prev, had := os.LookupEnv("HOME")
		t.Cleanup(func() {
			if had {
				_ = os.Setenv("HOME", prev)
			} else {
				_ = os.Unsetenv("HOME")
			}
		})
		_ = os.Unsetenv("HOME")
		want, err := os.UserHomeDir()
		if err != nil {
			if got := HomeDir(); got != "" {
				t.Fatalf("HomeDir() = %q, want empty when UserHomeDir fails (%v)", got, err)
			}
			return
		}
		wantClean := filepath.Clean(want)
		if got := HomeDir(); got != wantClean {
			t.Fatalf("HomeDir() = %q, want cleaned UserHomeDir %q", got, wantClean)
		}
	})
}
