package deployer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

	restoreProxyEnv, err := ensureKindNoProxyForRegistry(registryCfg)
	if err != nil {
		return fmt.Errorf("set kind no_proxy for registry: %w", err)
	}
	defer restoreProxyEnv()

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

func ensureKindNoProxyForRegistry(cfg registry.Config) (func(), error) {
	entries := []string{
		cfg.Name,
		registry.ContainerEndpoint(cfg),
	}
	restoreUpper, err := appendCSVEnv("NO_PROXY", entries)
	if err != nil {
		return nil, err
	}
	restoreLower, err := appendCSVEnv("no_proxy", entries)
	if err != nil {
		restoreUpper()
		return nil, err
	}
	return func() {
		restoreLower()
		restoreUpper()
	}, nil
}

func appendCSVEnv(key string, additions []string) (func(), error) {
	original, existed := os.LookupEnv(key)
	merged := mergeCSV(original, additions)
	if err := os.Setenv(key, merged); err != nil {
		return nil, err
	}
	return func() {
		if existed {
			_ = os.Setenv(key, original)
			return
		}
		_ = os.Unsetenv(key)
	}, nil
}

func mergeCSV(current string, additions []string) string {
	seen := map[string]struct{}{}
	out := make([]string, 0)
	appendValue := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		k := strings.ToLower(v)
		if _, ok := seen[k]; ok {
			return
		}
		seen[k] = struct{}{}
		out = append(out, v)
	}

	for _, item := range strings.Split(current, ",") {
		appendValue(item)
	}
	for _, item := range additions {
		appendValue(item)
	}
	return strings.Join(out, ",")
}
