package cluster

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

// Scenario: operator runs local deploy — kind cluster "magic", host bind mounts under a user dir,
// in-cluster registry hostname, MinIO NodePort mapped to a host port.
func TestKindConfig_Render_LocalKindWithPrivateRegistry(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()
	localPathDir := filepath.Join(tmp, "local-path-provisioner")
	dataDir := filepath.Join(tmp, "data")
	require.NoError(t, os.MkdirAll(localPathDir, 0o755))
	require.NoError(t, os.MkdirAll(dataDir, 0o755))

	const (
		clusterName = "magic"
		registry    = "kind-registry:5000"
		minIOHost   = 38090
	)

	path, cleanup, err := RenderConfig(KindClusterConfig{
		Name:                        clusterName,
		PodSubnet:                   "10.244.0.0/16",
		ServiceSubnet:               "172.22.224.0/24",
		NodeImage:                   "kindest/node:v1.32.8",
		LocalPathProvisionerHostDir: localPathDir,
		ClusterNodeDataHostDir:      dataDir,
		RegistryHost:                registry,
		MinIOHostPort:               minIOHost,
		WebHTTPHostPort:             38080,
		WebHTTPSHostPort:            38443,
	})
	require.NoError(t, err)
	defer cleanup()

	raw, err := os.ReadFile(path)
	require.NoError(t, err)

	var doc map[string]interface{}
	require.NoError(t, yaml.Unmarshal(raw, &doc), "rendered kind config must be valid YAML")

	assert.Equal(t, clusterName, doc["name"])
	net, ok := doc["networking"].(map[string]interface{})
	require.True(t, ok, "networking should be a map")
	assert.Equal(t, "10.244.0.0/16", net["podSubnet"])
	assert.Equal(t, "172.22.224.0/24", net["serviceSubnet"])

	nodes, ok := doc["nodes"].([]interface{})
	require.True(t, ok, "nodes should be a list")
	require.Len(t, nodes, 1)
	node0, ok := nodes[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "kindest/node:v1.32.8", node0["image"])

	mounts, ok := node0["extraMounts"].([]interface{})
	require.True(t, ok, "extraMounts should be a list")
	require.Len(t, mounts, 2)

	m0, ok := mounts[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, localPathDir, m0["hostPath"])
	assert.Equal(t, "/var/local-path-provisioner", m0["containerPath"])

	m1, ok := mounts[1].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, dataDir, m1["hostPath"])
	assert.Equal(t, "/data/"+clusterName, m1["containerPath"])

	ports, ok := node0["extraPortMappings"].([]interface{})
	require.True(t, ok)
	require.Len(t, ports, 3)
	wantHostPorts := []int{38080, 38443, minIOHost}
	for i, want := range wantHostPorts {
		pm, ok := ports[i].(map[string]interface{})
		require.True(t, ok, "port mapping %d", i)
		// YAML numbers may decode as int, int64, or float64 depending on decoder
		switch v := pm["hostPort"].(type) {
		case int:
			assert.Equal(t, want, v, "hostPort[%d]", i)
		case int64:
			assert.EqualValues(t, want, v, "hostPort[%d]", i)
		case float64:
			assert.EqualValues(t, want, int(v), "hostPort[%d]", i)
		default:
			t.Fatalf("hostPort[%d] unexpected type %T", i, pm["hostPort"])
		}
	}

	patches, ok := doc["containerdConfigPatches"].([]interface{})
	require.True(t, ok, "containerdConfigPatches should be a list")
	require.Len(t, patches, 1)
	patchStr, ok := patches[0].(string)
	require.True(t, ok, "patch should be a multiline string")
	assert.Contains(t, patchStr, registry)
	assert.Contains(t, patchStr, "insecure_skip_verify")
}

// Scenario: private registry is addressed as IP:port (common on LAN); TOML keys must still quote the host.
func TestKindConfig_Render_IPPortRegistryMirror(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()
	// RFC 5737 TEST-NET-1 — example only, not a real registry.
	registry := "192.0.2.1:15000"

	path, cleanup, err := RenderConfig(KindClusterConfig{
		Name:                        "magic",
		PodSubnet:                   "10.244.0.0/16",
		ServiceSubnet:               "172.22.224.0/24",
		NodeImage:                   "kindest/node:v1.32.8",
		LocalPathProvisionerHostDir: filepath.Join(tmp, "lp"),
		ClusterNodeDataHostDir:      filepath.Join(tmp, "data"),
		RegistryHost:                registry,
		MinIOHostPort:               38090,
		WebHTTPHostPort:             38080,
		WebHTTPSHostPort:            38443,
	})
	require.NoError(t, err)
	defer cleanup()

	raw, err := os.ReadFile(path)
	require.NoError(t, err)

	var doc map[string]interface{}
	require.NoError(t, yaml.Unmarshal(raw, &doc))

	patches := doc["containerdConfigPatches"].([]interface{})
	patchStr := patches[0].(string)
	assert.Contains(t, patchStr, registry)
	assert.Contains(t, patchStr, `mirrors."`+registry+`"`)
}

// Contract: caller can delete the temp file via cleanup callback.
func TestKindConfig_Render_CleanupRemovesTempFile(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()
	path, cleanup, err := RenderConfig(KindClusterConfig{
		Name:                        "magic",
		PodSubnet:                   "10.244.0.0/16",
		ServiceSubnet:               "172.22.224.0/24",
		NodeImage:                   "kindest/node:v1.32.8",
		LocalPathProvisionerHostDir: filepath.Join(tmp, "lp"),
		ClusterNodeDataHostDir:      filepath.Join(tmp, "data"),
		RegistryHost:                "kind-registry:5000",
		MinIOHostPort:               38090,
		WebHTTPHostPort:             38080,
		WebHTTPSHostPort:            38443,
	})
	require.NoError(t, err)
	_, statErr := os.Stat(path)
	require.NoError(t, statErr, "temp file should exist before cleanup")

	cleanup()

	_, statErr = os.Stat(path)
	require.Error(t, statErr)
	assert.True(t, os.IsNotExist(statErr), "temp file should be removed after cleanup")
}
