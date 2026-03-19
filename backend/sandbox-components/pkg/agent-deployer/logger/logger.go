package logger

import (
	"os"
	"strings"

	"github.com/sirupsen/logrus"

	"github.com/dtyq/sandbox-components/pkg/agent-deployer/config"
)

var log *logrus.Logger

func init() {
	log = logrus.New()
	log.SetOutput(os.Stdout)
	log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
	})
}

// InitLogger initializes the logger with the given configuration
func InitLogger(cfg *config.Config) {
	if cfg == nil {
		log.SetLevel(logrus.InfoLevel)
		return
	}

	level, err := logrus.ParseLevel(strings.ToLower(cfg.LogLevel))
	if err != nil {
		log.Warnf("Invalid log level '%s', using 'info' level", cfg.LogLevel)
		level = logrus.InfoLevel
	}

	log.SetLevel(level)
	log.Infof("Logger initialized with level: %s", level.String())
}

// GetLogger returns the logger instance
func GetLogger() *logrus.Logger {
	return log
}

// Debug logs a debug message
func Debug(args ...interface{}) {
	log.Debug(args...)
}

// Debugf logs a formatted debug message
func Debugf(format string, args ...interface{}) {
	log.Debugf(format, args...)
}

// Info logs an info message
func Info(args ...interface{}) {
	log.Info(args...)
}

// Infof logs a formatted info message
func Infof(format string, args ...interface{}) {
	log.Infof(format, args...)
}

// Warn logs a warning message
func Warn(args ...interface{}) {
	log.Warn(args...)
}

// Warnf logs a formatted warning message
func Warnf(format string, args ...interface{}) {
	log.Warnf(format, args...)
}

// Error logs an error message
func Error(args ...interface{}) {
	log.Error(args...)
}

// Errorf logs a formatted error message
func Errorf(format string, args ...interface{}) {
	log.Errorf(format, args...)
}

// Fatal logs a fatal message and exits
func Fatal(args ...interface{}) {
	log.Fatal(args...)
}

// Fatalf logs a formatted fatal message and exits
func Fatalf(format string, args ...interface{}) {
	log.Fatalf(format, args...)
}

// WithField creates a new logger entry with a field
func WithField(key string, value interface{}) *logrus.Entry {
	return log.WithField(key, value)
}

// WithFields creates a new logger entry with multiple fields
func WithFields(fields logrus.Fields) *logrus.Entry {
	return log.WithFields(fields)
}
