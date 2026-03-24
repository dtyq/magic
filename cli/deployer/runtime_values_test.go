package deployer

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeTempYAML(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "values-*.yaml")
	require.NoError(t, err)
	_, err = f.WriteString(content)
	require.NoError(t, err)
	require.NoError(t, f.Close())
	return f.Name()
}

func TestBuildDeployValues_ImageRegistry(t *testing.T) {
	defaults := map[string]map[string]interface{}{
		"infra": {"redis": map[string]interface{}{"password": "x"}},
	}

	t.Run("user_sets_imageRegistry_preserved", func(t *testing.T) {
		// User sets global.imageRegistry -> value preserved as-is (no substitution here).
		valuesFile := writeTempYAML(t, `
global:
  imageRegistry: "user-registry.example.com"
`)
		got, err := buildDeployValues(defaults, valuesFile)
		require.NoError(t, err)
		global := mapValue(got["global"])
		assert.Equal(t, "user-registry.example.com", global["imageRegistry"])
	})

	t.Run("user_sets_imageRegistry_empty_no_injection", func(t *testing.T) {
		// User sets global.imageRegistry to "" -> preserved as empty, no injection.
		valuesFile := writeTempYAML(t, `
global:
  imageRegistry: ""
`)
		got, err := buildDeployValues(defaults, valuesFile)
		require.NoError(t, err)
		global := mapValue(got["global"])
		assert.Equal(t, "", global["imageRegistry"])
	})

	t.Run("user_missing_key_no_injection", func(t *testing.T) {
		// User does not set global.imageRegistry -> no key injected; each stage injects separately.
		valuesFile := writeTempYAML(t, `
infra:
  redis:
    password: custom
`)
		got, err := buildDeployValues(defaults, valuesFile)
		require.NoError(t, err)
		global := mapValue(got["global"])
		_, has := global["imageRegistry"]
		assert.False(t, has)
	})
}

func TestWithRegistryEndpoint(t *testing.T) {
	merged := map[string]interface{}{
		"global": map[string]interface{}{"foo": "bar"},
		"infra":  map[string]interface{}{"redis": "x"},
	}
	result := withRegistryEndpoint(merged, "kind-registry:5000")
	global := mapValue(result["global"])
	assert.Equal(t, "kind-registry:5000", global["imageRegistry"])
	// original must be unchanged
	origGlobal := mapValue(merged["global"])
	_, has := origGlobal["imageRegistry"]
	assert.False(t, has)
}

func TestInjectWebBaseURL(t *testing.T) {
	merged := map[string]interface{}{
		releaseNameMagic: map[string]interface{}{
			"magic-web": map[string]interface{}{
				"proxy": map[string]interface{}{},
			},
		},
	}
	injectWebBaseURL(merged, "http://server.example.com:38080")
	got := stringAtPath(
		mapValue(mapValue(merged[releaseNameMagic])["magic-web"]),
		"proxy", "webBaseURL",
	)
	assert.Equal(t, "http://server.example.com:38080", got)
}

func TestInjectWebBaseURL_empty_noop(t *testing.T) {
	merged := map[string]interface{}{
		releaseNameMagic: map[string]interface{}{
			"magic-web": map[string]interface{}{
				"proxy": map[string]interface{}{"webBaseURL": "http://localhost:38080"},
			},
		},
	}
	injectWebBaseURL(merged, "")
	got := stringAtPath(
		mapValue(mapValue(merged[releaseNameMagic])["magic-web"]),
		"proxy", "webBaseURL",
	)
	assert.Equal(t, "http://localhost:38080", got)
}

func TestInjectMagicGatewayAllowedTargetIP(t *testing.T) {
	t.Run("user value wins", func(t *testing.T) {
		merged := map[string]interface{}{
			releaseNameMagicSandbox: map[string]interface{}{
				"magic-gateway": map[string]interface{}{
					"gateway": map[string]interface{}{
						"allowedTargetIp": "10.0.0.0/24",
					},
				},
			},
		}

		injectMagicGatewayAllowedTargetIP(merged, "172.22.224.0/24")
		got := stringAtPath(
			mapValue(merged[releaseNameMagicSandbox]),
			"magic-gateway", "gateway", "allowedTargetIp",
		)
		assert.Equal(t, "10.0.0.0/24", got)
	})

	t.Run("config wins over default", func(t *testing.T) {
		merged := map[string]interface{}{
			releaseNameMagicSandbox: map[string]interface{}{},
		}

		injectMagicGatewayAllowedTargetIP(merged, "172.22.224.0/24")
		got := stringAtPath(
			mapValue(merged[releaseNameMagicSandbox]),
			"magic-gateway", "gateway", "allowedTargetIp",
		)
		assert.Equal(t, "172.22.224.0/24", got)
	})

	t.Run("fallback to default", func(t *testing.T) {
		merged := map[string]interface{}{
			releaseNameMagicSandbox: map[string]interface{}{},
		}

		injectMagicGatewayAllowedTargetIP(merged, "")
		got := stringAtPath(
			mapValue(merged[releaseNameMagicSandbox]),
			"magic-gateway", "gateway", "allowedTargetIp",
		)
		assert.Equal(t, "172.22.224.0/24", got)
	})
}

func TestBoolFromMapDefault(t *testing.T) {
	t.Run("missing key fallback", func(t *testing.T) {
		got := boolFromMapDefault(map[string]interface{}{}, "enabled", true)
		assert.True(t, got)
	})

	t.Run("bool value", func(t *testing.T) {
		got := boolFromMapDefault(map[string]interface{}{"enabled": false}, "enabled", true)
		assert.False(t, got)
	})

	t.Run("string bool value", func(t *testing.T) {
		got := boolFromMapDefault(map[string]interface{}{"enabled": "true"}, "enabled", false)
		assert.True(t, got)
	})

	t.Run("invalid type fallback", func(t *testing.T) {
		got := boolFromMapDefault(map[string]interface{}{"enabled": 1}, "enabled", false)
		assert.False(t, got)
	})

	t.Run("invalid string fallback", func(t *testing.T) {
		got := boolFromMapDefault(map[string]interface{}{"enabled": "abc"}, "enabled", true)
		assert.True(t, got)
	})
}

func TestIntFromMapDefault(t *testing.T) {
	t.Run("missing key fallback", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{}, "maxWaitSeconds", 300)
		assert.Equal(t, 300, got)
	})

	t.Run("int value", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": 120}, "maxWaitSeconds", 300)
		assert.Equal(t, 120, got)
	})

	t.Run("int32 value", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": int32(121)}, "maxWaitSeconds", 300)
		assert.Equal(t, 121, got)
	})

	t.Run("int64 value", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": int64(122)}, "maxWaitSeconds", 300)
		assert.Equal(t, 122, got)
	})

	t.Run("float64 value", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": float64(123)}, "maxWaitSeconds", 300)
		assert.Equal(t, 123, got)
	})

	t.Run("string int value", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": "124"}, "maxWaitSeconds", 300)
		assert.Equal(t, 124, got)
	})

	t.Run("invalid string fallback", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": "abc"}, "maxWaitSeconds", 300)
		assert.Equal(t, 300, got)
	})

	t.Run("invalid type fallback", func(t *testing.T) {
		got := intFromMapDefault(map[string]interface{}{"maxWaitSeconds": true}, "maxWaitSeconds", 300)
		assert.Equal(t, 300, got)
	})
}
