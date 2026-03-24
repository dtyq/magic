package deployer

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"os"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/dtyq/magicrew-cli/util"
)

const (
	proxyEnvFilePath = "~/.config/magicrew/proxy.env"

	envNameCLIHostProxyURL      = "MAGICREW_CLI_HOST_PROXY_URL"
	envNameCLIContainerProxyURL = "MAGICREW_CLI_CONTAINER_PROXY_URL"

	dockerProbeCurlImage         = "curlimages/curl:latest"
	dockerProbeTimeout           = 120 * time.Second
	dockerBridgeInspectTimeout   = 50 * time.Second
	dockerProbeCurlTargetTimeout = 60

	dockerDaemonSmokeTimeout = 60 * time.Second
)

var containerProxyEgressTargets = []string{
	"https://www.magicrew.ai",
	"https://github.com",
}

var proxyDefaultNoProxyEntries = []string{
	"localhost", "127.0.0.1", "::1", "host.docker.internal", ".internal", ".local",
	"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
}

type ProxyPlan struct {
	HostProxyURL      string
	ContainerProxyURL string
	Warnings          []string
}

// BuildProxyPlan resolves host/container proxy configuration with this priority:
// 1) Current process env.
// 2) ~/.config/magicrew/proxy.env (only when current env has no host proxy).
// 3) Container proxy fallback to host proxy when not explicitly configured.
//
// After normalization, it probes container-reachable candidates (for localhost-like
// host proxies it tries host.docker.internal / docker bridge gateway variants) and
// returns the selected container proxy plus non-fatal warnings.
func BuildProxyPlan(ctx context.Context) (ProxyPlan, error) {
	plan := ProxyPlan{}
	hostProxy := firstProxyFromEnv()
	containerProxy := strings.TrimSpace(os.Getenv(envNameCLIContainerProxyURL))

	if hostProxy == "" {
		entries, err := readProxyEntriesFromFile(util.ExpandTilde(proxyEnvFilePath))
		if err == nil {
			restore, applyErr := applyEnvTemporarily(entries)
			if applyErr == nil {
				defer restore()
				hostProxy = firstProxyFromEnv()
				if containerProxy == "" {
					containerProxy = firstNonEmpty(
						strings.TrimSpace(entries[envNameCLIContainerProxyURL]),
						strings.TrimSpace(entries["MAGICREW_CONTAINER_PROXY_URL"]),
					)
				}
			}
		}
	}
	if hostProxy == "" {
		return plan, nil
	}

	hostProxy, err := normalizeProxyURL(hostProxy)
	if err != nil {
		plan.Warnings = append(plan.Warnings, fmt.Sprintf("ignore invalid host proxy url %q", hostProxy))
		return plan, nil
	}
	plan.HostProxyURL = hostProxy

	if containerProxy != "" {
		containerProxy, err = normalizeProxyURL(containerProxy)
		if err != nil {
			plan.Warnings = append(plan.Warnings, fmt.Sprintf("ignore invalid container proxy url %q", containerProxy))
			containerProxy = ""
		}
	}
	if containerProxy == "" {
		containerProxy = hostProxy
	}

	selected, warnings := chooseContainerProxy(ctx, hostProxy, containerProxy)
	plan.ContainerProxyURL = selected
	plan.Warnings = append(plan.Warnings, warnings...)
	return plan, nil
}

func CheckDockerDaemonNetwork(ctx context.Context) error {
	_, err := runDockerWithTimeout(
		ctx, dockerDaemonSmokeTimeout,
		"run", "--rm", "--pull", "always", dockerProbeCurlImage, "curl", "--version",
	)
	if err == nil {
		return nil
	}
	return fmt.Errorf("docker daemon network check failed: %w", err)
}

