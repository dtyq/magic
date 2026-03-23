package registry

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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
	assert.Equal(t, DefaultPort, out.Port)
	assert.Equal(t, DefaultImage, out.Image)
	assert.Empty(t, out.DataDir)
	assert.Empty(t, out.CAFile)

	withTilde := NormalizeConfig(Config{
		Name:    "r",
		Port:    1,
		Image:   "i",
		DataDir: "~/regdata",
		CAFile:  "~/ca.pem",
	})
	assert.Equal(t, "r", withTilde.Name)
	assert.Equal(t, filepath.Join(home, "regdata"), withTilde.DataDir)
	assert.Equal(t, filepath.Join(home, "ca.pem"), withTilde.CAFile)
}

func TestContainerEndpoint(t *testing.T) {
	cfg := Config{
		Name: "magic-kind-registry",
		Port: 5000,
	}
	assert.Equal(t, "magic-kind-registry:5000", ContainerEndpoint(cfg))
}

func TestHostEndpoint(t *testing.T) {
	cfg := Config{
		Name: "magic-kind-registry",
		Port: 5000,
	}
	assert.Equal(t, "127.0.0.1:5000", HostEndpoint(cfg))
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
	cfg := Config{Name: "magic-kind-registry", Port: port}

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
	cfg := Config{Name: "magic-kind-registry", Port: port}

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	err = WaitForHostEndpoint(ctx, cfg, 500*time.Millisecond)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "wait for registry host endpoint")
}
