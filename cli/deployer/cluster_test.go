package deployer

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveKindMountDirs_UsesDefaultsUnderHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	k := cluster.NormalizeKindCluster(cluster.KindClusterConfig{})
	require.NoError(t, resolveKindMountDirs(&k))

	wantLocal := filepath.Join(home, ".magicrew", "docker", "local-path-provisioner")
	wantData := filepath.Join(home, ".magicrew", "docker", "data")
	assert.Equal(t, wantLocal, k.LocalPathProvisionerHostDir)
	assert.Equal(t, wantData, k.ClusterNodeDataHostDir)
	_, err := os.Stat(k.LocalPathProvisionerHostDir)
	require.NoError(t, err)
	_, err = os.Stat(k.ClusterNodeDataHostDir)
	require.NoError(t, err)
}

func TestResolveKindMountDirs_UsesConfiguredPaths(t *testing.T) {
	customLP := filepath.Join(t.TempDir(), "lp")
	customData := filepath.Join(t.TempDir(), "data")

	k := cluster.NormalizeKindCluster(cluster.KindClusterConfig{
		LocalPathProvisionerHostDir: customLP,
		ClusterNodeDataHostDir:      customData,
	})
	require.NoError(t, resolveKindMountDirs(&k))
	assert.Equal(t, customLP, k.LocalPathProvisionerHostDir)
	assert.Equal(t, customData, k.ClusterNodeDataHostDir)
	_, err := os.Stat(customLP)
	require.NoError(t, err)
	_, err = os.Stat(customData)
	require.NoError(t, err)
}
