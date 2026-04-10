package deployer

import (
	"context"
	"fmt"
	"os"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/dtyq/magicrew-cli/kube"
	"github.com/dtyq/magicrew-cli/registry"
	corev1 "k8s.io/api/core/v1"
)

// BootstrapClusterStage creates (or reuses) a kind cluster and initialises the kube client.
type BootstrapClusterStage struct {
	BaseStage
	d *Deployer
}

func newBootstrapClusterStage(d *Deployer) *BootstrapClusterStage {
	return &BootstrapClusterStage{BaseStage: BaseStage{"bootstrap cluster"}, d: d}
}

func (s *BootstrapClusterStage) Exec(ctx context.Context) error {
	registryCfg := s.d.opts.registry
	restoreContainerProxy, err := applyContainerProxyTemporarily(s.d.opts.proxy.Container.URL, []string{
		registryCfg.Name,
		registry.ContainerEndpoint(registryCfg),
	})
	if err != nil {
		return fmt.Errorf("apply container proxy temporarily: %w", err)
	}
	defer restoreContainerProxy()

	// Mutate opts.Kind in place so later stages and introspection see effective paths/registry host.
	if err := s.d.resolveKindMountDirs(&s.d.opts.kind); err != nil {
		return err
	}
	if s.d.opts.kind.RegistryHost == "" {
		s.d.opts.kind.RegistryHost = registry.ContainerEndpoint(registryCfg)
	}

	renderedPath, cleanup, err := cluster.RenderConfig(s.d.opts.kind)
	if err != nil {
		return fmt.Errorf("render kind config: %w", err)
	}
	defer cleanup()

	if err := cluster.Create(s.d.opts.kind.Name, renderedPath); err != nil {
		return fmt.Errorf("create kind cluster: %w", err)
	}

	if err := registry.ConnectToKindNetwork(ctx, registryCfg.Name); err != nil {
		return fmt.Errorf("connect registry to kind network: %w", err)
	}

	kubeconfig, err := cluster.GetKubeconfig(s.d.opts.kind.Name)
	if err != nil {
		return fmt.Errorf("get kubeconfig: %w", err)
	}

	s.d.kubeClient, err = kube.NewClient(kubeconfig)
	if err != nil {
		return fmt.Errorf("create kube client: %w", err)
	}

	reporter := newPodReporter(s.d.log, "control-plane")
	if err := s.d.kubeClient.WatchPods(ctx, "kube-system", "tier=control-plane", podReadyTimeout, func(pods []corev1.Pod) (bool, error) {
		ready := len(pods) > 0 && kube.PodsReadyOrCompleted(pods)
		if ready {
			reporter.Confirm()
		}
		reporter.Report(pods)
		return ready, nil
	}); err != nil {
		return fmt.Errorf("wait for kube-system control-plane: %w", err)
	}

	if err := s.d.kubeClient.RecreateStandardStorageClass(ctx); err != nil {
		return fmt.Errorf("recreate standard storage class: %w", err)
	}

	return nil
}

// resolveKindMountDirs sets LocalPathProvisionerHostDir and ClusterNodeDataHostDir on kind to the
// paths used for bind mounts, creating directories as needed.
// Empty fields become <DataDir>/docker/....
func (d *Deployer) resolveKindMountDirs(kind *cluster.KindClusterConfig) error {
	defaultLocal := d.dataPath("docker", "local-path-provisioner")
	defaultData := d.dataPath("docker", "data")

	localPath := kind.LocalPathProvisionerHostDir
	if localPath == "" {
		localPath = defaultLocal
	}
	dataDir := kind.ClusterNodeDataHostDir
	if dataDir == "" {
		dataDir = defaultData
	}
	for _, dir := range []string{localPath, dataDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create mount dir %s: %w", dir, err)
		}
	}
	kind.LocalPathProvisionerHostDir = localPath
	kind.ClusterNodeDataHostDir = dataDir
	return nil
}
