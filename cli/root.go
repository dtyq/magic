package cli

import (
	"context"

	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/spf13/cobra"
)

const cliName = "magicrew"

var (
	cfgFile string
	rootCmd = &cobra.Command{
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
	rootCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", cliName))

	rootCmd.SilenceErrors = true
	rootCmd.SilenceUsage = true
}

func Execute() error {
	return rootCmd.Execute()
}
