// Package main provides the incremental go vet command entrypoint.
package main

import (
	"fmt"
	"log/slog"
	"os"

	"magic/internal/pkg/logkey"
	"magic/internal/tools/smartvet"
)

func main() {
	logger := slog.Default()
	opts, err := smartvet.ParseOptions(os.Args[1:])
	if err != nil {
		logger.Error("invalid flags", logkey.Error, err)
		os.Exit(1)
	}

	runner := smartvet.NewRunner(opts, logger, os.Stdout, os.Stderr)
	if err := runner.Run(); err != nil {
		logger.Error("smartvet failed", logkey.Error, err)
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
