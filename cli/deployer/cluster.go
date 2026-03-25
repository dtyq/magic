package deployer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/dtyq/magicrew-cli/kube"
	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
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
	registryCfg := s.d.opts.Registry
	restoreContainerProxy, err := ApplyContainerProxyTemporarily(s.d.proxyPlan.ContainerProxyURL, []string{
		registryCfg.Name,
		registry.ContainerEndpoint(registryCfg),
	})
	if err != nil {
		return fmt.Errorf("apply container proxy temporarily: %w", err)
	}
	defer restoreContainerProxy()

	// Mutate opts.Kind in place so later stages and introspection see effective paths/registry host.
	if err := resolveKindMountDirs(&s.d.opts.Kind); err != nil {
		return err
	}
	if s.d.opts.Kind.RegistryHost == "" {
		s.d.opts.Kind.RegistryHost = registry.ContainerEndpoint(registryCfg)
	}

	renderedPath, cleanup, err := cluster.RenderConfig(s.d.opts.Kind)
	if err != nil {
		return fmt.Errorf("render kind config: %w", err)
	}
	defer cleanup()

	if err := cluster.Create(s.d.opts.Kind.Name, renderedPath); err != nil {
		return fmt.Errorf("create kind cluster: %w", err)
	}

	if err := registry.ConnectToKindNetwork(ctx, registryCfg.Name); err != nil {
		return fmt.Errorf("connect registry to kind network: %w", err)
	}

	kubeconfig, err := cluster.GetKubeconfig(s.d.opts.Kind.Name)
	if err != nil {
		return fmt.Errorf("get kubeconfig: %w", err)
	}

	s.d.kubeClient, err = kube.NewClient(kubeconfig)
	if err != nil {
		return fmt.Errorf("create kube client: %w", err)
	}

	if err := s.d.kubeClient.WaitForPodsReady(ctx, "kube-system", "tier=control-plane", podReadyTimeout, newPodReporter(s.d.log, "control-plane")); err != nil {
		return fmt.Errorf("wait for kube-system control-plane: %w", err)
	}

	if err := s.d.kubeClient.RecreateStandardStorageClass(ctx); err != nil {
		return fmt.Errorf("recreate standard storage class: %w", err)
	}

	return nil
}

// resolveKindMountDirs sets LocalPathProvisionerHostDir and ClusterNodeDataHostDir on kind to the
// paths used for bind mounts, creating directories as needed. Empty fields become ~/.magicrew/docker/...
func resolveKindMountDirs(kind *cluster.KindClusterConfig) error {
	return util.NoSudo(func() error {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("get home dir: %w", err)
		}
		defaultLocal := filepath.Join(homeDir, ".magicrew", "docker", "local-path-provisioner")
		defaultData := filepath.Join(homeDir, ".magicrew", "docker", "data")

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
	})
}
