package cli

import (
	"fmt"
	"os"

	"github.com/dtyq/magicrew-cli/deps"
	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/spf13/cobra"
)

var (
	depsCmd = &cobra.Command{
		Use:   "deps",
		Short: i18n.L("depsCommandShort"),
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Help()
		},
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			err := deps.InitDepsMap(cfg.Deps)
			if err != nil {
				lg.Loge("deps", "%s", i18n.L("errorReadDepsData", err))
				os.Exit(1)
			}
		},
	}

	depsListCmd = &cobra.Command{
		Use:   "list",
		Short: i18n.L("depsListCommandShort"),
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println("========================")
			for _, dep := range deps.DepsMap {
				fmt.Println(i18n.L("depsName", dep.GetName()))
				fmt.Println(i18n.L("depsVersion", dep.GetVersion()))
				if dep.Resolved(commandContext) {
					fmt.Println(i18n.L("depsResolved", i18n.L("trueMark")))
				} else {
					fmt.Println(i18n.L("depsResolved", i18n.L("falseMark")))
				}
				if dep.Uptodate(commandContext) {
					fmt.Println(i18n.L("depsUpToDate", i18n.L("trueMark")))
				} else {
					fmt.Println(i18n.L("depsUpToDate", i18n.L("falseMark")))
				}
				fmt.Println("========================")
			}
		},
	}

	depsResolveCmd = &cobra.Command{
		Use:   "resolve",
		Short: i18n.L("depsResolveCommandShort"),
		RunE: func(cmd *cobra.Command, args []string) error {
			overallSuccess := true
			for _, dep := range deps.DepsMap {
				err := dep.Resolve(commandContext)
				if err != nil {
					lg.Loge("deps", "%s", i18n.L("errorResolveDeps", err))
					overallSuccess = false
				}
			}
			if overallSuccess {
				return nil
			}
			return fmt.Errorf("failed to resolve dependencies")
		},
	}

	depsUpdateCmd = &cobra.Command{
		Use:   "update",
		Short: i18n.L("depsUpdateCommandShort"),
		RunE: func(cmd *cobra.Command, args []string) error {
			updateLatest, err := cmd.Flags().GetBool("updateLatest")
			if err != nil {
				return fmt.Errorf("failed to get updateLatest flag: %v", err)
			}
			overallSuccess := true
			for _, dep := range deps.DepsMap {
				err := dep.Update(commandContext, updateLatest)
				if err != nil {
					lg.Loge("deps", "%s", i18n.L("errorUpdateDeps", err))
					overallSuccess = false
				}
			}
			if overallSuccess {
				return nil
			}
			return fmt.Errorf("failed to update dependencies")
		},
	}
)

func init() {
	depsCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", "deps"))

	rootCmd.AddCommand(depsCmd)

	depsListCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", "deps list"))

	depsCmd.AddCommand(depsListCmd)

	depsResolveCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", "deps resolve"))

	depsCmd.AddCommand(depsResolveCmd)

	depsUpdateCmd.Flags().BoolP("updateLatest", "f", false, i18n.L("depsUpdateLatestFlagHelp"))
	depsUpdateCmd.Flags().BoolP("help", "h", false, i18n.L("cobraHelpFor", "deps update"))

	depsCmd.AddCommand(depsUpdateCmd)
}
