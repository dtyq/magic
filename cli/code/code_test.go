package code

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/dtyq/magicrew-cli/image"
	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/plumbing/object"
	"github.com/stretchr/testify/assert"
)

const testMagicrewYml = `
images:
  test:
    context: ./test
    tags:
      - test:latest
      - test:v1.0.0

`

var testMagicrewStructure = MagicrewStructure{
	Images: map[string]image.Build{
		"test": {
			Context: "./test",
			Tags:    []string{"test:latest", "test:v1.0.0"},
		},
	},
}

func TestFindMagicrew(t *testing.T) {
	// create filesystem structure to test find
	rootDir := t.TempDir()
	defer os.RemoveAll(rootDir)

	err := os.MkdirAll(filepath.Join(rootDir, "home", "someuser", "magicrew", "cli", "code"), 0755)
	if !assert.NoError(t, err) {
		t.FailNow()
	}
	targetBaseDir, err := filepath.Abs(filepath.Join(rootDir, "home", "someuser", "magicrew"))
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	magicrewYml := filepath.Join(targetBaseDir, "magicrew.yml")
	err = os.WriteFile(magicrewYml, []byte(testMagicrewYml), 0644)
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	t.Run("AtRoot", func(t *testing.T) {
		// find magicrew at the root - should fail
		code, err := FindMagicrew(rootDir)
		if !assert.Error(t, err) {
			t.FailNow()
		}
		assert.Nil(t, code)
	})

	t.Run("AtMagicrew", func(t *testing.T) {
		// find magicrew at the magicrew directory - should succeed
		code, err := FindMagicrew(filepath.Join(rootDir, "home", "someuser", "magicrew"))
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.NotNil(t, code)
		assert.Equal(t, targetBaseDir, code.BaseDir)
	})

	t.Run("AtCli", func(t *testing.T) {
		// find magicrew at the cli directory - should succeed
		code, err := FindMagicrew(filepath.Join(rootDir, "home", "someuser", "magicrew", "cli"))
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.NotNil(t, code)
		assert.Equal(t, targetBaseDir, code.BaseDir)
	})

	t.Run("AtCliSubPackage", func(t *testing.T) {
		// find magicrew at the cli sub package directory - should succeed
		code, err := FindMagicrew(filepath.Join(rootDir, "home", "someuser", "magicrew", "cli", "code"))
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.NotNil(t, code)
		assert.Equal(t, targetBaseDir, code.BaseDir)
	})

	t.Run("ReadStructure", func(t *testing.T) {
		// find magicrew at the cli sub package directory
		code, err := FindMagicrew(filepath.Join(rootDir, "home", "someuser", "magicrew", "cli", "code"))
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.NotNil(t, code)
		assert.Equal(t, targetBaseDir, code.BaseDir)

		structure, err := code.ReadStructure()
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.Equal(t, testMagicrewStructure, *structure)
	})
}

func TestInfoHelpers(t *testing.T) {
	var err error
	tempDir := t.TempDir()
	defer os.RemoveAll(tempDir)

	repo, err := git.PlainInit(tempDir, false)
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	wt, err := repo.Worktree()
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	// write test structure
	err = os.WriteFile(filepath.Join(tempDir, "magicrew.yml"), []byte(testMagicrewYml), 0644)
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	// write dummy code
	const cleanContent = "# hello world"
	const dirtyContent = "# hello world 2"
	writeDummyCode := func(t *testing.T, content string) {
		err = os.WriteFile(filepath.Join(tempDir, "Readme.md"), []byte(content), 0644)
		if !assert.NoError(t, err) {
			t.FailNow()
		}
	}
	writeDummyCode(t, cleanContent)

	// commit test structure
	err = wt.AddWithOptions(&git.AddOptions{
		All: true,
	})
	if !assert.NoError(t, err) {
		t.FailNow()
	}
	testCommitHash, err := wt.Commit("test commit", &git.CommitOptions{
		Author: &object.Signature{Name: "Test User", Email: "test@example.com", When: time.Now()},
	})

	// tag it multiple
	lightweightTag, err := repo.CreateTag("lightweight-tag", testCommitHash, nil)
	if !assert.NoError(t, err) {
		t.FailNow()
	}
	annotatedTag, err := repo.CreateTag("annotated-tag", testCommitHash, &git.CreateTagOptions{
		Message: "annotated tag",
		Tagger:  &object.Signature{Name: "Test User", Email: "test@example.com", When: time.Now()},
	})
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	code, err := FindMagicrew(tempDir)
	if !assert.NoError(t, err) {
		t.FailNow()
	}

	t.Run("GetHEADHash", func(t *testing.T) {
		// not dirty
		hash, err := code.GetHEADHash()
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.Equal(t, testCommitHash.String(), hash)
	})
	t.Run("WorkTreeDirty", func(t *testing.T) {
		writeDummyCode(t, cleanContent)

		// not dirty
		dirty, err := code.WorkTreeDirty()
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.False(t, dirty)

		writeDummyCode(t, dirtyContent)

		// dirty
		dirty, err = code.WorkTreeDirty()
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.True(t, dirty)
	})

	t.Run("GetHEADTags", func(t *testing.T) {
		tags, err := code.GetHEADTags()
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{lightweightTag.Name().Short(), annotatedTag.Name().Short()}, tags)
	})
}
