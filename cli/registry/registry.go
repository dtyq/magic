package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/dtyq/magicrew-cli/util"
)

// Config mirrors cli.RegistryConfig to avoid an import cycle.
type Config struct {
	Name            string      `yaml:"name"`
	Port            int         `yaml:"port"`
	Image           string      `yaml:"image"`
	DataDir         string      `yaml:"dataDir"`
	UseHostProxyEnv bool        `yaml:"useHostProxyEnv"`
	Proxy           ProxyConfig `yaml:"proxy"`
	CAFile          string      `yaml:"caFile"`
	ExtraHosts      []string    `yaml:"extraHosts"`
}

// ProxyConfig mirrors cli.RegistryProxyConfig.
type ProxyConfig struct {
	Enabled  bool   `yaml:"enabled"`
	URL      string `yaml:"url"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

// Defaults for local kind registry when deploy.registry is omitted or partial.
const (
	DefaultName  = "magic-kind-registry"
	DefaultPort  = 5000
	DefaultImage = "registry:2"
)

var hostPort = 35000

// NormalizeConfig fills empty name/image and zero port with defaults, and expands ~ in DataDir and CAFile.
func NormalizeConfig(cfg Config) Config {
	if cfg.Name == "" {
		cfg.Name = DefaultName
	}
	if cfg.Port == 0 {
		cfg.Port = DefaultPort
	}
	if cfg.Image == "" {
		cfg.Image = DefaultImage
	}
	cfg.DataDir = util.ExpandTilde(cfg.DataDir)
	cfg.CAFile = util.ExpandTilde(cfg.CAFile)
	return cfg
}

const kindNetworkName = "kind"

// ContainerEndpoint returns the address kind nodes use to reach the registry
// over the Docker kind network, e.g. "kind-registry:5000".
func ContainerEndpoint(cfg Config) string {
	return fmt.Sprintf("%s:%d", cfg.Name, cfg.Port)
}

// HostEndpoint returns the address the local host process uses to reach
// the registry published on loopback, e.g. "127.0.0.1:5000".
func HostEndpoint(cfg Config) string {
	return fmt.Sprintf("127.0.0.1:%d", hostPort)
}

// WaitForHostEndpoint blocks until the local host endpoint serves registry v2 API.
func WaitForHostEndpoint(ctx context.Context, cfg Config, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := &http.Client{Timeout: 1 * time.Second}
	url := fmt.Sprintf("http://%s/v2/", HostEndpoint(cfg))
	for {
		req, err := http.NewRequestWithContext(waitCtx, http.MethodGet, url, nil)
		if err == nil {
			resp, reqErr := client.Do(req)
			if reqErr == nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					return nil
				}
			}
		}

		select {
		case <-waitCtx.Done():
			return fmt.Errorf("wait for registry host endpoint %s: %w", HostEndpoint(cfg), waitCtx.Err())
		case <-time.After(200 * time.Millisecond):
		}
	}
}

// EnsureRunning idempotently ensures the registry container is running.
//   - Already running or stopped → docker restart to apply latest config.
//   - Does not exist → docker run with the given config.
func EnsureRunning(ctx context.Context, cfg Config) error {
	exists, err := containerExists(ctx, cfg.Name)
	if err != nil {
		return err
	}
	if cfg.Proxy.Enabled && cfg.Proxy.URL != "" {
		if _, err := writeRegistryConfig(cfg); err != nil {
			return fmt.Errorf("write registry config: %w", err)
		}
	}
	if exists {
		// If an old container still mounts a temp config path, recreate it so
		// the mount source switches to ~/.config/magicrew.
		if cfg.Proxy.Enabled && cfg.Proxy.URL != "" {
			recreate, err := needsRecreateForConfigMount(ctx, cfg)
			if err != nil {
				return err
			}
			if recreate {
				if err := forceDeleteContainer(ctx, cfg.Name); err != nil {
					return fmt.Errorf("remove stale registry container: %w", err)
				}
				return createContainer(ctx, cfg)
			}
		}
		return restartContainer(ctx, cfg.Name)
	}

	return createContainer(ctx, cfg)
}

// ConnectToKindNetwork connects the registry container to the "kind" Docker
// network if it is not already connected. It is a no-op when the kind network
// does not yet exist.
func ConnectToKindNetwork(ctx context.Context, name string) error {
	if !networkExists(ctx, kindNetworkName) {
		return nil
	}
	already, err := isOnNetwork(ctx, name, kindNetworkName)
	if err != nil {
		return err
	}
	if already {
		return nil
	}
	return run(ctx, "docker", "network", "connect", kindNetworkName, name)
}

// ── helpers ──────────────────────────────────────────────────────────────────

func containerExists(ctx context.Context, name string) (bool, error) {
	out, err := output(ctx, "docker", "ps", "-a", "--filter", "name=^"+name+"$", "--format", "{{.Names}}")
	if err != nil {
		return false, fmt.Errorf("list containers: %w", err)
	}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if strings.TrimSpace(line) == name {
			return true, nil
		}
	}
	return false, nil
}

func restartContainer(ctx context.Context, name string) error {
	return run(ctx, "docker", "restart", name)
}

func forceDeleteContainer(ctx context.Context, name string) error {
	return run(ctx, "docker", "rm", "-f", name)
}

func networkExists(ctx context.Context, network string) bool {
	err := run(ctx, "docker", "network", "inspect", network)
	return err == nil
}

func isOnNetwork(ctx context.Context, container, network string) (bool, error) {
	out, err := output(ctx, "docker", "inspect",
		"-f", fmt.Sprintf(`{{index .NetworkSettings.Networks "%s"}}`, network),
		container,
	)
	if err != nil {
		return false, fmt.Errorf("inspect container network: %w", err)
	}
	return strings.TrimSpace(out) != "<nil>", nil
}

func createContainer(ctx context.Context, cfg Config) error {
	args := []string{
		"run", "-d",
		"--restart=unless-stopped",
		"-p", fmt.Sprintf("127.0.0.1:%d:5000", hostPort),
		"--network", "bridge",
		"-v", fmt.Sprintf("%s:/var/lib/registry", cfg.DataDir),
		"--name", cfg.Name,
	}

	// If proxy is enabled, generate a registry config file and mount it.
	if cfg.Proxy.Enabled && cfg.Proxy.URL != "" {
		cfgFile, err := writeRegistryConfig(cfg)
		if err != nil {
			return fmt.Errorf("write registry config: %w", err)
		}
		args = append(args, "-v", cfgFile+":/etc/docker/registry/config.yml:ro")
	}

	// Optionally pass host proxy env vars into the container so it can reach
	// upstream registries through the host network proxy.
	if cfg.UseHostProxyEnv {
		for _, envKey := range []string{"HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy"} {
			if val := os.Getenv(envKey); val != "" {
				args = append(args, "-e", envKey+"="+val)
			}
		}
	}

	// Mount CA cert when provided.
	if cfg.CAFile != "" {
		if _, err := os.Stat(cfg.CAFile); err != nil {
			return fmt.Errorf("stat ca file %s: %w", cfg.CAFile, err)
		}
		args = append(args, "-v", cfg.CAFile+":/etc/ssl/certs/upstream-ca.crt:ro")
	}

	// Add extra hosts when provided.
	for _, host := range cfg.ExtraHosts {
		args = append(args, "--add-host", host)
	}

	args = append(args, cfg.Image)
	return run(ctx, "docker", args...)
}

func needsRecreateForConfigMount(ctx context.Context, cfg Config) (bool, error) {
	expected := registryConfigHostPath(cfg)
	out, err := output(ctx, "docker", "inspect", "-f", "{{json .Mounts}}", cfg.Name)
	if err != nil {
		return false, fmt.Errorf("inspect container mounts: %w", err)
	}
	recreate, err := shouldRecreateForConfigMount(out, expected)
	if err != nil {
		return false, fmt.Errorf("decode container mounts: %w", err)
	}
	return recreate, nil
}

type dockerMount struct {
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
}

func shouldRecreateForConfigMount(mountsJSON, expected string) (bool, error) {
	var mounts []dockerMount
	if err := json.Unmarshal([]byte(strings.TrimSpace(mountsJSON)), &mounts); err != nil {
		return false, err
	}
	for _, m := range mounts {
		if m.Destination == "/etc/docker/registry/config.yml" {
			return filepath.Clean(m.Source) != filepath.Clean(expected), nil
		}
	}
	// Proxy enabled but no config mount found: recreate to enforce expected behavior.
	return true, nil
}

// writeRegistryConfig generates a temporary registry config.yml with proxy
// settings and returns its path.
func writeRegistryConfig(cfg Config) (string, error) {
	proxyURL := cfg.Proxy.URL
	if !strings.HasSuffix(proxyURL, "/") {
		proxyURL += "/"
	}

	content := fmt.Sprintf(`version: 0.1

log:
  fields:
    service: registry

storage:
  cache:
    blobdescriptor: inmemory
  filesystem:
    rootdirectory: /var/lib/registry

http:
  addr: :5000

proxy:
  remoteurl: %s
  username: %s
  password: %s
`, proxyURL, cfg.Proxy.Username, cfg.Proxy.Password)

	cfgFile := registryConfigHostPath(cfg)
	if err := os.MkdirAll(filepath.Dir(cfgFile), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(cfgFile, []byte(content), 0o644); err != nil {
		return "", err
	}
	return cfgFile, nil
}

func registryConfigHostPath(cfg Config) string {
	configDir := util.ExpandTilde("~/.config/magicrew")
	return filepath.Join(configDir, fmt.Sprintf("registry-%s-config.yml", cfg.Name))
}

// run executes a docker command, discarding stdout/stderr.
func run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run()
}

// output executes a command and returns its combined stdout.
func output(ctx context.Context, name string, args ...string) (string, error) {
	out, err := exec.CommandContext(ctx, name, args...).Output()
	return string(out), err
}
