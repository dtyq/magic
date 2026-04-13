package util

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestExpandTilde(t *testing.T) {
	home := HomeDir()
	if home == "" {
		t.Skip("HomeDir() empty; cannot assert tilde expansion")
	}

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
	home := HomeDir()
	if home == "" {
		t.Skip("HomeDir() empty; cannot assert tilde normalization")
	}

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
