package deployer

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/mattn/go-isatty"
	"helm.sh/helm/v4/pkg/release/common"
)

type releaseRecoveryAction string

const (
	recoveryActionRollback  releaseRecoveryAction = "rollback"
	recoveryActionUninstall releaseRecoveryAction = "uninstall"
)

type recoveryExecutor struct {
	confirm   func(action releaseRecoveryAction) error
	rollback  func() error
	uninstall func() error
}

type confirmationIO struct {
	in          io.Reader
	out         io.Writer
	interactive bool
	cleanup     func()
}

var openTTY = func() (io.ReadWriteCloser, error) {
	return os.OpenFile("/dev/tty", os.O_RDWR, 0)
}

// ensureReleaseReadyForInstall checks pending Helm states and recovers
// the release before running install/upgrade.
func ensureReleaseReadyForInstall(ctx context.Context, d *Deployer, name, namespace string) error {
	rel, err := chart.GetReleaseStatus(ctx, name, namespace, d.kubeClient.RESTConfig())
	if err != nil {
		return fmt.Errorf("get helm release status: %w", err)
	}
	if rel == nil || rel.Info == nil || !rel.Info.Status.IsPending() {
		return nil
	}

	status := rel.Info.Status
	d.log.Logw("deploy", "release %s/%s is in %s; recovery is required", namespace, name, status)
	confirmIO := resolveConfirmationIO(os.Stdin, os.Stdout, isInteractiveTerminal())
	defer confirmIO.cleanup()
	exec := recoveryExecutor{
		confirm: func(action releaseRecoveryAction) error {
			return promptRecoveryConfirmation(
				confirmIO.in,
				confirmIO.out,
				confirmIO.interactive,
				d.opts.AutoRecoverRelease,
				name,
				namespace,
				status,
				action,
			)
		},
		rollback: func() error {
			d.log.Logi("deploy", "recover release %s/%s by rollback", namespace, name)
			return chart.RollbackRelease(ctx, name, namespace, d.kubeClient.RESTConfig(), 0)
		},
		uninstall: func() error {
			d.log.Logi("deploy", "recover release %s/%s by uninstall", namespace, name)
			return chart.UninstallRelease(ctx, name, namespace, d.kubeClient.RESTConfig())
		},
	}
	if err := executeRecoveryFlow(status, exec); err != nil {
		return fmt.Errorf("recover release %s/%s from %s: %w", namespace, name, status, err)
	}
	return nil
}

func chooseRecoveryAction(status common.Status) (releaseRecoveryAction, bool) {
	if !status.IsPending() {
		return "", false
	}
	if status == common.StatusPendingInstall {
		return recoveryActionUninstall, true
	}
	return recoveryActionRollback, true
}

// executeRecoveryFlow applies the selected recovery action.
// For rollback path, it supports an uninstall fallback when rollback fails.
func executeRecoveryFlow(status common.Status, exec recoveryExecutor) error {
	action, ok := chooseRecoveryAction(status)
	if !ok {
		return nil
	}
	if err := exec.confirm(action); err != nil {
		return err
	}

	switch action {
	case recoveryActionUninstall:
		if err := exec.uninstall(); err != nil {
			return fmt.Errorf("uninstall release: %w", err)
		}
		return nil
	case recoveryActionRollback:
		if err := exec.rollback(); err != nil {
			if askErr := exec.confirm(recoveryActionUninstall); askErr != nil {
				return fmt.Errorf("rollback release: %w (fallback uninstall cancelled: %v)", err, askErr)
			}
			if uninstallErr := exec.uninstall(); uninstallErr != nil {
				return fmt.Errorf("rollback release: %w (fallback uninstall failed: %v)", err, uninstallErr)
			}
		}
		return nil
	default:
		return fmt.Errorf("unsupported recovery action %q", action)
	}
}

func promptRecoveryConfirmation(
	in io.Reader,
	out io.Writer,
	interactive bool,
	autoRecover bool,
	releaseName, namespace string,
	status common.Status,
	action releaseRecoveryAction,
) error {
	if autoRecover {
		_, _ = fmt.Fprintf(
			out,
			"Helm release %s/%s is %s. Auto recovery enabled, continue with %s.\n",
			namespace, releaseName, status, action,
		)
		return nil
	}

	if !interactive {
		return fmt.Errorf(
			"detected pending release %s/%s (%s) in non-interactive mode; rerun in tty to confirm %s",
			namespace, releaseName, status, action,
		)
	}

	if _, err := fmt.Fprintf(
		out,
		"Helm release %s/%s is %s. Confirm %s before continue deploy? [y/N]: ",
		namespace,
		releaseName,
		status,
		action,
	); err != nil {
		return err
	}

	reader := bufio.NewReader(in)
	answer, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("read confirmation: %w", err)
	}
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "y", "yes":
		return nil
	default:
		return fmt.Errorf("user cancelled %s for pending release %s/%s", action, namespace, releaseName)
	}
}

func isInteractiveTerminal() bool {
	return isatty.IsTerminal(os.Stdin.Fd()) && isatty.IsTerminal(os.Stdout.Fd())
}

// resolveConfirmationIO chooses the input/output stream for confirmations.
// It prefers stdio; when stdio is non-interactive (e.g. pipe), it falls back to /dev/tty.
func resolveConfirmationIO(stdin io.Reader, stdout io.Writer, stdioInteractive bool) confirmationIO {
	tty, err := openTTY()
	return selectConfirmationIO(stdin, stdout, stdioInteractive, tty, err)
}

// selectConfirmationIO is separated from resolveConfirmationIO to make tty fallback testable.
func selectConfirmationIO(
	stdin io.Reader,
	stdout io.Writer,
	stdioInteractive bool,
	tty io.ReadWriteCloser,
	ttyErr error,
) confirmationIO {
	if stdioInteractive {
		return confirmationIO{
			in:          stdin,
			out:         stdout,
			interactive: true,
			cleanup:     func() {},
		}
	}
	if ttyErr == nil && tty != nil {
		return confirmationIO{
			in:          tty,
			out:         tty,
			interactive: true,
			cleanup: func() {
				_ = tty.Close()
			},
		}
	}
	return confirmationIO{
		in:          stdin,
		out:         stdout,
		interactive: false,
		cleanup:     func() {},
	}
}
