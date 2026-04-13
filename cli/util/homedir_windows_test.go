//go:build windows

package util

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHomeDir_WindowsMatchesUserProfileEnv(t *testing.T) {
	got := HomeDir()
	if got == "" {
		t.Fatal("HomeDir() returned empty string")
	}
	want := filepath.Clean(os.Getenv("USERPROFILE"))
	if want == "" {
		t.Skip("USERPROFILE not set in test environment")
	}
	if got != want {
		t.Fatalf("HomeDir() = %q, want %q (expected same as USERPROFILE for interactive token)", got, want)
	}
}

func TestHomeDir_WindowsIgnoresHomeAndUserProfileEnv(t *testing.T) {
	baseline := HomeDir()
	if baseline == "" {
		t.Fatal("HomeDir() returned empty string")
	}
	t.Setenv("HOME", `C:\This\Path\Must\Not\Be\Used`)
	t.Setenv("HOMEDRIVE", "X:")
	t.Setenv("HOMEPATH", `\fake`)
	t.Setenv("USERPROFILE", `C:\Also\Ignored\For\Resolution`)
	if got := HomeDir(); got != baseline {
		t.Fatalf("HomeDir() = %q after overriding HOME/HOMEDRIVE/HOMEPATH/USERPROFILE, want unchanged %q", got, baseline)
	}
}
