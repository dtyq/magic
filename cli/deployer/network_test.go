package deployer

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dtyq/magicrew-cli/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── helpers ──────────────────────────────────────────────────────────────────

// clearAllProxyEnv resets every proxy-related env var so tests start clean.
func clearAllProxyEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		envNameCLIHostProxyURL, envNameCLIContainerProxyURL,
		"HTTP_PROXY", "http_proxy",
		"HTTPS_PROXY", "https_proxy",
		"ALL_PROXY", "all_proxy",
		"NO_PROXY", "no_proxy",
	} {
		t.Setenv(k, "")
	}
}

// ── applyContainerProxyTemporarily ───────────────────────────────────────────

func TestApplyContainerProxyTemporarily_SetsAndRestores(t *testing.T) {
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("NO_PROXY", "localhost")
	t.Setenv("no_proxy", "localhost")

	restore, err := applyContainerProxyTemporarily("http://host.docker.internal:7897", nil)
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

func TestApplyContainerProxyTemporarily_MergesNoProxyAdditions(t *testing.T) {
	t.Setenv("NO_PROXY", "localhost,EXAMPLE.com")
	t.Setenv("no_proxy", "")

	restore, err := applyContainerProxyTemporarily(
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

func TestApplyContainerProxyTemporarily_EmptyProxySetsOnlyNoProxy(t *testing.T) {
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("HTTPS_PROXY", "")
	t.Setenv("https_proxy", "")
	t.Setenv("ALL_PROXY", "")
	t.Setenv("all_proxy", "")
	t.Setenv("NO_PROXY", "localhost")
	t.Setenv("no_proxy", "localhost")

	restore, err := applyContainerProxyTemporarily("", []string{"kind-registry", "kind-registry:5000"})
	require.NoError(t, err)

	assert.Equal(t, "", os.Getenv("HTTP_PROXY"))
	assert.Equal(t, "", os.Getenv("http_proxy"))
	assert.Contains(t, os.Getenv("NO_PROXY"), "kind-registry")
	assert.Contains(t, os.Getenv("NO_PROXY"), "kind-registry:5000")

	restore()
	assert.Equal(t, "localhost", os.Getenv("NO_PROXY"))
	assert.Equal(t, "localhost", os.Getenv("no_proxy"))
}

// ── applyHostProxyForProcess ─────────────────────────────────────────────────

func TestApplyHostProxyForProcess_SetsProxyAndNoProxy(t *testing.T) {
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("NO_PROXY", "localhost")
	t.Setenv("no_proxy", "localhost")

	err := applyHostProxyForProcess("http://proxy.example.com:8080", []string{"registry.local:5000"})
	require.NoError(t, err)
	assert.Equal(t, "http://proxy.example.com:8080", os.Getenv("HTTP_PROXY"))
	assert.Equal(t, "http://proxy.example.com:8080", os.Getenv("https_proxy"))
	assert.Contains(t, os.Getenv("NO_PROXY"), "registry.local:5000")
	assert.Contains(t, os.Getenv("NO_PROXY"), "host.docker.internal")
}

// ── normalizeProxyURL ─────────────────────────────────────────────────────────

func TestNormalizeProxyURL_AddDefaultScheme(t *testing.T) {
	got, err := normalizeProxyURL("127.0.0.1:7897")
	require.NoError(t, err)
	assert.Equal(t, "http://127.0.0.1:7897", got)
}

// ── misc helpers ──────────────────────────────────────────────────────────────

func TestMergeCSV_DeduplicatesCaseInsensitiveAndTrims(t *testing.T) {
	got := mergeCSV(" A.com ,b.com,a.com ", []string{"B.com", " c.com ", ""})
	assert.Equal(t, "A.com,b.com,c.com", got)
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

func TestMaskProxyURLForLog(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{"mask username and password", "http://user:pass@proxy.example.com:8080", "http://REDACTED:REDACTED@proxy.example.com:8080"},
		{"mask username only", "http://user@proxy.example.com:8080", "http://REDACTED@proxy.example.com:8080"},
		{"keep url without credentials", "http://proxy.example.com:8080", "http://proxy.example.com:8080"},
		{"keep invalid url as is", "://bad", "://bad"},
		{"keep empty userinfo as is", "http://@proxy.example.com:8080", "http://@proxy.example.com:8080"},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, maskProxyURLForLog(tt.in))
		})
	}
}

