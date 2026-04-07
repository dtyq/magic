package deployer

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"helm.sh/helm/v4/pkg/release/common"
)

type fakeReadWriteCloser struct {
	io.Reader
	io.Writer
	closed bool
}

func (f *fakeReadWriteCloser) Close() error {
	f.closed = true
	return nil
}

func TestChooseRecoveryAction(t *testing.T) {
	action, ok := chooseRecoveryAction(common.StatusPendingInstall)
	require.True(t, ok)
	assert.Equal(t, recoveryActionUninstall, action)

	action, ok = chooseRecoveryAction(common.StatusPendingUpgrade)
	require.True(t, ok)
	assert.Equal(t, recoveryActionRollback, action)

	action, ok = chooseRecoveryAction(common.StatusPendingRollback)
	require.True(t, ok)
	assert.Equal(t, recoveryActionRollback, action)

	action, ok = chooseRecoveryAction(common.StatusDeployed)
	assert.False(t, ok)
	assert.Equal(t, releaseRecoveryAction(""), action)
}

func TestPromptRecoveryConfirmation_NonInteractive(t *testing.T) {
	err := promptRecoveryConfirmation(
		strings.NewReader(""),
		&bytes.Buffer{},
		false,
		false,
		"infra",
		"infra",
		common.StatusPendingInstall,
		recoveryActionUninstall,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "non-interactive")
}

func TestPromptRecoveryConfirmation_Accepted(t *testing.T) {
	var out bytes.Buffer
	err := promptRecoveryConfirmation(
		strings.NewReader("y\n"),
		&out,
		true,
		false,
		"infra",
		"infra",
		common.StatusPendingUpgrade,
		recoveryActionRollback,
	)
	require.NoError(t, err)
	assert.Contains(t, out.String(), "rollback")
}

func TestPromptRecoveryConfirmation_Rejected(t *testing.T) {
	var out bytes.Buffer
	err := promptRecoveryConfirmation(
		strings.NewReader("n\n"),
		&out,
		true,
		false,
		"infra",
		"infra",
		common.StatusPendingUpgrade,
		recoveryActionRollback,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cancelled")
}

func TestPromptRecoveryConfirmation_AutoRecoverBypassesTTY(t *testing.T) {
	var out bytes.Buffer
	err := promptRecoveryConfirmation(
		strings.NewReader(""),
		&out,
		false,
		true,
		"infra",
		"infra",
		common.StatusPendingInstall,
		recoveryActionUninstall,
	)
	require.NoError(t, err)
	assert.Contains(t, out.String(), "Auto recovery enabled")
}

func TestExecuteRecoveryFlow_RollbackFailsFallbackUninstall(t *testing.T) {
	var called []releaseRecoveryAction
	errRollback := errors.New("rollback failed")

	err := executeRecoveryFlow(common.StatusPendingUpgrade, recoveryExecutor{
		confirm: func(action releaseRecoveryAction) error {
			called = append(called, action)
			return nil
		},
		rollback: func() error { return errRollback },
		uninstall: func() error {
			called = append(called, recoveryActionUninstall)
			return nil
		},
	})
	require.NoError(t, err)
	assert.Equal(t, []releaseRecoveryAction{
		recoveryActionRollback,
		recoveryActionUninstall,
		recoveryActionUninstall,
	}, called)
}

func TestSelectConfirmationIO(t *testing.T) {
	t.Run("prefer stdio when interactive", func(t *testing.T) {
		in := strings.NewReader("stdin")
		out := &bytes.Buffer{}
		tty := &fakeReadWriteCloser{Reader: strings.NewReader("tty"), Writer: &bytes.Buffer{}}
		got := selectConfirmationIO(in, out, true, tty, nil)
		require.True(t, got.interactive)
		assert.Same(t, in, got.in)
		assert.Same(t, out, got.out)
		got.cleanup()
		assert.False(t, tty.closed)
	})

	t.Run("fallback to tty when stdio non-interactive", func(t *testing.T) {
		in := strings.NewReader("stdin")
		out := &bytes.Buffer{}
		ttyOut := &bytes.Buffer{}
		tty := &fakeReadWriteCloser{Reader: strings.NewReader("tty"), Writer: ttyOut}
		got := selectConfirmationIO(in, out, false, tty, nil)
		require.True(t, got.interactive)
		assert.Same(t, tty, got.in)
		assert.Same(t, tty, got.out)
		got.cleanup()
		assert.True(t, tty.closed)
	})

	t.Run("non-interactive when tty unavailable", func(t *testing.T) {
		in := strings.NewReader("stdin")
		out := &bytes.Buffer{}
		got := selectConfirmationIO(in, out, false, nil, errors.New("open tty failed"))
		assert.False(t, got.interactive)
		assert.Same(t, in, got.in)
		assert.Same(t, out, got.out)
	})
}
