package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_resolveDeployValuesFile(t *testing.T) {
	t.Run("cli flag has highest priority", func(t *testing.T) {
		tmp := t.TempDir()
		cliPath := filepath.Join(tmp, "cli-values.yaml")
		cfgPath := filepath.Join(tmp, "config-values.yaml")
		got := resolveDeployValuesFile(cliPath, cfgPath, t.TempDir())
		assert.Equal(t, cliPath, got)
	})

	t.Run("config value is used when cli flag is empty", func(t *testing.T) {
		tmp := t.TempDir()
		cfgPath := filepath.Join(tmp, "config-values.yaml")
		got := resolveDeployValuesFile("", cfgPath, t.TempDir())
		assert.Equal(t, cfgPath, got)
	})

	t.Run("fallback to configDir values file when it exists", func(t *testing.T) {
		configDir := t.TempDir()
		want := filepath.Join(configDir, "values.yaml")
		requireNoError(t, os.WriteFile(want, []byte("x: 1\n"), 0o644))

		got := resolveDeployValuesFile("", "", configDir)
		assert.Equal(t, want, got)
	})

	t.Run("keep empty when fallback file does not exist", func(t *testing.T) {
		got := resolveDeployValuesFile("", "", t.TempDir())
		assert.Equal(t, "", got)
	})

	t.Run("cli values path is normalized tilde and whitespace", func(t *testing.T) {
		home := t.TempDir()
		applyControlledHomeEnv(t, home)
		p := filepath.Join(home, "v.yaml")
		requireNoError(t, os.WriteFile(p, []byte("x: 1\n"), 0o644))
		in := "  ~/v.yaml  "
		want := filepath.Join(home, "v.yaml")
		ignored := filepath.Join(t.TempDir(), "ignored.yaml")
		got := resolveDeployValuesFile(in, ignored, t.TempDir())
		assert.Equal(t, want, got)
	})

	t.Run("config values path is normalized dotdot", func(t *testing.T) {
		tmp := t.TempDir()
		sub := filepath.Join(tmp, "sub")
		requireNoError(t, os.MkdirAll(sub, 0o755))
		want := filepath.Join(sub, "values.yaml")
		requireNoError(t, os.WriteFile(want, []byte("x: 1\n"), 0o644))
		in := filepath.Join(tmp, "a", "..", "sub", "values.yaml")
		got := resolveDeployValuesFile("", in, t.TempDir())
		assert.Equal(t, want, got)
	})

	t.Run("whitespace-only cli values falls through to config", func(t *testing.T) {
		tmp := t.TempDir()
		cfgPath := filepath.Join(tmp, "cfg-values.yaml")
		got := resolveDeployValuesFile("  \t  ", cfgPath, t.TempDir())
		assert.Equal(t, cfgPath, got)
	})

	t.Run("fallback uses normalized configDir to find values.yaml", func(t *testing.T) {
		base := t.TempDir()
		want := filepath.Join(base, "values.yaml")
		requireNoError(t, os.WriteFile(want, []byte("x: 1\n"), 0o644))
		// configDir with redundant segments and trailing ASCII space must resolve to base
		configDirArg := filepath.Join(base, "x", "..") + "  "
		got := resolveDeployValuesFile("", "", configDirArg)
		assert.Equal(t, want, got)
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
		assert.Contains(t, err.Error(), envNameCLIAutoRecoverRelease)
	})
}

func TestResolveDeployWebBaseURL(t *testing.T) {
	t.Run("cli flag has highest priority", func(t *testing.T) {
		t.Setenv(envNameCLIWebBaseURL, "https://env.example.com")
		t.Setenv(envNameCLILegacyWebBaseURL, "https://legacy.example.com")

		got, usedDeprecatedEnv := resolveDeployWebBaseURL("https://cli.example.com")
		assert.Equal(t, "https://cli.example.com", got)
		assert.False(t, usedDeprecatedEnv)
	})

	t.Run("new env is used when cli flag is empty", func(t *testing.T) {
		t.Setenv(envNameCLIWebBaseURL, "https://env.example.com")
		t.Setenv(envNameCLILegacyWebBaseURL, "https://legacy.example.com")

		got, usedDeprecatedEnv := resolveDeployWebBaseURL("")
		assert.Equal(t, "https://env.example.com", got)
		assert.False(t, usedDeprecatedEnv)
	})

	t.Run("legacy env falls back when cli and new env are empty", func(t *testing.T) {
		t.Setenv(envNameCLIWebBaseURL, " \t ")
		t.Setenv(envNameCLILegacyWebBaseURL, "https://legacy.example.com")

		got, usedDeprecatedEnv := resolveDeployWebBaseURL("")
		assert.Equal(t, "https://legacy.example.com", got)
		assert.True(t, usedDeprecatedEnv)
	})

	t.Run("empty inputs return empty value without deprecated marker", func(t *testing.T) {
		t.Setenv(envNameCLIWebBaseURL, "")
		t.Setenv(envNameCLILegacyWebBaseURL, "")

		got, usedDeprecatedEnv := resolveDeployWebBaseURL("   ")
		assert.Equal(t, "", got)
		assert.False(t, usedDeprecatedEnv)
	})
}

func TestResolveDeployMinIOURL(t *testing.T) {
	const minIOPort = 39000

	t.Run("cli flag has highest priority", func(t *testing.T) {
		t.Setenv(envNameCLIMinIOURL, "http://env.example:9000")

		got := resolveDeployMinIOURL("http://cli.example:9001", "http://203.0.113.22:38080", minIOPort)
		assert.Equal(t, "http://cli.example:9001", got)
	})

	t.Run("env is used when cli flag is empty", func(t *testing.T) {
		t.Setenv(envNameCLIMinIOURL, "http://env.example:9000")

		got := resolveDeployMinIOURL("", "http://ignored:38080", minIOPort)
		assert.Equal(t, "http://env.example:9000", got)
	})

	t.Run("derives host and scheme from web URL when cli and env are empty", func(t *testing.T) {
		t.Setenv(envNameCLIMinIOURL, "")

		got := resolveDeployMinIOURL("", "http://203.0.113.22:38080", minIOPort)
		assert.Equal(t, "http://203.0.113.22:39000", got)
	})

	t.Run("falls back to localhost when web URL is also empty", func(t *testing.T) {
		t.Setenv(envNameCLIMinIOURL, "")

		got := resolveDeployMinIOURL("", "", minIOPort)
		assert.Equal(t, "http://localhost:39000", got)
	})
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
