package lintcmd

import (
	"context"
	"time"
)

const (
	TestTaskVetToolSmart  = taskVetToolSmart
	TestTaskVetSmart      = taskVetSmart
	TestTaskGolangCILint  = taskGolangCILint
	TestTaskDeadcodeSmart = taskDeadcodeSmart
	TestTaskWireSmart     = taskWireSmart
)

type TestResult struct {
	Name     string
	Duration time.Duration
	Output   string
	Err      error
	Status   string
}

func (r *Runner) SetTestRunTask(fn func(ctx context.Context, taskName string) TestResult) {
	r.runTask = func(ctx context.Context, task lintTask) lintResult {
		result := fn(ctx, task.name)
		lintResultValue := lintResult{
			name:     result.Name,
			duration: result.Duration,
			output:   result.Output,
			err:      result.Err,
		}
		if result.Status != "" {
			lintResultValue.status = lintStatus(result.Status)
		}

		return lintResultValue
	}
}
