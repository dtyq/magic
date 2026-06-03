package socketio_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	socketioapp "magic/internal/application/socketio"
	"magic/internal/pkg/lock"
)

func TestRedisCleanupManagerDefaultAllowlist(t *testing.T) {
	t.Parallel()

	allowed := socketioapp.DefaultAllowedPrefixes()
	if !slices.Contains(allowed, socketioapp.RedisV2Prefix) {
		t.Fatalf("expected default allowlist contains v2 prefix")
	}
	if !slices.Contains(allowed, socketioapp.RedisV3Prefix) {
		t.Fatalf("expected default allowlist contains v3 prefix")
	}
}

func TestRedisCleanupManagerDefaultStateTTLIsOneHour(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("state-ttl")
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })
	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         testLockPrefix(),
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(
		client,
		lockManager,
		socketioapp.RedisCleanupOptions{Owner: "state-ttl"},
		prefix,
	)

	started, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Count:  10,
		Apply:  false,
	})
	if err != nil {
		t.Fatalf("start cleanup: %v", err)
	}

	ttl := client.TTL(ctx, socketioapp.RedisCleanupStateKey(started.JobID)).Val()
	if ttl <= 59*time.Minute || ttl > time.Hour {
		t.Fatalf("expected default cleanup state ttl in (59m, 1h], got %s", ttl)
	}
}

func TestRedisCleanupManagerStateTTLCanBeConfiguredAboveDefault(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("state-ttl-configured")
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })
	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         testLockPrefix(),
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(
		client,
		lockManager,
		socketioapp.RedisCleanupOptions{
			Owner:    "state-ttl-configured",
			StateTTL: 2 * time.Hour,
		},
		prefix,
	)

	started, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Count:  10,
		Apply:  false,
	})
	if err != nil {
		t.Fatalf("start cleanup: %v", err)
	}

	ttl := client.TTL(ctx, socketioapp.RedisCleanupStateKey(started.JobID)).Val()
	if ttl <= 119*time.Minute || ttl > 2*time.Hour {
		t.Fatalf("expected configured cleanup state ttl in (119m, 2h], got %s", ttl)
	}
}

func TestRedisCleanupManagerRunningStateTTLRenewedByHeartbeat(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("state-ttl-renew")
	key := prefix + ":slow-scan"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	var delayed atomic.Bool
	client.AddHook(slowFirstScanHook{
		delay:   1500 * time.Millisecond,
		delayed: &delayed,
	})

	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         testLockPrefix(),
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(
		client,
		lockManager,
		socketioapp.RedisCleanupOptions{
			Owner:             "state-ttl-renew",
			HeartbeatInterval: 200 * time.Millisecond,
			StaleThreshold:    2 * time.Second,
			StateTTL:          time.Second,
		},
		prefix,
	)

	started, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Count:  10,
		Apply:  false,
	})
	if err != nil {
		t.Fatalf("start cleanup: %v", err)
	}

	time.Sleep(1200 * time.Millisecond)
	if !delayed.Load() {
		t.Fatalf("expected scan hook to delay the running cleanup")
	}
	stateKey := socketioapp.RedisCleanupStateKey(started.JobID)
	if exists := client.Exists(ctx, stateKey).Val(); exists != 1 {
		t.Fatalf("expected running cleanup state to survive past initial ttl, exists=%d", exists)
	}
	ttl := client.TTL(ctx, stateKey).Val()
	if ttl <= 0 {
		t.Fatalf("expected running cleanup state ttl to be renewed, got %s", ttl)
	}
}

func TestRedisCleanupManagerCountMaxHasHardCap(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("count-hard-cap")
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })
	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         testLockPrefix(),
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(
		client,
		lockManager,
		socketioapp.RedisCleanupOptions{
			Owner:    "count-hard-cap",
			CountMax: 50_000,
		},
		prefix,
	)

	started, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Count:  100_000,
		Apply:  false,
	})
	if err != nil {
		t.Fatalf("start cleanup: %v", err)
	}
	if started.Count != 5000 {
		t.Fatalf("expected count hard-capped at 5000, got %d", started.Count)
	}
}

