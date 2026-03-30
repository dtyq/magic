package deployer

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/dtyq/magicrew-cli/util"
	"go.yaml.in/yaml/v3"
)

const (
	envNameCLIHostProxyURL      = "MAGICREW_CLI_HOST_PROXY_URL"
	envNameCLIContainerProxyURL = "MAGICREW_CLI_CONTAINER_PROXY_URL"

	dockerProbeCurlImage = "curlimages/curl:latest"

	dockerBridgeInspectTimeout   = 5 * time.Second
	dockerProbeCurlTargetTimeout = 10 * time.Second

	dockerDaemonSmokeTimeout = 60 * time.Second

	dockerProbeTimeout = dockerDaemonSmokeTimeout + dockerProbeCurlTargetTimeout
)

var containerProxyEgressTargets = []string{
	"https://www.magicrew.ai",
	"https://github.com",
}

var proxyDefaultNoProxyEntries = []string{
	"localhost", "127.0.0.1", "::1", "host.docker.internal", ".internal", ".local",
	"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
}

// inheritEnvProxy applies proxy-related environment variables on top of cfg.
// Environment variables take priority over config file values. Fields are only
// overridden when the corresponding env var is non-empty.
func inheritEnvProxy(cfg ProxyConfig) ProxyConfig {
	if envHost := firstProxyFromEnv(); envHost != "" {
		cfg.Host.URL = envHost
	}
	if envContainer := strings.TrimSpace(os.Getenv(envNameCLIContainerProxyURL)); envContainer != "" {
		cfg.Container.URL = envContainer
	}
	if envNoProxy := firstNonEmpty(os.Getenv("NO_PROXY"), os.Getenv("no_proxy")); envNoProxy != "" {
		cfg.Host.NoProxy = splitCSV(envNoProxy)
		cfg.Container.NoProxy = splitCSV(envNoProxy)
	}
	return cfg
}

// resolveContainerProxy determines the effective container proxy URL.
// It normalises host/container proxy URLs, builds candidates from the host proxy
// when the host is loopback, then probes each candidate according to policy.
// Warnings are logged directly; nothing is returned for them.
func resolveContainerProxy(ctx context.Context, log util.LoggerGroup, cfg ProxyConfig) string {
	// Respect Enabled=false unless the shell environment explicitly provides a proxy.
	if !cfg.Enabled {
		envHasProxy := firstProxyFromEnv() != "" ||
			strings.TrimSpace(os.Getenv(envNameCLIContainerProxyURL)) != ""
		if !envHasProxy {
			return ""
		}
	}
	if strings.TrimSpace(cfg.Host.URL) == "" && strings.TrimSpace(cfg.Container.URL) == "" {
		return ""
	}

	hostProxy := ""
	if cfg.Host.URL != "" {
		var err error
		hostProxy, err = normalizeProxyURL(cfg.Host.URL)
		if err != nil {
			log.Logw("deploy", "ignore invalid host proxy url %q: %v", cfg.Host.URL, err)
		}
	}

	containerProxy := ""
	if cfg.Container.URL != "" {
		var err error
		containerProxy, err = normalizeProxyURL(cfg.Container.URL)
		if err != nil {
			log.Logw("deploy", "ignore invalid container proxy url %q: %v", cfg.Container.URL, err)
		}
	}

	if hostProxy == "" && containerProxy == "" {
		return ""
	}

	selected := chooseContainerProxy(ctx, log, hostProxy, containerProxy, cfg.Policy)
	if selected != "" {
		log.Logi("deploy", "container proxy selected: %s", maskProxyURLForLog(selected))
	} else if hostProxy != "" {
		log.Logi("deploy", "container proxy disabled due to failed reachability checks")
	}

	return selected
}

func checkDockerDaemonNetwork(ctx context.Context) error {
	_, err := runDockerWithTimeout(
		ctx, dockerDaemonSmokeTimeout,
		"run", "--rm", "--pull", "always", dockerProbeCurlImage, "curl", "--version",
	)
	if err == nil {
		return nil
	}
	return fmt.Errorf("docker daemon network check failed: %w", err)
}

func applyContainerProxyTemporarily(proxyURL string, noProxyAdditions []string) (func(), error) {
	proxyURL = strings.TrimSpace(proxyURL)
	noProxy := mergeCSV(firstNonEmpty(
		os.Getenv("NO_PROXY"),
		os.Getenv("no_proxy"),
	), proxyNoProxyDefaultsWith(noProxyAdditions...))
	envs := map[string]string{
		"NO_PROXY": noProxy, "no_proxy": noProxy,
	}
	if proxyURL != "" {
		envs["HTTP_PROXY"] = proxyURL
		envs["HTTPS_PROXY"] = proxyURL
		envs["ALL_PROXY"] = proxyURL
		envs["http_proxy"] = proxyURL
		envs["https_proxy"] = proxyURL
		envs["all_proxy"] = proxyURL
	}
	return applyEnvTemporarily(envs)
}

