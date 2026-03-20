package main

import (
	cli "github.com/dtyq/magicrew-cli"
	"github.com/spf13/cobra"
)

func main() {
	err := cli.Execute()
	cobra.CheckErr(err)
}
