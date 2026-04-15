package smartgolangci

import "context"

func SetLookPathForTest(r *Runner, fn func(string) (string, error)) {
	r.lookPath = fn
}

func SetFileHashForTest(r *Runner, fn func(string) (string, error)) {
	r.fileHash = fn
}

func SetRunLintForTest(r *Runner, fn func(context.Context, string) (string, error)) {
	r.runLint = fn
}

func SetIsFindingForTest(r *Runner, fn func(error) bool) {
	r.isFinding = fn
}
