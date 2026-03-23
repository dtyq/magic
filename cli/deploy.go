package cli

import (
	"context"
	"os"
	"path/filepath"

	"github.com/dtyq/magicrew-cli/deployer"
	"github.com/dtyq/magicrew-cli/util"
	"github.com/spf13/cobra"
)

const envMagicWebBaseURL = "MAGIC_WEB_BASE_URL"

var (
	deployChartsDir  string
	deployValuesFile string
	deployChartRepo  string
	deployPlainHTTP  bool
	deployWebURL     string

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
	deployCmd.Flags().StringVar(&deployWebURL, "web-url", "", "magic-web external access URL (for server deploy; overrides MAGIC_WEB_BASE_URL)")
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
	valuesFile := resolveDeployValuesFile(deployValuesFile, cfg.Deploy.Values)

	chartsDir := deployChartsDir
	if chartsDir == "" && chartRepoURL == "" {
		// In local mode, default to "<cwd>/charts" when --charts-dir is not provided.
		if cwd, err := getwd(); err == nil {
			chartsDir = filepath.Join(cwd, "charts")
		}
	}

	webBaseURL := deployWebURL
	if webBaseURL == "" {
		webBaseURL = os.Getenv(envMagicWebBaseURL)
	}

	chartSpecs := buildChartSpecsFromConfig()
	return deployer.New(deployer.Options{
		ChartsDir:     chartsDir,
		ChartRepo:     chartRepoURL,
		PlainHTTP:     plainHTTP,
		ChartRepoUser: cfg.Deploy.ChartRepo.Username,
		ChartRepoPass: cfg.Deploy.ChartRepo.Password,
		PassCredsAll:  cfg.Deploy.ChartRepo.PassCredentialsAll,
		ChartSpecs:    chartSpecs,
		ValuesFile:    valuesFile,
		WebBaseURL:    webBaseURL,
		Registry:      cfg.Deploy.Registry,
		Kind:          cfg.Deploy.Kind,
		InfraUseProxy: cfg.Deploy.InfraUseProxy,
		Log:           lg,
	}).Run(context.Background())
}

// getwd returns the current working directory and can be replaced in tests.
var getwd = os.Getwd

// resolveDeployValuesFile chooses the values file path for deploy, in order:
// 1) CLI --values
// 2) deploy.values in config.yml
// 3) ~/.config/magicrew/values.yaml (only when the file exists)
// Returns an empty string when none of the above is available.
func resolveDeployValuesFile(cliValuesFile, configValuesFile string) string {
	if cliValuesFile != "" {
		return cliValuesFile
	}
	if configValuesFile != "" {
		return configValuesFile
	}
	defaultValuesFile := util.ExpandTilde("~/.config/magicrew/values.yaml")
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
