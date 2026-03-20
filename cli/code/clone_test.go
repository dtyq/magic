package code

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClone(t *testing.T) {
	t.Run("NotShallow", func(t *testing.T) {
		tempDir := t.TempDir()
		defer os.RemoveAll(tempDir)

		code, err := Clone("https://github.com/octocat/Hello-World.git", "master", tempDir, false)
		if err != nil {
			t.Fatalf("failed to clone code: %v", err)
		}
		assert.NotNil(t, code)
	})

	t.Run("Shallow", func(t *testing.T) {
		tempDir := t.TempDir()
		defer os.RemoveAll(tempDir)

		code, err := Clone("https://github.com/octocat/Hello-World.git", "master", tempDir, true)
		if err != nil {
			t.Fatalf("failed to clone code: %v", err)
		}
		assert.NotNil(t, code)
	})
}
