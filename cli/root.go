package cli

import (
	"context"

	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/spf13/cobra"
)

const cliName = "magicrew"

var (
	cfgFile   string
	configDir string
	dataDir   string
	rootCmd   = &cobra.Command{
		Use:   cliName,
		Short: "Magicrew CLI",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Help()
		},
	}
	commandContext context.Context
)

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.SetUsageTemplate(i18n.L("cobraHelpUsageTemplate"))
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", i18n.L(
		"mainArgHelpConfig", "$XDG_CONFIG_HOME/magicrew/config.yml", "~/.config/magicrew/config.yml",
	))
	rootCmd.PersistentFlags().StringVar(&configDir, "config-dir", "", "Configuration directory (env MAGICREW_CLI_CONFIG_DIR)")
	rootCmd.PersistentFlags().StringVar(&dataDir, "data-dir", "", "Data directory (env MAGICREW_CLI_DATA_DIR)")
	rootCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", cliName))

	rootCmd.SilenceErrors = true
	rootCmd.SilenceUsage = true
}

func Execute() error {
	return rootCmd.Execute()
}
