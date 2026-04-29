package rebuild

import (
	"context"
	"fmt"
	"os"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/runguard"
)

func rebuildPanicOptions(logger *logging.SugaredLogger, scope string, fields ...any) runguard.Options {
	return runguard.Options{
		Scope:  scope,
		Policy: runguard.ExitProcess,
		Fields: fields,
		OnPanic: func(ctx context.Context, report runguard.Report) {
			if logger != nil {
				logger.KnowledgeErrorContext(ctx, "Knowledge rebuild goroutine panic recovered", report.Fields...)
				return
			}
			_, _ = fmt.Fprintf(os.Stderr, "goEngineException: Knowledge rebuild goroutine panic recovered scope=%s panic=%v\n", report.Scope, report.Recovered)
		},
		Exit: os.Exit,
	}
}
