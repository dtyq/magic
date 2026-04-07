package deployer

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// deployerForDiskCheckTest builds a minimal Deployer for preflight dir/disk checks.
// Log capture uses spyLoggerGroup from reporter_test.go (same-package spyLogger style).
func deployerForDiskCheckTest(t *testing.T, dataDir string) (*spyLogger, *PreflightStage) {
	t.Helper()
	spy, lg := spyLoggerGroup()
	d := &Deployer{
		log: lg,
		opts: Options{
			DataDir: dataDir,
			Log:     lg,
		},
	}
	s := &PreflightStage{
		BaseStage: BaseStage{"preflight"},
		d:         d,
	}
	return spy, s
}

func TestEnsureDataDirReady_CreatesMissingDataDir(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "nested", "fresh-datadir")
	require.NoDirExists(t, dataDir)

	spy, stage := deployerForDiskCheckTest(t, dataDir)
	require.NoError(t, stage.ensureDataDirReady())

	fi, err := os.Stat(dataDir)
	require.NoError(t, err, "expected DataDir to be created, logs: %v", spy.lines)
	assert.True(t, fi.IsDir(), "expected DataDir to be a directory")
}

func TestEnsureDataDirReady_FilePathAsDataDir_WarnsAndReturns(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "not-a-dir")
	require.NoError(t, os.WriteFile(filePath, []byte("x"), 0o644))

	spy, stage := deployerForDiskCheckTest(t, filePath)
	err := stage.ensureDataDirReady()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create data dir")
	assert.False(t, spy.contains("failed to create data dir"), "ensureDataDirReady should return error, logging handled by caller: %v", spy.lines)
}

func TestEnsureDataDirReady_CreateFail_DoesNotPanicAndReturnsError(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "not-a-dir")
	require.NoError(t, os.WriteFile(filePath, []byte("x"), 0o644))

	spy, stage := deployerForDiskCheckTest(t, filePath)

	assert.NotPanics(t, func() {
		_ = stage.ensureDataDirReady()
	}, "ensureDataDirReady must not panic when MkdirAll fails on a file path")

	err := stage.ensureDataDirReady()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create data dir")

	fi, err := os.Stat(filePath)
	require.NoError(t, err)
	assert.False(t, fi.IsDir(), "path must stay a regular file; proves early return after create failure")

	assert.NotPanics(t, func() {
		_ = stage.ensureDataDirReady()
	}, "repeat ensureDataDirReady must remain non-panicking")
	assert.False(t, spy.contains("failed to create data dir"), "ensureDataDirReady should return error, logging handled by caller: %v", spy.lines)
}

func TestEnsureDataDirReady_ExistingDataDir_NoCreateInfo(t *testing.T) {
	dataDir := t.TempDir()

	spy, stage := deployerForDiskCheckTest(t, dataDir)
	require.NoError(t, stage.ensureDataDirReady())

	for _, line := range spy.lines {
		assert.NotContains(t, line, "data dir not found, created", "unexpected auto-create info on existing dir: %v", spy.lines)
	}
}

func TestCheckDiskSpace_DiskCheckFailure_WarnsAndReturns(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "missing-dir")
	require.NoDirExists(t, dataDir)

	spy, stage := deployerForDiskCheckTest(t, dataDir)
	stage.checkDiskSpace()

	assert.True(t, spy.contains("failed to check free disk space"), "expected disk-check warning, got: %v", spy.lines)
	assert.False(t, spy.contains("failed to create data dir"), "disk check should not create data dir anymore, got: %v", spy.lines)
}
