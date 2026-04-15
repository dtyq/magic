// Package main provides the incremental golangci-lint command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartgolangci"
)

type lintRunner interface {
	Run(ctx context.Context) error
}

type lintRunnerFactory func(opts smartgolangci.Options, stdout, stderr io.Writer) lintRunner

func newLintRunner(opts smartgolangci.Options, stdout, stderr io.Writer) lintRunner {
	return smartgolangci.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newLintRunner))
}

func run(args []string, stdout, stderr io.Writer, factory lintRunnerFactory) int {
	opts, err := smartgolangci.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newLintRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}
