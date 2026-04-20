package documentsync

import (
	"context"
	"sync"
	"time"

	"magic/internal/infrastructure/logging"
)

type asyncScheduler struct {
	runner  Runner
	logger  *logging.SugaredLogger
	timeout time.Duration
	mu      sync.Mutex
	slots   map[string]*asyncTaskSlot
}

type asyncTaskSlot struct {
	running    bool
	pending    bool
	latestTask *Task
}

// NewAsyncScheduler 创建进程内异步同步调度器。
func NewAsyncScheduler(runner Runner, logger *logging.SugaredLogger, timeout time.Duration) Scheduler {
	if timeout <= 0 {
		timeout = defaultTaskTimeout
	}
	return &asyncScheduler{
		runner:  runner,
		logger:  logger,
		timeout: timeout,
		slots:   make(map[string]*asyncTaskSlot),
	}
}

func (s *asyncScheduler) Schedule(ctx context.Context, task *Task) {
	if s == nil || s.runner == nil || task == nil {
		return
	}

	cloned := captureTaskRequestID(ctx, CloneTask(task))
	detachedCtx := detachTaskContext(ctx, cloned)
	key, dedupe := dedupeKey(cloned)
	if !dedupe {
		go s.runOnce(detachedCtx, cloned)
		return
	}

	startTask, shouldStart := s.enqueueLatest(key, cloned)
	if !shouldStart {
		if s.logger != nil {
			s.logger.InfoContext(
				detachedCtx,
				"Queue latest async document resync schedule for trailing execution",
				"document_code", cloned.Code,
				"knowledge_base_code", cloned.KnowledgeBaseCode,
				"mode", cloned.Mode,
			)
		}
		return
	}

	go func(baseCtx context.Context) {
		current := startTask
		for current != nil {
			s.runOnce(detachTaskContext(baseCtx, current), current)
			current = s.nextPendingOrClear(key)
		}
	}(detachedCtx)
}

func (s *asyncScheduler) runOnce(ctx context.Context, task *Task) {
	ctx, cancel := context.WithTimeout(withTaskContext(ctx, task), s.timeout)
	defer cancel()

	if err := s.runner.Run(ctx, task); err != nil && s.logger != nil {
		s.logger.ErrorContext(
			ctx,
			"Async document sync failed",
			"document_code", task.Code,
			"knowledge_base_code", task.KnowledgeBaseCode,
			"mode", task.Mode,
			"error", err,
		)
	}
}

func (s *asyncScheduler) enqueueLatest(key string, task *Task) (*Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	slot, exists := s.slots[key]
	if !exists {
		slot = &asyncTaskSlot{}
		s.slots[key] = slot
	}
	if slot.running {
		slot.pending = true
		slot.latestTask = task
		return nil, false
	}
	slot.running = true
	slot.pending = false
	slot.latestTask = nil
	return task, true
}

func (s *asyncScheduler) nextPendingOrClear(key string) *Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	slot, exists := s.slots[key]
	if !exists {
		return nil
	}
	if slot.pending && slot.latestTask != nil {
		next := slot.latestTask
		slot.pending = false
		slot.latestTask = nil
		return next
	}
	delete(s.slots, key)
	return nil
}
