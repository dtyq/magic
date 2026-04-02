package util

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestHomeDir_UnixFallback(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix fallback semantics are tested on non-Windows platforms")
	}

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

func TestHomeDirWindows_ConfigMatchShortCircuit(t *testing.T) {
	withoutCfg := t.TempDir()
	withCfg := t.TempDir()
	cfgDir := filepath.Join(withCfg, ".config", "magicrew")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfgDir, "config.yml"), []byte("workdir: .\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", withoutCfg)
	t.Setenv("USERPROFILE", withCfg)
	t.Setenv("HOMEDRIVE", "")
	t.Setenv("HOMEPATH", "")

	want := filepath.Clean(withCfg)
	if got := homeDirWindows(); got != want {
		t.Fatalf("homeDirWindows() = %q, want %q when .config/magicrew/config.yml exists", got, want)
	}
}

func TestHomeDirWindows_FallbackOrder(t *testing.T) {
	t.Run("writableProbePrefersHOMEOverUSERPROFILEWhenNeitherHasConfig", func(t *testing.T) {
		home := t.TempDir()
		prof := t.TempDir()
		t.Setenv("HOME", home)
		t.Setenv("USERPROFILE", prof)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		want := filepath.Clean(home)
		if got := homeDirWindows(); got != want {
			t.Fatalf("homeDirWindows() = %q, want HOME %q", got, want)
		}
	})

	t.Run("skipsHOMEWhenWritableProbeFailsUsesUSERPROFILE", func(t *testing.T) {
		home := t.TempDir()
		prof := t.TempDir()
		if err := os.Chmod(home, 0o555); err != nil {
			t.Skipf("chmod not supported: %v", err)
		}
		t.Cleanup(func() { _ = os.Chmod(home, 0o755) })
		t.Setenv("HOME", home)
		t.Setenv("USERPROFILE", prof)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		want := filepath.Clean(prof)
		if got := homeDirWindows(); got != want {
			t.Fatalf("homeDirWindows() = %q, want USERPROFILE %q after HOME probe fails", got, want)
		}
	})

	t.Run("skipsNonexistentHOMEUsesExistingUSERPROFILE", func(t *testing.T) {
		t.Setenv("HOME", filepath.Join(t.TempDir(), "missing-subdir", "nope"))
		prof := t.TempDir()
		t.Setenv("USERPROFILE", prof)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		want := filepath.Clean(prof)
		if got := homeDirWindows(); got != want {
			t.Fatalf("homeDirWindows() = %q, want USERPROFILE %q", got, want)
		}
	})

	t.Run("returnsFirstSetWhenNoneExist", func(t *testing.T) {
		t.Setenv("HOME", filepath.Join(t.TempDir(), "ghost-a"))
		t.Setenv("USERPROFILE", filepath.Join(t.TempDir(), "ghost-b"))
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")

		want := filepath.Clean(os.Getenv("HOME"))
		if got := homeDirWindows(); got != want {
			t.Fatalf("homeDirWindows() = %q, want first set (HOME) %q", got, want)
		}
	})
}
