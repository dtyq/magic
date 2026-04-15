package smartdeadcode

import "context"

func SetLookPathForTest(r *Runner, fn func(string) (string, error)) {
	r.lookPath = fn
}

func SetFileHashForTest(r *Runner, fn func(string) (string, error)) {
	r.fileHash = fn
}

func SetRunDeadcodeForTest(r *Runner, fn func(context.Context, string) (string, error)) {
	r.runDeadcode = fn
}
