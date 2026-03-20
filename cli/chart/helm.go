package chart

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"
	"helm.sh/helm/v4/pkg/action"
	helmchart "helm.sh/helm/v4/pkg/chart"
	"helm.sh/helm/v4/pkg/chart/loader"
	"helm.sh/helm/v4/pkg/cli"
	"helm.sh/helm/v4/pkg/downloader"
	"helm.sh/helm/v4/pkg/getter"
	"helm.sh/helm/v4/pkg/kube"
	"helm.sh/helm/v4/pkg/registry"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

const defaultTimeout = 10 * time.Minute

type RefKind string

const (
	RefKindLocal RefKind = "local"
	RefKindHTTP  RefKind = "http"
	RefKindOCI   RefKind = "oci"
)

type ChartReference struct {
	Kind               RefKind
	Path               string
	RepoURL            string
	Name               string
	Version            string
	Username           string
	Password           string
	PassCredentialsAll bool
	PlainHTTP          bool // only meaningful for RefKindOCI
}

func NewLocalReference(path string) ChartReference {
	return ChartReference{
		Kind: RefKindLocal,
		Path: path,
	}
}

func NewHTTPReference(repoURL, name, version, username, password string, passCredentialsAll bool) ChartReference {
	return ChartReference{
		Kind:               RefKindHTTP,
		RepoURL:            repoURL,
		Name:               name,
		Version:            version,
		Username:           username,
		Password:           password,
		PassCredentialsAll: passCredentialsAll,
	}
}

func NewOCIReference(repoURL, name, version string, plainHTTP bool) ChartReference {
	return ChartReference{
		Kind:      RefKindOCI,
		RepoURL:   repoURL,
		Name:      name,
		Version:   version,
		PlainHTTP: plainHTTP,
	}
}

func (r ChartReference) DisplayName() string {
	switch r.Kind {
	case RefKindLocal:
		return r.Path
	case RefKindHTTP:
		return fmt.Sprintf("%s/%s", strings.TrimRight(r.RepoURL, "/"), r.Name)
	case RefKindOCI:
		base := strings.TrimRight(r.RepoURL, "/")
		if r.Name == "" {
			return base
		}
		return fmt.Sprintf("%s/%s", base, r.Name)
	default:
		return r.Name
	}
}

// ReadFile reads a named file from the chart.
// For local refs, reads from the chart directory on disk.
// For remote refs (HTTP/OCI), downloads the chart and extracts the file from the archive.
func (r ChartReference) ReadFile(name string) ([]byte, error) {
	if r.Kind == RefKindLocal {
		p := filepath.Join(r.Path, name)
		data, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", p, err)
		}
		return data, nil
	}

	settings := cli.New()
	chartPath, err := r.locate(settings)
	if err != nil {
		return nil, fmt.Errorf("locate chart %s: %w", r.DisplayName(), err)
	}
	ch, err := loader.Load(chartPath)
	if err != nil {
		return nil, fmt.Errorf("load chart %s: %w", chartPath, err)
	}
	accessor, err := helmchart.NewAccessor(ch)
	if err != nil {
		return nil, fmt.Errorf("open chart accessor %s: %w", chartPath, err)
	}
	for _, f := range accessor.Files() {
		if f.Name == name {
			return f.Data, nil
		}
	}
	return nil, fmt.Errorf("file %q not found in chart %s", name, r.DisplayName())
}

func (r ChartReference) locate(settings *cli.EnvSettings) (string, error) {
	switch r.Kind {
	case RefKindLocal:
		return r.Path, nil
	case RefKindHTTP:
		pathOpts := action.ChartPathOptions{
			RepoURL:            r.RepoURL,
			Version:            r.Version,
			Username:           r.Username,
			Password:           r.Password,
			PassCredentialsAll: r.PassCredentialsAll,
		}
		return pathOpts.LocateChart(r.Name, settings)
	case RefKindOCI:
		return r.locateOCI(settings)
	default:
		return "", fmt.Errorf("unsupported chart reference kind: %s", r.Kind)
	}
}

