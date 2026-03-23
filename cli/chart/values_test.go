package chart

import (
	"os"
	"path/filepath"
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

// ── MergeValues ──────────────────────────────────────────────────────────────

func TestMergeValues_SingleFile(t *testing.T) {
	f := writeTempYAML(t, "key: value\n")
	got, err := MergeValues(f)
	require.NoError(t, err)
	assert.Equal(t, "value", got["key"])
}

func TestMergeValues_LaterFileOverrides(t *testing.T) {
	f1 := writeTempYAML(t, "key: first\nonly1: a\n")
	f2 := writeTempYAML(t, "key: second\nonly2: b\n")
	got, err := MergeValues(f1, f2)
	require.NoError(t, err)
	assert.Equal(t, "second", got["key"], "later file should override earlier")
	assert.Equal(t, "a", got["only1"], "key only in first file should be kept")
	assert.Equal(t, "b", got["only2"])
}

func TestMergeValues_DeepMerge(t *testing.T) {
	f1 := writeTempYAML(t, "parent:\n  a: 1\n  b: 2\n")
	f2 := writeTempYAML(t, "parent:\n  b: 99\n  c: 3\n")
	got, err := MergeValues(f1, f2)
	require.NoError(t, err)
	parent, ok := got["parent"].(map[string]interface{})
	require.True(t, ok)
	// f2 overrides b; a from f1 is preserved; c from f2 is added
	assert.EqualValues(t, 1, parent["a"])
	assert.EqualValues(t, 99, parent["b"])
	assert.EqualValues(t, 3, parent["c"])
}

func TestMergeValues_MissingFileSkipped(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "does-not-exist.yaml")
	got, err := MergeValues(missing)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestMergeValues_InvalidYAMLReturnsError(t *testing.T) {
	f := writeTempYAML(t, "key: [unclosed\n")
	_, err := MergeValues(f)
	assert.Error(t, err)
}

// ── ExtractChartValues ───────────────────────────────────────────────────────

func TestExtractChartValues_OnlyGlobal(t *testing.T) {
	merged := map[string]interface{}{
		"global": map[string]interface{}{"env": "prod"},
	}
	got := ExtractChartValues(merged, "myapp")
	assert.Equal(t, map[string]interface{}{"env": "prod"}, got["global"])
	assert.NotContains(t, got, "myapp")
}

func TestExtractChartValues_OnlyChartName(t *testing.T) {
	merged := map[string]interface{}{
		"myapp": map[string]interface{}{"replicas": 2, "image": "nginx"},
	}
	got := ExtractChartValues(merged, "myapp")
	assert.EqualValues(t, 2, got["replicas"])
	assert.Equal(t, "nginx", got["image"])
	assert.NotContains(t, got, "myapp")
}

func TestExtractChartValues_GlobalAndChartName(t *testing.T) {
	merged := map[string]interface{}{
		"global": map[string]interface{}{"region": "cn"},
		"myapp":  map[string]interface{}{"port": 8080},
	}
	got := ExtractChartValues(merged, "myapp")
	assert.NotNil(t, got["global"])
	assert.EqualValues(t, 8080, got["port"])
}

func TestExtractChartValues_MergeChartGlobalWithoutOverwritingRootGlobal(t *testing.T) {
	merged := map[string]interface{}{
		"global": map[string]interface{}{
			"imageRegistry": "registry.example.com",
			"security": map[string]interface{}{
				"allowInsecureImages": false,
			},
		},
		"infra": map[string]interface{}{
			"global": map[string]interface{}{
				"security": map[string]interface{}{
					"allowInsecureImages": true,
				},
			},
			"mysql": map[string]interface{}{"enabled": true},
		},
	}

	got := ExtractChartValues(merged, "infra")
	global, ok := got["global"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "registry.example.com", global["imageRegistry"])

	security, ok := global["security"].(map[string]interface{})
	require.True(t, ok)
	// Root global remains higher priority for conflicts.
	assert.Equal(t, false, security["allowInsecureImages"])
	mysql, ok := got["mysql"].(map[string]interface{})
	require.True(t, ok)
	assert.EqualValues(t, true, mysql["enabled"])
}

func TestExtractChartValues_NeitherPresent(t *testing.T) {
	merged := map[string]interface{}{
		"otherapp": map[string]interface{}{"x": 1},
	}
	got := ExtractChartValues(merged, "myapp")
	assert.Empty(t, got)
}