func TestRedisCleanupManagerRealRedisDryRunDoesNotDelete(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("dry-run")
	keys := make([]string, 0, 4)
	keys = append(keys,
		prefix+":room_nodes:a",
		prefix+":sid_rooms:b",
		prefix+":node_queue:c",
	)
	otherKey := prefix + "_other:kept"
	seedStringKeys(ctx, t, client, append(keys, otherKey)...)
	t.Cleanup(func() {
		cleanupRedisKeysByPrefix(ctx, t, client, prefix)
		_ = client.Del(ctx, otherKey).Err()
	})

	manager := newTestCleanupManager(client, prefix, "dry-run")
	started, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix:      prefix,
		Count:       2,
		Apply:       false,
		SampleLimit: 2,
	})
	if err != nil {
		t.Fatalf("start dry-run cleanup: %v", err)
	}
	if started.Status != socketioapp.RedisCleanupStatusRunning || started.JobID == "" {
		t.Fatalf("expected running cleanup, got %#v", started)
	}

	done := waitCleanupDone(ctx, t, manager, prefix, false)
	if done.Deleted != 0 || done.Matched != int64(len(keys)) || len(done.SampleKeys) != 2 {
		t.Fatalf("unexpected dry-run done state: %#v", done)
	}
	if exists := client.Exists(ctx, keys...).Val(); exists != int64(len(keys)) {
		t.Fatalf("dry-run should keep socketio keys, exists=%d", exists)
	}
	if exists := client.Exists(ctx, otherKey).Val(); exists != 1 {
		t.Fatalf("expected non-matching key to survive, exists=%d", exists)
	}
	assertStateHasTTL(ctx, t, client, done.JobID)
}

func TestRedisCleanupManagerRealRedisDeletesAllAndDoesNotRestartAfterDone(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("apply")
	keys := make([]string, 0, 25)
	for i := range 25 {
		keys = append(keys, fmt.Sprintf("%s:key:%02d", prefix, i))
	}
	seedStringKeys(ctx, t, client, keys...)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	manager := newTestCleanupManager(client, prefix, "apply")
	_, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Count:  5,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("start apply cleanup: %v", err)
	}
	done := waitCleanupDone(ctx, t, manager, prefix, true)
	if done.Deleted != int64(len(keys)) {
		t.Fatalf("expected deleted=%d, got state=%#v", len(keys), done)
	}
	if exists := client.Exists(ctx, keys...).Val(); exists != 0 {
		t.Fatalf("expected cleanup to delete all keys, exists=%d", exists)
	}

	newKey := prefix + ":arrived-after-done"
	seedStringKeys(ctx, t, client, newKey)
	repeated, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("repeat done cleanup: %v", err)
	}
	if repeated.Status != socketioapp.RedisCleanupStatusDone || repeated.Deleted != done.Deleted {
		t.Fatalf("expected repeated request to return previous done state, got %#v", repeated)
	}
	if exists := client.Exists(ctx, newKey).Val(); exists != 1 {
		t.Fatalf("done job should not restart before state ttl expires, exists=%d", exists)
	}
}

