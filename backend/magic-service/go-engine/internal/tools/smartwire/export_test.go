package smartwire

import "context"

func SetLookPathForTest(r *Runner, fn func(string) (string, error)) {
	r.lookPath = fn
}

func SetFileHashForTest(r *Runner, fn func(string) (string, error)) {
	r.fileHash = fn
}

func SetRunCheckForTest(r *Runner, fn func(context.Context, string) (string, error)) {
	r.runCheck = fn
}

func SetRunDiffForTest(r *Runner, fn func(context.Context, string) (string, error)) {
	r.runDiff = fn
}

func SetIsDiffMatchForTest(r *Runner, fn func(error) bool) {
	r.isDiffMatch = fn
}