func applyHostProxyForProcess(proxyURL string, noProxy []string) error {
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL == "" {
		return nil
	}
	mergedNoProxy := mergeCSV(
		firstNonEmpty(os.Getenv("NO_PROXY"), os.Getenv("no_proxy")),
		dedupCSVEntries(append(proxyDefaultNoProxyEntries, noProxy...)),
	)
	envs := map[string]string{
		"HTTP_PROXY":  proxyURL,
		"HTTPS_PROXY": proxyURL,
		"ALL_PROXY":   proxyURL,
		"http_proxy":  proxyURL,
		"https_proxy": proxyURL,
		"all_proxy":   proxyURL,
		"NO_PROXY":    mergedNoProxy,
		"no_proxy":    mergedNoProxy,
	}
	for key, value := range envs {
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	return nil
}

func chooseContainerProxy(
	ctx context.Context,
	log util.LoggerGroup,
	hostProxy, containerProxy string,
	policy ProxyPolicyConfig,
) string {
	candidates := buildContainerProxyCandidates(ctx, hostProxy, containerProxy)
	if len(candidates) == 0 {
		return ""
	}
	for _, c := range candidates {
		if policy.RequireReachability {
			if err := containerProxyConnectivityProbe(ctx, c); err != nil {
				log.Logw("deploy", "%s", err)
				continue
			}
		}
		if err := containerProxyEgressProbe(ctx, c); err != nil {
			log.Logw("deploy", "%s", err)
			if policy.RequireEgress {
				continue
			}
		}
		return c
	}
	log.Logw("deploy", "no usable container proxy candidate found; container proxy disabled")
	return ""
}

func buildContainerProxyCandidates(ctx context.Context, hostProxy, containerProxy string) []string {
	candidates := make([]string, 0)
	appendUnique := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		for _, e := range candidates {
			if e == v {
				return
			}
		}
		candidates = append(candidates, v)
	}
	if containerProxy != "" {
		appendUnique(containerProxy)
		return candidates
	}
	if strings.TrimSpace(hostProxy) == "" {
		return candidates
	}
	parsedHost, err := url.Parse(hostProxy)
	if err != nil || parsedHost.Hostname() == "" || !isLoopbackHost(parsedHost.Hostname()) {
		appendUnique(hostProxy)
		return candidates
	}
	gateway := dockerBridgeGateway(ctx)
	build := func(h string) string {
		u := *parsedHost
		if p := parsedHost.Port(); p != "" {
			u.Host = h + ":" + p
		} else {
			u.Host = h
		}
		return u.String()
	}
	if runtime.GOOS == "linux" {
		if gateway != "" {
			appendUnique(build(gateway))
		}
		appendUnique(build("host.docker.internal"))
		appendUnique(hostProxy)
	} else {
		appendUnique(hostProxy)
		appendUnique(build("host.docker.internal"))
		if gateway != "" {
			appendUnique(build(gateway))
		}
	}
	return candidates
}

func isLoopbackHost(host string) bool {
	switch strings.ToLower(strings.TrimSpace(host)) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

func checkContainerProxyConnectivity(ctx context.Context, proxyURL string) error {
	u, err := url.Parse(proxyURL)
	if err != nil || u.Hostname() == "" {
		return fmt.Errorf("invalid container proxy url %q", proxyURL)
	}
	port := u.Port()
	if port == "" {
		if strings.EqualFold(u.Scheme, "https") {
			port = "443"
		} else {
			port = "80"
		}
	}
	host := u.Hostname()
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}
	target := fmt.Sprintf("http://%s:%s/", host, port)
	out, err := runDockerWithTimeout(
		ctx, dockerProbeTimeout,
		"run", "--rm", "--pull=missing", dockerProbeCurlImage,
		"curl", "-sS", "-v", "--max-time", fmt.Sprintf("%d", dockerProbeCurlTargetTimeout),
		"-o", "/dev/null", target,
	)
	if err != nil {
		return fmt.Errorf("container cannot reach proxy endpoint %s:%s", u.Hostname(), port)
	}
	if outputShowsProxyEndpoint(out, u.Hostname(), port) {
		return nil
	}
	return fmt.Errorf("container cannot reach proxy endpoint %s:%s", u.Hostname(), port)
}