func (r ChartReference) locateOCI(settings *cli.EnvSettings) (string, error) {
	var regOpts []registry.ClientOption
	if r.PlainHTTP {
		regOpts = append(regOpts, registry.ClientOptPlainHTTP())
	}
	regClient, err := registry.NewClient(regOpts...)
	if err != nil {
		return "", fmt.Errorf("create registry client: %w", err)
	}
	cfg := action.NewConfiguration()
	cfg.RegistryClient = regClient
	inst := action.NewInstall(cfg)
	inst.ChartPathOptions.Version = r.Version
	inst.ChartPathOptions.PlainHTTP = r.PlainHTTP
	ociRef := r.DisplayName()
	return inst.LocateChart(ociRef, settings)
}

// DependencyBuild runs `helm dependency build` for local chart references.
func DependencyBuild(ref ChartReference) error {
	if ref.Kind != RefKindLocal {
		return nil
	}
	settings := cli.New()
	man := &downloader.Manager{
		Out:              os.Stdout,
		ChartPath:        ref.Path,
		Verify:           downloader.VerifyNever,
		SkipUpdate:       false,
		RepositoryConfig: settings.RepositoryConfig,
		RepositoryCache:  settings.RepositoryCache,
		Debug:            false,
		Getters:          getter.All(settings),
	}
	return man.Update()
}

// DefaultValues reads chart defaults from the chart reference.
// Remote references are resolved through Helm chart resolution and loaded
// from the located chart package.
func DefaultValues(ref ChartReference) (map[string]interface{}, error) {
	settings := cli.New()
	chartPath, err := ref.locate(settings)
	if err != nil {
		return nil, fmt.Errorf("locate chart %s: %w", ref.DisplayName(), err)
	}
	if ref.Kind == RefKindLocal {
		valuesPath := filepath.Join(chartPath, "values.yaml")
		data, err := os.ReadFile(valuesPath)
		if err != nil {
			return nil, fmt.Errorf("read default values %s: %w", valuesPath, err)
		}

		var parsed map[string]interface{}
		if err := yaml.Unmarshal(data, &parsed); err != nil {
			return nil, fmt.Errorf("parse default values %s: %w", valuesPath, err)
		}
		if parsed == nil {
			return map[string]interface{}{}, nil
		}
		return parsed, nil
	}

	loaded, err := loader.Load(chartPath)
	if err != nil {
		return nil, fmt.Errorf("load chart %s: %w", chartPath, err)
	}
	accessor, err := helmchart.NewAccessor(loaded)
	if err != nil {
		return nil, fmt.Errorf("new chart accessor for %s: %w", chartPath, err)
	}
	loadedValues := accessor.Values()
	if loadedValues == nil {
		return map[string]interface{}{}, nil
	}
	values := map[string]interface{}{}
	for key, value := range loadedValues {
		values[key] = value
	}
	return values, nil
}

// restConfigGetter implements Helm's RESTClientGetter from *rest.Config without a kubeconfig file.
// Helm's kube.Client calls ToRawKubeConfigLoader().Namespace(), so a non-nil ClientConfig must be returned.
type restConfigGetter struct {
	config    *rest.Config
	namespace string
}

func (g *restConfigGetter) ToRESTConfig() (*rest.Config, error) { return g.config, nil }

func (g *restConfigGetter) ToDiscoveryClient() (discovery.CachedDiscoveryInterface, error) {
	dc, err := discovery.NewDiscoveryClientForConfig(g.config)
	if err != nil {
		return nil, err
	}
	return memory.NewMemCacheClient(dc), nil
}

func (g *restConfigGetter) ToRESTMapper() (meta.RESTMapper, error) {
	dc, err := g.ToDiscoveryClient()
	if err != nil {
		return nil, err
	}
	return restmapper.NewDeferredDiscoveryRESTMapper(dc), nil
}

