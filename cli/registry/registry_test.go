package registry

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeConfig_DefaultsAndExpandTilde(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	out := NormalizeConfig(Config{})
	assert.Equal(t, DefaultName, out.Name)
	assert.Equal(t, DefaultHostPort, out.HostPort)
	assert.Equal(t, DefaultImage, out.Image)
	assert.Empty(t, out.DataDir)
	assert.Empty(t, out.CAFile)

	withTilde := NormalizeConfig(Config{
		Name:     "r",
		HostPort: 13500,
		Image:    "i",
		DataDir:  "~/regdata",
		CAFile:   "~/ca.pem",
	})
	assert.Equal(t, "r", withTilde.Name)
	assert.Equal(t, 13500, withTilde.HostPort)
	assert.Equal(t, filepath.Join(home, "regdata"), withTilde.DataDir)
	assert.Equal(t, filepath.Join(home, "ca.pem"), withTilde.CAFile)
}

func TestContainerEndpoint(t *testing.T) {
	cfg := Config{
		Name: "magic-kind-registry",
	}
	assert.Equal(t, "magic-kind-registry:5000", ContainerEndpoint(cfg))
}

func TestHostEndpoint(t *testing.T) {
	cfg := Config{
		Name:     "magic-kind-registry",
		HostPort: 35000,
	}
	assert.Equal(t, "127.0.0.1:35000", HostEndpoint(cfg))
}

func TestWaitForHostEndpoint_Ready(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})
	srv := httptest.NewUnstartedServer(handler)
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv.Listener = l
	srv.Start()
	defer srv.Close()

	port := srv.Listener.Addr().(*net.TCPAddr).Port
	cfg := Config{Name: "magic-kind-registry", HostPort: port}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	require.NoError(t, WaitForHostEndpoint(ctx, cfg, 2*time.Second))
}

func TestWaitForHostEndpoint_Timeout(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	srv := httptest.NewUnstartedServer(handler)
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv.Listener = l
	srv.Start()
	defer srv.Close()

	port := srv.Listener.Addr().(*net.TCPAddr).Port
	cfg := Config{Name: "magic-kind-registry", HostPort: port}

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	err = WaitForHostEndpoint(ctx, cfg, 500*time.Millisecond)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "wait for registry host endpoint")
}

func TestRegistryConfigHostPath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	p := registryConfigHostPath(Config{Name: "magic-kind-registry"})
	assert.Equal(t, filepath.Join(home, ".config", "magicrew", "registry-magic-kind-registry-config.yml"), p)
}

func TestWriteRegistryConfig_PersistentPathAndContent(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	cfg := Config{
		Name: "magic-kind-registry",
		Proxy: ProxyConfig{
			Enabled:  true,
			URL:      "https://example.com",
			Username: "u",
			Password: "p",
		},
	}

	path, err := writeRegistryConfig(cfg)
	require.NoError(t, err)
	assert.Equal(t, registryConfigHostPath(cfg), path)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, "remoteurl: https://example.com/")
	assert.True(t, strings.Contains(content, "username: u"))
	assert.True(t, strings.Contains(content, "password: p"))
}

func TestWriteRegistryConfig_DirPermission(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	cfg := Config{
		Name: "magic-kind-registry",
		Proxy: ProxyConfig{
			Enabled:  true,
			URL:      "https://example.com",
			Username: "u",
			Password: "p",
		},
	}

	path, err := writeRegistryConfig(cfg)
	require.NoError(t, err)
	info, err := os.Stat(filepath.Dir(path))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o700), info.Mode().Perm())
}

func TestWriteRegistryConfig_FilePermission(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	cfg := Config{
		Name: "magic-kind-registry",
		Proxy: ProxyConfig{
			Enabled:  true,
			URL:      "https://example.com",
			Username: "u",
			Password: "p",
		},
	}

	path, err := writeRegistryConfig(cfg)
	require.NoError(t, err)
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())
}

func TestShouldRecreateForConfigMount(t *testing.T) {
	expected := "/Users/test/.config/magicrew/registry-magic-kind-registry-config.yml"

	t.Run("legacy temp mount should recreate", func(t *testing.T) {
		mountsJSON := `[{"Source":"/var/folders/xx/T/magicrew-registry-config-123.yml","Destination":"/etc/docker/registry/config.yml"}]`
		got, err := shouldRecreateForConfigMount(mountsJSON, expected)
		require.NoError(t, err)
		assert.True(t, got)
	})

	t.Run("expected mount should not recreate", func(t *testing.T) {
		mountsJSON := `[{"Source":"/Users/test/.config/magicrew/registry-magic-kind-registry-config.yml","Destination":"/etc/docker/registry/config.yml"}]`
		got, err := shouldRecreateForConfigMount(mountsJSON, expected)
		require.NoError(t, err)
		assert.False(t, got)
	})

	t.Run("missing config mount should recreate", func(t *testing.T) {
		mountsJSON := `[{"Source":"/tmp/data","Destination":"/var/lib/registry"}]`
		got, err := shouldRecreateForConfigMount(mountsJSON, expected)
		require.NoError(t, err)
		assert.True(t, got)
	})

	t.Run("invalid mounts json returns error", func(t *testing.T) {
		_, err := shouldRecreateForConfigMount("{not-json}", expected)
		require.Error(t, err)
	})
}
