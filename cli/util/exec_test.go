package util

import (
	"bytes"
	"context"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCommand(t *testing.T) {
	// ctx for logging
	ctx := getLogContext()

	var cmd *Command
	var err error

	// simple echo command without ctx
	cmd = &Command{
		Args: []string{"echo", "hello"},
	}
	err = cmd.Run(context.Background())
	if !assert.NoError(t, err) {
		t.Fatalf("failed to run command: %v", err)
	}

	// simple echo command
	cmd = &Command{
		Args: []string{"echo", "hello"},
	}
	err = cmd.Run(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to run command: %v", err)
	}

	// check stdout
	tempDir := t.TempDir()
	stdout := bytes.NewBufferString("")
	cmd = &Command{
		Args:   []string{"sh", "-c", "echo \"$PWD\""},
		Dir:    tempDir,
		Stdout: stdout,
	}
	err = cmd.Run(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to run command: %v", err)
	}
	assert.Equal(t, tempDir, strings.TrimSpace(stdout.String()))

	// stop signal
	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	cmd = &Command{
		Args:       []string{"sleep", "10"},
		StopSignal: syscall.SIGTERM,
		WaitDelay:  1 * time.Second,
	}
	err = cmd.Run(ctx)
	if !assert.ErrorContains(t, err, "signal: terminated") {
		t.Fatalf("not expected error: %v", err)
	}
	assert.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)

	// start command
	ctx = getLogContext()
	cmd = &Command{
		Args:       []string{"sleep", "100"},
		StopSignal: syscall.SIGTERM,
		WaitDelay:  1 * time.Second,
	}
	err = cmd.Start(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to start command: %v", err)
	}
	// assert process is running
	assert.NotNil(t, cmd.cmd)
	assert.NotNil(t, cmd.cmd.Process)
	err = cmd.cmd.Process.Signal(syscall.Signal(0))
	if !assert.NoError(t, err) {
		t.Fatalf("failed to signal process: %v", err)
	}
	cmd.cmd.Process.Signal(syscall.SIGTERM)

	// wait
	cmd = &Command{
		Args: []string{"sleep", "1"},
	}
	err = cmd.Wait(ctx)
	if !assert.ErrorContains(t, err, "command not started") {
		t.Fatalf("not expected error: %v", err)
	}
	err = cmd.Start(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to start command: %v", err)
	}
	err = cmd.Wait(ctx)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to wait command: %v", err)
	}
}