func ApplyContainerProxyTemporarily(proxyURL string, noProxyAdditions []string) (func(), error) {
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL == "" {
		return func() {}, nil
	}
	noProxy := mergeCSV(firstNonEmpty(
		os.Getenv("NO_PROXY"),
		os.Getenv("no_proxy"),
	), proxyNoProxyDefaultsWith(noProxyAdditions...))
	envs := map[string]string{
		"HTTP_PROXY": proxyURL, "HTTPS_PROXY": proxyURL, "ALL_PROXY": proxyURL,
		"http_proxy": proxyURL, "https_proxy": proxyURL, "all_proxy": proxyURL,
		"NO_PROXY": noProxy, "no_proxy": noProxy,
	}
	return applyEnvTemporarily(envs)
}

func chooseContainerProxy(ctx context.Context, hostProxy, preferredContainer string) (string, []string) {
	warnings := make([]string, 0)
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
	appendUnique(preferredContainer)

	parsedHost, err := url.Parse(hostProxy)
	if err == nil && parsedHost.Hostname() != "" {
		hostName := strings.ToLower(parsedHost.Hostname())
		if hostName == "localhost" || hostName == "127.0.0.1" || hostName == "::1" {
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
			if runtime.GOOS == "darwin" || runtime.GOOS == "windows" {
				appendUnique(build("host.docker.internal"))
				if gateway != "" {
					appendUnique(build(gateway))
				}
			} else {
				if gateway != "" {
					appendUnique(build(gateway))
				}
				appendUnique(build("host.docker.internal"))
			}
		}
	}

	for _, c := range candidates {
		ok, msg := checkContainerProxyConnectivity(ctx, c)
		if !ok {
			if msg != "" {
				warnings = append(warnings, msg)
			}
			continue
		}
		egressOK, egressWarn := checkContainerProxyEgress(ctx, c)
		if !egressOK && egressWarn != "" {
			warnings = append(warnings, egressWarn)
		}
		return c, warnings
	}
	warnings = append(warnings, "no verified container proxy candidate found; fallback to host proxy")
	return hostProxy, warnings
}

func checkContainerProxyConnectivity(ctx context.Context, proxyURL string) (bool, string) {
	u, err := url.Parse(proxyURL)
	if err != nil || u.Hostname() == "" {
		return false, fmt.Sprintf("invalid container proxy url %q", proxyURL)
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
		return false, fmt.Sprintf("container cannot reach proxy endpoint %s:%s", u.Hostname(), port)
	}
	if outputShowsProxyEndpoint(out, u.Hostname(), port) {
		return true, ""
	}
	return false, fmt.Sprintf("container cannot reach proxy endpoint %s:%s", u.Hostname(), port)
}

func checkContainerProxyEgress(ctx context.Context, proxyURL string) (bool, string) {
	proxyHost, proxyPort, parseErr := proxyEndpointHostPort(proxyURL)
	if parseErr != nil {
		return false, fmt.Sprintf("invalid container proxy url %q", proxyURL)
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
			return true, ""
		}
	}
	return false, fmt.Sprintf("container proxy egress probe did not show proxy endpoint usage for %s", proxyURL)
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

func readProxyEntriesFromFile(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	allowed := map[string]struct{}{
		"HTTP_PROXY": {}, "HTTPS_PROXY": {}, "ALL_PROXY": {}, "NO_PROXY": {},
		"http_proxy": {}, "https_proxy": {}, "all_proxy": {}, "no_proxy": {},
		envNameCLIHostProxyURL: {}, envNameCLIContainerProxyURL: {},
	}
	out := map[string]string{}
	for _, rawLine := range strings.Split(string(data), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		if _, ok := allowed[k]; !ok {
			continue
		}
		v = strings.TrimSpace(v)
		if len(v) >= 2 {
			if (strings.HasPrefix(v, "\"") && strings.HasSuffix(v, "\"")) ||
				(strings.HasPrefix(v, "'") && strings.HasSuffix(v, "'")) {
				v = v[1 : len(v)-1]
			}
		}
		out[k] = v
	}
	return out, nil
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
