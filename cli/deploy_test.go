package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_resolveDeployValuesFile(t *testing.T) {
	t.Run("cli flag has highest priority", func(t *testing.T) {
		got := resolveDeployValuesFile("/tmp/cli-values.yaml", "/tmp/config-values.yaml")
		assert.Equal(t, "/tmp/cli-values.yaml", got)
	})

	t.Run("config value is used when cli flag is empty", func(t *testing.T) {
		got := resolveDeployValuesFile("", "/tmp/config-values.yaml")
		assert.Equal(t, "/tmp/config-values.yaml", got)
	})

	t.Run("fallback to user home values file when it exists", func(t *testing.T) {
		home := t.TempDir()
		t.Setenv("HOME", home)
		t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
		want := filepath.Join(home, ".config", "magicrew", "values.yaml")
		requireNoError(t, os.MkdirAll(filepath.Dir(want), 0o755))
		requireNoError(t, os.WriteFile(want, []byte("x: 1\n"), 0o644))

		got := resolveDeployValuesFile("", "")
		assert.Equal(t, want, got)
	})

	t.Run("keep empty when fallback file does not exist", func(t *testing.T) {
		home := t.TempDir()
		t.Setenv("HOME", home)
		t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
		got := resolveDeployValuesFile("", "")
		assert.Equal(t, "", got)
	})
}

func TestResolveAutoRecoverRelease(t *testing.T) {
	t.Run("cli flag has highest priority", func(t *testing.T) {
		got, err := resolveAutoRecoverRelease(true, true, "false")
		requireNoError(t, err)
		assert.True(t, got)
	})

	t.Run("env true values", func(t *testing.T) {
		cases := []string{"true", "1", "yes", "on", "Y"}
		for _, c := range cases {
			got, err := resolveAutoRecoverRelease(false, false, c)
			requireNoError(t, err)
			assert.True(t, got, "env=%s", c)
		}
	})

	t.Run("env false values", func(t *testing.T) {
		cases := []string{"false", "0", "no", "off", "N"}
		for _, c := range cases {
			got, err := resolveAutoRecoverRelease(true, false, c)
			requireNoError(t, err)
			assert.False(t, got, "env=%s", c)
		}
	})

	t.Run("empty env defaults false", func(t *testing.T) {
		got, err := resolveAutoRecoverRelease(false, false, "")
		requireNoError(t, err)
		assert.False(t, got)
	})

	t.Run("invalid env returns error", func(t *testing.T) {
		_, err := resolveAutoRecoverRelease(false, false, "maybe")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), envMagicrewCliAutoRecoverRelease)
	})
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
