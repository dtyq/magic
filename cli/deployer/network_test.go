package deployer

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
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

// TestBuildContainerProxyCandidates_LinuxLoopback_Priority asserts Linux loopback
// order: bridge gateway (if discoverable) → host.docker.internal → original loopback.
func TestBuildContainerProxyCandidates_LinuxLoopback_Priority(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Linux-only container proxy candidate ordering")
	}
	const host = "http://127.0.0.1:7897"
	candidates := buildContainerProxyCandidates(context.Background(), host, "")
	require.GreaterOrEqual(t, len(candidates), 2, "expect at least host.docker.internal + original loopback")
	assert.Equal(t, host, candidates[len(candidates)-1], "original loopback must be last on Linux")

	switch len(candidates) {
	case 2:
		assert.Contains(t, candidates[0], "host.docker.internal", "without bridge gateway, host.docker.internal is first")
	case 3:
		assert.NotContains(t, candidates[0], "host.docker.internal", "first candidate should be bridge gateway, not docker.internal")
		assert.Contains(t, candidates[1], "host.docker.internal")
	default:
		t.Fatalf("unexpected candidate count %d: %v", len(candidates), candidates)
	}
}

// TestBuildContainerProxyCandidates_LinuxLoopback_LocalhostAndIPv6SameDerivedPrefix
// asserts localhost and [::1] take the same derived-candidate prefix as 127.0.0.1
// (gateway / host.docker.internal slots identical; only the final loopback URL differs).
func TestBuildContainerProxyCandidates_LinuxLoopback_LocalhostAndIPv6SameDerivedPrefix(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Linux-only loopback derivation parity")
	}
	ctx := context.Background()
	ref := buildContainerProxyCandidates(ctx, "http://127.0.0.1:7897", "")
	require.GreaterOrEqual(t, len(ref), 2, "expect host.docker.internal + original loopback at minimum")

	for _, hostURL := range []string{"http://localhost:7897", "http://[::1]:7897"} {
		got := buildContainerProxyCandidates(ctx, hostURL, "")
		require.Equal(t, len(ref), len(got), "candidate count must match 127.0.0.1 for %q", hostURL)
		for i := 0; i < len(got)-1; i++ {
			assert.Equal(t, ref[i], got[i], "derived prefix index %d must match 127.0.0.1 baseline for %q", i, hostURL)
		}
		assert.Equal(t, hostURL, got[len(got)-1], "last candidate must be the original host URL for %q", hostURL)
	}
}

// TestBuildContainerProxyCandidates_DarwinWindows_Loopback_Order documents platform
// ordering: original loopback first, then host.docker.internal, then bridge gateway when present.
func TestBuildContainerProxyCandidates_DarwinWindows_Loopback_Order(t *testing.T) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		t.Skip("darwin/windows-only container proxy candidate ordering")
	}
	const host = "http://127.0.0.1:7897"
	candidates := buildContainerProxyCandidates(context.Background(), host, "")
	require.GreaterOrEqual(t, len(candidates), 2, "expect at least original loopback + host.docker.internal")
	assert.Equal(t, host, candidates[0], "original loopback must be first on darwin/windows")
	assert.Contains(t, candidates[1], "host.docker.internal", "second slot is host.docker.internal")
	switch len(candidates) {
	case 2:
		// no bridge gateway discovered
	case 3:
		assert.NotContains(t, candidates[2], "host.docker.internal", "third slot should be bridge gateway, not docker.internal")
	default:
		t.Fatalf("unexpected candidate count %d: %v", len(candidates), candidates)
	}
}

