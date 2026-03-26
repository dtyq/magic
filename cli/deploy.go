package cli

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/dtyq/magicrew-cli/deployer"
	"github.com/dtyq/magicrew-cli/util"
	"github.com/spf13/cobra"
)

const envMagicWebBaseURL = "MAGIC_WEB_BASE_URL"
const envMagicrewCliAutoRecoverRelease = "MAGICREW_CLI_AUTO_RECOVER_RELEASE"

var (
	deployChartsDir          string
	deployValuesFile         string
	deployChartRepo          string
	deployPlainHTTP          bool
	deployWebURL             string
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
	deployCmd.Flags().StringVar(&deployWebURL, "web-url", "", "magic-web external access URL (for server deploy; overrides MAGIC_WEB_BASE_URL)")
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
	valuesFile := resolveDeployValuesFile(deployValuesFile, cfg.Deploy.Values)

	chartsDir := deployChartsDir
	if chartsDir == "" && chartRepoURL == "" {
		return fmt.Errorf("either --charts-dir or chart repository URL must be provided")
	}

	webBaseURL := deployWebURL
	if webBaseURL == "" {
		webBaseURL = os.Getenv(envMagicWebBaseURL)
	}
	autoRecoverRelease, err := resolveAutoRecoverRelease(
		deployAutoRecoverRelease,
		cmd.Flags().Changed("auto-recover-release"),
		os.Getenv(envMagicrewCliAutoRecoverRelease),
	)
	if err != nil {
		return err
	}

	chartSpecs := buildChartSpecsFromConfig()
	return deployer.New(deployer.Options{
		ChartsDir:          chartsDir,
		ChartRepo:          chartRepoURL,
		PlainHTTP:          plainHTTP,
		ChartRepoUser:      cfg.Deploy.ChartRepo.Username,
		ChartRepoPass:      cfg.Deploy.ChartRepo.Password,
		PassCredsAll:       cfg.Deploy.ChartRepo.PassCredentialsAll,
		ChartSpecs:         chartSpecs,
		ValuesFile:         valuesFile,
		WebBaseURL:         webBaseURL,
		Registry:           cfg.Deploy.Registry,
		Kind:               cfg.Deploy.Kind,
		InfraUseProxy:      cfg.Deploy.InfraUseProxy,
		ConfigFile:         cfgFile,
		Proxy:              cfg.Deploy.Proxy,
		AutoRecoverRelease: autoRecoverRelease,
		Log:                lg,
	}).Run(context.Background())
}

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
			envMagicrewCliAutoRecoverRelease, envValue,
		)
	}
}
