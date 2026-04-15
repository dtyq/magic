package rebuild_test

import (
	"context"
	"errors"
	"net"
	"strings"
	"syscall"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
	"magic/internal/infrastructure/logging"
	rediscoordinator "magic/internal/infrastructure/persistence/redis/rebuild"
)

const (
	testLockKey            = "magic:kb:rebuild:lock"
	testCurrentRunKey      = "magic:kb:rebuild:current"
	testHeartbeatKeyPrefix = "magic:kb:rebuild:heartbeat:"
	testDualWriteStateKey  = "magic:kb:rebuild:dualwrite"
	testJobKeyPrefix       = "magic:kb:rebuild:job:"
	testMetricsKeyPrefix   = "magic:kb:rebuild:metrics:"
	testRetryKeyPrefix     = "magic:kb:rebuild:retry:"
)

func newTestCoordinator(t *testing.T) (*miniredis.Miniredis, *rediscoordinator.Coordinator) {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		if isListenPermissionError(err) {
			t.Skipf("skip miniredis: %v", err)
		}
		t.Fatalf("start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		server.Close()
		t.Fatalf("ping redis: %v", err)
	}

	return server, rediscoordinator.NewCoordinator(client, logging.New())
}

func TestCoordinatorSaveJobNormalizesCustomTypesAndSetsTTL(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-job"

	err := coordinator.SaveJob(ctx, runID, map[string]any{
		"mode":         domainrebuild.ModeAuto,
		"enabled":      true,
		"target_model": "text-embedding-3-large",
		"started_at":   time.Unix(123, 0),
		"dimension":    int64(3072),
	})
	if err != nil {
		t.Fatalf("save job: %v", err)
	}

	key := testJobKeyPrefix + runID
	if got := server.HGet(key, "mode"); got != string(domainrebuild.ModeAuto) {
		t.Fatalf("unexpected mode: %s", got)
	}
	if got := server.HGet(key, "enabled"); got != "1" {
		t.Fatalf("unexpected enabled: %s", got)
	}
	if got := server.HGet(key, "started_at"); got != "123" {
		t.Fatalf("unexpected started_at: %s", got)
	}
	if ttl := server.TTL(key); ttl <= 0 {
		t.Fatalf("expected positive ttl for job key, got %s", ttl)
	}
}

func TestCoordinatorSetsTTLForAllRebuildKeyTypes(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-all"

	locked, err := coordinator.AcquireLock(ctx, "owner", time.Minute)
	if err != nil {
		t.Fatalf("acquire lock: %v", err)
	}
	if !locked {
		t.Fatal("expected lock acquired")
	}

	if err := coordinator.SetCurrentRun(ctx, runID); err != nil {
		t.Fatalf("set current run: %v", err)
	}
	if err := coordinator.SetDualWriteState(ctx, &domainrebuild.VectorDualWriteState{
		RunID:            runID,
		Enabled:          true,
		Mode:             string(domainrebuild.ModeBlueGreen),
		ActiveCollection: "magic_knowledge",
		ShadowCollection: "magic_knowledge_shadow",
		ActiveModel:      "dmeta-embedding",
		TargetModel:      "text-embedding-3-large",
	}); err != nil {
		t.Fatalf("set dual write state: %v", err)
	}
	if err := coordinator.IncrMetric(ctx, runID, "success_docs", 1); err != nil {
		t.Fatalf("increment metric: %v", err)
	}
	if err := coordinator.EnqueueFailure(ctx, &domainrebuild.VectorRebuildFailureEvent{
		RunID:             runID,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
		UserID:            "U1",
		Operation:         "store",
		Error:             "boom",
	}); err != nil {
		t.Fatalf("enqueue failure: %v", err)
	}

	keys := []string{
		testLockKey,
		testCurrentRunKey,
		testHeartbeatKeyPrefix + runID,
		testDualWriteStateKey,
		testMetricsKeyPrefix + runID,
		testRetryKeyPrefix + runID,
	}
	for _, key := range keys {
		if ttl := server.TTL(key); ttl <= 0 {
			t.Fatalf("expected positive ttl for key %s, got %s", key, ttl)
		}
	}
}

func TestCoordinatorGetCurrentRunReturnsRunIDWhenHeartbeatExists(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-live"
	if err := coordinator.SetCurrentRun(ctx, runID); err != nil {
		t.Fatalf("set current run: %v", err)
	}

	got, err := coordinator.GetCurrentRun(ctx)
	if err != nil {
		t.Fatalf("get current run: %v", err)
	}
	if got != runID {
		t.Fatalf("expected runID=%s, got %s", runID, got)
	}
}

