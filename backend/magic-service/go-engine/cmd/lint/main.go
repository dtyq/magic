// Package main provides the repository lint command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/lintcmd"
)

type lintRunner interface {
	Run(ctx context.Context) error
}

type lintRunnerFactory func(opts lintcmd.Options, stdout, stderr io.Writer) lintRunner

func newLintRunner(opts lintcmd.Options, stdout, stderr io.Writer) lintRunner {
	return lintcmd.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newLintRunner))
}

func run(args []string, stdout, stderr io.Writer, runnerFactory lintRunnerFactory) int {
	opts, err := lintcmd.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if runnerFactory == nil {
		runnerFactory = newLintRunner
	}

	runner := runnerFactory(opts, stdout, stderr)
	if err := runner.Run(context.Background()); err != nil {
		return 1
	}

	return 0
}
