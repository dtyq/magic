package chart

import (
	"testing"

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