func (g *restConfigGetter) ToRawKubeConfigLoader() clientcmd.ClientConfig {
	return &restConfigClientConfig{config: g.config, namespace: g.namespace}
}

// restConfigClientConfig implements clientcmd.ClientConfig; only ClientConfig() and Namespace() are meaningful; the rest are minimal stubs for Helm.
type restConfigClientConfig struct {
	config    *rest.Config
	namespace string
}

func (c *restConfigClientConfig) RawConfig() (clientcmdapi.Config, error) {
	return clientcmdapi.Config{}, nil
}
func (c *restConfigClientConfig) ClientConfig() (*rest.Config, error)  { return c.config, nil }
func (c *restConfigClientConfig) Namespace() (string, bool, error)     { return c.namespace, true, nil }
func (c *restConfigClientConfig) ConfigAccess() clientcmd.ConfigAccess { return emptyConfigAccess }

// emptyConfigAccess implements clientcmd.ConfigAccess with no file I/O; shared by restConfigClientConfig.
var emptyConfigAccess = &emptyConfigAccessImpl{}

type emptyConfigAccessImpl struct{}

func (emptyConfigAccessImpl) GetLoadingRules() *clientcmd.ClientConfigLoadingRules {
	return &clientcmd.ClientConfigLoadingRules{}
}
func (emptyConfigAccessImpl) GetStartingConfig() (*clientcmdapi.Config, error) {
	return &clientcmdapi.Config{}, nil
}
func (emptyConfigAccessImpl) GetDefaultFilename() string     { return "" }
func (emptyConfigAccessImpl) GetExplicitFile() string        { return "" }
func (emptyConfigAccessImpl) GetLoadingPrecedence() []string { return nil }
func (emptyConfigAccessImpl) IsExplicitFile() bool           { return false }

// UpgradeInstall performs helm upgrade --install for the given release.
// config is the same rest.Config used by the kube client (e.g. from kube.Client.RESTConfig()).
func UpgradeInstall(ctx context.Context, releaseName, namespace string, config *rest.Config, ref ChartReference, values map[string]interface{}) error {
	cfg, err := newActionConfig(namespace, config)
	if err != nil {
		return err
	}

	settings := cli.New()
	chartPath, err := ref.locate(settings)
	if err != nil {
		return fmt.Errorf("locate chart %s: %w", ref.DisplayName(), err)
	}

	ch, err := loader.Load(chartPath)
	if err != nil {
		return fmt.Errorf("load chart %s: %w", chartPath, err)
	}

	histClient := action.NewHistory(cfg)
	histClient.Max = 1
	_, err = histClient.Run(releaseName)

	var upgradeErr error
	if err != nil {
		// No existing release — install
		install := action.NewInstall(cfg)
		install.ReleaseName = releaseName
		install.Namespace = namespace
		install.CreateNamespace = true
		install.Timeout = defaultTimeout
		install.WaitStrategy = kube.HookOnlyStrategy
		install.WaitForJobs = false
		_, upgradeErr = install.RunWithContext(ctx, ch, values)
	} else {
		// Existing release — upgrade
		upgrade := action.NewUpgrade(cfg)
		upgrade.Namespace = namespace
		upgrade.Timeout = defaultTimeout
		upgrade.WaitStrategy = kube.HookOnlyStrategy
		upgrade.WaitForJobs = false
		_, upgradeErr = upgrade.RunWithContext(ctx, releaseName, ch, values)
	}
	return upgradeErr
}

func newActionConfig(namespace string, config *rest.Config) (*action.Configuration, error) {
	getter := &restConfigGetter{config: config, namespace: namespace}
	cfg := new(action.Configuration)
	if err := cfg.Init(getter, namespace, "secret"); err != nil {
		return nil, fmt.Errorf("init helm action config: %w", err)
	}
	return cfg, nil
}
