package cluster

import (
	"bytes"
	_ "embed"
	"fmt"
	"os"
	"text/template"

	"github.com/dtyq/magicrew-cli/util"
	"sigs.k8s.io/kind/pkg/cluster"
	"sigs.k8s.io/kind/pkg/cluster/nodes"
	kindcmd "sigs.k8s.io/kind/pkg/cmd"
)

//go:embed kind-config.yaml
var kindConfigTemplate string

const (
	// DefaultKindClusterName is the default kind cluster name (deploy.kind.name).
	defaultKindClusterName = "magic"

	defaultKindPodSubnet     = "10.244.0.0/16"
	defaultKindServiceSubnet = "172.22.224.0/24"
	defaultKindNodeImage     = "kindest/node:v1.32.8"
	defaultKindMinIOHostPort = 39000
	defaultKindWebHTTPPort   = 38080
	defaultKindWebHTTPSPort  = 38443
)

// KindClusterConfig holds kind cluster settings from config.yml (deploy.kind) and values passed to the embedded kind config template.
type KindClusterConfig struct {
	Name string `yaml:"name"`
	// PodSubnet is the Kubernetes pod CIDR (e.g. 10.244.0.0/16).
	PodSubnet string `yaml:"podSubnet"`
	// ServiceSubnet is the Kubernetes service CIDR (e.g. 172.22.224.0/24).
	ServiceSubnet string `yaml:"serviceSubnet"`
	NodeImage     string `yaml:"nodeImage"`
	// LocalPathProvisionerHostDir is the host path bind-mounted into the kind node at /var/local-path-provisioner. Empty uses ~/.magic/docker/local-path-provisioner at runtime.
	LocalPathProvisionerHostDir string `yaml:"localPathProvisionerHostDir"`
	// ClusterNodeDataHostDir is the host path bind-mounted into the kind node at /data/<Name>. Empty uses ~/.magic/docker/data at runtime.
	ClusterNodeDataHostDir string `yaml:"clusterNodeDataHostDir"`
	// RegistryHost is the hostname:port used in containerd registry mirror config (e.g. kind-registry:5000). Empty uses registry.ContainerEndpoint at deploy time.
	RegistryHost     string `yaml:"registryHost"`
	MinIOHostPort    int    `yaml:"minioHostPort"`
	WebHTTPHostPort  int    `yaml:"webHTTPHostPort"`
	WebHTTPSHostPort int    `yaml:"webHTTPSHostPort"`
}

// NormalizeKindCluster fills zero values in k with built-in defaults for name/subnet/image/ports.
// Non-empty mount dir fields are passed through util.ExpandTilde (~ prefix). RegistryHost is unchanged when empty.
func NormalizeKindCluster(k KindClusterConfig) KindClusterConfig {
	if k.Name == "" {
		k.Name = defaultKindClusterName
	}
	if k.PodSubnet == "" {
		k.PodSubnet = defaultKindPodSubnet
	}
	if k.ServiceSubnet == "" {
		k.ServiceSubnet = defaultKindServiceSubnet
	}
	if k.NodeImage == "" {
		k.NodeImage = defaultKindNodeImage
	}
	if k.MinIOHostPort == 0 {
		k.MinIOHostPort = defaultKindMinIOHostPort
	}
	if k.WebHTTPHostPort == 0 {
		k.WebHTTPHostPort = defaultKindWebHTTPPort
	}
	if k.WebHTTPSHostPort == 0 {
		k.WebHTTPSHostPort = defaultKindWebHTTPSPort
	}
	if k.LocalPathProvisionerHostDir != "" {
		k.LocalPathProvisionerHostDir = util.ExpandTilde(k.LocalPathProvisionerHostDir)
	}
	if k.ClusterNodeDataHostDir != "" {
		k.ClusterNodeDataHostDir = util.ExpandTilde(k.ClusterNodeDataHostDir)
	}
	return k
}

// RenderConfig renders the embedded kind config template with the given data,
// writes the result to a temporary file, and returns its path along with a cleanup
// function that removes the file.
func RenderConfig(data KindClusterConfig) (path string, cleanup func(), err error) {
	tmpl, err := template.New("kind-config").Parse(kindConfigTemplate)
	if err != nil {
		return "", nil, fmt.Errorf("parse kind config template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", nil, fmt.Errorf("render kind config template: %w", err)
	}

	f, err := os.CreateTemp("", "magicrew-kind-config-*.yaml")
	if err != nil {
		return "", nil, fmt.Errorf("create temp kind config: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(buf.Bytes()); err != nil {
		os.Remove(f.Name())
		return "", nil, fmt.Errorf("write temp kind config: %w", err)
	}

	return f.Name(), func() { os.Remove(f.Name()) }, nil
}

// Create creates a kind cluster using the given config file.
// If a cluster with the same name already exists, it is a no-op.
func Create(name, configPath string) error {
	provider := cluster.NewProvider(
		cluster.ProviderWithLogger(kindcmd.NewLogger()),
	)

	existing, err := provider.List()
	if err != nil {
		return err
	}
	for _, c := range existing {
		if c == name {
			return nil
		}
	}

	opts := []cluster.CreateOption{
		cluster.CreateWithWaitForReady(0),
	}
	if configPath != "" {
		raw, err := os.ReadFile(configPath)
		if err != nil {
			return err
		}
		opts = append(opts, cluster.CreateWithRawConfig(raw))
	}

	return provider.Create(name, opts...)
}

// Delete deletes the named kind cluster.
// If the cluster does not exist, it returns nil.
func Delete(name string) error {
	provider := cluster.NewProvider(
		cluster.ProviderWithLogger(kindcmd.NewLogger()),
	)

	existing, err := provider.List()
	if err != nil {
		return err
	}
	for _, c := range existing {
		if c == name {
			return provider.Delete(name, "")
		}
	}
	return nil
}

// GetKubeconfig returns the kubeconfig bytes for the named cluster.
func GetKubeconfig(name string) ([]byte, error) {
	provider := cluster.NewProvider(
		cluster.ProviderWithLogger(kindcmd.NewLogger()),
	)
	cfg, err := provider.KubeConfig(name, false)
	if err != nil {
		return nil, err
	}
	return []byte(cfg), nil
}

// ListNodes returns the nodes of the named cluster (used for health checks).
func ListNodes(name string) ([]nodes.Node, error) {
	provider := cluster.NewProvider(
		cluster.ProviderWithLogger(kindcmd.NewLogger()),
	)
	return provider.ListNodes(name)
}
