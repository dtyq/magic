package lock

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	defaultSinglePodJobAcquireTimeout = 2 * time.Second
	minHeartbeatInterval              = time.Second
)

var (
	errSinglePodJobLockKeyEmpty = errors.New("single pod job lock key is empty")
	errSinglePodJobRunnerNil    = errors.New("single pod job runner is nil")
	// ErrSinglePodJobLockLost 表示任务执行期间丢失了锁所有权，调用方应中止本轮任务。
	ErrSinglePodJobLockLost = errors.New("single pod job lock lost")
)

// SinglePodJobStatus 描述单 pod 任务调度结果。
type SinglePodJobStatus string

const (
	// SinglePodJobStatusExecuted 表示当前 pod 拿到锁并执行了任务。
	SinglePodJobStatusExecuted SinglePodJobStatus = "executed"
	// SinglePodJobStatusSkippedLocked 表示锁已由其他 pod 持有，本轮跳过执行。
	SinglePodJobStatusSkippedLocked SinglePodJobStatus = "skipped_locked"
	// SinglePodJobStatusSkippedRedisUnavailable 表示 Redis 不可用，本轮跳过执行。
	SinglePodJobStatusSkippedRedisUnavailable SinglePodJobStatus = "skipped_redis_unavailable"
	// SinglePodJobStatusAbortedLockLost 表示任务执行期间丢失锁所有权并被中止。
	SinglePodJobStatusAbortedLockLost SinglePodJobStatus = "aborted_lock_lost"
)

// SinglePodJobRequest 定义单 pod 任务执行所需的锁参数。
type SinglePodJobRequest struct {
	LockKey           string
	LockTTL           time.Duration
	HeartbeatInterval time.Duration
	AcquireTimeout    time.Duration
}

// SinglePodJobResult 描述单 pod 任务执行结果。
type SinglePodJobResult struct {
	Status SinglePodJobStatus
}

// SinglePodJobFunc 表示受单 pod 锁保护的任务函数。
type SinglePodJobFunc func(ctx context.Context) error

// SinglePodJobRunner 定义单 pod 任务执行能力。
type SinglePodJobRunner interface {
	Run(ctx context.Context, req SinglePodJobRequest, job SinglePodJobFunc) (SinglePodJobResult, error)
}

// RedisSinglePodJobRunner 使用 Redis 分布式锁确保任务同一时间只在一个 pod 上执行。
type RedisSinglePodJobRunner struct {
	lockManager *RedisLockManager
}

// NewRedisSinglePodJobRunner 创建 Redis 单 pod 任务执行器。
func NewRedisSinglePodJobRunner(lockManager *RedisLockManager) SinglePodJobRunner {
	return &RedisSinglePodJobRunner{lockManager: lockManager}
}

// localSinglePodJobRunner 在当前进程内直接执行任务，主要用于单元测试。
type localSinglePodJobRunner struct{}

// NewLocalSinglePodJobRunner 创建仅在本地执行的单 pod runner。
func NewLocalSinglePodJobRunner() SinglePodJobRunner {
	return localSinglePodJobRunner{}
}

func (localSinglePodJobRunner) Run(ctx context.Context, _ SinglePodJobRequest, job SinglePodJobFunc) (SinglePodJobResult, error) {
	if job == nil {
		return SinglePodJobResult{Status: SinglePodJobStatusExecuted}, nil
	}
	return SinglePodJobResult{Status: SinglePodJobStatusExecuted}, job(ctx)
}

