// Package taskqueue 提供进程内轻量异步任务队列。
package taskqueue

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/runguard"
)

const (
	minAsyncExecutorQueueSize   = 1
	minAsyncExecutorWorkerCount = 1
)

var errAsyncExecutorNilContext = errors.New("close async executor: nil context")

// ExecutorName 标识异步执行器名称，建议由调用方用包内常量声明。
type ExecutorName string

// AsyncExecutorConfig 定义异步执行器的构造参数。
type AsyncExecutorConfig[T any] struct {
	ExecutorName ExecutorName
	QueueSize    int
	WorkerCount  int
	Handler      func(context.Context, T) error
	OnError      func(context.Context, error)
	Logger       *logging.SugaredLogger
	PanicPolicy  runguard.Policy
}

type queuedTask[T any] struct {
	ctxValue any
	item     T
}

func (t queuedTask[T]) context() context.Context {
	ctx, _ := t.ctxValue.(context.Context)
	if ctx == nil {
		return context.Background()
	}
	return ctx
}

// AsyncExecutor 提供 best-effort 的进程内异步执行能力。
// 它只适用于弱一致、允许少量丢失、不会影响业务正确性的后台任务。
type AsyncExecutor[T any] struct {
	executorName ExecutorName
	handler      func(context.Context, T) error
	onError      func(context.Context, error)
	logger       *logging.SugaredLogger
	panicPolicy  runguard.Policy

	queue       chan queuedTask[T]
	done        chan struct{}
	workerCount int

	doneOnce sync.Once
	wg       sync.WaitGroup

	mu      sync.Mutex
	started bool
	closed  bool
}

// NewAsyncExecutor 创建新的异步执行器。
// 该执行器不会重试、不会持久化，也不会保证进程异常退出后的任务不丢失。
func NewAsyncExecutor[T any](cfg AsyncExecutorConfig[T]) *AsyncExecutor[T] {
	if cfg.QueueSize < minAsyncExecutorQueueSize {
		cfg.QueueSize = minAsyncExecutorQueueSize
	}
	if cfg.WorkerCount < minAsyncExecutorWorkerCount {
		cfg.WorkerCount = minAsyncExecutorWorkerCount
	}
	return &AsyncExecutor[T]{
		executorName: cfg.ExecutorName,
		handler:      cfg.Handler,
		onError:      cfg.OnError,
		logger:       cfg.Logger,
		panicPolicy:  normalizeExecutorPanicPolicy(cfg.PanicPolicy),
		queue:        make(chan queuedTask[T], cfg.QueueSize),
		done:         make(chan struct{}),
		workerCount:  cfg.WorkerCount,
	}
}

// Enqueue 以非阻塞方式入队任务；队列满或已关闭时返回 false。
func (e *AsyncExecutor[T]) Enqueue(ctx context.Context, item T) bool {
	if e == nil || e.handler == nil || ctx == nil {
		return false
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return false
	}
	if !e.started {
		e.startWorkersLocked()
	}

	select {
	case e.queue <- queuedTask[T]{
		ctxValue: ctx,
		item:     item,
	}:
		return true
	default:
		return false
	}
}

// Close 停止接收新任务并尽力等待已入队任务执行完成。
func (e *AsyncExecutor[T]) Close(ctx context.Context) error {
	if e == nil {
		return nil
	}
	if ctx == nil {
		return errAsyncExecutorNilContext
	}

	e.mu.Lock()
	if !e.closed {
		e.closed = true
		if e.started {
			close(e.queue)
		} else {
			e.closeDone()
		}
	}
	e.mu.Unlock()

	select {
	case <-e.done:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("close async executor %q: %w", e.executorName, ctx.Err())
	}
}

func (e *AsyncExecutor[T]) startWorkersLocked() {
	e.started = true
	e.wg.Add(e.workerCount)

	for range e.workerCount {
		runguard.Go(context.Background(), runguard.Options{
			Scope:  "taskqueue.worker",
			Policy: e.panicPolicy,
			Fields: []any{"executor_name", e.executorName},
			OnPanic: func(ctx context.Context, report runguard.Report) {
				if e.logger != nil {
					e.logger.ErrorContext(ctx, "Goroutine panic recovered", report.Fields...)
				}
			},
		}, e.run)
	}

	go func() {
		e.wg.Wait()
		e.closeDone()
	}()
}

func (e *AsyncExecutor[T]) run() {
	defer e.wg.Done()

	for task := range e.queue {
		ctx := task.context()
		if err := e.handler(ctx, task.item); err != nil && e.onError != nil {
			e.onError(ctx, err)
		}
	}
}

func (e *AsyncExecutor[T]) closeDone() {
	e.doneOnce.Do(func() {
		close(e.done)
	})
}

func normalizeExecutorPanicPolicy(policy runguard.Policy) runguard.Policy {
	switch policy {
	case runguard.Continue, runguard.CloseScope, runguard.ExitProcess:
		return policy
	default:
		return runguard.ExitProcess
	}
}
