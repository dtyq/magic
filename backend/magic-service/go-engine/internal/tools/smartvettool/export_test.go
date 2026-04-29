package smartvettool

import "context"

func SetRunBuildForTest(r *Runner, fn func(context.Context) (string, error)) {
	r.runBuild = fn
}
