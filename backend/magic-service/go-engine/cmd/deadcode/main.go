// Package main provides the incremental deadcode command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartdeadcode"
)

type deadcodeRunner interface {
	Run(ctx context.Context) error
}

type deadcodeRunnerFactory func(opts smartdeadcode.Options, stdout, stderr io.Writer) deadcodeRunner

func newDeadcodeRunner(opts smartdeadcode.Options, stdout, stderr io.Writer) deadcodeRunner {
	return smartdeadcode.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newDeadcodeRunner))
}

func run(args []string, stdout, stderr io.Writer, factory deadcodeRunnerFactory) int {
	opts, err := smartdeadcode.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newDeadcodeRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}
