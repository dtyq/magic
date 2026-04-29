package logging

import (
	"io"
	"log/slog"
)

func NewSugaredLoggerForTest(handler slog.Handler, name string) *SugaredLogger {
	return &SugaredLogger{
		l:    slog.New(handler),
		name: name,
	}
}

func NewMagicTextHandlerForTest(out io.Writer, opts *slog.HandlerOptions) slog.Handler {
	return newMagicTextHandler(out, opts)
}

func NewTruncatingHandlerForTest(next slog.Handler) slog.Handler {
	return newTruncatingHandler(next, defaultLogValueLimit)
}

func LevelNameForTest(level slog.Level) string {
	return levelName(level)
}

func ParseLevelForTest(level string, defaultLevel slog.Level) slog.Level {
	return parseLevel(level, defaultLevel)
}
