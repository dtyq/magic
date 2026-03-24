package util

import (
	"context"
	"os"
)

func getLogContext() context.Context {
	return context.WithValue(context.Background(), ContextTypeLoggerGroup{}, LoggerGroup{
		&FileLogger{
			stream: os.Stdout,
			config: LogStreamConfig{
				Level: LogLevelDebug,
				Type:  LogTypeText,
			},
		},
	})
}
