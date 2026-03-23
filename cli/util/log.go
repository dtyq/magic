package util

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/mattn/go-isatty"
)

type LogStreamConfig struct {
	Level LogLevel `yaml:"level"`
	Kind  LogKind  `yaml:"kind"`
	Type  LogType  `yaml:"type"`
	Color *bool    `yaml:"color,omitempty"` // true to enable color, false to disable color, default to check isatty
	Path  string   `yaml:"path,omitempty"`
}

type LogKind string

const (
	LogKindFile LogKind = "file"
	// LogKindSLS  LogKind = "sls"
)

type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarning
	LogLevelError
)

func (l *LogLevel) UnmarshalText(text []byte) error {
	switch string(text) {
	case "debug":
		*l = LogLevelDebug
	case "info":
		*l = LogLevelInfo
	case "warning", "warn":
		*l = LogLevelWarning
	case "error":
		*l = LogLevelError
	default:
		return fmt.Errorf("unknown log level: %s", text)
	}
	return nil
}

type LogType string

const (
	LogTypeText LogType = "text"
	LogTypeJSON LogType = "json"
)

type Logger interface {
	Log(level LogLevel, tag string, logEntry LogEntry)
}

type LoggerGroup []Logger

func NewLoggers(configs []LogStreamConfig) (LoggerGroup, error) {
	var err error
	loggers := make(LoggerGroup, len(configs))
	for i, config := range configs {
		switch config.Kind {
		case LogKindFile:
			var stream *os.File
			switch {
			case config.Path == "stdout":
				stream = os.Stdout
			case config.Path == "stderr":
				stream = os.Stderr
			case strings.HasPrefix(config.Path, "/") || strings.HasPrefix(config.Path, "."):
				stream, err = os.OpenFile(config.Path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
				if err != nil {
					return nil, fmt.Errorf("failed to open log file: %w", err)
				}
			default:
				return nil, fmt.Errorf("unsupported log path (use relative path starting with . or absolute path starting with /): %s", config.Path)
			}
			logger := &FileLogger{
				stream: stream,
				config: config,
			}
			if config.Color != nil {
				logger.color = *config.Color
			} else {
				logger.color = isatty.IsTerminal(stream.Fd())
			}
			loggers[i] = logger
		default:
			return nil, fmt.Errorf("unsupported log kind: %s", config.Kind)
		}
	}
	return loggers, nil
}

type FileLogger struct {
	stream io.WriteCloser
	config LogStreamConfig
	color  bool
}

var logColors = map[LogLevel]string{
	LogLevelDebug:   "\033[96m",
	LogLevelInfo:    "",
	LogLevelWarning: "\033[33;1m",
	LogLevelError:   "\033[31;1m",
}

var logLevelNames = map[LogLevel]string{
	LogLevelDebug:   "D",
	LogLevelInfo:    "I",
	LogLevelWarning: "W",
	LogLevelError:   "E",
}

type LogEntry interface {
	ToMap() map[string]any
	ToString() string
}

type TextLogEntry struct {
	str string
}

func (l TextLogEntry) ToMap() map[string]any {
	return map[string]any{
		"msg": l.str,
	}
}

func (l TextLogEntry) ToString() string {
	return l.str
}

func (l FileLogger) Log(level LogLevel, tag string, logEntry LogEntry) {
	if level < l.config.Level {
		return
	}

	switch l.config.Type {
	case LogTypeText:
		// prepare color and level name
		color := ""
		if l.color {
			color = logColors[level]
		}
		levelName := logLevelNames[level]
		dateString := time.Now().Format("2006-01-02 15:04:05.000")
		logString := logEntry.ToString()

		// write to stream
		for _, line := range strings.Split(logString, "\n") {
			fmt.Fprintf(l.stream, "%s[%s][%s][%s]\033[0m %s\n", color, dateString, levelName, tag, line)
		}
	case LogTypeJSON:
		jsonDict := map[string]any{}
		for key, value := range logEntry.ToMap() {
			jsonDict[key] = value
		}
		jsonDict["date"] = time.Now().Format("2006-01-02 15:04:05.000")
		jsonDict["lv"] = level
		jsonDict["tag"] = tag
		jsonBytes, _ := json.Marshal(jsonDict)
		l.stream.Write(append(jsonBytes, []byte("\n")...))
	}
}

func (lg LoggerGroup) Log(level LogLevel, tag string, logEntry LogEntry) {
	for _, logger := range lg {
		logger.Log(level, tag, logEntry)
	}
}

func (lg LoggerGroup) Logd(tag string, format string, args ...any) {
	lg.Log(LogLevelDebug, tag, TextLogEntry{fmt.Sprintf(format, args...)})
}

func (lg LoggerGroup) Logi(tag string, format string, args ...any) {
	lg.Log(LogLevelInfo, tag, TextLogEntry{fmt.Sprintf(format, args...)})
}

func (lg LoggerGroup) Logw(tag string, format string, args ...any) {
	lg.Log(LogLevelWarning, tag, TextLogEntry{fmt.Sprintf(format, args...)})
}

func (lg LoggerGroup) Loge(tag string, format string, args ...any) {
	lg.Log(LogLevelError, tag, TextLogEntry{fmt.Sprintf(format, args...)})
}

// LoggerGroup{}
type ContextTypeLoggerGroup struct{}