// ── inheritEnvProxy ───────────────────────────────────────────────────────────

func TestInheritEnvProxy_NoEnv_ConfigUnchanged(t *testing.T) {
	clearAllProxyEnv(t)
	cfg := ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://config-proxy:8080", NoProxy: []string{"old.local"}},
	}
	got := inheritEnvProxy(cfg)
	assert.Equal(t, "http://config-proxy:8080", got.Host.URL)
	assert.Equal(t, []string{"old.local"}, got.Host.NoProxy)
}

func TestInheritEnvProxy_HTTPProxyEnv_OverridesConfig(t *testing.T) {
	clearAllProxyEnv(t)
	t.Setenv("HTTP_PROXY", "http://corp-proxy:3128")
	cfg := ProxyConfig{Host: ProxyEndpointConfig{URL: "http://old-proxy:8080"}}
	got := inheritEnvProxy(cfg)
	assert.Equal(t, "http://corp-proxy:3128", got.Host.URL)
}

func TestInheritEnvProxy_CLIEnvTakesPriorityOverHTTPProxy(t *testing.T) {
	clearAllProxyEnv(t)
	t.Setenv(envNameCLIHostProxyURL, "http://cli-proxy:9999")
	t.Setenv("HTTP_PROXY", "http://http-proxy:3128")
	cfg := ProxyConfig{}
	got := inheritEnvProxy(cfg)
	assert.Equal(t, "http://cli-proxy:9999", got.Host.URL)
}

func TestInheritEnvProxy_ContainerEnvSet(t *testing.T) {
	clearAllProxyEnv(t)
	t.Setenv(envNameCLIContainerProxyURL, "http://container-proxy:8888")
	cfg := ProxyConfig{}
	got := inheritEnvProxy(cfg)
	assert.Equal(t, "http://container-proxy:8888", got.Container.URL)
}

func TestInheritEnvProxy_NOPROXYEnvOverridesConfigNoProxy(t *testing.T) {
	clearAllProxyEnv(t)
	t.Setenv("NO_PROXY", "custom.com,internal.net")
	cfg := ProxyConfig{
		Host:      ProxyEndpointConfig{NoProxy: []string{"old.host"}},
		Container: ProxyEndpointConfig{NoProxy: []string{"old.container"}},
	}
	got := inheritEnvProxy(cfg)
	assert.Equal(t, []string{"custom.com", "internal.net"}, got.Host.NoProxy)
	assert.Equal(t, []string{"custom.com", "internal.net"}, got.Container.NoProxy)
}

func TestInheritEnvProxy_EnvOverridesEvenIfConfigDisabled(t *testing.T) {
	clearAllProxyEnv(t)
	t.Setenv("HTTP_PROXY", "http://env-proxy:8080")
	cfg := ProxyConfig{Enabled: false}
	got := inheritEnvProxy(cfg)
	// inheritEnvProxy does not care about Enabled; it just applies env fields.
	assert.Equal(t, "http://env-proxy:8080", got.Host.URL)
	assert.False(t, got.Enabled, "Enabled flag must not be changed by inheritEnvProxy")
}

// ── resolveContainerProxy ────────────────────────────────────────────────────

func TestResolveContainerProxy_NoInput_ReturnsEmpty(t *testing.T) {
	clearAllProxyEnv(t)
	got := resolveContainerProxy(context.Background(), nolog(), ProxyConfig{Enabled: true})
	assert.Equal(t, "", got)
}

func TestResolveContainerProxy_InvalidHostURL_LogsAndReturnsEmpty(t *testing.T) {
	clearAllProxyEnv(t)
	cfg := ProxyConfig{Enabled: true, Host: ProxyEndpointConfig{URL: "://bad"}}
	got := resolveContainerProxy(context.Background(), nolog(), cfg)
	assert.Equal(t, "", got)
}

func TestResolveContainerProxy_DisabledConfig_NoEnv_ReturnsEmpty(t *testing.T) {
	clearAllProxyEnv(t)
	cfg := ProxyConfig{
		Enabled: false,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	}
	got := resolveContainerProxy(context.Background(), nolog(), cfg)
	assert.Equal(t, "", got)
}

