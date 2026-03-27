package chart

import (
	"errors"
	"testing"

	"helm.sh/helm/v4/pkg/release"
	"helm.sh/helm/v4/pkg/release/common"
	releasev1 "helm.sh/helm/v4/pkg/release/v1"

	"github.com/stretchr/testify/assert"
)

func TestNewHTTPReference_WithBasicAuthFields(t *testing.T) {
	ref := NewHTTPReference(
		"https://git.example.com/org/charts",
		"infra",
		"0.0.1",
		"user1",
		"pat-123",
		true,
	)

	assert.Equal(t, RefKindHTTP, ref.Kind)
	assert.Equal(t, "https://git.example.com/org/charts", ref.RepoURL)
	assert.Equal(t, "infra", ref.Name)
	assert.Equal(t, "0.0.1", ref.Version)
	assert.Equal(t, "user1", ref.Username)
	assert.Equal(t, "pat-123", ref.Password)
	assert.True(t, ref.PassCredentialsAll)
}

func TestShouldUseUpgrade(t *testing.T) {
	t.Run("history error falls back to fresh install", func(t *testing.T) {
		useUpgrade, replaceInstall := shouldUseUpgrade(nil, errors.New("history error"))
		assert.False(t, useUpgrade)
		assert.False(t, replaceInstall)
	})

	t.Run("uninstalled latest release uses install replace", func(t *testing.T) {
		history := []release.Releaser{
			&releasev1.Release{Version: 1, Info: &releasev1.Info{Status: common.StatusDeployed}},
			&releasev1.Release{Version: 2, Info: &releasev1.Info{Status: common.StatusUninstalled}},
		}
		useUpgrade, replaceInstall := shouldUseUpgrade(history, nil)
		assert.False(t, useUpgrade)
		assert.True(t, replaceInstall)
	})

	t.Run("failed latest release uses install replace", func(t *testing.T) {
		history := []release.Releaser{
			&releasev1.Release{Version: 3, Info: &releasev1.Info{Status: common.StatusFailed}},
		}
		useUpgrade, replaceInstall := shouldUseUpgrade(history, nil)
		assert.False(t, useUpgrade)
		assert.True(t, replaceInstall)
	})

	t.Run("deployed latest release uses upgrade", func(t *testing.T) {
		history := []release.Releaser{
			&releasev1.Release{Version: 3, Info: &releasev1.Info{Status: common.StatusDeployed}},
		}
		useUpgrade, replaceInstall := shouldUseUpgrade(history, nil)
		assert.True(t, useUpgrade)
		assert.False(t, replaceInstall)
	})
}
