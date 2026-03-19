package main

import (
	"fmt"
	"os"

	"github.com/dtyq/sandbox-components/cmd/webhook-server/app"
)

func main() {
	if err := app.Execute(nil); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}