func TestRedisCleanupManagerFreshHeartbeatDoesNotTakeOver(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("fresh-heartbeat")
	key := prefix + ":kept"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	jobID := socketioapp.RedisCleanupJobID(prefix, true)
	now := time.Now()
	writeCleanupState(ctx, t, client, &socketioapp.RedisCleanupResult{
		JobID:          jobID,
		Status:         socketioapp.RedisCleanupStatusRunning,
		Prefix:         prefix,
		Pattern:        prefix + ":*",
		Apply:          true,
		Count:          100,
		SampleKeys:     []string{},
		Owner:          "other-pod",
		HeartbeatAt:    &now,
		LastProgressAt: &now,
		StartedAt:      &now,
		UpdatedAt:      &now,
	})

	manager := newTestCleanupManager(client, prefix, "current-pod")
	state, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("observe fresh running state: %v", err)
	}
	if state.Owner != "other-pod" || state.Status != socketioapp.RedisCleanupStatusRunning {
		t.Fatalf("expected fresh heartbeat to skip takeover, got %#v", state)
	}
	if exists := client.Exists(ctx, key).Val(); exists != 1 {
		t.Fatalf("fresh heartbeat should not trigger cleanup, exists=%d", exists)
	}
}

func TestRedisCleanupManagerFreshHeartbeatIgnoresStaleProgress(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("fresh-heartbeat-stale-progress")
	key := prefix + ":kept"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	jobID := socketioapp.RedisCleanupJobID(prefix, true)
	now := time.Now()
	oldProgress := now.Add(-time.Hour)
	writeCleanupState(ctx, t, client, &socketioapp.RedisCleanupResult{
		JobID:          jobID,
		Status:         socketioapp.RedisCleanupStatusRunning,
		Prefix:         prefix,
		Pattern:        prefix + ":*",
		Apply:          true,
		Count:          100,
		SampleKeys:     []string{},
		Owner:          "other-pod",
		HeartbeatAt:    &now,
		LastProgressAt: &oldProgress,
		StartedAt:      &oldProgress,
		UpdatedAt:      &now,
	})

	manager := newTestCleanupManager(client, prefix, "current-pod")
	state, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("observe fresh heartbeat with stale progress: %v", err)
	}
	if state.Owner != "other-pod" || state.Status != socketioapp.RedisCleanupStatusRunning {
		t.Fatalf("expected fresh heartbeat to skip takeover even with stale progress, got %#v", state)
	}
	if exists := client.Exists(ctx, key).Val(); exists != 1 {
		t.Fatalf("fresh heartbeat should not trigger cleanup, exists=%d", exists)
	}
}

func TestRedisCleanupManagerStaleHeartbeatAllowsTakeover(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("stale-heartbeat")
	key := prefix + ":delete"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	jobID := socketioapp.RedisCleanupJobID(prefix, true)
	old := time.Now().Add(-time.Hour)
	writeCleanupState(ctx, t, client, &socketioapp.RedisCleanupResult{
		JobID:          jobID,
		Status:         socketioapp.RedisCleanupStatusRunning,
		Prefix:         prefix,
		Pattern:        prefix + ":*",
		Apply:          true,
		Count:          100,
		SampleKeys:     []string{},
		Owner:          "dead-pod",
		HeartbeatAt:    &old,
		LastProgressAt: &old,
		StartedAt:      &old,
		UpdatedAt:      &old,
	})

	manager := newTestCleanupManager(client, prefix, "takeover-pod")
	_, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("start stale takeover: %v", err)
	}
	done := waitCleanupDone(ctx, t, manager, prefix, true)
	if done.Owner != "takeover-pod" || done.Deleted != 1 {
		t.Fatalf("unexpected takeover done state: %#v", done)
	}
	if exists := client.Exists(ctx, key).Val(); exists != 0 {
		t.Fatalf("expected stale takeover cleanup to delete key, exists=%d", exists)
	}
}

