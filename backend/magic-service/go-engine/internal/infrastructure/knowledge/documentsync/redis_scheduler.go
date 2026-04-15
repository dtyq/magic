package documentsync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"magic/internal/infrastructure/logging"
	lockpkg "magic/internal/pkg/lock"
)

const (
	taskFieldLatestSeq     = "latest_seq"
	taskFieldDebounceUntil = "debounce_until_ms"
	taskFieldExecutingSeq  = "executing_seq"
	taskFieldCompletedSeq  = "completed_seq"
	taskFieldLatestPayload = "latest_payload"
	taskFieldLatestRequest = "latest_request_id"
	taskFieldUpdatedAt     = "updated_at_ms"
	taskStateKeyPrefix     = "magic:document:resync:state:"
	taskLockKeyPrefix      = "magic:document:resync:worker:"
)

const (
	defaultTaskLockTTL  = 30 * time.Second
	defaultTaskStateTTL = 24 * time.Hour
	defaultWatchRetries = 5
)

// RedisSchedulerConfig 定义 Redis 调度器参数。
type RedisSchedulerConfig struct {
	DebounceWindow    time.Duration
	LockTTL           time.Duration
	HeartbeatInterval time.Duration
	StateTTL          time.Duration
	RedisOpTimeout    time.Duration
	WatchRetryTimes   int
}

type redisScheduler struct {
	runner      Runner
	logger      *logging.SugaredLogger
	client      *redis.Client
	lockManager *lockpkg.RedisLockManager
	config      RedisSchedulerConfig
	timeout     time.Duration
	fallback    Scheduler
}

type redisTaskState struct {
	LatestSeq     int64
	DebounceUntil int64
	ExecutingSeq  int64
	CompletedSeq  int64
	LatestPayload string
	LatestRequest string
}

// DefaultRedisSchedulerConfig 返回默认调度配置。
func DefaultRedisSchedulerConfig() RedisSchedulerConfig {
	return RedisSchedulerConfig{
		DebounceWindow:    500 * time.Millisecond,
		LockTTL:           defaultTaskLockTTL,
		HeartbeatInterval: 10 * time.Second,
		StateTTL:          defaultTaskStateTTL,
		RedisOpTimeout:    2 * time.Second,
		WatchRetryTimes:   defaultWatchRetries,
	}
}

// NewRedisScheduler 创建基于 Redis 的异步滑动窗口调度器。
func NewRedisScheduler(
	runner Runner,
	logger *logging.SugaredLogger,
	client *redis.Client,
	lockManager *lockpkg.RedisLockManager,
	config RedisSchedulerConfig,
	timeout time.Duration,
) Scheduler {
	if timeout <= 0 {
		timeout = defaultTaskTimeout
	}
	config = normalizeRedisSchedulerConfig(config)
	return &redisScheduler{
		runner:      runner,
		logger:      logger,
		client:      client,
		lockManager: lockManager,
		config:      config,
		timeout:     timeout,
		fallback:    NewAsyncScheduler(runner, logger, timeout),
	}
}

func (s *redisScheduler) Schedule(ctx context.Context, task *Task) {
	if s == nil || s.runner == nil || task == nil {
		return
	}

	cloned := captureTaskRequestID(ctx, CloneTask(task))
	if !s.shouldUseRedisCoordinator(cloned) {
		s.fallback.Schedule(ctx, cloned)
		return
	}

	baseCtx := detachTaskContext(ctx, cloned)
	scheduleCtx, cancel := context.WithTimeout(baseCtx, s.config.RedisOpTimeout)
	defer cancel()

	if err := s.enqueueLatestRequest(scheduleCtx, cloned); err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(
				scheduleCtx,
				"Enqueue redis-backed document resync failed, fallback to local scheduler",
				"document_code", cloned.Code,
				"knowledge_base_code", cloned.KnowledgeBaseCode,
				"error", err,
			)
		}
		s.fallback.Schedule(ctx, cloned)
		return
	}

	workerLock, acquired, err := s.tryAcquireWorkerLock(scheduleCtx, cloned)
	if err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(
				scheduleCtx,
				"Try acquire document resync worker lock failed",
				"document_code", cloned.Code,
				"knowledge_base_code", cloned.KnowledgeBaseCode,
				"error", err,
			)
		}
		return
	}
	if !acquired {
		return
	}

	go s.runWorker(baseCtx, cloned, workerLock)
}

func (s *redisScheduler) shouldUseRedisCoordinator(task *Task) bool {
	if task == nil || task.Mode != resyncMode || !task.Async {
		return false
	}
	if _, ok := dedupeKey(task); !ok {
		return false
	}
	return s.client != nil && s.lockManager != nil
}

