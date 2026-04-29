package selfcheck_test

import (
	"bytes"
	"strings"
	"testing"

	"magic/internal/pkg/selfcheck"
)

func TestRunShouldIgnoreNonSelfCheckCommand(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	handled, exitCode := selfcheck.Run([]string{"serve"}, &stdout, &stderr)
	if handled {
		t.Fatal("expected non self-check command to be ignored")
	}
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", exitCode)
	}
}

func TestRunShouldReturnUsageWhenMissingTarget(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	handled, exitCode := selfcheck.Run([]string{"self-check"}, &stdout, &stderr)
	if !handled {
		t.Fatal("expected self-check command handled")
	}
	if exitCode != 2 {
		t.Fatalf("expected usage exit code 2, got %d", exitCode)
	}
	if !strings.Contains(stderr.String(), "usage: magic-go-engine self-check tokenizer-offline") {
		t.Fatalf("unexpected usage output: %s", stderr.String())
	}
}

func TestRunShouldReturnUsageForUnknownTarget(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	handled, exitCode := selfcheck.Run([]string{"self-check", "unknown"}, &stdout, &stderr)
	if !handled {
		t.Fatal("expected self-check command handled")
	}
	if exitCode != 2 {
		t.Fatalf("expected usage exit code 2, got %d", exitCode)
	}
	if !strings.Contains(stderr.String(), "unknown self-check target") {
		t.Fatalf("unexpected error output: %s", stderr.String())
	}
}

func TestRunTokenizerOfflineShouldSucceed(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	handled, exitCode := selfcheck.Run([]string{"self-check", "tokenizer-offline"}, &stdout, &stderr)
	if !handled {
		t.Fatal("expected tokenizer self-check handled")
	}
	if exitCode != 0 {
		t.Fatalf("expected success exit code 0, got %d, stderr=%s", exitCode, stderr.String())
	}
	if !strings.Contains(stdout.String(), "self-check tokenizer-offline: ok") {
		t.Fatalf("unexpected success output: %s", stdout.String())
	}
}
