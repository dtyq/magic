package code

import (
	"os"

	"github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/plumbing"
)

const (
	DefaultCloneURL = "https://github.com/dtyq/magic.git"
	DefaultRef      = "refs/heads/master"
)

func Clone(url string, ref string, dest string, shallow bool) (*Code, error) {
	cloneOptions := &git.CloneOptions{
		URL:           url,
		Progress:      os.Stdout,
		ReferenceName: plumbing.ReferenceName(ref),
	}

	if shallow {
		cloneOptions.Depth = 1
		cloneOptions.SingleBranch = true
	}

	r, err := git.PlainClone(dest, cloneOptions)
	if err != nil {
		return nil, err
	}

	return &Code{
		BaseDir:    dest,
		Repository: r,
	}, nil
}