func TestResolveContainerProxy_EnvOverridesDisabledConfig(t *testing.T) {
	clearAllProxyEnv(t)
	// Simulate: inheritEnvProxy already ran and put env proxy in Host.URL,
	// but Enabled is still false from config.
	t.Setenv("HTTP_PROXY", "http://192.168.1.100:7890")
	// Use a cancelled context so Docker probe calls fail instantly.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	cfg := ProxyConfig{
		Enabled: false,
		Host:    ProxyEndpointConfig{URL: "http://192.168.1.100:7890"},
		Policy:  ProxyPolicyConfig{RequireReachability: false, RequireEgress: false},
	}
	got := resolveContainerProxy(ctx, nolog(), cfg)
	// env has a proxy → Enabled=false must NOT block resolution.
	assert.NotEmpty(t, got)
}

func TestResolveContainerProxy_NonLoopbackHost_NoDeriving(t *testing.T) {
	clearAllProxyEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	cfg := ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://10.10.10.10:7897"},
		Policy:  ProxyPolicyConfig{RequireReachability: false, RequireEgress: false},
	}
	got := resolveContainerProxy(ctx, nolog(), cfg)
	// Non-loopback: only one candidate (the host URL itself), no docker.internal deriving.
	assert.Equal(t, "http://10.10.10.10:7897", got)
}

func TestResolveContainerProxy_ExplicitContainer_UsedDirectly(t *testing.T) {
	clearAllProxyEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	cfg := ProxyConfig{
		Enabled:   true,
		Host:      ProxyEndpointConfig{URL: "http://127.0.0.1:7897"},
		Container: ProxyEndpointConfig{URL: "http://proxy.example.com:8888"},
		Policy:    ProxyPolicyConfig{RequireReachability: false, RequireEgress: false},
	}
	got := resolveContainerProxy(ctx, nolog(), cfg)
	assert.Equal(t, "http://proxy.example.com:8888", got)
}

func TestResolveContainerProxy_ReachabilityRequired_AllFail_ReturnsEmpty(t *testing.T) {
	clearAllProxyEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // all docker calls will fail immediately
	cfg := ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://127.0.0.1:7897"},
		Policy:  ProxyPolicyConfig{RequireReachability: true},
	}
	got := resolveContainerProxy(ctx, nolog(), cfg)
	assert.Equal(t, "", got)
}

func TestResolveContainerProxy_ReachabilityNotRequired_ReturnsCandidate(t *testing.T) {
	clearAllProxyEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // docker calls fail but reachability is not required
	cfg := ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://10.10.10.10:7897"},
		Policy: ProxyPolicyConfig{
			RequireReachability: false,
			RequireEgress:       false,
		},
	}
	got := resolveContainerProxy(ctx, nolog(), cfg)
	assert.Equal(t, "http://10.10.10.10:7897", got)
}

// ── buildContainerProxyCandidates ────────────────────────────────────────────

func TestBuildContainerProxyCandidates_NonLoopbackDoesNotDerive(t *testing.T) {
	candidates := buildContainerProxyCandidates(
		context.Background(),
		"http://10.10.10.10:7897",
		"",
	)
	require.Len(t, candidates, 1)
	assert.Equal(t, "http://10.10.10.10:7897", candidates[0])
}

func TestBuildContainerProxyCandidates_ExplicitContainerOnly(t *testing.T) {
	candidates := buildContainerProxyCandidates(
		context.Background(),
		"http://127.0.0.1:7897",
		"http://proxy.example.com:8888",
	)
	require.Len(t, candidates, 1)
	assert.Equal(t, "http://proxy.example.com:8888", candidates[0])
}

// ── chooseContainerProxy ─────────────────────────────────────────────────────

func TestChooseContainerProxy_ReachabilityRequired_AllFail_ReturnsEmpty(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	got := chooseContainerProxy(
		ctx, nolog(),
		"http://127.0.0.1:7897", "",
		ProxyPolicyConfig{RequireReachability: true},
	)
	assert.Empty(t, got)
}

func TestChooseContainerProxy_ReachabilityFalse_AllowsUnreachableCandidate(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	got := chooseContainerProxy(
		ctx, nolog(),
		"http://127.0.0.1:7897", "",
		ProxyPolicyConfig{
			RequireReachability: false,
			RequireEgress:       false,
		},
	)
	// At least one candidate exists; with no reachability check it should be returned.
	assert.NotEmpty(t, got)
}

