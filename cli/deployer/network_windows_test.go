//go:build windows

package deployer

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestProxyWindowsApplyEnvTemporarilyRestoresLowerCaseInitial documents Windows
// case-insensitive env semantics: HTTP_PROXY and http_proxy are one variable.
// Snapshots must be taken before any Setenv so restore returns the pre-apply
// value when the user only had a lowercase spelling set.
func TestProxyWindowsApplyEnvTemporarilyRestoresLowerCaseInitial(t *testing.T) {
	const before = "http://before.example.com:8080"
	const during = "http://during.example.com:9999"

	proxyKeys := []string{
		"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
		"http_proxy", "https_proxy", "all_proxy", "no_proxy",
	}
	for _, k := range proxyKeys {
		_ = os.Unsetenv(k)
	}
	t.Cleanup(func() {
		for _, k := range proxyKeys {
			_ = os.Unsetenv(k)
		}
	})

	// Only lowercase spelling; do not Unsetenv("HTTP_PROXY") afterward — on Windows
	// that name aliases the same logical variable and would clear the value.
	require.NoError(t, os.Setenv("http_proxy", before))

	restore, err := applyEnvTemporarily(map[string]string{
		"HTTP_PROXY":  during,
		"HTTPS_PROXY": during,
		"ALL_PROXY":   during,
		"http_proxy":  during,
		"https_proxy": during,
		"all_proxy":   during,
		"NO_PROXY":    "localhost",
		"no_proxy":    "localhost",
	})
	require.NoError(t, err)

	assert.Equal(t, during, strings.TrimSpace(os.Getenv("HTTP_PROXY")))
	assert.Equal(t, during, strings.TrimSpace(os.Getenv("http_proxy")))

	restore()

	afterUpper := strings.TrimSpace(os.Getenv("HTTP_PROXY"))
	afterLower := strings.TrimSpace(os.Getenv("http_proxy"))
	if afterUpper != "" && afterLower != "" && afterUpper != afterLower {
		t.Fatalf("inconsistent proxy after restore: HTTP_PROXY=%q http_proxy=%q", afterUpper, afterLower)
	}
	got := firstNonEmpty(afterUpper, afterLower)
	assert.Equal(t, before, got, "effective proxy after restore must match pre-apply lowercase-only value")
}

// TestProxyWindowsApplyContainerProxyTemporarilyRestoresLowerCaseInitial runs the
// same regression through applyContainerProxyTemporarily (uses applyEnvTemporarily).
func TestProxyWindowsApplyContainerProxyTemporarilyRestoresLowerCaseInitial(t *testing.T) {
	const before = "http://before.example.com:8080"

	proxyKeys := []string{
		"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
		"http_proxy", "https_proxy", "all_proxy", "no_proxy",
	}
	for _, k := range proxyKeys {
		_ = os.Unsetenv(k)
	}
	t.Cleanup(func() {
		for _, k := range proxyKeys {
			_ = os.Unsetenv(k)
		}
	})

	require.NoError(t, os.Setenv("http_proxy", before))
	require.NoError(t, os.Setenv("no_proxy", "keep.local"))

	restore, err := applyContainerProxyTemporarily("http://host.docker.internal:7897", nil)
	require.NoError(t, err)
	restore()

	afterUpper := strings.TrimSpace(os.Getenv("HTTP_PROXY"))
	afterLower := strings.TrimSpace(os.Getenv("http_proxy"))
	got := firstNonEmpty(afterUpper, afterLower)
	assert.Equal(t, before, got)

	npUpper := strings.TrimSpace(os.Getenv("NO_PROXY"))
	npLower := strings.TrimSpace(os.Getenv("no_proxy"))
	np := firstNonEmpty(npUpper, npLower)
	assert.Equal(t, "keep.local", np)
}

// TestProxyWindowsApplyHostProxyForProcessReadsLowerCaseNoProxyBeforeSet verifies
// mergeCSV + firstNonEmpty sees no_proxy when NO_PROXY is unset (same logical var
// on Windows); after applyHostProxyForProcess both spellings reflect merged value.
func TestProxyWindowsApplyHostProxyForProcessReadsLowerCaseNoProxyBeforeSet(t *testing.T) {
	proxyKeys := []string{
		"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
		"http_proxy", "https_proxy", "all_proxy", "no_proxy",
	}
	for _, k := range proxyKeys {
		_ = os.Unsetenv(k)
	}
	t.Cleanup(func() {
		for _, k := range proxyKeys {
			_ = os.Unsetenv(k)
		}
	})

	require.NoError(t, os.Setenv("no_proxy", "user.only.local"))

	err := applyHostProxyForProcess("http://proxy.example.com:8080", []string{"extra.internal"})
	require.NoError(t, err)

	mergedUpper := os.Getenv("NO_PROXY")
	mergedLower := os.Getenv("no_proxy")
	if mergedUpper != mergedLower {
		t.Fatalf("NO_PROXY vs no_proxy diverged on Windows: %q vs %q", mergedUpper, mergedLower)
	}
	assert.Contains(t, mergedUpper, "user.only.local")
	assert.Contains(t, mergedUpper, "extra.internal")
	assert.Equal(t, "http://proxy.example.com:8080", strings.TrimSpace(os.Getenv("HTTP_PROXY")))
	assert.Equal(t, "http://proxy.example.com:8080", strings.TrimSpace(os.Getenv("https_proxy")))
}
