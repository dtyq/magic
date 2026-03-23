package image

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/moby/go-archive/compression"
	"github.com/stretchr/testify/assert"
)

func TestBuildDockerTarReader(t *testing.T) {
	// test build tar reader
	tempdir := t.TempDir()
	defer os.RemoveAll(tempdir)
	os.WriteFile(filepath.Join(tempdir, "Dockerfile"), []byte("FROM scratch\nCOPY ./test /test"), 0644)
	os.WriteFile(filepath.Join(tempdir, "test"), []byte("hello world"), 0644)
	os.WriteFile(filepath.Join(tempdir, "test2"), []byte("hello world"), 0644)
	os.WriteFile(filepath.Join(tempdir, ".dockerignore"), []byte("test2\n"), 0644)

	build := Build{
		Dockerfile: "Dockerfile",
		Context:    tempdir,
	}

	reader, err := build.DockerTarReader(compression.Gzip)
	if err != nil {
		t.Fatalf("failed to get tar reader: %v", err)
	}
	assert.NotNil(t, reader)

	// 看看这个tar有没问题
	// 解压gzip
	decompressed, err := gzip.NewReader(reader)
	if err != nil {
		t.Fatalf("failed to decompress gzip: %v", err)
	}
	assert.NotNil(t, decompressed)

	// 读取tar的文件列表
	tarReader := tar.NewReader(decompressed)
	files := []string{}
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("failed to read tar: %v", err)
		}
		files = append(files, header.Name)
	}
	assert.NotContains(t, files, "test2")
	assert.Contains(t, files, "test")
	assert.Contains(t, files, "Dockerfile")
	assert.Contains(t, files, ".dockerignore")
}

func TestBuildOCISpecPlatforms(t *testing.T) {
	build := Build{
		Platforms: []string{"linux/amd64", "linux/arm64"},
	}
	platforms := build.OCISpecPlatforms()
	assert.NotNil(t, platforms)
	assert.Equal(t, 2, len(platforms))
	assert.Equal(t, "linux", platforms[0].OS)
	assert.Equal(t, "amd64", platforms[0].Architecture)
	assert.Equal(t, "linux", platforms[1].OS)
	assert.Equal(t, "arm64", platforms[1].Architecture)

	build = Build{
		Platforms: []string{},
	}
	platforms = build.OCISpecPlatforms()
	assert.NotNil(t, platforms)
	assert.Equal(t, 1, len(platforms))
	assert.Equal(t, runtime.GOOS, platforms[0].OS)
	assert.Equal(t, runtime.GOARCH, platforms[0].Architecture)
}
