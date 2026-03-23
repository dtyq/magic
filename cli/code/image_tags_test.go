package code

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/plumbing"
	"github.com/go-git/go-git/v6/plumbing/object"
	"github.com/stretchr/testify/assert"
)

func TestGenerateImageTags(t *testing.T) {
	var err error
	tempDir := t.TempDir()
	defer os.RemoveAll(tempDir)

	const branchName = "test-branch"
	repo, err := git.PlainInit(tempDir, false,
		git.WithDefaultBranch(plumbing.ReferenceName("refs/heads/"+branchName)),
	)
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

	t.Run("latest", func(t *testing.T) {
		tags, err := code.GenerateImageTags("latest")
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{"latest"}, tags)
	})

	t.Run("commit", func(t *testing.T) {
		tags, err := code.GenerateImageTags("commit")
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{testCommitHash.String()}, tags)
	})

	t.Run("nightly-date", func(t *testing.T) {
		tags, err := code.GenerateImageTags("nightly-date")
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{"nightly-" + time.Now().Format("20060102")}, tags)
	})

	t.Run("branch", func(t *testing.T) {
		tags, err := code.GenerateImageTags("branch")
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{branchName}, tags)
	})

	t.Run("git-tags", func(t *testing.T) {
		tags, err := code.GenerateImageTags("git-tags")
		if !assert.NoError(t, err) {
			t.FailNow()
		}
		assert.ElementsMatch(t, []string{lightweightTag.Name().Short(), annotatedTag.Name().Short()}, tags)
	})
}
