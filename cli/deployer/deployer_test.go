package deployer

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInstallChartWithWaitSelector_ChartReferenceNotFound(t *testing.T) {
	ctx := context.Background()
	d := &Deployer{
		chartRefs: map[string]chart.ChartReference{},
	}
	err := d.installChartWithWaitSelector(ctx, releaseNameMagicSandbox, "magic-sandbox", map[string]interface{}{}, nonImagePrepullLabelSelector)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "chart reference not found")
}

func TestInstallChart_ChartReferenceNotFound(t *testing.T) {
	ctx := context.Background()
	d := &Deployer{
		chartRefs: map[string]chart.ChartReference{},
	}
	err := d.installChart(ctx, releaseNameInfra, defaultInfraNamespace, map[string]interface{}{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "chart reference not found")
}

func TestRunInstallAndWait_WaitsForSecondResultAfterFirstNil(t *testing.T) {
	firstDone := make(chan struct{})
	releaseSecond := make(chan struct{})
	errCh := make(chan error, 1)

	go func() {
		errCh <- runInstallAndWait(
			context.Background(),
			func(context.Context) error {
				close(firstDone)
				return nil
			},
			func(ctx context.Context, helmDone <-chan struct{}) error {
				<-helmDone
				<-releaseSecond
				return nil
			},
		)
	}()

	select {
	case <-firstDone:
	case <-time.After(1 * time.Second):
		t.Fatal("first worker did not finish")
	}

	select {
	case err := <-errCh:
		t.Fatalf("runInstallAndWait returned early: %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	close(releaseSecond)

	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-time.After(1 * time.Second):
		t.Fatal("runInstallAndWait did not return after second worker finished")
	}
}

func TestRunInstallAndWait_ReturnsErrorAndCancelsPeer(t *testing.T) {
	expectedErr := errors.New("wait failed")
	peerCanceled := make(chan struct{})

	err := runInstallAndWait(
		context.Background(),
		func(ctx context.Context) error {
			<-ctx.Done()
			close(peerCanceled)
			return ctx.Err()
		},
		func(ctx context.Context, helmDone <-chan struct{}) error {
			return expectedErr
		},
	)

	require.ErrorIs(t, err, expectedErr)

	select {
	case <-peerCanceled:
	case <-time.After(1 * time.Second):
		t.Fatal("peer worker did not observe cancellation")
	}
}

func TestRunInstallAndWait_WatchCannotFinishBeforeHelmDone(t *testing.T) {
	unblockHelm := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- runInstallAndWait(
			context.Background(),
			func(ctx context.Context) error {
				<-unblockHelm
				return nil
			},
			func(ctx context.Context, helmDone <-chan struct{}) error {
				for {
					select {
					case <-ctx.Done():
						return ctx.Err()
					case <-helmDone:
						return nil
					case <-time.After(5 * time.Millisecond):
					}
				}
			},
		)
	}()

	select {
	case err := <-done:
		t.Fatalf("runInstallAndWait returned before helm unblocked: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	close(unblockHelm)

	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("runInstallAndWait did not complete after helm unblocked")
	}
}

func TestRunInstallAndWait_ReturnsFirstError(t *testing.T) {
	helmErr := errors.New("helm upgrade failed")
	err := runInstallAndWait(
		context.Background(),
		func(context.Context) error {
			return helmErr
		},
		func(ctx context.Context, helmDone <-chan struct{}) error {
			<-ctx.Done()
			return ctx.Err()
		},
	)
	require.ErrorIs(t, err, helmErr)
}

func TestRunInstallAndWait_WatchErrorCancelsHelm(t *testing.T) {
	watchErr := errors.New("watch pods failed")
	peerCanceled := make(chan struct{})

	err := runInstallAndWait(
		context.Background(),
		func(ctx context.Context) error {
			<-ctx.Done()
			close(peerCanceled)
			return ctx.Err()
		},
		func(ctx context.Context, helmDone <-chan struct{}) error {
			return watchErr
		},
	)

	require.ErrorIs(t, err, watchErr)

	select {
	case <-peerCanceled:
	case <-time.After(1 * time.Second):
		t.Fatal("helm worker did not observe cancellation")
	}
}