func TestIsLoopbackHost_Localhost127AndIPv6(t *testing.T) {
	assert.True(t, isLoopbackHost("127.0.0.1"))
	assert.True(t, isLoopbackHost("LOCALHOST"))
	assert.True(t, isLoopbackHost("::1"))
	assert.True(t, isLoopbackHost("  ::1  "))
	assert.False(t, isLoopbackHost("host.docker.internal"))
	assert.False(t, isLoopbackHost("10.0.0.1"))
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

// TestChooseContainerProxy_ReachabilityOkEgressFail_PolicyEgress distinguishes
// RequireEgress when reachability passes but egress fails (injected probes).
func TestChooseContainerProxy_ReachabilityOkEgressFail_PolicyEgress(t *testing.T) {
	origConn := containerProxyConnectivityProbe
	origEgress := containerProxyEgressProbe
	t.Cleanup(func() {
		containerProxyConnectivityProbe = origConn
		containerProxyEgressProbe = origEgress
	})
	containerProxyConnectivityProbe = func(context.Context, string) error { return nil }
	containerProxyEgressProbe = func(context.Context, string) error {
		return errors.New("simulated egress failure")
	}

	ctx := context.Background()
	const proxy = "http://10.10.10.10:7897" // single non-loopback candidate

	got := chooseContainerProxy(ctx, nolog(), proxy, "", ProxyPolicyConfig{
		RequireReachability: true,
		RequireEgress:       false,
	})
	assert.Equal(t, proxy, got, "RequireEgress=false: egress failure must not block selection")

	got = chooseContainerProxy(ctx, nolog(), proxy, "", ProxyPolicyConfig{
		RequireReachability: true,
		RequireEgress:       true,
	})
	assert.Empty(t, got, "RequireEgress=true: egress failure must yield no candidate")
}

// TestChooseContainerProxy_PolicyCombinations_CancelledContext locks policy behaviour
// when Docker probes fail immediately: reachability required → no candidate;
// reachability optional → first candidate despite failed egress when RequireEgress=false.
func TestChooseContainerProxy_PolicyCombinations_CancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	tests := []struct {
		name      string
		rr, re    bool
		wantEmpty bool
	}{
		{"requireReachability_true_requireEgress_false", true, false, true},
		{"requireReachability_true_requireEgress_true", true, true, true},
		{"requireReachability_false_requireEgress_false", false, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := chooseContainerProxy(
				ctx, nolog(),
				"http://127.0.0.1:7897", "",
				ProxyPolicyConfig{RequireReachability: tt.rr, RequireEgress: tt.re},
			)
			if tt.wantEmpty {
				assert.Empty(t, got)
			} else {
				assert.NotEmpty(t, got)
			}
		})
	}
}

// TestResolveContainerProxy_PolicyCombinations_CancelledContext mirrors chooseContainerProxy
// expectations through the public resolve path (normalized loopback host).
func TestResolveContainerProxy_PolicyCombinations_CancelledContext(t *testing.T) {
	clearAllProxyEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	tests := []struct {
		name      string
		rr, re    bool
		wantEmpty bool
	}{
		{"requireReachability_true_requireEgress_false", true, false, true},
		{"requireReachability_true_requireEgress_true", true, true, true},
		{"requireReachability_false_requireEgress_false", false, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := ProxyConfig{
				Enabled: true,
				Host:    ProxyEndpointConfig{URL: "http://127.0.0.1:7897"},
				Policy:  ProxyPolicyConfig{RequireReachability: tt.rr, RequireEgress: tt.re},
			}
			got := resolveContainerProxy(ctx, nolog(), cfg)
			if tt.wantEmpty {
				assert.Empty(t, got)
			} else {
				assert.NotEmpty(t, got)
			}
		})
	}
}

