package code

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/dtyq/magicrew-cli/image"
	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/plumbing"
	"github.com/stretchr/testify/assert/yaml"
)

type Code struct {
	BaseDir    string
	Repository *git.Repository
}

func FindMagicrew(startPath string) (*Code, error) {
	wd, err := filepath.Abs(startPath)
	if err != nil {
		return nil, fmt.Errorf("error getting current path: %w", err)
	}

	for {
		// 递归向上找magicrew.yml
		if _, err := os.Stat(filepath.Join(wd, "magicrew.yml")); err == nil {
			break
		}
		wd = filepath.Dir(wd)
		if wd == "/" {
			break
		}
	}
	if wd == "/" {
		return nil, fmt.Errorf("magicrew root not found")
	}

	r, err := git.PlainOpen(wd)
	// 打不开就打不开吧
	// if err != nil {
	// 	return nil, fmt.Errorf("error opening git repository: %w", err)
	// }

	return &Code{
		BaseDir:    wd,
		Repository: r,
	}, nil
}

type MagicrewStructure struct {
	Images map[string]image.Build `yaml:"images"`
}

func (c *Code) ReadStructure() (*MagicrewStructure, error) {
	magicrewYml, err := os.ReadFile(filepath.Join(c.BaseDir, "magicrew.yml"))
	if err != nil {
		return nil, fmt.Errorf("error reading magicrew.yml: %w", err)
	}

	magicrewStructure := MagicrewStructure{}
	err = yaml.Unmarshal(magicrewYml, &magicrewStructure)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling magicrew.yml: %w", err)
	}
	return &magicrewStructure, nil
}

func (c *Code) Chdir() error {
	return os.Chdir(c.BaseDir)
}

func (c *Code) Update(remoteName string) (string, error) {
	if c.Repository == nil {
		return "", fmt.Errorf("failed to open repository")
	}

	wt, err := c.Repository.Worktree()
	if err != nil {
		return "", fmt.Errorf("error getting worktree: %w", err)
	}

	err = wt.Pull(&git.PullOptions{RemoteName: "origin"})
	if err != nil {
		return "", fmt.Errorf("error pulling repository: %w", err)
	}

	ref, err := c.Repository.Head()
	if err != nil {
		return "", fmt.Errorf("error getting head: %w", err)
	}
	return ref.Hash().String(), nil
}

func (c *Code) WorkTreeDirty() (bool, error) {
	if c.Repository == nil {
		return false, fmt.Errorf("failed to open repository")
	}

	wt, err := c.Repository.Worktree()
	if err != nil {
		return false, fmt.Errorf("error getting worktree: %w", err)
	}

	status, err := wt.Status()
	if err != nil {
		return false, fmt.Errorf("error getting status: %w", err)
	}
	return !status.IsClean(), nil
}

func (c *Code) GetHEADHash() (string, error) {
	if c.Repository == nil {
		return "", fmt.Errorf("failed to open repository")
	}

	ref, err := c.Repository.Head()
	if err != nil {
		return "", fmt.Errorf("error getting head: %w", err)
	}

	hash := ref.Hash().String()
	return hash, nil
}

func (c *Code) GetBranch() (string, error) {
	if c.Repository == nil {
		return "", fmt.Errorf("failed to open repository")
	}

	ref, err := c.Repository.Head()
	if err != nil {
		return "", fmt.Errorf("error getting head: %w", err)
	}
	if !ref.Name().IsBranch() {
		return "", fmt.Errorf("head is not a branch")
	}
	return ref.Name().Short(), nil
}

func (c *Code) GetHEADTags() ([]string, error) {
	if c.Repository == nil {
		return nil, fmt.Errorf("failed to open repository")
	}

	head, err := c.Repository.Head()
	if err != nil {
		return nil, fmt.Errorf("error getting head: %w", err)
	}
	headHash := head.Hash()

	tagRefs, err := c.Repository.Tags()
	if err != nil {
		return nil, fmt.Errorf("error getting tags: %w", err)
	}
	var tags []string
	err = tagRefs.ForEach(func(ref *plumbing.Reference) error {
		// 轻量 tag 直接指向 commit
		if ref.Hash() == headHash {
			tags = append(tags, ref.Name().Short())
			return nil
		}
		// 附注 tag 需要解引用到 commit
		tagObj, err := c.Repository.TagObject(ref.Hash())
		if err != nil {
			return nil
		}
		commitHash := tagObj.Target
		if commitHash == headHash {
			tags = append(tags, ref.Name().Short())
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("error iterating tags: %w", err)
	}
	return tags, nil
}
