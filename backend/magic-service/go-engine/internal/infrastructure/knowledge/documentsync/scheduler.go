// Package documentsync provides infrastructure schedulers for document sync tasks.
package documentsync

import (
	"context"
	"errors"
	"strings"
	"time"

	"magic/internal/pkg/ctxmeta"
)

const (
	defaultTaskTimeout = 30 * time.Minute
	resyncMode         = "resync"

	// TaskKindDocumentSync 表示真正执行单文档同步的任务，也是 MQ 唯一支持的任务类型。
	TaskKindDocumentSync = "document_sync"
)

// ErrTerminalHandlerNotRegistered 表示任务类型没有注册重试耗尽终态处理器。
var ErrTerminalHandlerNotRegistered = errors.New("documentsync terminal handler not registered")

// Task 定义通用的文档同步调度任务。
type Task struct {
	Kind              string
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

// ReadinessGate 定义后台任务启动前可等待的外部依赖就绪能力。
type ReadinessGate interface {
	WaitReady(ctx context.Context) error
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

// TerminalHandler 定义任务重试耗尽后的业务终态处理能力。
type TerminalHandler interface {
	HandleTerminalTask(ctx context.Context, task *Task, cause error) error
}

// TerminalHandlerFunc 允许使用函数适配 TerminalHandler。
type TerminalHandlerFunc func(ctx context.Context, task *Task, cause error) error

// HandleTerminalTask 处理任务重试耗尽后的业务终态。
func (f TerminalHandlerFunc) HandleTerminalTask(ctx context.Context, task *Task, cause error) error {
	return f(ctx, task, cause)
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
