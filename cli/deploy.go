package cli

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/dtyq/magicrew-cli/deployer"
	"github.com/dtyq/magicrew-cli/registry"
	"github.com/dtyq/magicrew-cli/util"
	"github.com/spf13/cobra"
)

const envNameCLIWebBaseURL = "MAGICREW_CLI_WEB_BASE_URL"
const envNameCLIMinIOURL = "MAGICREW_CLI_MINIO_URL"
const envNameCLILegacyWebBaseURL = "MAGIC_WEB_BASE_URL"
const envNameCLIAutoRecoverRelease = "MAGICREW_CLI_AUTO_RECOVER_RELEASE"
const envNameCLIConfigDir = "MAGICREW_CLI_CONFIG_DIR"
const envNameCLIDataDir = "MAGICREW_CLI_DATA_DIR"

var (
	deployChartsDir          string
	deployValuesFile         string
	deployChartRepo          string
	deployPlainHTTP          bool
	deployWebURL             string
	deployMinIOURL           string
	deployAutoRecoverRelease bool

	deployCmd = &cobra.Command{
		Use:   "deploy",
		Short: "Deploy magic charts to a local kind cluster",
		RunE:  runDeploy,
	}
)

func init() {
	deployCmd.Flags().StringVar(&deployChartsDir, "charts-dir", "", "Path to local charts directory (overrides remote source)")
	deployCmd.Flags().StringVar(&deployValuesFile, "values", "", "Additional values file (merged with highest priority)")
	deployCmd.Flags().StringVar(&deployChartRepo, "chart-repo", "", "Remote chart repository URL (supports https:// and oci://)")
	deployCmd.Flags().BoolVar(&deployPlainHTTP, "plain-http", false, "Use plain HTTP for OCI chart repository")
	deployCmd.Flags().StringVar(&deployWebURL, "web-url", "", "magic-web external access URL (for server deploy; overrides MAGICREW_CLI_WEB_BASE_URL)")
	deployCmd.Flags().StringVar(&deployMinIOURL, "minio-url", "", "MinIO external access URL (overrides MAGICREW_CLI_MINIO_URL)")
	deployCmd.Flags().BoolVar(&deployAutoRecoverRelease, "auto-recover-release", false, "Automatically recover pending Helm releases without interactive confirmation")
	deployCmd.Flags().BoolP("help", "h", false, "Help for deploy")
	rootCmd.AddCommand(deployCmd)
}

func runDeploy(cmd *cobra.Command, args []string) error {
	chartRepoURL := cfg.Deploy.ChartRepo.URL
	if deployChartRepo != "" {
		chartRepoURL = deployChartRepo
	}
	plainHTTP := cfg.Deploy.ChartRepo.PlainHTTP
	if deployPlainHTTP {
		plainHTTP = true
	}

	chartsDir := util.NormalizePath(deployChartsDir)
	if chartsDir == "" && chartRepoURL == "" {
		return fmt.Errorf("either --charts-dir or chart repository URL must be provided")
	}

	cfg.Deploy.ChartRepo.URL = chartRepoURL
	cfg.Deploy.ChartRepo.PlainHTTP = plainHTTP

	webBaseURL, usedDeprecatedWebBaseURL := resolveDeployWebBaseURL(deployWebURL)
	if usedDeprecatedWebBaseURL {
		lg.Logw(
			"deploy",
			"%s is deprecated, please use %s instead",
			envNameCLILegacyWebBaseURL,
			envNameCLIWebBaseURL,
		)
	}
	if err := deployer.ValidateAccessURL(webBaseURL); err != nil {
		return fmt.Errorf("invalid web URL: %w", err)
	}

	minioURL := resolveDeployMinIOURL(deployMinIOURL, webBaseURL, cfg.Deploy.Kind.MinIOHostPort)
	if err := deployer.ValidateAccessURL(minioURL); err != nil {
		return fmt.Errorf("invalid minio URL: %w", err)
	}

	autoRecoverRelease, err := resolveAutoRecoverRelease(
		deployAutoRecoverRelease,
		cmd.Flags().Changed("auto-recover-release"),
		os.Getenv(envNameCLIAutoRecoverRelease),
	)
	if err != nil {
		return err
	}

	valuesFile := resolveDeployValuesFile(deployValuesFile, cfg.Deploy.Values, configDir)

	chartSpecs := buildChartSpecsFromConfig()
	return deployer.New(
		deployer.WithChartRepo(cfg.Deploy.ChartRepo),
		deployer.WithChartsDir(chartsDir),
		deployer.WithChartSpecs(chartSpecs),
		deployer.WithValuesFile(valuesFile),
		deployer.WithWebBaseURL(webBaseURL),
		deployer.WithMinIOURL(minioURL),
		deployer.WithRegistry(withRegistryConfigDir(cfg.Deploy.Registry, configDir)),
		deployer.WithKind(cfg.Deploy.Kind),
		deployer.WithInfraUseProxy(cfg.Deploy.InfraUseProxy),
		deployer.WithConfigFile(cfgFile),
		deployer.WithProxy(cfg.Deploy.Proxy),
		deployer.WithAutoRecoverRelease(autoRecoverRelease),
		deployer.WithConfigDir(configDir),
		deployer.WithDataDir(dataDir),
		deployer.WithLog(lg),
	).Run(context.Background())
}

