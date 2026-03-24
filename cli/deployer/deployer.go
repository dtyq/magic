package deployer

import (
	"context"
	"fmt"
	"time"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/dtyq/magicrew-cli/kube"
	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
)

const (
	podReadyTimeout = 30 * time.Minute

	releaseNameInfra        = "infra"
	releaseNameMagic        = "magic"
	releaseNameMagicSandbox = "magic-sandbox"

	defaultInfraNamespace        = "infra"
	defaultMagicNamespace        = "magic"
	defaultMagicSandboxNamespace = "magic-sandbox"
)

// ChartSpec holds the name and version for a chart release.
type ChartSpec struct {
	Name    string
	Version string
}

// Options holds the configuration for a Deployer.
type Options struct {
	ChartsDir     string
	ChartRepo     string
	PlainHTTP     bool // use plain HTTP for OCI chart repo
	ChartRepoUser string
	ChartRepoPass string
	PassCredsAll  bool
	ChartSpecs    map[string]ChartSpec
	ValuesFile    string
	WebBaseURL    string // magic-web external URL (CLI --web-url or MAGIC_WEB_BASE_URL)
	Registry      registry.Config
	Kind          cluster.KindClusterConfig
	InfraUseProxy bool // route infra image pulls through the local registry proxy
	Log           util.LoggerGroup
}

// Deployer orchestrates the multi-stage deploy pipeline.
type Deployer struct {
	log        util.LoggerGroup
	opts       Options
	chartSpecs map[string]ChartSpec
	valuesFile string

	// populated by PreflightStage
	chartRefs map[string]chart.ChartReference
	proxyPlan ProxyPlan

	// populated by BootstrapClusterStage
	kubeClient *kube.Client

	// populated by PrepareValuesStage
	merged map[string]interface{}

	infraRegistry *InfraRegistry
	stages        []Stage
}

// New creates a Deployer with all stages wired up.
// Construction order: Deployer → InfraRegistry → Stages (pass d pointer to each).
// This order ensures stage constructors can register InfraRegistry dependencies
// before InfraStage's Prep resolves them.
func New(opts Options) *Deployer {
	opts.Kind = cluster.NormalizeKindCluster(opts.Kind)
	d := &Deployer{
		log:        opts.Log,
		opts:       opts,
		chartSpecs: normalizeChartSpecs(opts.ChartSpecs),
		valuesFile: opts.ValuesFile,
	}
	reg := newInfraRegistry()
	d.infraRegistry = reg
	d.stages = []Stage{
		newPreflightStage(d),
		newBootstrapRegistryStage(d),
		newPrepareValuesStage(d),
		newBootstrapClusterStage(d),
		newInfraStage(d, reg),        // Prep: resolves creds + renders overlay; includes ingress-nginx sub-chart
		newMagicStage(d, reg),        // constructor registers MySQL/Redis/RabbitMQ/MinIO
		newMagicSandboxStage(d, reg), // constructor registers MySQL/Redis/MinIO
		newSummaryStage(d),
	}
	return d
}

// Run executes all deployment stages in order.
func (d *Deployer) Run(ctx context.Context) error {
	return runStages(ctx, d)
}

// installChart is a shared helper used by multiple stages to build dependencies,
// ensure the namespace, install/upgrade, and wait for pods.
func installChart(ctx context.Context, d *Deployer, name, namespace string, chartRef chart.ChartReference, merged map[string]interface{}) error {
	return installChartWithWaitSelector(ctx, d, name, namespace, chartRef, merged, "")
}

func installChartWithWaitSelector(ctx context.Context, d *Deployer, name, namespace string, chartRef chart.ChartReference, merged map[string]interface{}, waitLabelSelector string) error {
	if chartRef.Kind == chart.RefKindLocal {
		d.log.Logi("deploy", "Building %s chart dependencies...", name)
		if err := chart.DependencyBuild(chartRef); err != nil {
			return fmt.Errorf("dependency build %s: %w", name, err)
		}
	}
	if err := d.kubeClient.EnsureNamespace(ctx, namespace); err != nil {
		return fmt.Errorf("ensure namespace %s: %w", namespace, err)
	}
	values := chart.ExtractChartValues(merged, name)
	if err := chart.UpgradeInstall(ctx, name, namespace, d.kubeClient.RESTConfig(), chartRef, values); err != nil {
		return fmt.Errorf("helm install %s: %w", name, err)
	}
	if err := d.kubeClient.WaitForPodsReady(ctx, namespace, waitLabelSelector, podReadyTimeout, newPodReporter(d.log, name)); err != nil {
		return fmt.Errorf("wait for %s pods: %w", name, err)
	}
	return nil
}