func TestRedisCleanupManagerStaleHeartbeatLockBusyReturnsState(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("stale-heartbeat-lock-busy")
	key := prefix + ":kept"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	jobID := socketioapp.RedisCleanupJobID(prefix, true)
	old := time.Now().Add(-time.Hour)
	writeCleanupState(ctx, t, client, &socketioapp.RedisCleanupResult{
		JobID:          jobID,
		Status:         socketioapp.RedisCleanupStatusRunning,
		Prefix:         prefix,
		Pattern:        prefix + ":*",
		Apply:          true,
		Count:          100,
		SampleKeys:     []string{},
		Owner:          "dead-pod",
		HeartbeatAt:    &old,
		LastProgressAt: &old,
		StartedAt:      &old,
		UpdatedAt:      &old,
	})

	lockPrefix := testLockPrefix()
	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         lockPrefix,
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	heldLock := lockManager.CreateLock(socketioapp.RedisCleanupLockKey(jobID), time.Minute)
	acquired, err := heldLock.TryAcquire(ctx)
	if err != nil {
		t.Fatalf("acquire competing lock: %v", err)
	}
	if !acquired {
		t.Fatalf("expected test lock acquisition")
	}
	t.Cleanup(func() { _ = heldLock.Release(context.Background()) })

	manager := newTestCleanupManagerWithLockPrefix(client, prefix, "current-pod", lockPrefix)
	state, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("observe stale running state with busy lock: %v", err)
	}
	if state.Owner != "dead-pod" || state.Status != socketioapp.RedisCleanupStatusRunning {
		t.Fatalf("expected busy lock to return existing stale state, got %#v", state)
	}
	if exists := client.Exists(ctx, key).Val(); exists != 1 {
		t.Fatalf("busy lock should not trigger cleanup, exists=%d", exists)
	}
}

func TestRedisCleanupManagerFailedStateAllowsRestart(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("failed-retry")
	key := prefix + ":delete"
	seedStringKeys(ctx, t, client, key)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	jobID := socketioapp.RedisCleanupJobID(prefix, true)
	old := time.Now().Add(-time.Hour)
	writeCleanupState(ctx, t, client, &socketioapp.RedisCleanupResult{
		JobID:          jobID,
		Status:         socketioapp.RedisCleanupStatusFailed,
		Prefix:         prefix,
		Pattern:        prefix + ":*",
		Apply:          true,
		Count:          100,
		SampleKeys:     []string{},
		Owner:          "failed-pod",
		HeartbeatAt:    &old,
		LastProgressAt: &old,
		StartedAt:      &old,
		UpdatedAt:      &old,
		FinishedAt:     &old,
		Error:          "previous failure",
	})

	manager := newTestCleanupManager(client, prefix, "retry-pod")
	state, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix: prefix,
		Apply:  true,
	})
	if err != nil {
		t.Fatalf("restart failed cleanup: %v", err)
	}
	if state.Status != socketioapp.RedisCleanupStatusRunning || state.Owner != "retry-pod" {
		t.Fatalf("expected failed state to restart, got %#v", state)
	}

	done := waitCleanupDone(ctx, t, manager, prefix, true)
	if done.Owner != "retry-pod" || done.Deleted != 1 || done.Error != "" {
		t.Fatalf("unexpected retry done state: %#v", done)
	}
	if exists := client.Exists(ctx, key).Val(); exists != 0 {
		t.Fatalf("expected retry cleanup to delete key, exists=%d", exists)
	}
}

func TestRedisCleanupManagerConcurrentRequestsUseSingleOwner(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	client := connectLocalRedis(t)
	t.Cleanup(func() { _ = client.Close() })

	prefix := testSocketIORedisPrefix("concurrent")
	keys := make([]string, 0, 200)
	for i := range 200 {
		keys = append(keys, fmt.Sprintf("%s:key:%03d", prefix, i))
	}
	seedStringKeys(ctx, t, client, keys...)
	t.Cleanup(func() { cleanupRedisKeysByPrefix(ctx, t, client, prefix) })

	lockPrefix := testLockPrefix()
	managerA := newTestCleanupManagerWithLockPrefix(client, prefix, "pod-a", lockPrefix)
	managerB := newTestCleanupManagerWithLockPrefix(client, prefix, "pod-b", lockPrefix)

	errs := make(chan error, 2)
	for _, manager := range []*socketioapp.RedisCleanupManager{managerA, managerB} {
		go func() {
			_, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
				Prefix: prefix,
				Count:  10,
				Apply:  true,
			})
			errs <- err
		}()
	}
	for range 2 {
		if err := <-errs; err != nil {
			t.Fatalf("concurrent cleanup request failed: %v", err)
		}
	}

	done := waitCleanupDone(ctx, t, managerA, prefix, true)
	if done.Deleted != int64(len(keys)) {
		t.Fatalf("expected one cleanup to delete all keys, got %#v", done)
	}
	if done.Owner != "pod-a" && done.Owner != "pod-b" {
		t.Fatalf("expected owner to be one of the request pods, got %#v", done)
	}
}