// ── patchConfigProxySection ──────────────────────────────────────────────────

func TestPatchConfigProxySection_NoInput_FileUnchanged(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	orig := "deploy:\n  proxy:\n    enabled: true\n"
	require.NoError(t, os.WriteFile(path, []byte(orig), 0o644))

	// Enabled=true and no URLs → no-op
	err := patchConfigProxySection(path, ProxyConfig{Enabled: true})
	require.NoError(t, err)
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, orig, string(data))
}

func TestPatchConfigProxySection_UpdatesProxyOnly_PreservesOtherSections(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	orig := "log:\n  - kind: file\n    path: stderr\ndeploy:\n  chartRepo:\n    url: https://example\n"
	require.NoError(t, os.WriteFile(path, []byte(orig), 0o644))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://127.0.0.1:7890"},
	})
	require.NoError(t, err)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, "chartRepo:")
	assert.Contains(t, content, "https://example")
	assert.Contains(t, content, "proxy:")
	assert.Contains(t, content, "http://127.0.0.1:7890")
	assert.Contains(t, content, "kind: file")
}

func TestPatchConfigProxySection_WritesContainerURL(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("deploy: {}\n"), 0o644))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled:   true,
		Container: ProxyEndpointConfig{URL: "http://host.docker.internal:7890"},
	})
	require.NoError(t, err)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Contains(t, string(data), "http://host.docker.internal:7890")
}

func TestPatchConfigProxySection_CreatesProxyNodeIfAbsent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("log:\n  - kind: file\n"), 0o644))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled: false,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	})
	require.NoError(t, err)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, "proxy:")
	assert.Contains(t, content, "enabled: false")
	assert.Contains(t, content, "http://proxy:8080")
}

func TestPatchConfigProxySection_ExplicitDisabled_WritesEnabledFalse(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("deploy:\n  proxy:\n    enabled: true\n"), 0o644))

	// Enabled=false with no URLs → still writes because explicitly disabled.
	err := patchConfigProxySection(path, ProxyConfig{Enabled: false})
	require.NoError(t, err)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Contains(t, string(data), "enabled: false")
}

func TestPatchConfigProxySection_IdempotentOnSameInput(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("deploy: {}\n"), 0o644))

	cfg := ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	}
	require.NoError(t, patchConfigProxySection(path, cfg))
	first, err := os.ReadFile(path)
	require.NoError(t, err)

	require.NoError(t, patchConfigProxySection(path, cfg))
	second, err := os.ReadFile(path)
	require.NoError(t, err)

	assert.Equal(t, string(first), string(second), "second patch should not change the file")
}

func TestPatchConfigProxySection_FilePermission_TightenedTo0600(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("deploy: {}\n"), 0o644))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	})
	require.NoError(t, err)

	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm(),
		"file written with 0644 source should be tightened to 0600")
}

func TestPatchConfigProxySection_FilePermission_OwnerOnlyPreserved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	require.NoError(t, os.WriteFile(path, []byte("deploy: {}\n"), 0o400))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	})
	require.NoError(t, err)

	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o400), info.Mode().Perm(),
		"existing owner-only permission 0400 should be preserved")
}

func TestPatchConfigProxySection_PreservesComments(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	orig := "# top-level comment\ndeploy:\n  # deploy comment\n  chartRepo:\n    url: https://example\n"
	require.NoError(t, os.WriteFile(path, []byte(orig), 0o644))

	err := patchConfigProxySection(path, ProxyConfig{
		Enabled: true,
		Host:    ProxyEndpointConfig{URL: "http://proxy:8080"},
	})
	require.NoError(t, err)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	content := string(data)

	assert.Contains(t, content, "# top-level comment", "top-level comment must be preserved")
	assert.Contains(t, content, "# deploy comment", "nested comment must be preserved")
	assert.Contains(t, content, "chartRepo:", "unrelated key must be preserved")
	assert.Contains(t, content, "https://example", "unrelated value must be preserved")
	assert.Contains(t, content, "http://proxy:8080", "proxy URL must appear")
}

// ── test helpers ──────────────────────────────────────────────────────────────

// nolog returns an empty LoggerGroup that silently discards all log calls.
func nolog() util.LoggerGroup { return util.LoggerGroup{} }
