package deployer

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/dtyq/magicrew-cli/kube"
	"github.com/dtyq/magicrew-cli/util"
	corev1 "k8s.io/api/core/v1"
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

// Deployer orchestrates the multi-stage deploy pipeline.
type Deployer struct {
	log        util.LoggerGroup
	opts       *options
	valuesFile string

	// populated by PreflightStage
	chartRefs map[string]chart.ChartReference

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
func New(opts ...Option) *Deployer {
	o := defaultOptions()
	for _, opt := range opts {
		opt(o)
	}
	o.chartSpecs = normalizeChartSpecs(o.chartSpecs)

	d := &Deployer{
		log:        o.log,
		opts:       o,
		valuesFile: o.valuesFile,
	}
	reg := newInfraRegistry(o.configDir)
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

// installChart builds chart dependencies when needed, ensures the namespace,
// installs/upgrades the release, and waits for pods.
func (d *Deployer) installChart(ctx context.Context, name, namespace string, merged map[string]interface{}) error {
	return d.installChartWithWaitSelector(ctx, name, namespace, merged, "")
}

func (d *Deployer) installChartWithWaitSelector(ctx context.Context, name, namespace string, merged map[string]interface{}, waitLabelSelector string) error {
	chartRef, err := d.chartRef(name)
	if err != nil {
		return err
	}

	if chartRef.Kind == chart.RefKindLocal {
		d.log.Logi("deploy", "Building %s chart dependencies...", name)
		if err := chart.DependencyBuild(chartRef); err != nil {
			return fmt.Errorf("dependency build %s: %w", name, err)
		}
	}

	if err := d.kubeClient.EnsureNamespace(ctx, namespace); err != nil {
		return fmt.Errorf("ensure namespace %s: %w", namespace, err)
	}

	if err := ensureReleaseReadyForInstall(ctx, d, name, namespace); err != nil {
		return err
	}

	values := chart.ExtractChartValues(merged, name)

	runHelm := func(runCtx context.Context) error {
		return chart.UpgradeInstall(runCtx, name, namespace, d.kubeClient.RESTConfig(), chartRef, values)
	}

	watchPods := func(runCtx context.Context, helmDone <-chan struct{}) error {
		return watchPodsAfterHelm(runCtx, helmDone, d.kubeClient, d.log, name, namespace, waitLabelSelector)
	}

	return runInstallAndWait(ctx, runHelm, watchPods)
}

func watchPodsAfterHelm(
	ctx context.Context,
	helmDone <-chan struct{},
	kubeClient *kube.Client,
	log util.LoggerGroup,
	chartName string,
	namespace string,
	labelSelector string,
) error {
	reporter := newPodReporter(log, chartName)
	helmConfirmed := false
	confirmIfHelmDone := func() bool {
		select {
		case <-helmDone:
			if !helmConfirmed {
				reporter.Confirm()
				helmConfirmed = true
			}
			return true
		default:
			return false
		}
	}

	if err := kubeClient.WatchPods(ctx, namespace, labelSelector, podReadyTimeout, func(pods []corev1.Pod) (bool, error) {
		helmFinished := confirmIfHelmDone()
		reporter.Report(pods)
		if !helmFinished && confirmIfHelmDone() {
			helmFinished = true
			// Re-render once so the transition tick also shows full details.
			reporter.Report(pods)
		}
		// Keep reporting pod changes until Helm finishes creating the full release set.
		if !helmFinished {
			return false, nil
		}
		return len(pods) > 0 && kube.PodsReadyOrCompleted(pods), nil
	}); err != nil {
		return fmt.Errorf("wait for %s pods: %w", chartName, err)
	}
	return nil
}

func runInstallAndWait(
	ctx context.Context,
	runHelm func(context.Context) error,
	watchPods func(context.Context, <-chan struct{}) error,
) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	helmDone := make(chan struct{})
	errCh := make(chan error, 2)

	go func() {
		err := runHelm(runCtx)
		if err == nil {
			close(helmDone)
		}
		errCh <- err
	}()

	go func() {
		errCh <- watchPods(runCtx, helmDone)
	}()

	for range 2 {
		if err := <-errCh; err != nil {
			return err
		}
	}

	return nil
}

// configPath returns a child path under the configured config directory.
func (d *Deployer) configPath(parts ...string) string {
	return filepath.Join(d.opts.configDir, filepath.Join(parts...))
}

// dataPath returns a child path under the configured data directory.
func (d *Deployer) dataPath(parts ...string) string {
	return filepath.Join(d.opts.dataDir, filepath.Join(parts...))
}