func TestRedisCleanupManagerRejectsUnsafePrefixBeforeRedisAccess(t *testing.T) {
	t.Parallel()

	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(nil, nil, socketioapp.RedisCleanupOptions{}, socketioapp.RedisV2Prefix)
	_, err := manager.Cleanup(context.Background(), &socketioapp.RedisCleanupInput{
		Prefix: "magicChat:NotSocketIo",
		Apply:  true,
	})
	if !errors.Is(err, socketioapp.ErrRedisCleanupPrefixDenied) {
		t.Fatalf("expected prefix denied before redis access, got %v", err)
	}
}

func TestRedisCleanupManagerRejectsV3ApplyBeforeRedisAccess(t *testing.T) {
	t.Parallel()

	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(
		nil,
		nil,
		socketioapp.RedisCleanupOptions{},
		socketioapp.RedisV3Prefix,
	)
	_, err := manager.Cleanup(context.Background(), &socketioapp.RedisCleanupInput{
		Prefix: socketioapp.RedisV3Prefix,
		Apply:  true,
	})
	if !errors.Is(err, socketioapp.ErrRedisCleanupApplyDenied) {
		t.Fatalf("expected v3 apply denied before redis access, got %v", err)
	}
}

func TestRedisCleanupManagerRejectsUnlistedSocketIOPrefix(t *testing.T) {
	t.Parallel()

	manager := socketioapp.NewRedisCleanupManagerWithPrefixes(nil, nil, socketioapp.RedisCleanupOptions{}, socketioapp.RedisV2Prefix)
	_, err := manager.Cleanup(context.Background(), &socketioapp.RedisCleanupInput{
		Prefix: "magicChat:SocketIo:RedisAdapter:unknown",
		Apply:  true,
	})
	if !errors.Is(err, socketioapp.ErrRedisCleanupPrefixDenied) {
		t.Fatalf("expected unlisted socketio prefix denied before redis access, got %v", err)
	}
}

func newTestCleanupManager(
	client *redis.Client,
	prefix string,
	owner string,
) *socketioapp.RedisCleanupManager {
	return newTestCleanupManagerWithLockPrefix(client, prefix, owner, testLockPrefix())
}

func newTestCleanupManagerWithLockPrefix(
	client *redis.Client,
	prefix string,
	owner string,
	lockPrefix string,
) *socketioapp.RedisCleanupManager {
	lockManager := lock.NewRedisLockManager(client, &lock.RedisConfig{
		LockPrefix:         lockPrefix,
		LockTTLSeconds:     30,
		SpinIntervalMillis: 10,
		SpinMaxRetries:     1,
	})
	return socketioapp.NewRedisCleanupManagerWithPrefixes(
		client,
		lockManager,
		socketioapp.RedisCleanupOptions{
			Owner:             owner,
			HeartbeatInterval: time.Second,
			StaleThreshold:    3 * time.Second,
			StateTTL:          time.Hour,
		},
		prefix,
	)
}

