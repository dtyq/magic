package smartvet

import (
	"os/exec"
)

func ExportAtomicWriteFile(filename string, data []byte) error {
	return atomicWriteFile(filename, data)
}

func ExportComputePackageState(pkg PackageInfo, oldCache PackageCache) (PackageCache, error) {
	return computePackageState(pkg, oldCache)
}

func (r *Runner) SetTestListPackages(fn func() ([]PackageInfo, error)) {
	r.listPackages = fn
}

func (r *Runner) SetTestRunGoVet(fn func(args ...string) error) {
	r.runGoVet = fn
}

func (r *Runner) SetTestExecCommand(fn func(name string, args ...string) *exec.Cmd) {
	r.execCommand = fn
}

func (r *Runner) ExportListPackages() ([]PackageInfo, error) {
	return r.listPackages()
}
