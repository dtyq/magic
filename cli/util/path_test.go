package util

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// applyControlledHomeEnv pins ExpandTilde/HomeDir resolution for tilde tests.
// On Windows, HomeDir consults HOME, HOMEDRIVE+HOMEPATH, USERPROFILE and may
// prefer another profile when a magicrew config exists; we align env and add a
// marker config under home so the temp directory wins deterministically.
func applyControlledHomeEnv(t *testing.T, home string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		cfgDir := filepath.Join(home, ".config", "magicrew")
		if err := os.MkdirAll(cfgDir, 0o755); err != nil {
			t.Fatalf("mkdir config dir: %v", err)
		}
		if err := os.WriteFile(filepath.Join(cfgDir, "config.yml"), []byte{}, 0o644); err != nil {
			t.Fatalf("write config: %v", err)
		}
		t.Setenv("HOME", home)
		t.Setenv("USERPROFILE", home)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")
		return
	}
	t.Setenv("HOME", home)
}

func TestExpandTilde(t *testing.T) {
	home := t.TempDir()
	applyControlledHomeEnv(t, home)

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"slash", "~/foo", filepath.Join(home, "foo")},
		{"backslash", `~\foo`, filepath.Join(home, "foo")},
		{"nested_slash", "~/a/b", filepath.Join(home, "a", "b")},
		{"absolute_unchanged", "/usr/bin", "/usr/bin"},
		{"relative_unchanged", "foo/bar", "foo/bar"},
		{"tilde_only", "~", "~"},
		{"tilde_no_sep", "~foo", "~foo"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ExpandTilde(tc.in)
			if got != tc.want {
				t.Fatalf("ExpandTilde(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestNormalizePath(t *testing.T) {
	home := t.TempDir()
	applyControlledHomeEnv(t, home)

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"whitespace_only", "  \t\n ", ""},
		{"tilde_slash", "~/a", filepath.Join(home, "a")},
		{"dotdot", "a/../b", filepath.Clean("a/../b")},
		{"dup_seps", "p//q//r", filepath.Clean("p//q//r")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := NormalizePath(tc.in)
			if got != tc.want {
				t.Fatalf("NormalizePath(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}

	t.Run("empty_never_dot", func(t *testing.T) {
		for _, in := range []string{"", " ", "\t", strings.Repeat(" ", 8)} {
			got := NormalizePath(in)
			if got != "" {
				t.Fatalf("NormalizePath(%q) = %q, want empty string", in, got)
			}
			if got == "." {
				t.Fatalf("NormalizePath(%q) must not be %q", in, got)
			}
		}
	})
}