func (s *redisScheduler) enqueueLatestRequest(ctx context.Context, task *Task) error {
	key := s.stateKey(task)
	now := time.Now()
	return s.withWatchedStateRetry(ctx, key, func(tx *redis.Tx) error {
		state, err := s.loadStateFromTx(ctx, tx, key)
		if err != nil {
			return err
		}
		nextSeq := state.LatestSeq + 1
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.HSet(ctx, key, map[string]any{
				taskFieldLatestSeq:     nextSeq,
				taskFieldDebounceUntil: now.Add(s.config.DebounceWindow).UnixMilli(),
				taskFieldLatestPayload: string(task.Payload),
				taskFieldLatestRequest: task.RequestID,
				taskFieldUpdatedAt:     now.UnixMilli(),
			})
			pipe.Expire(ctx, key, s.config.StateTTL)
			return nil
		})
		if err != nil {
			return fmt.Errorf("enqueue latest document resync request: %w", err)
		}
		return nil
	})
}

func (s *redisScheduler) tryAcquireWorkerLock(ctx context.Context, task *Task) (*lockpkg.RedisLock, bool, error) {
	workerLock := s.lockManager.CreateLock(s.lockKey(task), s.config.LockTTL)
	acquired, err := workerLock.TryAcquire(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("try acquire redis document resync worker lock: %w", err)
	}
	return workerLock, acquired, nil
}

func (s *redisScheduler) runWorker(ctx context.Context, seed *Task, workerLock *lockpkg.RedisLock) {
	currentLock := workerLock
	for currentLock != nil {
		loopCtx, cancelLoop := context.WithCancel(withTaskContext(ctx, seed))
		heartbeatDone := make(chan struct{})
		go s.keepWorkerLockAlive(loopCtx, currentLock, heartbeatDone, cancelLoop)

		err := s.processPendingRequests(loopCtx, seed)
		cancelLoop()
		<-heartbeatDone

		releaseCtx, releaseCancel := context.WithTimeout(withTaskContext(ctx, seed), s.config.RedisOpTimeout)
		if releaseErr := currentLock.Release(releaseCtx); releaseErr != nil && s.logger != nil {
			s.logger.WarnContext(
				releaseCtx,
				"Release document resync worker lock failed",
				"document_code", seed.Code,
				"knowledge_base_code", seed.KnowledgeBaseCode,
				"error", releaseErr,
			)
		}
		releaseCancel()

		if err != nil && !errors.Is(err, context.Canceled) && s.logger != nil {
			s.logger.ErrorContext(
				withTaskContext(ctx, seed),
				"Document resync worker stopped with error",
				"document_code", seed.Code,
				"knowledge_base_code", seed.KnowledgeBaseCode,
				"error", err,
			)
		}

		currentLock = s.tryReacquireForPendingRequest(ctx, seed)
	}
}

func (s *redisScheduler) keepWorkerLockAlive(
	ctx context.Context,
	workerLock *lockpkg.RedisLock,
	done chan<- struct{},
	cancel context.CancelFunc,
) {
	defer close(done)

	ticker := time.NewTicker(s.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshCtx, refreshCancel := context.WithTimeout(ctx, s.config.RedisOpTimeout)
			refreshed, err := workerLock.Refresh(refreshCtx)
			refreshCancel()
			if err != nil {
				if s.logger != nil {
					s.logger.WarnContext(ctx, "Refresh document resync worker lock failed", "error", err)
				}
				continue
			}
			if !refreshed {
				if s.logger != nil {
					s.logger.WarnContext(ctx, "Document resync worker lock ownership lost")
				}
				cancel()
				return
			}
		}
	}
}

func (s *redisScheduler) processPendingRequests(ctx context.Context, seed *Task) error {
	for {
		if err := s.ensureWorkerContext(ctx); err != nil {
			return err
		}

		state, shouldStop, err := s.loadPendingState(ctx, seed)
		if err != nil {
			return err
		}
		if shouldStop {
			return nil
		}

		waited, err := s.waitForDebounceWindow(ctx, state)
		if err != nil {
			return err
		}
		if waited {
			continue
		}

		runSeq, claimed, err := s.executeClaimedRequest(ctx, seed)
		if err != nil {
			return err
		}
		if !claimed {
			continue
		}
		if !s.hasPendingRequestAfterSequence(ctx, seed, runSeq) {
			return nil
		}
	}
}

