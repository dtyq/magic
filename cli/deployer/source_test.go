package deployer

import (
	"testing"

	"github.com/dtyq/magicrew-cli/registry"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveChartRefs_RewritesOCIRepoToHostEndpoint(t *testing.T) {
	d := &Deployer{
		opts: Options{
			ChartRepo: "oci://magic-kind-registry:5000/magic-charts-open",
			ChartSpecs: map[string]ChartSpec{
				"magic": {Name: "magic", Version: "0.0.1"},
			},
			Registry: registry.Config{
				Name: "magic-kind-registry",
				Port: 5000,
			},
		},
		chartSpecs: map[string]ChartSpec{
			"magic": {Name: "magic", Version: "0.0.1"},
		},
	}

	err := d.resolveChartRefs()
	require.NoError(t, err)

	ref, ok := d.chartRefs["magic"]
	require.True(t, ok)
	assert.Equal(t, "oci://"+registry.HostEndpoint(d.opts.Registry)+"/magic-charts-open", ref.RepoURL)
}

func TestResolveChartRefs_KeepOCIRepoWhenHostNotRegistryContainerEndpoint(t *testing.T) {
	d := &Deployer{
		opts: Options{
			ChartRepo: "oci://example-registry:5000/magic-charts-open",
			ChartSpecs: map[string]ChartSpec{
				"magic": {Name: "magic", Version: "0.0.1"},
			},
			Registry: registry.Config{
				Name: "magic-kind-registry",
				Port: 5000,
			},
		},
		chartSpecs: map[string]ChartSpec{
			"magic": {Name: "magic", Version: "0.0.1"},
		},
	}

	err := d.resolveChartRefs()
	require.NoError(t, err)

	ref, ok := d.chartRefs["magic"]
	require.True(t, ok)
	assert.Equal(t, "oci://example-registry:5000/magic-charts-open", ref.RepoURL)
}

func TestResolveChartRefs_HTTPRepoCarriesBasicAuth(t *testing.T) {
	d := &Deployer{
		opts: Options{
			ChartRepo:     "https://git.example.com/org/charts",
			ChartRepoUser: "user1",
			ChartRepoPass: "pat-123",
			PassCredsAll:  true,
		},
		chartSpecs: map[string]ChartSpec{
			"infra": {Name: "infra", Version: "0.0.1"},
		},
	}

	err := d.resolveChartRefs()
	require.NoError(t, err)

	ref, ok := d.chartRefs["infra"]
	require.True(t, ok)
	assert.Equal(t, "https://git.example.com/org/charts", ref.RepoURL)
	assert.Equal(t, "infra", ref.Name)
	assert.Equal(t, "0.0.1", ref.Version)
	assert.Equal(t, "user1", ref.Username)
	assert.Equal(t, "pat-123", ref.Password)
	assert.True(t, ref.PassCredentialsAll)
}
