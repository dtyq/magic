package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolveDeployValuesFile_Priority(t *testing.T) {
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
		want := filepath.Join(home, ".config", "magicrew", "values.yaml")
		requireNoError(t, os.MkdirAll(filepath.Dir(want), 0o755))
		requireNoError(t, os.WriteFile(want, []byte("x: 1\n"), 0o644))

		got := resolveDeployValuesFile("", "")
		assert.Equal(t, want, got)
	})

	t.Run("keep empty when fallback file does not exist", func(t *testing.T) {
		home := t.TempDir()
		t.Setenv("HOME", home)
		got := resolveDeployValuesFile("", "")
		assert.Equal(t, "", got)
	})
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