func (s *redisScheduler) ensureWorkerContext(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("document resync worker context done: %w", err)
	}
	return nil
}

func (s *redisScheduler) loadPendingState(ctx context.Context, seed *Task) (redisTaskState, bool, error) {
	stateCtx, cancel := context.WithTimeout(ctx, s.config.RedisOpTimeout)
	defer cancel()

	state, err := s.loadState(stateCtx, seed)
	if err != nil {
		return redisTaskState{}, false, err
	}
	return state, state.LatestSeq == 0 || state.CompletedSeq >= state.LatestSeq, nil
}

func (s *redisScheduler) waitForDebounceWindow(ctx context.Context, state redisTaskState) (bool, error) {
	waitUntil := time.UnixMilli(state.DebounceUntil)
	if delay := time.Until(waitUntil); delay > 0 {
		timer := time.NewTimer(delay)
		defer timer.Stop()

		select {
		case <-ctx.Done():
			return false, fmt.Errorf("wait for document resync debounce window: %w", ctx.Err())
		case <-timer.C:
			return true, nil
		}
	}
	return false, nil
}

func (s *redisScheduler) executeClaimedRequest(ctx context.Context, seed *Task) (int64, bool, error) {
	claimedTask, runSeq, claimed, err := s.claimLatestExecution(ctx, seed)
	if err != nil || !claimed {
		return 0, claimed, err
	}

	runCtxBase := withTaskContext(ctx, claimedTask)
	runCtx, cancelRun := context.WithTimeout(runCtxBase, s.timeout)
	runErr := s.runner.Run(runCtx, claimedTask)
	cancelRun()
	if err := s.ensureWorkerContext(ctx); err != nil {
		return 0, false, err
	}
	if runErr != nil && s.logger != nil {
		s.logger.ErrorContext(
			runCtx,
			"Document resync execution failed",
			"document_code", seed.Code,
			"knowledge_base_code", seed.KnowledgeBaseCode,
			"sequence", runSeq,
			"error", runErr,
		)
	}

	completeCtx, cancelComplete := context.WithTimeout(ctx, s.config.RedisOpTimeout)
	defer cancelComplete()
	if err := s.markExecutionCompleted(completeCtx, seed, runSeq); err != nil {
		return 0, false, err
	}
	return runSeq, true, nil
}

func (s *redisScheduler) hasPendingRequestAfterSequence(ctx context.Context, seed *Task, runSeq int64) bool {
	nextCtx, cancelNext := context.WithTimeout(ctx, s.config.RedisOpTimeout)
	defer cancelNext()

	nextState, err := s.loadState(nextCtx, seed)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Load document resync state after execution failed, stop current worker loop",
				"document_code", seed.Code,
				"knowledge_base_code", seed.KnowledgeBaseCode,
				"sequence", runSeq,
				"error", err,
			)
		}
		return false
	}
	return nextState.LatestSeq > runSeq
}

func (s *redisScheduler) claimLatestExecution(ctx context.Context, seed *Task) (*Task, int64, bool, error) {
	key := s.stateKey(seed)

	var (
		claimed bool
		runSeq  int64
		payload string
		request string
	)
	err := s.withWatchedStateRetry(ctx, key, func(tx *redis.Tx) error {
		state, err := s.loadStateFromTx(ctx, tx, key)
		if err != nil {
			return err
		}
		if state.LatestSeq == 0 || state.CompletedSeq >= state.LatestSeq {
			return nil
		}
		if time.Now().UnixMilli() < state.DebounceUntil {
			return nil
		}

		runSeq = state.LatestSeq
		payload = state.LatestPayload
		request = state.LatestRequest
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.HSet(ctx, key, map[string]any{
				taskFieldExecutingSeq: runSeq,
				taskFieldUpdatedAt:    time.Now().UnixMilli(),
			})
			pipe.Expire(ctx, key, s.config.StateTTL)
			return nil
		})
		if err == nil {
			claimed = true
			return nil
		}
		return fmt.Errorf("claim latest document resync execution: %w", err)
	})
	if err != nil {
		return nil, 0, false, err
	}
	if !claimed {
		return nil, 0, false, nil
	}

	runTask := CloneTask(seed)
	if payload != "" {
		runTask.Payload = []byte(payload)
	}
	runTask.Async = true
	runTask.RequestID = request
	return runTask, runSeq, true, nil
}

