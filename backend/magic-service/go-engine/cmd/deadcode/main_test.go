package main

import (
	"bytes"
	"context"
	"io"
	"testing"

	"magic/internal/tools/smartdeadcode"
)

type testError string

func (e testError) Error() string {
	return string(e)
}

const errFakeDeadcodeFailed = testError("deadcode failed")

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

	factory := func(_ smartdeadcode.Options, _, _ io.Writer) deadcodeRunner {
		return fakeRunner{}
	}

	exitCode := run(nil, io.Discard, io.Discard, factory)
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", exitCode)
	}
}

func TestRunReturnsOneOnRunnerFailure(t *testing.T) {
	t.Parallel()

	factory := func(_ smartdeadcode.Options, _, _ io.Writer) deadcodeRunner {
		return fakeRunner{runErr: errFakeDeadcodeFailed}
	}

	exitCode := run(nil, io.Discard, io.Discard, factory)
	if exitCode != 1 {
		t.Fatalf("expected exit code 1, got %d", exitCode)
	}
}
