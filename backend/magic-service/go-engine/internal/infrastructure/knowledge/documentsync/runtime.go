package documentsync

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"magic/internal/infrastructure/logging"
)

// ErrRunnerNotRegistered 表示任务类型未注册执行器。
var ErrRunnerNotRegistered = errors.New("documentsync runner not registered")

// BackgroundService 定义后台服务启动能力。
type BackgroundService interface {
	Start(ctx context.Context) error
}

// BackgroundServiceWithStop 定义带显式停止等待能力的后台服务。
type BackgroundServiceWithStop interface {
	BackgroundService
	Stop(ctx context.Context) error
}

type noopBackgroundService struct{}

func (noopBackgroundService) Start(context.Context) error {
	return nil
}

// Runtime 聚合文档调度运行时能力。
type Runtime struct {
	logger *logging.SugaredLogger

	mu         sync.RWMutex
	handlers   map[string]Runner
	terminals  map[string]TerminalHandler
	scheduler  Scheduler
	background BackgroundService
}

// NewRuntime 创建空的调度运行时。
func NewRuntime(logger *logging.SugaredLogger) *Runtime {
	return &Runtime{
		logger:     logger,
		handlers:   make(map[string]Runner),
		terminals:  make(map[string]TerminalHandler),
		background: noopBackgroundService{},
	}
}

// RegisterRunner 注册指定任务类型的执行器。
func (r *Runtime) RegisterRunner(kind string, runner Runner) {
	if r == nil || runner == nil {
		return
	}

	trimmedKind := strings.TrimSpace(kind)
	if trimmedKind == "" {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[trimmedKind] = runner
}

// RegisterTerminalHandler 注册指定任务类型重试耗尽后的业务终态处理器。
func (r *Runtime) RegisterTerminalHandler(kind string, handler TerminalHandler) {
	if r == nil || handler == nil {
		return
	}

	trimmedKind := strings.TrimSpace(kind)
	if trimmedKind == "" {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.terminals[trimmedKind] = handler
}

// UseScheduler 注入调度器实现。
func (r *Runtime) UseScheduler(scheduler Scheduler) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scheduler = scheduler
}

// UseBackgroundService 注入后台服务实现。
func (r *Runtime) UseBackgroundService(service BackgroundService) {
	if r == nil {
		return
	}
	if service == nil {
		service = noopBackgroundService{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.background = service
}

// Schedule 调度任务。
func (r *Runtime) Schedule(ctx context.Context, task *Task) {
	if r == nil {
		return
	}

	r.mu.RLock()
	scheduler := r.scheduler
	r.mu.RUnlock()
	if scheduler == nil {
		return
	}
	scheduler.Schedule(ctx, task)
}

// Run 执行任务。
func (r *Runtime) Run(ctx context.Context, task *Task) error {
	if r == nil || task == nil {
		return nil
	}

	kind := strings.TrimSpace(task.Kind)

	r.mu.RLock()
	runner := r.handlers[kind]
	r.mu.RUnlock()
	if runner == nil {
		return fmt.Errorf("%w: %s", ErrRunnerNotRegistered, kind)
	}
	if err := runner.Run(ctx, task); err != nil {
		return fmt.Errorf("run documentsync task %q: %w", kind, err)
	}
	return nil
}

// HandleTerminalTask 处理重试耗尽任务的业务终态。
func (r *Runtime) HandleTerminalTask(ctx context.Context, task *Task, cause error) error {
	if r == nil || task == nil {
		return nil
	}

	kind := strings.TrimSpace(task.Kind)

	r.mu.RLock()
	handler := r.terminals[kind]
	r.mu.RUnlock()
	if handler == nil {
		return fmt.Errorf("%w: %s", ErrTerminalHandlerNotRegistered, kind)
	}
	if err := handler.HandleTerminalTask(ctx, task, cause); err != nil {
		return fmt.Errorf("handle terminal documentsync task %q: %w", kind, err)
	}
	return nil
}

// Start 启动后台服务。
func (r *Runtime) Start(ctx context.Context) error {
	if r == nil {
		return nil
	}

	r.mu.RLock()
	background := r.background
	r.mu.RUnlock()
	if background == nil {
		return nil
	}
	if err := background.Start(ctx); err != nil {
		return fmt.Errorf("start documentsync background service: %w", err)
	}
	return nil
}

// Stop 停止后台服务，并在服务支持时等待其退出。
func (r *Runtime) Stop(ctx context.Context) error {
	if r == nil {
		return nil
	}

	r.mu.RLock()
	background := r.background
	r.mu.RUnlock()
	if background == nil {
		return nil
	}

	lifecycle, ok := background.(BackgroundServiceWithStop)
	if !ok {
		return nil
	}
	if err := lifecycle.Stop(ctx); err != nil {
		return fmt.Errorf("stop documentsync background service: %w", err)
	}
	return nil
}
