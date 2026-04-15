package document

import (
	"errors"
	"fmt"
	"strings"
)

// SyncStageError 表示同步链路某个阶段的标准失败语义。
type SyncStageError struct {
	Reason string
	Err    error
}

// Error 返回标准错误消息。
func (e *SyncStageError) Error() string {
	if e == nil {
		return ""
	}
	reason := strings.TrimSpace(e.Reason)
	switch {
	case reason == "" && e.Err == nil:
		return ""
	case reason == "":
		return e.Err.Error()
	case e.Err == nil:
		return reason
	default:
		return fmt.Sprintf("%s: %v", reason, e.Err)
	}
}

// Unwrap 返回底层错误。
func (e *SyncStageError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// NewSyncStageError 创建带标准失败语义的阶段错误。
func NewSyncStageError(reason string, err error) *SyncStageError {
	if strings.TrimSpace(reason) == "" && err == nil {
		return nil
	}
	return &SyncStageError{
		Reason: strings.TrimSpace(reason),
		Err:    err,
	}
}

func unwrapSyncStageError(err error, fallbackReason string) (string, error) {
	var stageErr *SyncStageError
	if !errors.As(err, &stageErr) || stageErr == nil {
		return strings.TrimSpace(fallbackReason), err
	}

	reason := strings.TrimSpace(stageErr.Reason)
	if reason == "" {
		reason = strings.TrimSpace(fallbackReason)
	}
	if stageErr.Err != nil {
		return reason, stageErr.Err
	}
	return reason, err
}
