package deps

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCommonTool(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("common_tool dependency is only supported on Linux")
	}
	ctx := getLogContext()

	commonTool, err := newCommonToolDep()
	if err != nil {
		t.Fatalf("failed to create common tool dependency: %v", err)
	}
	err = commonTool.Resolve(ctx)
	if err != nil {
		t.Fatalf("failed to resolve common tool dependency: %v", err)
	}
	err = commonTool.Update(ctx, false)
	if err != nil {
		t.Fatalf("failed to update common tool dependency: %v", err)
	}
	assert.Equal(t, commonTool.GetName(), "common_tool")
	assert.Equal(t, commonTool.GetVersion(), "latest")
}
