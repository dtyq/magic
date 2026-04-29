package main

import (
	"bytes"
	"context"
	"io"
	"testing"

	"magic/internal/tools/lintcmd"
)

type testError string

func (e testError) Error() string {
	return string(e)
}

const errFakeRunnerFailed = testError("lint failed")

type fakeRunner struct {
	runErr error
}

func (f fakeRunner) Run(_ context.Context) error {
	return f.runErr
}

func TestRunReturnsOneOnParseError(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	exitCode := run([]string{"--unknown-flag"}, &stdout, &stderr, nil)
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d", exitCode)
	}
	if stderr.Len() == 0 {
		t.Fatal("expected parse error to be written to stderr")
	}
}

func TestRunReturnsZeroOnSuccess(t *testing.T) {
	t.Parallel()

	factory := func(_ lintcmd.Options, _, _ io.Writer) lintRunner {
		return fakeRunner{}
	}

	exitCode := run(nil, io.Discard, io.Discard, factory)
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", exitCode)
	}
}

func TestRunPassesNoSmartCacheOption(t *testing.T) {
	t.Parallel()

	var got lintcmd.Options
	factory := func(opts lintcmd.Options, _, _ io.Writer) lintRunner {
		got = opts
		return fakeRunner{}
	}

	exitCode := run([]string{"--no-smart-cache"}, io.Discard, io.Discard, factory)
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", exitCode)
	}
	if !got.NoSmartCache {
		t.Fatal("expected --no-smart-cache to be passed to runner factory")
	}
}

func TestRunReturnsOneOnRunnerFailure(t *testing.T) {
	t.Parallel()

	factory := func(_ lintcmd.Options, _, _ io.Writer) lintRunner {
		return fakeRunner{runErr: errFakeRunnerFailed}
	}

	exitCode := run(nil, io.Discard, io.Discard, factory)
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d", exitCode)
	}
}
