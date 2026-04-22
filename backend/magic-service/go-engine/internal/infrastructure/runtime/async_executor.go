// Package appruntime 提供应用运行期管理工具。
package appruntime

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/logkey"
)

const minAsyncExecutorQueueSize = 1

var errAsyncExecutorNilContext = errors.New("close async executor: nil context")

// ExecutorName 标识异步执行器名称，建议由调用方用包内常量声明。
type ExecutorName string

// AsyncExecutorConfig 定义异步执行器的构造参数。
type AsyncExecutorConfig[T any] struct {
	ExecutorName ExecutorName
	QueueSize    int
	Logger       *logging.SugaredLogger
	Handler      func(context.Context, T) error
}

// AsyncExecutor 提供单 worker、best-effort 的进程内异步执行能力。
// 它只适用于弱一致、允许少量丢失、不会影响业务正确性的后台任务，
// 例如访问计数、最后访问时间、非关键统计类 SQL。
// 不要把它用于资金、库存、权限、事务一致性等关键写路径。
type AsyncExecutor[T any] struct {
	executorName ExecutorName
	logger       *logging.SugaredLogger
	handler      func(context.Context, T) error

	queue chan T
	done  chan struct{}

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
	return &AsyncExecutor[T]{
		executorName: cfg.ExecutorName,
		logger:       cfg.Logger,
		handler:      cfg.Handler,
		queue:        make(chan T, cfg.QueueSize),
		done:         make(chan struct{}),
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
		e.started = true
		go e.run(context.WithoutCancel(ctx))
	}

	select {
	case e.queue <- item:
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
			close(e.done)
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

func (e *AsyncExecutor[T]) run(ctx context.Context) {
	defer close(e.done)

	for item := range e.queue {
		if err := e.handler(ctx, item); err != nil && e.logger != nil {
			e.logger.WarnContext(ctx, "async executor task failed", "executor", e.executorName, logkey.Error, err)
		}
	}
}
