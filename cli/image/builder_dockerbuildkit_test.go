package image

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"go.yaml.in/yaml/v3"
)

func TestDockerBuildKitBuilderBuild(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("skip docker buildkit integration test on non-linux systems")
	}

	var err error
	tempdir := t.TempDir()
	defer os.RemoveAll(tempdir)
	os.WriteFile(filepath.Join(tempdir, "Dockerfile"), []byte("FROM alpine\nCOPY . /work/\nRUN env && ls /work"), 0644)
	os.WriteFile(filepath.Join(tempdir, ".dockerignore"), []byte(".dockerignore\nDockerfile\ntest2\n"), 0644)
	os.WriteFile(filepath.Join(tempdir, "test"), []byte("hello world"), 0644)
	os.WriteFile(filepath.Join(tempdir, "test2"), []byte("hello world"), 0644)

	ctx := getLogContext()

	build := Build{
		Dockerfile: "Dockerfile",
		Context:    tempdir,
		Tags:       []string{"test/test"},
	}
	node := yaml.Node{}
	err = node.Encode(map[string]any{
		"kind":         "dockerBuildkit",
		"imagePrefix":  "test.io/",
		"progressMode": "plain",
	})
	if !assert.NoError(t, err) {
		t.Fatalf("failed to encode yaml node: %v", err)
	}
	dockerBuilder, err := newDockerBuildKitBuilder(node)
	if !assert.NoError(t, err) {
		t.Fatalf("failed to create docker buildkit builder: %v", err)
	}
	imageID, err := dockerBuilder.Build(ctx, build, BuildOptions{
		Push:    false,
		Pull:    false,
		NoCache: false,
	})
	if err != nil {
		t.Fatalf("failed to build image: %v", err)
	}
	assert.NotEmpty(t, imageID)
	fmt.Println("built image id: ", imageID)
}
