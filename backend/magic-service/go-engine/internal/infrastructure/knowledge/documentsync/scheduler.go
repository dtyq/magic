// Package documentsync provides infrastructure schedulers for document sync tasks.
package documentsync

import (
	"context"
	"strings"
	"time"

	"magic/internal/pkg/ctxmeta"
)

const (
	defaultTaskTimeout = 30 * time.Minute
	resyncMode         = "resync"
)

// Task 定义通用的文档同步调度任务。
type Task struct {
	KnowledgeBaseCode string
	Code              string
	Mode              string
	Async             bool
	Key               string
	Payload           []byte
	RequestID         string
}

// Scheduler 定义文档同步调度能力。
type Scheduler interface {
	Schedule(ctx context.Context, task *Task)
}

// Runner 定义文档同步任务执行器。
type Runner interface {
	Run(ctx context.Context, task *Task) error
}

// RunnerFunc 允许使用函数适配 Runner。
type RunnerFunc func(ctx context.Context, task *Task) error

// Run 执行调度任务。
func (f RunnerFunc) Run(ctx context.Context, task *Task) error {
	return f(ctx, task)
}

// CloneTask 深拷贝任务，避免异步调度共享可变状态。
func CloneTask(task *Task) *Task {
	if task == nil {
		return nil
	}

	cloned := *task
	if len(task.Payload) > 0 {
		cloned.Payload = append([]byte(nil), task.Payload...)
	}
	return &cloned
}

func captureTaskRequestID(ctx context.Context, task *Task) *Task {
	if task == nil {
		return nil
	}
	if requestID, ok := ctxmeta.RequestIDFromContext(ctx); ok {
		task.RequestID = strings.TrimSpace(requestID)
	}
	return task
}

func withTaskContext(ctx context.Context, task *Task) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if task == nil {
		return ctx
	}
	if requestID := strings.TrimSpace(task.RequestID); requestID != "" {
		ctx = ctxmeta.WithRequestID(ctx, requestID)
	}
	return ctx
}

func detachTaskContext(ctx context.Context, task *Task) context.Context {
	return withTaskContext(ctxmeta.Detach(ctx), task)
}

func dedupeKey(task *Task) (string, bool) {
	if task == nil || task.Mode != resyncMode {
		return "", false
	}
	if task.Key != "" {
		return task.Key + ":" + task.Mode, true
	}
	if task.KnowledgeBaseCode == "" || task.Code == "" {
		return "", false
	}
	return task.KnowledgeBaseCode + ":" + task.Code + ":" + task.Mode, true
}