func TestCoordinatorGetCurrentRunClearsZombieStateWhenHeartbeatMissing(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-zombie"

	if _, err := coordinator.AcquireLock(ctx, "knowledge-rebuild:"+runID, time.Minute); err != nil {
		t.Fatalf("acquire lock: %v", err)
	}
	if err := coordinator.SetCurrentRun(ctx, runID); err != nil {
		t.Fatalf("set current run: %v", err)
	}
	if err := coordinator.SetDualWriteState(ctx, &domainrebuild.VectorDualWriteState{
		RunID:            runID,
		Enabled:          true,
		Mode:             string(domainrebuild.ModeBlueGreen),
		ActiveCollection: "magic_knowledge",
		ShadowCollection: "magic_knowledge_shadow",
	}); err != nil {
		t.Fatalf("set dual write state: %v", err)
	}

	server.Del(testHeartbeatKeyPrefix + runID)

	got, err := coordinator.GetCurrentRun(ctx)
	if err != nil {
		t.Fatalf("get current run: %v", err)
	}
	if got != "" {
		t.Fatalf("expected empty runID for zombie state, got %s", got)
	}
	if server.Exists(testCurrentRunKey) {
		t.Fatalf("expected current run key cleared")
	}
	if server.Exists(testLockKey) {
		t.Fatalf("expected lock key cleared")
	}
	if server.Exists(testDualWriteStateKey) {
		t.Fatalf("expected dual write state cleared")
	}
}

func TestCoordinatorGetCurrentRunDoesNotClearOtherDualWriteState(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-zombie"
	otherRunID := "r-active"

	if _, err := coordinator.AcquireLock(ctx, "knowledge-rebuild:"+runID, time.Minute); err != nil {
		t.Fatalf("acquire lock: %v", err)
	}
	if err := coordinator.SetCurrentRun(ctx, runID); err != nil {
		t.Fatalf("set current run: %v", err)
	}
	if err := coordinator.SetDualWriteState(ctx, &domainrebuild.VectorDualWriteState{
		RunID:            otherRunID,
		Enabled:          true,
		Mode:             string(domainrebuild.ModeBlueGreen),
		ActiveCollection: "magic_knowledge",
		ShadowCollection: "magic_knowledge_shadow",
	}); err != nil {
		t.Fatalf("set dual write state: %v", err)
	}

	server.Del(testHeartbeatKeyPrefix + runID)

	got, err := coordinator.GetCurrentRun(ctx)
	if err != nil {
		t.Fatalf("get current run: %v", err)
	}
	if got != "" {
		t.Fatalf("expected empty runID for zombie state, got %s", got)
	}
	if !server.Exists(testDualWriteStateKey) {
		t.Fatalf("expected dual write state kept for other run")
	}
	if gotRunID := server.HGet(testDualWriteStateKey, "run_id"); gotRunID != otherRunID {
		t.Fatalf("expected dual write run_id=%s, got %s", otherRunID, gotRunID)
	}
}

func TestCoordinatorRefreshLockByOwner(t *testing.T) {
	t.Parallel()
	server, coordinator := newTestCoordinator(t)
	defer server.Close()

	ctx := context.Background()
	runID := "r-refresh"
	owner := "knowledge-rebuild:" + runID

	locked, err := coordinator.AcquireLock(ctx, owner, time.Minute)
	if err != nil {
		t.Fatalf("acquire lock: %v", err)
	}
	if !locked {
		t.Fatal("expected lock acquired")
	}

	ok, err := coordinator.RefreshLock(ctx, owner, 2*time.Minute)
	if err != nil {
		t.Fatalf("refresh lock: %v", err)
	}
	if !ok {
		t.Fatal("expected refresh lock success")
	}
	if ttl := server.TTL(testLockKey); ttl <= time.Minute {
		t.Fatalf("expected refreshed ttl > 1m, got %s", ttl)
	}

	ok, err = coordinator.RefreshLock(ctx, "knowledge-rebuild:other", 2*time.Minute)
	if err != nil {
		t.Fatalf("refresh lock by other owner: %v", err)
	}
	if ok {
		t.Fatal("expected refresh lock fail for mismatched owner")
	}
}

func isListenPermissionError(err error) bool {
	if err == nil {
		return false
	}
	if strings.Contains(err.Error(), "permission denied") || strings.Contains(err.Error(), "operation not permitted") {
		return true
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		if errors.Is(opErr.Err, syscall.EPERM) || errors.Is(opErr.Err, syscall.EACCES) {
			return true
		}
	}
	return strings.Contains(err.Error(), syscall.EPERM.Error()) || strings.Contains(err.Error(), syscall.EACCES.Error())
}
