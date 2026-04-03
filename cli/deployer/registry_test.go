package deployer

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveRegistryDataDir_UsesConfiguredPath(t *testing.T) {
	d := &Deployer{}
	configured := filepath.Join(t.TempDir(), "explicit-registry-data")

	got, err := d.resolveRegistryDataDir(configured)
	require.NoError(t, err)
	assert.Equal(t, configured, got)
}

func TestResolveRegistryDataDir_FallsBackToDataDir(t *testing.T) {
	base := t.TempDir()
	d := &Deployer{opts: Options{DataDir: base}}

	got, err := d.resolveRegistryDataDir("")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(base, "docker", "registry-data"), got)

	info, statErr := os.Stat(got)
	require.NoError(t, statErr)
	assert.True(t, info.IsDir())
}