// Run 在拿到 Redis 锁后执行任务，并在执行期间通过心跳续租锁 TTL。
func (r *RedisSinglePodJobRunner) Run(
	ctx context.Context,
	req SinglePodJobRequest,
	job SinglePodJobFunc,
) (SinglePodJobResult, error) {
	if r == nil || r.lockManager == nil {
		return SinglePodJobResult{Status: SinglePodJobStatusSkippedRedisUnavailable}, errSinglePodJobRunnerNil
	}

	normalized, err := r.normalizeRequest(req)
	if err != nil {
		return SinglePodJobResult{}, err
	}
	if job == nil {
		return SinglePodJobResult{Status: SinglePodJobStatusExecuted}, nil
	}

	acquireCtx, cancelAcquire := context.WithTimeout(ctx, normalized.AcquireTimeout)
	defer cancelAcquire()

	jobLock := r.lockManager.CreateLock(normalized.LockKey, normalized.LockTTL)
	acquired, err := jobLock.TryAcquire(acquireCtx)
	if err != nil {
		return SinglePodJobResult{Status: SinglePodJobStatusSkippedRedisUnavailable}, fmt.Errorf("acquire single pod job lock: %w", err)
	}
	if !acquired {
		return SinglePodJobResult{Status: SinglePodJobStatusSkippedLocked}, nil
	}

	jobCtx, cancelJob := context.WithCancelCause(ctx)
	stopHeartbeat := make(chan struct{})
	heartbeatDone := make(chan struct{})
	go r.keepLockAlive(jobCtx, stopHeartbeat, heartbeatDone, normalized, jobLock, cancelJob)

	jobErr := job(jobCtx)

	close(stopHeartbeat)
	<-heartbeatDone

	releaseCtx, cancelRelease := context.WithTimeout(context.WithoutCancel(ctx), normalized.AcquireTimeout)
	releaseErr := jobLock.Release(releaseCtx)
	cancelRelease()

	result := SinglePodJobResult{Status: SinglePodJobStatusExecuted}
	if cause := context.Cause(jobCtx); errors.Is(cause, ErrSinglePodJobLockLost) {
		result.Status = SinglePodJobStatusAbortedLockLost
		switch {
		case jobErr == nil:
			jobErr = cause
		case errors.Is(jobErr, context.Canceled), errors.Is(jobErr, context.DeadlineExceeded):
			jobErr = cause
		default:
			jobErr = errors.Join(jobErr, cause)
		}
	}

	if releaseErr != nil {
		jobErr = errors.Join(jobErr, fmt.Errorf("release single pod job lock: %w", releaseErr))
	}

	return result, jobErr
}

func (r *RedisSinglePodJobRunner) normalizeRequest(req SinglePodJobRequest) (SinglePodJobRequest, error) {
	req.LockKey = strings.TrimSpace(req.LockKey)
	if req.LockKey == "" {
		return SinglePodJobRequest{}, errSinglePodJobLockKeyEmpty
	}

	if req.LockTTL <= 0 {
		req.LockTTL = time.Duration(r.lockManager.config.LockTTLSeconds) * time.Second
	}
	if req.LockTTL <= 0 {
		req.LockTTL = time.Duration(defaultLockTTLSecs) * time.Second
	}

	if req.HeartbeatInterval <= 0 {
		req.HeartbeatInterval = req.LockTTL / 3
		if req.HeartbeatInterval < minHeartbeatInterval && req.LockTTL > minHeartbeatInterval {
			req.HeartbeatInterval = minHeartbeatInterval
		}
	}
	if req.HeartbeatInterval >= req.LockTTL {
		req.HeartbeatInterval = req.LockTTL / 2
		if req.HeartbeatInterval <= 0 {
			req.HeartbeatInterval = req.LockTTL
		}
	}

	if req.AcquireTimeout <= 0 {
		req.AcquireTimeout = defaultSinglePodJobAcquireTimeout
	}

	return req, nil
}

func (r *RedisSinglePodJobRunner) keepLockAlive(
	ctx context.Context,
	stop <-chan struct{},
	done chan<- struct{},
	req SinglePodJobRequest,
	jobLock *RedisLock,
	cancel context.CancelCauseFunc,
) {
	defer close(done)

	lockOpCtx := context.WithoutCancel(ctx)
	ticker := time.NewTicker(req.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshCtx, refreshCancel := context.WithTimeout(lockOpCtx, req.AcquireTimeout)
			refreshed, err := jobLock.Refresh(refreshCtx)
			refreshCancel()
			if err != nil {
				cancel(fmt.Errorf("%w: refresh single pod job lock: %w", ErrSinglePodJobLockLost, err))
				return
			}
			if !refreshed {
				cancel(ErrSinglePodJobLockLost)
				return
			}
		}
	}
}