func checkContainerProxyEgress(ctx context.Context, proxyURL string) error {
	proxyHost, proxyPort, parseErr := proxyEndpointHostPort(proxyURL)
	if parseErr != nil {
		return fmt.Errorf("invalid container proxy url %q", proxyURL)
	}
	noProxy := mergeCSV(firstNonEmpty(os.Getenv("NO_PROXY"), os.Getenv("no_proxy")), proxyNoProxyDefaultsWith())
	for _, target := range containerProxyEgressTargets {
		out, err := runDockerWithTimeout(
			ctx, dockerProbeTimeout,
			"run", "--rm", "--pull=missing",
			"-e", "NO_PROXY="+noProxy,
			"-e", "no_proxy="+noProxy,
			dockerProbeCurlImage,
			"curl", "-sS", "-v", "--proxy", proxyURL,
			"--max-time", fmt.Sprintf("%d", dockerProbeCurlTargetTimeout),
			"-o", "/dev/null", target,
		)
		if err != nil {
			continue
		}
		if outputShowsProxyEndpoint(out, proxyHost, proxyPort) {
			return nil
		}
	}
	return fmt.Errorf("container proxy egress probe did not show proxy endpoint usage for %s", proxyURL)
}

// containerProxyConnectivityProbe and containerProxyEgressProbe are the checks
// chooseContainerProxy runs. Defaults mirror checkContainerProxyConnectivity /
// checkContainerProxyEgress; tests may replace them to simulate outcomes.
var (
	containerProxyConnectivityProbe = checkContainerProxyConnectivity
	containerProxyEgressProbe       = checkContainerProxyEgress
)

// patchConfigProxySection writes the resolved proxy configuration back to the
// config file. It uses a yaml.Node AST to surgically update only the
// deploy.proxy subtree, preserving all other content including comments.
// It is a no-op when there is no effective proxy input and the config is not
// explicitly disabled (i.e. nothing meaningful to persist).
// The file is written with permissions of at most 0o600 (group/other bits
// stripped) and via an atomic rename to guard against partial writes.
func patchConfigProxySection(configPath string, cfg ProxyConfig) error {
	if strings.TrimSpace(configPath) == "" {
		return nil
	}
	hasEffectiveInput := strings.TrimSpace(cfg.Host.URL) != "" || strings.TrimSpace(cfg.Container.URL) != ""
	if !hasEffectiveInput && cfg.Enabled {
		return nil
	}

	configPath = util.ExpandTilde(configPath)

	// Determine write permissions: tighten to at most 0o600 so that proxy
	// credentials (if embedded in a URL) are not readable by other users.
	fileMode := os.FileMode(0o600)
	if info, statErr := os.Stat(configPath); statErr == nil {
		if existing := info.Mode().Perm(); existing&0o077 == 0 {
			fileMode = existing // already owner-only; preserve exact mode
		}
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	// Parse via yaml.Node to preserve comments and key ordering.
	var rootNode yaml.Node
	if err := yaml.Unmarshal(data, &rootNode); err != nil {
		return err
	}
	// Unmarshal of an empty document leaves rootNode.Kind == 0.
	if rootNode.Kind == 0 {
		rootNode = yaml.Node{
			Kind:    yaml.DocumentNode,
			Content: []*yaml.Node{{Kind: yaml.MappingNode, Tag: "!!map"}},
		}
	}
	docContent := rootNode.Content[0]
	// Treat a top-level null scalar as an empty mapping.
	if docContent.Kind == yaml.ScalarNode && docContent.Tag == "!!null" {
		*docContent = yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	}
	if docContent.Kind != yaml.MappingNode {
		return fmt.Errorf("config file root is not a YAML mapping")
	}

	// Navigate/create deploy → proxy, then replace proxy with the marshaled cfg.
	deployVal := upsertYAMLMappingKey(docContent, "deploy")
	if deployVal.Kind != yaml.MappingNode {
		// Overwrite non-mapping value (e.g. null scalar left by "deploy: ~")
		*deployVal = yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	}
	proxyNode, err := proxyConfigToYAMLNode(cfg)
	if err != nil {
		return err
	}
	proxyVal := upsertYAMLMappingKey(deployVal, "proxy")
	*proxyVal = *proxyNode

	newData, err := yaml.Marshal(&rootNode)
	if err != nil {
		return err
	}
	if bytes.Equal(bytes.TrimSpace(data), bytes.TrimSpace(newData)) {
		return nil
	}

	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	// Atomic write: create temp file → write → sync → close → rename.
	tmp, err := os.CreateTemp(dir, ".config-proxy-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	// Best-effort cleanup if something goes wrong before rename.
	defer func() { _ = os.Remove(tmpPath) }()
	if err := tmp.Chmod(fileMode); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(newData); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, configPath)
}

// upsertYAMLMappingKey returns the value node for the given key within a YAML
// mapping node. If the key does not exist, a new key/value pair is appended
// and the new (empty mapping) value node is returned.
func upsertYAMLMappingKey(mapping *yaml.Node, key string) *yaml.Node {
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value == key {
			return mapping.Content[i+1]
		}
	}
	keyNode := &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key}
	valNode := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	mapping.Content = append(mapping.Content, keyNode, valNode)
	return mapping.Content[len(mapping.Content)-1]
}

