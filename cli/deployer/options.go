package deployer

import (
	"path/filepath"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
)

// Option configures a Deployer.
type Option func(*options)

// options holds deployer configuration (unexported).
type options struct {
	chartRepo          ChartRepoConfig
	chartsDir          string
	chartSpecs         map[string]ChartSpec
	valuesFile         string
	webBaseURL         string
	minioURL           string
	registry           registry.Config
	kind               cluster.KindClusterConfig
	proxy              ProxyConfig
	configDir          string
	dataDir            string
	configFile         string
	infraUseProxy      bool
	autoRecoverRelease bool
	log                util.LoggerGroup
}

// ChartRepoConfig holds chart repository connection configuration.
type ChartRepoConfig struct {
	URL                string `yaml:"url"`
	PlainHTTP          bool   `yaml:"plainHTTP"`
	Username           string `yaml:"username"`
	Password           string `yaml:"password"`
	PassCredentialsAll bool   `yaml:"passCredentialsAll"`
}

// ProxyEndpointConfig holds proxy endpoint configuration.
type ProxyEndpointConfig struct {
	URL     string   `yaml:"url"`
	NoProxy []string `yaml:"-"`
}

// ProxyPolicyConfig holds proxy policy configuration.
type ProxyPolicyConfig struct {
	UseHostProxy        bool `yaml:"useHostProxy"`
	RequireReachability bool `yaml:"requireReachability"`
	RequireEgress       bool `yaml:"requireEgress"`
}

// ProxyConfig holds proxy configuration.
type ProxyConfig struct {
	Enabled   bool                `yaml:"enabled"`
	Host      ProxyEndpointConfig `yaml:"host"`
	Container ProxyEndpointConfig `yaml:"container"`
	Policy    ProxyPolicyConfig   `yaml:"policy"`
}

func defaultOptions() *options {
	configDir := filepath.Join(util.ConfigDir(), "magicrew")
	dataDir := filepath.Join(util.HomeDir(), ".magicrew")

	return &options{
		chartRepo: ChartRepoConfig{},
		registry:  registry.NormalizeConfig(registry.Config{}),
		kind:      cluster.NormalizeKindCluster(cluster.KindClusterConfig{}),
		proxy: ProxyConfig{
			Enabled: true,
			Policy: ProxyPolicyConfig{
				UseHostProxy:        true,
				RequireReachability: true,
				RequireEgress:       false,
			},
		},
		chartSpecs: make(map[string]ChartSpec),
		configDir:  configDir,
		dataDir:    dataDir,
	}
}

func WithChartRepo(repo ChartRepoConfig) Option {
	return func(o *options) { o.chartRepo = repo }
}

func WithChartsDir(dir string) Option {
	return func(o *options) { o.chartsDir = dir }
}

func WithChartSpecs(specs map[string]ChartSpec) Option {
	return func(o *options) { o.chartSpecs = specs }
}

func WithValuesFile(path string) Option {
	return func(o *options) { o.valuesFile = path }
}

func WithWebBaseURL(url string) Option {
	return func(o *options) { o.webBaseURL = url }
}

func WithMinIOURL(url string) Option {
	return func(o *options) { o.minioURL = url }
}

func WithRegistry(cfg registry.Config) Option {
	return func(o *options) { o.registry = cfg }
}

func WithKind(cfg cluster.KindClusterConfig) Option {
	return func(o *options) { o.kind = cfg }
}

func WithProxy(cfg ProxyConfig) Option {
	return func(o *options) { o.proxy = cfg }
}

func WithConfigDir(dir string) Option {
	return func(o *options) { o.configDir = dir }
}

func WithDataDir(dir string) Option {
	return func(o *options) { o.dataDir = dir }
}

func WithConfigFile(path string) Option {
	return func(o *options) { o.configFile = path }
}

func WithInfraUseProxy(b bool) Option {
	return func(o *options) { o.infraUseProxy = b }
}

func WithAutoRecoverRelease(b bool) Option {
	return func(o *options) { o.autoRecoverRelease = b }
}

func WithLog(lg util.LoggerGroup) Option {
	return func(o *options) { o.log = lg }
}
