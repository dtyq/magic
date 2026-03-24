package image

import (
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/moby/go-archive"
	"github.com/moby/go-archive/compression"
	"github.com/moby/patternmatcher/ignorefile"
	ocispecv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

type Build struct {
	Dockerfile string             `yaml:"dockerfile"`
	Context    string             `yaml:"context"`
	BuildArgs  map[string]*string `yaml:"buildArgs"`
	Tags       []string           `yaml:"tags"`
	Platforms  []string           `yaml:"platforms"`
}

func (b *Build) DockerTarReader(comp compression.Compression) (io.Reader, error) {
	excludePatterns := []string{}
	f, err := os.Open(filepath.Join(b.Context, ".dockerignore"))
	if err == nil {
		defer f.Close()
		excludePatterns, err = ignorefile.ReadAll(f)
		if err != nil {
			return nil, err
		}
	}

	dockerfile := b.Dockerfile
	if dockerfile == "" {
		dockerfile = "Dockerfile"
	}
	excludePatterns = append(excludePatterns, "!"+dockerfile)

	return archive.TarWithOptions(b.Context, &archive.TarOptions{
		Compression:     comp,
		ExcludePatterns: excludePatterns,
	})
}

func (b *Build) OCISpecPlatforms() []ocispecv1.Platform {
	ret := []ocispecv1.Platform{}
	platforms := b.Platforms
	if len(platforms) == 0 {
		platforms = []string{runtime.GOOS + "/" + runtime.GOARCH} // current platform
	}
	for _, platform := range platforms {
		parts := strings.Split(platform, "/")
		if len(parts) != 2 {
			continue
		}
		ret = append(ret, ocispecv1.Platform{
			OS:           parts[0],
			Architecture: parts[1],
		})
	}
	return ret
}

func (b *Build) StringListPlatforms() string {
	platforms := b.Platforms
	if len(platforms) == 0 {
		platforms = []string{runtime.GOOS + "/" + runtime.GOARCH} // current platform
	}
	return strings.Join(platforms, ",")
}