func waitCleanupDone(
	ctx context.Context,
	t *testing.T,
	manager *socketioapp.RedisCleanupManager,
	prefix string,
	apply bool,
) *socketioapp.RedisCleanupResult {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	var last *socketioapp.RedisCleanupResult
	for time.Now().Before(deadline) {
		result, err := manager.Cleanup(ctx, &socketioapp.RedisCleanupInput{
			Prefix: prefix,
			Apply:  apply,
		})
		if err != nil {
			t.Fatalf("poll cleanup state: %v", err)
		}
		last = result
		if result.Status == socketioapp.RedisCleanupStatusDone {
			return result
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("cleanup did not reach %s, last=%#v", socketioapp.RedisCleanupStatusDone, last)
	return nil
}

func writeCleanupState(
	ctx context.Context,
	t *testing.T,
	client *redis.Client,
	state *socketioapp.RedisCleanupResult,
) {
	t.Helper()

	raw, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("encode cleanup state: %v", err)
	}
	if err := client.Set(ctx, socketioapp.RedisCleanupStateKey(state.JobID), raw, time.Hour).Err(); err != nil {
		t.Fatalf("write cleanup state: %v", err)
	}
}

func seedStringKeys(ctx context.Context, t *testing.T, client *redis.Client, keys ...string) {
	t.Helper()

	pipe := client.Pipeline()
	for _, key := range keys {
		pipe.Set(ctx, key, "1", time.Hour)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		t.Fatalf("seed redis keys: %v", err)
	}
}

func cleanupRedisKeysByPrefix(ctx context.Context, t *testing.T, client *redis.Client, prefix string) {
	t.Helper()

	var cursor uint64
	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, prefix+":*", 1000).Result()
		if err != nil {
			t.Fatalf("scan cleanup keys: %v", err)
		}
		if len(keys) > 0 {
			if err := client.Del(ctx, keys...).Err(); err != nil {
				t.Fatalf("delete cleanup keys: %v", err)
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	_ = client.Del(ctx, socketioapp.RedisCleanupStateKey(socketioapp.RedisCleanupJobID(prefix, true))).Err()
	_ = client.Del(ctx, socketioapp.RedisCleanupStateKey(socketioapp.RedisCleanupJobID(prefix, false))).Err()
}

func assertStateHasTTL(ctx context.Context, t *testing.T, client *redis.Client, jobID string) {
	t.Helper()

	ttl := client.TTL(ctx, socketioapp.RedisCleanupStateKey(jobID)).Val()
	if ttl <= 0 {
		t.Fatalf("expected cleanup state key to have ttl, got %s", ttl)
	}
}

func testSocketIORedisPrefix(name string) string {
	return fmt.Sprintf("%s:test:%s:%d:%d", socketioapp.RedisV2Prefix, name, time.Now().UnixNano(), os.Getpid())
}

func testLockPrefix() string {
	return fmt.Sprintf("test:socketio:redis_cleanup:lock:%d:%d:", os.Getpid(), time.Now().UnixNano())
}

func connectLocalRedis(t *testing.T) *redis.Client {
	t.Helper()

	db := 0
	if rawDB := os.Getenv("REDIS_DB"); rawDB != "" {
		parsed, err := strconv.Atoi(rawDB)
		if err != nil {
			t.Fatalf("parse REDIS_DB=%q: %v", rawDB, err)
		}
		db = parsed
	}

	client := redis.NewClient(&redis.Options{
		Addr:     redisAddrFromEnv(),
		Username: os.Getenv("REDIS_USERNAME"),
		Password: os.Getenv("REDIS_AUTH"),
		DB:       db,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		t.Skipf("local Redis unavailable: %v", err)
	}
	return client
}

func redisAddrFromEnv() string {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}
	return host + ":" + port
}

type slowFirstScanHook struct {
	delay   time.Duration
	delayed *atomic.Bool
}

func (h slowFirstScanHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		return next(ctx, network, addr)
	}
}

func (h slowFirstScanHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		if strings.EqualFold(cmd.Name(), "scan") && h.delayed != nil && h.delayed.CompareAndSwap(false, true) {
			timer := time.NewTimer(h.delay)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
		return next(ctx, cmd)
	}
}

func (h slowFirstScanHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		return next(ctx, cmds)
	}
}
