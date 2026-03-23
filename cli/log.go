package cli

import (
	"context"

	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/dtyq/magicrew-cli/util"
)

var lg util.LoggerGroup

func setLoggers(loggerConfigs []util.LogStreamConfig) {
	newLogGroup, err := util.NewLoggers(loggerConfigs)
	if err != nil {
		lg.Logw("log", "%s", i18n.L("errorCreatingLoggers", err))
		return
	}
	lg = newLogGroup
	if commandContext == nil {
		commandContext = context.Background()
	}
	commandContext = context.WithValue(commandContext, util.ContextTypeLoggerGroup{}, lg)
}
