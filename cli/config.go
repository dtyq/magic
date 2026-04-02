package cli

import (
	"os"
	"path/filepath"

	"go.yaml.in/yaml/v3"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/dtyq/magicrew-cli/deployer"
	"github.com/dtyq/magicrew-cli/deps"
	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
)

type Config struct {
	Log          []util.LogStreamConfig `yaml:"log"`
	ImageBuilder yaml.Node              `yaml:"imageBuilder"`
	Deploy       DeployConfig           `yaml:"deploy"`

	// data, this describes what will the CLI do
	Workdir string         `yaml:"workdir"`
	Deps    []deps.DepData `yaml:"deps"`
}

type DeployChartConfig struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version"`
}

// ChartRepoConfig holds chart repository URL and whether to use plain HTTP (for OCI).
type ChartRepoConfig struct {
	URL                string `yaml:"url"`
	PlainHTTP          bool   `yaml:"plainHTTP"`
	Username           string `yaml:"username"`
	Password           string `yaml:"password"`
	PassCredentialsAll bool   `yaml:"passCredentialsAll"`
}

type DeployConfig struct {
	ChartRepo     ChartRepoConfig              `yaml:"chartRepo"`
	Values        string                       `yaml:"values"`
	Registry      registry.Config              `yaml:"registry"`
	Kind          cluster.KindClusterConfig    `yaml:"kind"`
	Charts        map[string]DeployChartConfig `yaml:"charts"`
	InfraUseProxy bool                         `yaml:"infraUseProxy"`
	Proxy         deployer.ProxyConfig         `yaml:"proxy"`
}

// defaultDeployCharts 返回 deploy.charts 的默认值；当配置文件为空或未配置 charts 时使用。
func defaultDeployCharts() map[string]DeployChartConfig {
	return map[string]DeployChartConfig{
		"infra":         {Name: "infra", Version: ""},
		"magic":         {Name: "magic", Version: ""},
		"magic-sandbox": {Name: "magic-sandbox", Version: ""},
	}
}

func defaultDeployProxyConfig() deployer.ProxyConfig {
	return deployer.ProxyConfig{
		Enabled: true,
		Policy: deployer.ProxyPolicyConfig{
			UseHostProxy:        true,
			RequireReachability: true,
			RequireEgress:       false,
		},
	}
}

var cfg *Config

const defaultConfig = `
log:
  - kind: file
    path: stderr
    level: info
    type: text

imageBuilder:
  # by default, use docker buildkit builder
  kind: dockerBuildkit
  imagePrefix: ghcr.io/dtyq/

deploy:
  chartRepo:
    url: "https://dtyq.github.io/artifacts"
    username: ""
    password: ""
    passCredentialsAll: false
  values: ""
  registry:
    name: magic-kind-registry
    hostPort: 35000
    image: registry:2
    dataDir: ""
    useHostProxyEnv: false
    proxy:
      enabled: true
      url: "https://ghcr.io"
      username: ""
      password: ""
    caFile: ""
  charts:
    infra:
      name: infra
      version: "0.0.1"
    magic:
      name: magic
      version: "0.0.1"
    magic-sandbox:
      name: magic-sandbox
      version: "0.0.2"
  infraUseProxy: false
  proxy:
    enabled: true
    host:
      url: ""
    container:
      url: ""
    policy:
      useHostProxy: true
      requireReachability: true
      requireEgress: false
`

func initConfig() {
	util.NoSudo(func() error {
		// determine config file path
		if cfgFile == "" {
			cfgFile = filepath.Join(util.ConfigDir(), "config.yml")
		} else {
			cfgFile = util.ExpandTilde(cfgFile)
		}
		lg.Logd("init", "config file path: %s", cfgFile)

		// check if config file exists
		if _, err := os.Stat(cfgFile); os.IsNotExist(err) {
			lg.Logd("init", "config file not found, creating default config file")
			// best effort to create config file directory and file
			// create config file directory
			os.MkdirAll(filepath.Dir(cfgFile), 0755)
			// create config file
			os.WriteFile(cfgFile, []byte(defaultConfig), 0644)
		}
		return nil
	})

	// read and parse config file
	cfgData, err := os.ReadFile(cfgFile)
	if err != nil {
		lg.Logw("config", "%s", i18n.L("errorReadingConfig", err))
		return
	}
	cfg = &Config{}
	if err := yaml.Unmarshal(cfgData, cfg); err != nil {
		lg.Logw("config", "%s", i18n.L("errorUnmarshallingConfig", err))
		// use default config
	}
	if len(cfg.Deploy.Charts) == 0 {
		cfg.Deploy.Charts = defaultDeployCharts()
	}
	cfg.Deploy.Registry = registry.NormalizeConfig(cfg.Deploy.Registry)
	cfg.Deploy.Kind = cluster.NormalizeKindCluster(cfg.Deploy.Kind)

	// read magicrew.yml
	setLoggers(cfg.Log)
}

func init() {
	// default config and loggers
	var err error
	builderNode := yaml.Node{}
	err = builderNode.Encode(map[string]any{
		"kind":        "dockerBuildkit",
		"imagePrefix": "ghcr.io/dtyq/",
	})
	if err != nil {
		// impossible to happen
		panic(err)
	}
	cfg = &Config{
		Log: []util.LogStreamConfig{
			{
				Level: util.LogLevelInfo,
				Kind:  util.LogKindFile,
				Type:  util.LogTypeText,
			},
		},
		ImageBuilder: builderNode,
		Deps: []deps.DepData{
			{
				Name:         "common_tool",
				Version:      deps.LatestVersion,
				Dependencies: []string{},
			},
		},
		Deploy: DeployConfig{
			ChartRepo: ChartRepoConfig{},
			Values:    "",
			Registry:  registry.NormalizeConfig(registry.Config{}),
			Kind:      cluster.NormalizeKindCluster(cluster.KindClusterConfig{}),
			Charts:    defaultDeployCharts(),
			Proxy:     defaultDeployProxyConfig(),
		},
	}
	lg, err = util.NewLoggers(
		[]util.LogStreamConfig{
			{
				Kind:  util.LogKindFile,
				Path:  "stderr",
				Level: util.LogLevelInfo,
				Type:  util.LogTypeText,
			},
		},
	)
	if err != nil {
		// impossible to happen
		panic(err)
	}
}
