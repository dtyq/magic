package cli

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

// Pins home resolution for tilde tests; mirrors util/path_test.go.
func applyControlledHomeEnv(t *testing.T, home string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		cfgDir := filepath.Join(home, ".config", "magicrew")
		require.NoError(t, os.MkdirAll(cfgDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(cfgDir, "config.yml"), []byte{}, 0o644))
		t.Setenv("HOME", home)
		t.Setenv("USERPROFILE", home)
		t.Setenv("HOMEDRIVE", "")
		t.Setenv("HOMEPATH", "")
		return
	}
	t.Setenv("HOME", home)
}

type initConfigSnapshot struct {
	cfgFile, configDir, dataDir string
}

func snapshotInitConfigGlobals() initConfigSnapshot {
	return initConfigSnapshot{cfgFile: cfgFile, configDir: configDir, dataDir: dataDir}
}

func restoreInitConfigGlobals(s initConfigSnapshot) {
	cfgFile, configDir, dataDir = s.cfgFile, s.configDir, s.dataDir
}

func TestInitConfig_ConfigDirTildeExpandAndClean(t *testing.T) {
	home := t.TempDir()
	applyControlledHomeEnv(t, home)
	t.Setenv(envNameCLIConfigDir, "")
	t.Setenv(envNameCLIDataDir, "")
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())

	cfgFile = ""
	configDir = filepath.Join("~", "a", "..", "b", ".", "c")
	dataDir = ""

	initConfig()

	want := filepath.Clean(filepath.Join(home, "b", "c"))
	assert.Equal(t, want, configDir)
}

func TestInitConfig_DataDirTildeExpandAndClean(t *testing.T) {
	home := t.TempDir()
	applyControlledHomeEnv(t, home)
	t.Setenv(envNameCLIConfigDir, "")
	t.Setenv(envNameCLIDataDir, "")
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())

	cfgDir := filepath.Join(t.TempDir(), "cfg")
	require.NoError(t, os.MkdirAll(cfgDir, 0o700))

	cfgFile = ""
	configDir = cfgDir
	dataDir = filepath.Join("~", "d", "..", "e")

	initConfig()

	want := filepath.Clean(filepath.Join(home, "e"))
	assert.Equal(t, want, dataDir)
}

func TestInitConfig_CfgFileExplicitNormalize(t *testing.T) {
	base := t.TempDir()
	cfgDir := filepath.Join(base, "cfg")
	require.NoError(t, os.MkdirAll(cfgDir, 0o700))
	realCfg := filepath.Join(cfgDir, "config.yml")
	require.NoError(t, os.WriteFile(realCfg, []byte(defaultConfig), 0o644))

	t.Setenv(envNameCLIConfigDir, "")
	t.Setenv(envNameCLIDataDir, "")
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())

	configDir = cfgDir
	dataDir = filepath.Join(base, "data")
	cfgFile = filepath.Join(cfgDir, "messy", "..", ".", "config.yml") + "  "

	initConfig()

	assert.Equal(t, realCfg, cfgFile)
}

func TestInitConfig_EnvConfigDirAndDataDir(t *testing.T) {
	base := t.TempDir()
	envCD := filepath.Join(base, "from-env", "cfg")
	t.Setenv(envNameCLIConfigDir, envCD+string(filepath.Separator)+string(filepath.Separator)+"tail")
	t.Setenv(envNameCLIDataDir, "  "+filepath.Join(base, "from-env", "dot", "..", "data")+"  ")
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())

	cfgFile = ""
	configDir = ""
	dataDir = ""

	initConfig()

	assert.Equal(t, filepath.Clean(filepath.Join(base, "from-env", "cfg", "tail")), configDir)
	assert.Equal(t, filepath.Clean(filepath.Join(base, "from-env", "data")), dataDir)
}

func TestInitConfig_FlagOverridesEnvForDirs(t *testing.T) {
	base := t.TempDir()
	flagCD := filepath.Join(base, "flag-cfg")
	flagDD := filepath.Join(base, "flag-data")
	envCD := filepath.Join(base, "env-cfg")
	t.Setenv(envNameCLIConfigDir, envCD)
	t.Setenv(envNameCLIDataDir, filepath.Join(base, "env-data"))
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())

	cfgFile = ""
	configDir = flagCD
	dataDir = flagDD

	initConfig()

	assert.Equal(t, flagCD, configDir)
	assert.Equal(t, flagDD, dataDir)
}

func TestInitConfig_ConfigDirMkdir0700(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("directory permission bits are not asserted on Windows")
	}
	base := t.TempDir()
	nested := filepath.Join(base, "fresh", "magicrew")
	defer restoreInitConfigGlobals(snapshotInitConfigGlobals())
	t.Setenv(envNameCLIConfigDir, "")
	t.Setenv(envNameCLIDataDir, "")

	cfgFile = ""
	configDir = nested
	dataDir = filepath.Join(base, "data")

	initConfig()

	fi, err := os.Stat(nested)
	require.NoError(t, err)
	assert.True(t, fi.IsDir())
	assert.Equal(t, os.FileMode(0o700), fi.Mode().Perm())
}

func TestDefaultConfig_ProxyDeserializesToDeployerProxyConfig(t *testing.T) {
	var c Config
	require.NoError(t, yaml.Unmarshal([]byte(defaultConfig), &c))
	assert.True(t, c.Deploy.Proxy.Enabled)
	assert.True(t, c.Deploy.Proxy.Policy.UseHostProxy)
	assert.True(t, c.Deploy.Proxy.Policy.RequireReachability)
	assert.False(t, c.Deploy.Proxy.Policy.RequireEgress)
	assert.Empty(t, c.Deploy.Proxy.Host.URL)
	assert.Empty(t, c.Deploy.Proxy.Container.URL)
}

func TestYamlUnmarshal_ExplicitProxyDisableIsKept(t *testing.T) {
	raw := `
deploy:
  proxy:
    enabled: false
    policy:
      useHostProxy: false
      requireReachability: false
      requireEgress: false
`
	var c Config
	require.NoError(t, yaml.Unmarshal([]byte(raw), &c))
	assert.False(t, c.Deploy.Proxy.Enabled)
	assert.False(t, c.Deploy.Proxy.Policy.UseHostProxy)
	assert.False(t, c.Deploy.Proxy.Policy.RequireReachability)
	assert.False(t, c.Deploy.Proxy.Policy.RequireEgress)
}
