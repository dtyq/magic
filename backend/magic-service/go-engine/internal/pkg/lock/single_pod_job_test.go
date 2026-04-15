package lock_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"magic/internal/pkg/lock"
)

func TestRedisSinglePodJobRunnerSkipsWhenLocked(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()

	manager := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", LockTTLSeconds: 1})
	runner1 := lock.NewRedisSinglePodJobRunner(manager)
	runner2 := lock.NewRedisSinglePodJobRunner(manager)

	started := make(chan struct{})
	release := make(chan struct{})
	firstResultCh := make(chan lock.SinglePodJobResult, 1)
	firstErrCh := make(chan error, 1)

	go func() {
		result, err := runner1.Run(context.Background(), lock.SinglePodJobRequest{
			LockKey:           "job:test",
			LockTTL:           300 * time.Millisecond,
			HeartbeatInterval: 50 * time.Millisecond,
			AcquireTimeout:    50 * time.Millisecond,
		}, func(context.Context) error {
			close(started)
			<-release
			return nil
		})
		firstResultCh <- result
		firstErrCh <- err
	}()

	<-started

	var secondJobCalled atomic.Bool
	result, err := runner2.Run(context.Background(), lock.SinglePodJobRequest{
		LockKey:           "job:test",
		LockTTL:           300 * time.Millisecond,
		HeartbeatInterval: 50 * time.Millisecond,
		AcquireTimeout:    50 * time.Millisecond,
	}, func(context.Context) error {
		secondJobCalled.Store(true)
		return nil
	})
	if err != nil {
		t.Fatalf("runner2 run error: %v", err)
	}
	if result.Status != lock.SinglePodJobStatusSkippedLocked {
		t.Fatalf("unexpected runner2 status: %v", result.Status)
	}
	if secondJobCalled.Load() {
		t.Fatal("expected runner2 job not to execute")
	}

	close(release)

	if result := <-firstResultCh; result.Status != lock.SinglePodJobStatusExecuted {
		t.Fatalf("unexpected runner1 status: %v", result.Status)
	}
	if err := <-firstErrCh; err != nil {
		t.Fatalf("runner1 run error: %v", err)
	}
}

func TestRedisSinglePodJobRunnerRefreshKeepsLockAlive(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()

	manager := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", LockTTLSeconds: 3})
	runner := lock.NewRedisSinglePodJobRunner(manager)

	started := make(chan struct{})
	release := make(chan struct{})
	errCh := make(chan error, 1)

	go func() {
		_, err := runner.Run(context.Background(), lock.SinglePodJobRequest{
			LockKey:           "job:refresh",
			LockTTL:           3 * time.Second,
			HeartbeatInterval: 500 * time.Millisecond,
			AcquireTimeout:    100 * time.Millisecond,
		}, func(context.Context) error {
			close(started)
			<-release
			return nil
		})
		errCh <- err
	}()

	<-started

	s.FastForward(2 * time.Second)
	time.Sleep(700 * time.Millisecond)
	s.FastForward(2 * time.Second)

	if !s.Exists("lock:job:refresh") {
		t.Fatal("expected refreshed lock to remain after ttl extension")
	}

	close(release)

	if err := <-errCh; err != nil {
		t.Fatalf("runner run error: %v", err)
	}
}

func TestRedisSinglePodJobRunnerAbortsWhenLockOwnershipLost(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	defer s.Close()

	manager := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", LockTTLSeconds: 5})
	runner := lock.NewRedisSinglePodJobRunner(manager)

	started := make(chan struct{})
	resultCh := make(chan lock.SinglePodJobResult, 1)
	errCh := make(chan error, 1)

	go func() {
		result, err := runner.Run(context.Background(), lock.SinglePodJobRequest{
			LockKey:           "job:lost",
			LockTTL:           5 * time.Second,
			HeartbeatInterval: 20 * time.Millisecond,
			AcquireTimeout:    100 * time.Millisecond,
		}, func(ctx context.Context) error {
			close(started)
			<-ctx.Done()
			return ctx.Err()
		})
		resultCh <- result
		errCh <- err
	}()

	<-started
	if err := s.Set("lock:job:lost", "other-owner"); err != nil {
		t.Fatalf("overwrite lock owner: %v", err)
	}

	result := <-resultCh
	if result.Status != lock.SinglePodJobStatusAbortedLockLost {
		t.Fatalf("unexpected status: %v", result.Status)
	}
	if err := <-errCh; !errors.Is(err, lock.ErrSinglePodJobLockLost) {
		t.Fatalf("expected lock lost error, got %v", err)
	}
}

func TestRedisSinglePodJobRunnerSkipsWhenRedisUnavailable(t *testing.T) {
	t.Parallel()

	s, client := newTestRedis(t)
	manager := lock.NewRedisLockManager(client, &lock.RedisConfig{LockPrefix: "lock:", LockTTLSeconds: 1})
	runner := lock.NewRedisSinglePodJobRunner(manager)

	s.Close()

	var jobCalled atomic.Bool
	result, err := runner.Run(context.Background(), lock.SinglePodJobRequest{
		LockKey:        "job:redis-down",
		AcquireTimeout: 20 * time.Millisecond,
	}, func(context.Context) error {
		jobCalled.Store(true)
		return nil
	})
	if result.Status != lock.SinglePodJobStatusSkippedRedisUnavailable {
		t.Fatalf("unexpected status: %v", result.Status)
	}
	if err == nil {
		t.Fatal("expected redis unavailable error")
	}
	if jobCalled.Load() {
		t.Fatal("expected job not to execute when redis is unavailable")
	}
}
