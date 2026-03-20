package image

import (
	"context"

	"github.com/dtyq/magicrew-cli/util"
)

func getLogContext() context.Context {
	loggers, err := util.NewLoggers([]util.LogStreamConfig{
		{
			Kind:  util.LogKindFile,
			Path:  "stdout",
			Level: util.LogLevelDebug,
			Type:  util.LogTypeText,
		},
	})
	if err != nil {
		panic(err)
	}
	return context.WithValue(context.Background(), util.ContextTypeLoggerGroup{}, loggers)
}