// resolveDeployValuesFile chooses the values file path for deploy, in order:
// 1) CLI --values
// 2) deploy.values in config.yml
// 3) values.yaml under configDir (only when the file exists)
// Returns an empty string when none of the above is available.
func resolveDeployValuesFile(cliValuesFile, configValuesFile, configDir string) string {
	if n := util.NormalizePath(cliValuesFile); n != "" {
		return n
	}
	if n := util.NormalizePath(configValuesFile); n != "" {
		return n
	}
	normConfigDir := util.NormalizePath(configDir)
	defaultValuesFile := filepath.Join(normConfigDir, "values.yaml")
	if _, err := os.Stat(defaultValuesFile); err == nil {
		return defaultValuesFile
	}
	return ""
}

func buildChartSpecsFromConfig() map[string]deployer.ChartSpec {
	if cfg.Deploy.Charts == nil {
		return make(map[string]deployer.ChartSpec)
	}
	out := make(map[string]deployer.ChartSpec, len(cfg.Deploy.Charts))
	for key, spec := range cfg.Deploy.Charts {
		out[key] = deployer.ChartSpec{Name: spec.Name, Version: spec.Version}
	}
	return out
}

func resolveDeployWebBaseURL(cliValue string) (string, bool) {
	if v := strings.TrimSpace(cliValue); v != "" {
		return v, false
	}
	if v := strings.TrimSpace(os.Getenv(envNameCLIWebBaseURL)); v != "" {
		return v, false
	}
	if v := strings.TrimSpace(os.Getenv(envNameCLILegacyWebBaseURL)); v != "" {
		return v, true
	}
	return "", false
}

// resolveDeployMinIOURL chooses the MinIO access URL for deploy, in order:
// 1) CLI --minio-url
// 2) MAGICREW_CLI_MINIO_URL
// 3) same scheme and hostname as webBaseURL with port replaced by minIOPort
// 4) http://localhost:<minIOPort>
func resolveDeployMinIOURL(cliValue, webBaseURL string, minIOPort int) string {
	if v := strings.TrimSpace(cliValue); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv(envNameCLIMinIOURL)); v != "" {
		return v
	}
	if w := strings.TrimSpace(webBaseURL); w != "" {
		if derived := minIOURLDerivedFromWebBaseURL(w, minIOPort); derived != "" {
			return derived
		}
	}
	return fmt.Sprintf("http://localhost:%d", minIOPort)
}

func minIOURLDerivedFromWebBaseURL(webBaseURL string, minIOPort int) string {
	u, err := url.Parse(webBaseURL)
	if err != nil || u == nil || u.Hostname() == "" {
		return ""
	}
	u.Host = net.JoinHostPort(u.Hostname(), strconv.Itoa(minIOPort))
	return u.String()
}

func resolveAutoRecoverRelease(flagValue bool, flagChanged bool, envValue string) (bool, error) {
	if flagChanged {
		return flagValue, nil
	}
	v := strings.TrimSpace(strings.ToLower(envValue))
	if v == "" {
		return false, nil
	}
	switch v {
	case "1", "t", "true", "y", "yes", "on":
		return true, nil
	case "0", "f", "false", "n", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf(
			"invalid %s value %q: use true/false, 1/0, yes/no, on/off",
			envNameCLIAutoRecoverRelease, envValue,
		)
	}
}

func withRegistryConfigDir(cfg registry.Config, configDir string) registry.Config {
	cfg.ConfigDir = configDir
	return cfg
}
