package util

import (
	"path/filepath"
	"testing"
)

func TestExpandTilde(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

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
