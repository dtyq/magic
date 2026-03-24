package deployer

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadProxyEntriesFromFile_ReadsKeyValueFormat(t *testing.T) {
	file := filepath.Join(t.TempDir(), "proxy.env")
	content := `HTTP_PROXY="http://127.0.0.1:7897"
MAGICREW_CLI_HOST_PROXY_URL="http://127.0.0.1:7897"
IGNORE_ME="x"
`
	require.NoError(t, os.WriteFile(file, []byte(content), 0o600))

	entries, err := readProxyEntriesFromFile(file)
	require.NoError(t, err)
	assert.Equal(t, "http://127.0.0.1:7897", entries["HTTP_PROXY"])
	assert.Equal(t, "http://127.0.0.1:7897", entries["MAGICREW_CLI_HOST_PROXY_URL"])
	_, exists := entries["IGNORE_ME"]
	assert.False(t, exists)
}

func TestReadProxyEntriesFromFile_IgnoresExportFormat(t *testing.T) {
	file := filepath.Join(t.TempDir(), "proxy.env")
	content := `export HTTP_PROXY="http://127.0.0.1:7897"
export MAGICREW_CLI_HOST_PROXY_URL="http://127.0.0.1:7897"
`
	require.NoError(t, os.WriteFile(file, []byte(content), 0o600))

	entries, err := readProxyEntriesFromFile(file)
	require.NoError(t, err)
	assert.Empty(t, entries["HTTP_PROXY"])
	assert.Empty(t, entries["MAGICREW_CLI_HOST_PROXY_URL"])
}

func TestApplyContainerProxyTemporarily_SetsAndRestores(t *testing.T) {
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("NO_PROXY", "localhost")
	t.Setenv("no_proxy", "localhost")

	restore, err := ApplyContainerProxyTemporarily("http://host.docker.internal:7897", nil)
	require.NoError(t, err)
	assert.Equal(t, "http://host.docker.internal:7897", os.Getenv("HTTP_PROXY"))
	assert.Equal(t, "http://host.docker.internal:7897", os.Getenv("http_proxy"))
	assert.Contains(t, os.Getenv("NO_PROXY"), "host.docker.internal")
	assert.Contains(t, os.Getenv("no_proxy"), ".internal")

	restore()
	assert.Equal(t, "", os.Getenv("HTTP_PROXY"))
	assert.Equal(t, "", os.Getenv("http_proxy"))
	assert.Equal(t, "localhost", os.Getenv("NO_PROXY"))
	assert.Equal(t, "localhost", os.Getenv("no_proxy"))
}

func TestNormalizeProxyURL_AddDefaultScheme(t *testing.T) {
	got, err := normalizeProxyURL("127.0.0.1:7897")
	require.NoError(t, err)
	assert.Equal(t, "http://127.0.0.1:7897", got)
}

func TestApplyContainerProxyTemporarily_MergesNoProxyAdditions(t *testing.T) {
	t.Setenv("NO_PROXY", "localhost,EXAMPLE.com")
	t.Setenv("no_proxy", "")

	restore, err := ApplyContainerProxyTemporarily(
		"http://host.docker.internal:7897",
		[]string{"example.com", "registry.local:5000"},
	)
	require.NoError(t, err)
	defer restore()

	noProxy := os.Getenv("NO_PROXY")
	assert.Contains(t, noProxy, "registry.local:5000")
	assert.Contains(t, noProxy, "host.docker.internal")
	assert.Equal(t, 1, strings.Count(strings.ToLower(noProxy), "example.com"))
}

func TestMergeCSV_DeduplicatesCaseInsensitiveAndTrims(t *testing.T) {
	got := mergeCSV(" A.com ,b.com,a.com ", []string{"B.com", " c.com ", ""})
	assert.Equal(t, "A.com,b.com,c.com", got)
}

func TestBuildProxyPlan_InvalidHostProxyWarnsAndReturnsEmptyPlan(t *testing.T) {
	t.Setenv("HTTP_PROXY", "://bad")
	t.Setenv("http_proxy", "")
	t.Setenv("HTTPS_PROXY", "")
	t.Setenv("https_proxy", "")
	t.Setenv("ALL_PROXY", "")
	t.Setenv("all_proxy", "")
	t.Setenv(envNameCLIContainerProxyURL, "")

	plan, err := BuildProxyPlan(context.Background())
	require.NoError(t, err)
	assert.Empty(t, plan.HostProxyURL)
	assert.Empty(t, plan.ContainerProxyURL)
	require.Len(t, plan.Warnings, 1)
	assert.Contains(t, plan.Warnings[0], "ignore invalid host proxy url")
}

func TestProxyNoProxyDefaultsWith_ContainsExpectedDefaultsAndCustom(t *testing.T) {
	entries := proxyNoProxyDefaultsWith("custom.internal")
	assert.Contains(t, entries, "localhost")
	assert.Contains(t, entries, ".internal")
	assert.Contains(t, entries, ".local")
	assert.Contains(t, entries, "custom.internal")
}

func TestProxyEndpointHostPort_DefaultPortAndNormalizeHost(t *testing.T) {
	host, port, err := proxyEndpointHostPort("http://LOCALHOST")
	require.NoError(t, err)
	assert.Equal(t, "localhost", host)
	assert.Equal(t, "80", port)
}

func TestOutputShowsProxyEndpoint(t *testing.T) {
	out := "Connecting to host.docker.internal:7897 (192.168.65.2:7897)\nHTTP/1.1 400 Bad Request"
	assert.True(t, outputShowsProxyEndpoint(out, "host.docker.internal", "7897"))
	assert.False(t, outputShowsProxyEndpoint(out, "registry.k8s.io", "443"))
}
