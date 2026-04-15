// Package main provides the incremental analyzer build command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartvettool"
)

type vettoolRunner interface {
	Run(ctx context.Context) error
}

type vettoolRunnerFactory func(opts smartvettool.Options, stdout, stderr io.Writer) vettoolRunner

func newVettoolRunner(opts smartvettool.Options, stdout, stderr io.Writer) vettoolRunner {
	return smartvettool.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newVettoolRunner))
}

func run(args []string, stdout, stderr io.Writer, factory vettoolRunnerFactory) int {
	opts, err := smartvettool.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newVettoolRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}
