//go:build !windows

package util

import (
	"os"
	"testing"
)

func TestHomeDir_UnixFallback(t *testing.T) {
	t.Run("prefersHOMEWhenSet", func(t *testing.T) {
		dir := t.TempDir()
		t.Setenv("HOME", dir)
		if got := HomeDir(); got != dir {
			t.Fatalf("HomeDir() = %q, want %q", got, dir)
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
		if got := HomeDir(); got != want {
			t.Fatalf("HomeDir() = %q, want UserHomeDir %q", got, want)
		}
	})
}