// proxyConfigToYAMLNode marshals cfg into a yaml.Node suitable for replacing
// a subtree in a document, preserving struct field ordering.
func proxyConfigToYAMLNode(cfg ProxyConfig) (*yaml.Node, error) {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if doc.Kind == yaml.DocumentNode && len(doc.Content) > 0 {
		return doc.Content[0], nil
	}
	return &doc, nil
}

func runDockerWithTimeout(ctx context.Context, timeout time.Duration, args ...string) (string, error) {
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	output := &bytes.Buffer{}
	commandArgs := append([]string{"docker"}, args...)
	cmd := util.Command{
		Args:   commandArgs,
		Stdout: output,
		Stderr: output,
	}
	err := cmd.Run(runCtx)
	return output.String(), err
}

func dockerBridgeGateway(ctx context.Context) string {
	out, err := runDockerWithTimeout(ctx, dockerBridgeInspectTimeout, "network", "inspect", "bridge", "-f", "{{(index .IPAM.Config 0).Gateway}}")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}

func proxyEndpointHostPort(proxyURL string) (string, string, error) {
	u, err := url.Parse(proxyURL)
	if err != nil || u.Hostname() == "" {
		return "", "", fmt.Errorf("invalid proxy url")
	}
	port := u.Port()
	if port == "" {
		if strings.EqualFold(u.Scheme, "https") {
			port = "443"
		} else {
			port = "80"
		}
	}
	return strings.ToLower(u.Hostname()), port, nil
}

func outputShowsProxyEndpoint(out, proxyHost, proxyPort string) bool {
	lower := strings.ToLower(out)
	return strings.Contains(lower, strings.ToLower(proxyHost)+":"+proxyPort)
}

func firstProxyFromEnv() string {
	return firstNonEmpty(
		strings.TrimSpace(os.Getenv(envNameCLIHostProxyURL)),
		strings.TrimSpace(os.Getenv("HTTP_PROXY")),
		strings.TrimSpace(os.Getenv("http_proxy")),
		strings.TrimSpace(os.Getenv("HTTPS_PROXY")),
		strings.TrimSpace(os.Getenv("https_proxy")),
		strings.TrimSpace(os.Getenv("ALL_PROXY")),
		strings.TrimSpace(os.Getenv("all_proxy")),
	)
}

func normalizeProxyURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty")
	}
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	if u.Hostname() == "" {
		return "", fmt.Errorf("missing host")
	}
	return u.String(), nil
}

func splitCSV(raw string) []string {
	items := strings.Split(raw, ",")
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

func dedupCSVEntries(entries []string) []string {
	out := make([]string, 0, len(entries))
	seen := map[string]struct{}{}
	for _, e := range entries {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		k := strings.ToLower(e)
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, e)
	}
	return out
}

func proxyNoProxyDefaultsWith(additions ...string) []string {
	entries := make([]string, 0, len(proxyDefaultNoProxyEntries)+len(additions))
	entries = append(entries, proxyDefaultNoProxyEntries...)
	entries = append(entries, additions...)
	return entries
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

func applyEnvTemporarily(entries map[string]string) (func(), error) {
	keys := make([]string, 0, len(entries))
	for k := range entries {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	type envValue struct {
		value  string
		exists bool
	}
	originals := make(map[string]envValue, len(keys))
	for _, key := range keys {
		v, existed := os.LookupEnv(key)
		originals[key] = envValue{value: v, exists: existed}
		if err := os.Setenv(key, entries[key]); err != nil {
			for rollbackKey, rollback := range originals {
				if rollback.exists {
					_ = os.Setenv(rollbackKey, rollback.value)
				} else {
					_ = os.Unsetenv(rollbackKey)
				}
			}
			return nil, err
		}
	}
	return func() {
		for _, key := range keys {
			orig := originals[key]
			if orig.exists {
				_ = os.Setenv(key, orig.value)
			} else {
				_ = os.Unsetenv(key)
			}
		}
	}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func maskProxyURLForLog(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User == nil {
		return raw
	}

	username := parsed.User.Username()
	_, hasPassword := parsed.User.Password()
	if username == "" && !hasPassword {
		return raw
	}

	if hasPassword {
		parsed.User = url.UserPassword("REDACTED", "REDACTED")
		return parsed.String()
	}

	parsed.User = url.User("REDACTED")
	return parsed.String()
}