func (s *redisScheduler) markExecutionCompleted(ctx context.Context, seed *Task, runSeq int64) error {
	key := s.stateKey(seed)
	return s.withWatchedStateRetry(ctx, key, func(tx *redis.Tx) error {
		state, err := s.loadStateFromTx(ctx, tx, key)
		if err != nil {
			return err
		}
		completedSeq := maxInt64(state.CompletedSeq, runSeq)
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.HSet(ctx, key, map[string]any{
				taskFieldCompletedSeq: completedSeq,
				taskFieldExecutingSeq: 0,
				taskFieldUpdatedAt:    time.Now().UnixMilli(),
			})
			pipe.Expire(ctx, key, s.config.StateTTL)
			return nil
		})
		if err != nil {
			return fmt.Errorf("mark document resync execution completed: %w", err)
		}
		return nil
	})
}

func (s *redisScheduler) tryReacquireForPendingRequest(ctx context.Context, seed *Task) *lockpkg.RedisLock {
	ctx, cancel := context.WithTimeout(withTaskContext(ctx, seed), s.config.RedisOpTimeout)
	defer cancel()

	state, err := s.loadState(ctx, seed)
	if err != nil || state.LatestSeq <= state.CompletedSeq {
		return nil
	}

	workerLock, acquired, err := s.tryAcquireWorkerLock(ctx, seed)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Reacquire document resync worker lock failed",
				"document_code", seed.Code,
				"knowledge_base_code", seed.KnowledgeBaseCode,
				"error", err,
			)
		}
		return nil
	}
	if !acquired {
		return nil
	}
	return workerLock
}

func (s *redisScheduler) withWatchedStateRetry(ctx context.Context, key string, fn func(tx *redis.Tx) error) error {
	retries := maxInt(s.config.WatchRetryTimes, 1)
	var lastErr error
	for range retries {
		err := s.client.Watch(ctx, fn, key)
		switch {
		case err == nil:
			return nil
		case errors.Is(err, redis.TxFailedErr):
			lastErr = err
			continue
		default:
			return fmt.Errorf("watch document resync state %s: %w", key, err)
		}
	}
	if lastErr != nil {
		return fmt.Errorf("redis watch retries exhausted for %s: %w", key, lastErr)
	}
	return nil
}

func (s *redisScheduler) loadState(ctx context.Context, seed *Task) (redisTaskState, error) {
	return s.loadStateFromRedisMap(ctx, s.stateKey(seed), s.client.HGetAll)
}

func (s *redisScheduler) loadStateFromTx(ctx context.Context, tx *redis.Tx, key string) (redisTaskState, error) {
	return s.loadStateFromRedisMap(ctx, key, tx.HGetAll)
}

func (s *redisScheduler) loadStateFromRedisMap(
	ctx context.Context,
	key string,
	load func(context.Context, string) *redis.MapStringStringCmd,
) (redisTaskState, error) {
	values, err := load(ctx, key).Result()
	if err != nil {
		return redisTaskState{}, fmt.Errorf("load document resync state: %w", err)
	}
	return redisTaskState{
		LatestSeq:     parseRedisInt64(values[taskFieldLatestSeq]),
		DebounceUntil: parseRedisInt64(values[taskFieldDebounceUntil]),
		ExecutingSeq:  parseRedisInt64(values[taskFieldExecutingSeq]),
		CompletedSeq:  parseRedisInt64(values[taskFieldCompletedSeq]),
		LatestPayload: values[taskFieldLatestPayload],
		LatestRequest: values[taskFieldLatestRequest],
	}, nil
}

func (s *redisScheduler) stateKey(task *Task) string {
	key, _ := dedupeKey(task)
	return taskStateKeyPrefix + key
}

func (s *redisScheduler) lockKey(task *Task) string {
	key, _ := dedupeKey(task)
	return taskLockKeyPrefix + key
}

func normalizeRedisSchedulerConfig(config RedisSchedulerConfig) RedisSchedulerConfig {
	defaults := DefaultRedisSchedulerConfig()
	if config.DebounceWindow <= 0 {
		config.DebounceWindow = defaults.DebounceWindow
	}
	if config.LockTTL <= 0 {
		config.LockTTL = defaults.LockTTL
	}
	if config.HeartbeatInterval <= 0 {
		config.HeartbeatInterval = defaults.HeartbeatInterval
	}
	if config.StateTTL <= 0 {
		config.StateTTL = defaults.StateTTL
	}
	if config.RedisOpTimeout <= 0 {
		config.RedisOpTimeout = defaults.RedisOpTimeout
	}
	if config.WatchRetryTimes <= 0 {
		config.WatchRetryTimes = defaults.WatchRetryTimes
	}
	return config
}

func parseRedisInt64(value string) int64 {
	if value == "" {
		return 0
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
