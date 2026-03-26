package cli

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

func TestDefaultConfig_ProxyDeserializesToDeployerProxyConfig(t *testing.T) {
	var c Config
	require.NoError(t, yaml.Unmarshal([]byte(defaultConfig), &c))
	assert.True(t, c.Deploy.Proxy.Enabled)
	assert.True(t, c.Deploy.Proxy.Policy.UseHostProxy)
	assert.True(t, c.Deploy.Proxy.Policy.RequireReachability)
	assert.False(t, c.Deploy.Proxy.Policy.RequireEgress)
	assert.Empty(t, c.Deploy.Proxy.Host.URL)
	assert.Empty(t, c.Deploy.Proxy.Container.URL)
}

func TestYamlUnmarshal_ExplicitProxyDisableIsKept(t *testing.T) {
	raw := `
deploy:
  proxy:
    enabled: false
    policy:
      useHostProxy: false
      requireReachability: false
      requireEgress: false
`
	var c Config
	require.NoError(t, yaml.Unmarshal([]byte(raw), &c))
	assert.False(t, c.Deploy.Proxy.Enabled)
	assert.False(t, c.Deploy.Proxy.Policy.UseHostProxy)
	assert.False(t, c.Deploy.Proxy.Policy.RequireReachability)
	assert.False(t, c.Deploy.Proxy.Policy.RequireEgress)
}
