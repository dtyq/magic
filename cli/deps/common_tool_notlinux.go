//go:build !linux

package deps

import "fmt"

func newCommonToolDep() (Dep, error) {
	return nil, fmt.Errorf("common_tool dependency is only supported on Linux")
}
