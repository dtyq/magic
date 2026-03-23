package cli

import (
	"fmt"

	"github.com/dtyq/magicrew-cli/cluster"
	"github.com/spf13/cobra"
)

var teardownCmd = &cobra.Command{
	Use:   "teardown",
	Short: "Delete the local magic kind cluster",
	RunE:  runTeardown,
}

func init() {
	teardownCmd.Flags().BoolP("help", "h", false, "Help for teardown")
	rootCmd.AddCommand(teardownCmd)
}

func runTeardown(cmd *cobra.Command, args []string) error {
	name := cfg.Deploy.Kind.Name
	fmt.Printf("Deleting kind cluster '%s'...\n", name)
	if err := cluster.Delete(name); err != nil {
		return fmt.Errorf("delete cluster: %w", err)
	}
	fmt.Printf("✓ Cluster '%s' deleted.\n", name)
	return nil
}