// TestChooseContainerProxy_MultipleCandidates_FirstEgressFail_SecondEgressOk
// verifies that when the first candidate passes reachability but fails egress,
// and the second candidate passes both, the second candidate is selected.
func TestChooseContainerProxy_MultipleCandidates_FirstEgressFail_SecondEgressOk(t *testing.T) {
	origConn := containerProxyConnectivityProbe
	origEgress := containerProxyEgressProbe
	t.Cleanup(func() {
		containerProxyConnectivityProbe = origConn
		containerProxyEgressProbe = origEgress
	})

	// Both candidates pass reachability.
	containerProxyConnectivityProbe = func(context.Context, string) error { return nil }

	// Track which candidates egress probe sees.
	egressCalls := []string{}
	containerProxyEgressProbe = func(_ context.Context, candidate string) error {
		egressCalls = append(egressCalls, candidate)
		// First candidate fails egress, second succeeds.
		if len(egressCalls) == 1 {
			return errors.New("simulated egress failure for first candidate")
		}
		return nil
	}

	// Use loopback hostProxy to produce multiple candidates.
	ctx := context.Background()
	got := chooseContainerProxy(ctx, nolog(), "http://127.0.0.1:7897", "", ProxyPolicyConfig{
		RequireReachability: true,
		RequireEgress:       false,
	})
	// With the new fallback logic, the second candidate (which passes egress)
	// must be selected instead of the first (which fails egress).
	assert.NotEmpty(t, got, "should select a candidate")
	assert.Equal(t, 2, len(egressCalls), "should have probed both candidates")
	// The returned candidate must NOT be the first one probed (which failed egress).
	assert.NotEqual(t, egressCalls[0], got,
		"must not return the first candidate whose egress failed")
}

// TestChooseContainerProxy_AllEgressFail_RequireEgressFalse_Fallback
// verifies that when all candidates fail egress and RequireEgress=false,
// the first candidate that passed reachability is returned as fallback.
func TestChooseContainerProxy_AllEgressFail_RequireEgressFalse_Fallback(t *testing.T) {
	origConn := containerProxyConnectivityProbe
	origEgress := containerProxyEgressProbe
	t.Cleanup(func() {
		containerProxyConnectivityProbe = origConn
		containerProxyEgressProbe = origEgress
	})

	containerProxyConnectivityProbe = func(context.Context, string) error { return nil }
	containerProxyEgressProbe = func(context.Context, string) error {
		return errors.New("simulated egress failure")
	}

	ctx := context.Background()
	got := chooseContainerProxy(ctx, nolog(), "http://127.0.0.1:7897", "", ProxyPolicyConfig{
		RequireReachability: true,
		RequireEgress:       false,
	})
	assert.NotEmpty(t, got, "RequireEgress=false: should fallback to first reachable candidate")
}

// TestChooseContainerProxy_AllEgressFail_RequireEgressTrue_ReturnsEmpty
// verifies that when all candidates fail egress and RequireEgress=true,
// no candidate is returned (fallback disabled).
func TestChooseContainerProxy_AllEgressFail_RequireEgressTrue_ReturnsEmpty(t *testing.T) {
	origConn := containerProxyConnectivityProbe
	origEgress := containerProxyEgressProbe
	t.Cleanup(func() {
		containerProxyConnectivityProbe = origConn
		containerProxyEgressProbe = origEgress
	})

	containerProxyConnectivityProbe = func(context.Context, string) error { return nil }
	containerProxyEgressProbe = func(context.Context, string) error {
		return errors.New("simulated egress failure")
	}

	ctx := context.Background()
	got := chooseContainerProxy(ctx, nolog(), "http://127.0.0.1:7897", "", ProxyPolicyConfig{
		RequireReachability: true,
		RequireEgress:       true,
	})
	assert.Empty(t, got, "RequireEgress=true: must not fallback when all egress probes fail")
}

// TestChooseContainerProxy_SingleCandidate_EgressFail_RequireEgressFalse_Fallback
// verifies single-candidate fallback (same as legacy behavior).
func TestChooseContainerProxy_SingleCandidate_EgressFail_RequireEgressFalse_Fallback(t *testing.T) {
	origConn := containerProxyConnectivityProbe
	origEgress := containerProxyEgressProbe
	t.Cleanup(func() {
		containerProxyConnectivityProbe = origConn
		containerProxyEgressProbe = origEgress
	})

	containerProxyConnectivityProbe = func(context.Context, string) error { return nil }
	containerProxyEgressProbe = func(context.Context, string) error {
		return errors.New("simulated egress failure")
	}

	ctx := context.Background()
	const proxy = "http://10.10.10.10:7897"
	got := chooseContainerProxy(ctx, nolog(), proxy, "", ProxyPolicyConfig{
		RequireReachability: false,
		RequireEgress:       false,
	})
	assert.Equal(t, proxy, got, "single candidate with RequireEgress=false must still be returned as fallback")
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
