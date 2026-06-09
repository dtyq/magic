// Package socketio contains operational application services for Socket.IO.
package socketio

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"magic/internal/pkg/lock"
)

const (
	// RedisV2Prefix is the historical key prefix produced by the removed v2 PHP adapter.
	RedisV2Prefix = "magicChat:SocketIo:RedisAdapter:v2"
	// RedisV3Prefix is the current low-key-count Socket.IO Redis adapter prefix.
	RedisV3Prefix = "magicChat:SocketIo:RedisAdapter:v3"

	socketIORedisPrefixRoot = "magicChat:SocketIo:"

	redisCleanupStateKeyPrefix = "magicChat:SocketIo:redis_cleanup:job:"
	redisCleanupLockKeyPrefix  = "socketio:redis_cleanup:"

	defaultCleanupCount             int64 = 1000
	defaultCleanupSampleLimit             = 10
	defaultCleanupCountMax          int64 = 5000
	defaultCleanupSampleLimitMax          = 100
	defaultCleanupLockTTL                 = 30 * time.Second
	defaultCleanupHeartbeatInterval       = 5 * time.Second
	defaultCleanupStaleThreshold          = 20 * time.Second
	defaultCleanupStateTTL                = time.Hour
	defaultCleanupRedisOpTimeout          = 2 * time.Second
)

var (
	errRedisCleanupClientRequired      = errors.New("socketio redis cleanup redis client is required")
	errRedisCleanupLockManagerRequired = errors.New("socketio redis cleanup lock manager is required")
	errRedisCleanupStateMissing        = errors.New("socketio redis cleanup state is missing")
	errRedisCleanupLockLost            = errors.New("socketio redis cleanup lock lost")
	// ErrRedisCleanupPrefixRequired indicates the request did not choose a prefix.
	ErrRedisCleanupPrefixRequired = errors.New("socketio redis cleanup prefix is required")
	// ErrRedisCleanupPrefixDenied indicates the prefix is outside the Socket.IO allowlist.
	ErrRedisCleanupPrefixDenied = errors.New("socketio redis cleanup prefix is not allowed")
	// ErrRedisCleanupApplyDenied indicates the prefix is observable but cannot be deleted by this operation.
	ErrRedisCleanupApplyDenied = errors.New("socketio redis cleanup apply is not allowed for prefix")
)

// RedisCleanupStatus describes the current async cleanup job state.
type RedisCleanupStatus string

const (
	// RedisCleanupStatusRunning means one pod owns the cleanup lock and is scanning.
	RedisCleanupStatusRunning RedisCleanupStatus = "running"
	// RedisCleanupStatusDone means the last cleanup task reached SCAN cursor 0.
	RedisCleanupStatusDone RedisCleanupStatus = "done"
	// RedisCleanupStatusFailed means the last cleanup task failed and can be retried.
	RedisCleanupStatusFailed RedisCleanupStatus = "failed"
)

// RedisCleanupInput starts or observes one Socket.IO Redis cleanup task.
type RedisCleanupInput struct {
	Prefix      string
	Cursor      uint64
	Count       int64
	Apply       bool
	SampleLimit int
}

// RedisCleanupResult reports the current async cleanup task state.
type RedisCleanupResult struct {
	JobID          string             `json:"job_id"`
	Status         RedisCleanupStatus `json:"status"`
	Prefix         string             `json:"prefix"`
	Pattern        string             `json:"pattern"`
	Apply          bool               `json:"apply"`
	Count          int64              `json:"count"`
	Cursor         uint64             `json:"cursor"`
	Matched        int64              `json:"matched"`
	Deleted        int64              `json:"deleted"`
	Pages          int64              `json:"pages"`
	SampleKeys     []string           `json:"sample_keys"`
	Owner          string             `json:"owner"`
	HeartbeatAt    *time.Time         `json:"heartbeat_at,omitempty"`
	LastProgressAt *time.Time         `json:"last_progress_at,omitempty"`
	StartedAt      *time.Time         `json:"started_at,omitempty"`
	UpdatedAt      *time.Time         `json:"updated_at,omitempty"`
	FinishedAt     *time.Time         `json:"finished_at,omitempty"`
	Error          string             `json:"error,omitempty"`
	// Done is kept as a small compatibility convenience for older callers.
	Done bool `json:"done"`

	sampleLimit int
}

// RedisCleanupOptions tunes async Socket.IO Redis cleanup behavior.
type RedisCleanupOptions struct {
	AllowedPrefixes      []string
	ExtraAllowedPrefixes []string
	CountMax             int64
	LockTTL              time.Duration
	HeartbeatInterval    time.Duration
	StaleThreshold       time.Duration
	StateTTL             time.Duration
	Owner                string
	Logger               RedisCleanupLogger
}

// RedisCleanupLogger records asynchronous cleanup failures.
type RedisCleanupLogger interface {
	ErrorContext(ctx context.Context, msg string, keysAndValues ...any)
}

// RedisCleanupManager coordinates async Redis key cleanup across pods.
type RedisCleanupManager struct {
	client          *redis.Client
	lockManager     *lock.RedisLockManager
	allowedPrefixes []string

	countMax          int64
	lockTTL           time.Duration
	heartbeatInterval time.Duration
	staleThreshold    time.Duration
	stateTTL          time.Duration
	owner             string
	logger            RedisCleanupLogger

	localMu      sync.Mutex
	localRunning map[string]struct{}
}

// NewRedisCleanupManager creates a cleanup manager with the production allowlist.
func NewRedisCleanupManager(
	client *redis.Client,
	lockManager *lock.RedisLockManager,
	opts RedisCleanupOptions,
) *RedisCleanupManager {
	allowed := opts.AllowedPrefixes
	if len(allowed) == 0 {
		allowed = append(DefaultAllowedPrefixes(), opts.ExtraAllowedPrefixes...)
	}
	return newRedisCleanupManager(client, lockManager, allowed, opts)
}

// NewRedisCleanupManagerWithPrefixes creates a cleanup manager with an explicit allowlist.
func NewRedisCleanupManagerWithPrefixes(
	client *redis.Client,
	lockManager *lock.RedisLockManager,
	opts RedisCleanupOptions,
	allowedPrefixes ...string,
) *RedisCleanupManager {
	opts.AllowedPrefixes = allowedPrefixes
	return newRedisCleanupManager(client, lockManager, allowedPrefixes, opts)
}

func newRedisCleanupManager(
	client *redis.Client,
	lockManager *lock.RedisLockManager,
	allowedPrefixes []string,
	opts RedisCleanupOptions,
) *RedisCleanupManager {
	countMax := opts.CountMax
	if countMax <= 0 {
		countMax = defaultCleanupCountMax
	}
	countMax = min(countMax, defaultCleanupCountMax)
	stateTTL := normalizeDuration(opts.StateTTL, defaultCleanupStateTTL)
	return &RedisCleanupManager{
		client:            client,
		lockManager:       lockManager,
		allowedPrefixes:   normalizeAllowedPrefixes(allowedPrefixes),
		countMax:          countMax,
		lockTTL:           normalizeDuration(opts.LockTTL, defaultCleanupLockTTL),
		heartbeatInterval: normalizeDuration(opts.HeartbeatInterval, defaultCleanupHeartbeatInterval),
		staleThreshold:    normalizeDuration(opts.StaleThreshold, defaultCleanupStaleThreshold),
		stateTTL:          stateTTL,
		owner:             normalizeOwner(opts.Owner),
		logger:            opts.Logger,
		localRunning:      make(map[string]struct{}),
	}
}

// DefaultAllowedPrefixes returns the built-in Socket.IO cleanup allowlist.
func DefaultAllowedPrefixes() []string {
	return []string{RedisV2Prefix, RedisV3Prefix}
}

// RedisCleanupJobID returns the stable job id for one prefix/apply cleanup task.
func RedisCleanupJobID(prefix string, apply bool) string {
	sum := sha256.Sum256([]byte(normalizePrefix(prefix) + "|" + fmt.Sprintf("%t", apply)))
	return hex.EncodeToString(sum[:])
}

// RedisCleanupStateKey returns the Redis key used to store cleanup progress.
func RedisCleanupStateKey(jobID string) string {
	return redisCleanupStateKeyPrefix + strings.TrimSpace(jobID)
}

// RedisCleanupLockKey returns the logical Redis lock key used by RedisLockManager.
func RedisCleanupLockKey(jobID string) string {
	return redisCleanupLockKeyPrefix + strings.TrimSpace(jobID)
}

// Cleanup observes the current job state and starts one async cleanup task when needed.
func (m *RedisCleanupManager) Cleanup(
	ctx context.Context,
	input *RedisCleanupInput,
) (*RedisCleanupResult, error) {
	if m == nil {
		return nil, errRedisCleanupClientRequired
	}
	normalized, err := m.normalizeInput(input)
	if err != nil {
		return nil, err
	}
	if m.client == nil {
		return nil, errRedisCleanupClientRequired
	}
	if m.lockManager == nil {
		return nil, errRedisCleanupLockManagerRequired
	}

	state, stateFound, err := m.loadState(ctx, normalized.JobID)
	if err != nil && !errors.Is(err, errRedisCleanupStateMissing) {
		return nil, err
	}
	if shouldReturnState(state, m.staleThreshold, time.Now()) {
		return state.clone(), nil
	}

	if !m.markLocalRunning(normalized.JobID) {
		if stateFound {
			return state.clone(), nil
		}
		return newRunningState(normalized, m.owner, time.Now()).clone(), nil
	}

	jobLock := m.lockManager.CreateLock(RedisCleanupLockKey(normalized.JobID), m.lockTTL)
	lockCtx, cancel := context.WithTimeout(ctx, defaultCleanupRedisOpTimeout)
	acquired, err := jobLock.TryAcquire(lockCtx)
	cancel()
	if err != nil {
		m.clearLocalRunning(normalized.JobID)
		return nil, fmt.Errorf("acquire socketio redis cleanup lock: %w", err)
	}
	if !acquired {
		m.clearLocalRunning(normalized.JobID)
		if stateFound {
			return state.clone(), nil
		}
		return newRunningState(normalized, "", time.Now()).clone(), nil
	}

	started := newRunningState(normalized, m.owner, time.Now())
	if err := m.storeState(ctx, started); err != nil {
		m.clearLocalRunning(normalized.JobID)
		releaseCtx, cancelRelease := context.WithTimeout(context.WithoutCancel(ctx), defaultCleanupRedisOpTimeout)
		_ = jobLock.Release(releaseCtx)
		cancelRelease()
		return nil, err
	}

	go m.runCleanup(context.WithoutCancel(ctx), jobLock, started)
	return started.clone(), nil
}

func (m *RedisCleanupManager) runCleanup(parent context.Context, jobLock *lock.RedisLock, initial *RedisCleanupResult) {
	defer m.clearLocalRunning(initial.JobID)

	runCtx, cancelRun := context.WithCancelCause(parent)
	stopHeartbeat := make(chan struct{})
	heartbeatDone := make(chan struct{})
	run := newRedisCleanupRun(m, jobLock, initial)
	go run.heartbeat(runCtx, stopHeartbeat, heartbeatDone, cancelRun)

	err := run.scan(runCtx)
	close(stopHeartbeat)
	<-heartbeatDone

	if err != nil {
		run.finish(runCtx, RedisCleanupStatusFailed, err)
	} else {
		run.finish(runCtx, RedisCleanupStatusDone, nil)
	}

	releaseCtx, cancelRelease := context.WithTimeout(context.WithoutCancel(runCtx), defaultCleanupRedisOpTimeout)
	_ = jobLock.Release(releaseCtx)
	cancelRelease()
	cancelRun(nil)
}

type normalizedCleanupInput struct {
	JobID       string
	Prefix      string
	Pattern     string
	Count       int64
	Apply       bool
	SampleLimit int
}

func (m *RedisCleanupManager) normalizeInput(input *RedisCleanupInput) (normalizedCleanupInput, error) {
	if input == nil {
		return normalizedCleanupInput{}, ErrRedisCleanupPrefixRequired
	}

	prefix := normalizePrefix(input.Prefix)
	if prefix == "" {
		return normalizedCleanupInput{}, ErrRedisCleanupPrefixRequired
	}
	if !slices.Contains(m.allowedPrefixes, prefix) {
		return normalizedCleanupInput{}, fmt.Errorf("%w: %s", ErrRedisCleanupPrefixDenied, prefix)
	}
	if input.Apply && prefix == RedisV3Prefix {
		return normalizedCleanupInput{}, fmt.Errorf("%w: %s", ErrRedisCleanupApplyDenied, prefix)
	}

	count := input.Count
	if count <= 0 {
		count = defaultCleanupCount
	}
	if count > m.countMax {
		count = m.countMax
	}

	sampleLimit := max(input.SampleLimit, 0)
	if sampleLimit == 0 {
		sampleLimit = defaultCleanupSampleLimit
	}
	sampleLimit = min(sampleLimit, defaultCleanupSampleLimitMax)

	return normalizedCleanupInput{
		JobID:       RedisCleanupJobID(prefix, input.Apply),
		Prefix:      prefix,
		Pattern:     prefix + ":*",
		Count:       count,
		Apply:       input.Apply,
		SampleLimit: sampleLimit,
	}, nil
}

func shouldReturnState(state *RedisCleanupResult, staleThreshold time.Duration, now time.Time) bool {
	if state == nil {
		return false
	}
	switch state.Status {
	case RedisCleanupStatusDone:
		return true
	case RedisCleanupStatusRunning:
		return !isCleanupStateStale(state, staleThreshold, now)
	default:
		return false
	}
}

func isCleanupStateStale(state *RedisCleanupResult, staleThreshold time.Duration, now time.Time) bool {
	if state == nil || state.HeartbeatAt == nil || state.HeartbeatAt.IsZero() {
		return true
	}
	return now.Sub(*state.HeartbeatAt) > staleThreshold
}

func (m *RedisCleanupManager) loadState(ctx context.Context, jobID string) (*RedisCleanupResult, bool, error) {
	raw, err := m.client.Get(ctx, RedisCleanupStateKey(jobID)).Result()
	if errors.Is(err, redis.Nil) {
		return nil, false, errRedisCleanupStateMissing
	}
	if err != nil {
		return nil, false, fmt.Errorf("read socketio redis cleanup state: %w", err)
	}
	var state RedisCleanupResult
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return nil, false, fmt.Errorf("decode socketio redis cleanup state: %w", err)
	}
	state.normalizeAfterDecode()
	return &state, true, nil
}

func (m *RedisCleanupManager) storeState(ctx context.Context, state *RedisCleanupResult) error {
	state.normalizeAfterDecode()
	raw, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("encode socketio redis cleanup state: %w", err)
	}
	if err := m.client.Set(ctx, RedisCleanupStateKey(state.JobID), raw, m.stateTTL).Err(); err != nil {
		return fmt.Errorf("write socketio redis cleanup state: %w", err)
	}
	return nil
}

func (m *RedisCleanupManager) markLocalRunning(jobID string) bool {
	m.localMu.Lock()
	defer m.localMu.Unlock()
	if _, ok := m.localRunning[jobID]; ok {
		return false
	}
	m.localRunning[jobID] = struct{}{}
	return true
}

func (m *RedisCleanupManager) clearLocalRunning(jobID string) {
	m.localMu.Lock()
	delete(m.localRunning, jobID)
	m.localMu.Unlock()
}

func newRunningState(input normalizedCleanupInput, owner string, now time.Time) *RedisCleanupResult {
	return &RedisCleanupResult{
		JobID:          input.JobID,
		Status:         RedisCleanupStatusRunning,
		Prefix:         input.Prefix,
		Pattern:        input.Pattern,
		Apply:          input.Apply,
		Count:          input.Count,
		Cursor:         0,
		SampleKeys:     []string{},
		Owner:          owner,
		HeartbeatAt:    &now,
		LastProgressAt: &now,
		StartedAt:      &now,
		UpdatedAt:      &now,
		sampleLimit:    input.SampleLimit,
	}
}

type redisCleanupRun struct {
	manager     *RedisCleanupManager
	jobLock     *lock.RedisLock
	sampleLimit int

	mu    sync.Mutex
	state *RedisCleanupResult
}

func newRedisCleanupRun(
	manager *RedisCleanupManager,
	jobLock *lock.RedisLock,
	initial *RedisCleanupResult,
) *redisCleanupRun {
	return &redisCleanupRun{
		manager:     manager,
		jobLock:     jobLock,
		sampleLimit: initial.sampleLimit,
		state:       initial.clone(),
	}
}

func (r *redisCleanupRun) scan(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("socketio redis cleanup context done: %w", context.Cause(ctx))
		default:
		}

		current := r.currentState()
		keys, nextCursor, err := r.manager.client.Scan(ctx, current.Cursor, current.Pattern, current.Count).Result()
		if err != nil {
			return fmt.Errorf("scan socketio redis keys: %w", err)
		}

		var deleted int64
		if current.Apply && len(keys) > 0 {
			deleted, err = r.deleteKeys(ctx, keys)
			if err != nil {
				return err
			}
		}

		if err := r.updateProgress(ctx, keys, deleted, nextCursor); err != nil {
			return err
		}
		if nextCursor == 0 {
			return nil
		}
	}
}

func (r *redisCleanupRun) deleteKeys(ctx context.Context, keys []string) (int64, error) {
	pipe := r.manager.client.Pipeline()
	for _, key := range keys {
		// One DEL per command keeps this safe for Redis Cluster clients as well as
		// Tencent Cloud proxy routing. Pipeline still amortizes network overhead.
		pipe.Del(ctx, key)
	}
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("delete socketio redis keys: %w", err)
	}

	var deleted int64
	for _, cmd := range cmds {
		intCmd, ok := cmd.(*redis.IntCmd)
		if !ok {
			continue
		}
		deleted += intCmd.Val()
	}
	return deleted, nil
}

func (r *redisCleanupRun) heartbeat(
	ctx context.Context,
	stop <-chan struct{},
	done chan<- struct{},
	cancel context.CancelCauseFunc,
) {
	defer close(done)

	ticker := time.NewTicker(r.manager.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshCtx, refreshCancel := context.WithTimeout(ctx, defaultCleanupRedisOpTimeout)
			refreshed, err := r.jobLock.Refresh(refreshCtx)
			refreshCancel()
			if err != nil {
				cancel(fmt.Errorf("refresh socketio redis cleanup lock: %w", err))
				return
			}
			if !refreshed {
				cancel(errRedisCleanupLockLost)
				return
			}
			if err := r.updateHeartbeat(ctx); err != nil {
				continue
			}
		}
	}
}

func (r *redisCleanupRun) updateHeartbeat(ctx context.Context) error {
	now := time.Now()
	state := r.withState(func(state *RedisCleanupResult) {
		state.Status = RedisCleanupStatusRunning
		state.Owner = r.manager.owner
		state.HeartbeatAt = &now
		state.UpdatedAt = &now
	})
	return r.store(ctx, state)
}

func (r *redisCleanupRun) updateProgress(ctx context.Context, keys []string, deleted int64, nextCursor uint64) error {
	now := time.Now()
	state := r.withState(func(state *RedisCleanupResult) {
		state.Cursor = nextCursor
		state.Matched += int64(len(keys))
		state.Deleted += deleted
		state.Pages++
		state.Owner = r.manager.owner
		state.HeartbeatAt = &now
		state.LastProgressAt = &now
		state.UpdatedAt = &now
		state.SampleKeys = appendSampleKeys(state.SampleKeys, keys, r.sampleLimit)
	})
	return r.store(ctx, state)
}

func (r *redisCleanupRun) finish(ctx context.Context, status RedisCleanupStatus, err error) {
	now := time.Now()
	state := r.withState(func(state *RedisCleanupResult) {
		state.Status = status
		state.Done = status == RedisCleanupStatusDone
		state.Owner = r.manager.owner
		state.HeartbeatAt = &now
		state.UpdatedAt = &now
		state.FinishedAt = &now
		if err != nil {
			state.Error = err.Error()
		} else {
			state.Error = ""
		}
	})
	if storeErr := r.store(context.WithoutCancel(ctx), state); storeErr != nil && r.manager.logger != nil {
		r.manager.logger.ErrorContext(
			context.WithoutCancel(ctx),
			"Failed to store socketio redis cleanup final state",
			"job_id", state.JobID,
			"status", string(status),
			"error", storeErr,
		)
	}
}

func (r *redisCleanupRun) withState(fn func(*RedisCleanupResult)) *RedisCleanupResult {
	r.mu.Lock()
	defer r.mu.Unlock()
	fn(r.state)
	r.state.normalizeAfterDecode()
	return r.state.clone()
}

func (r *redisCleanupRun) currentState() *RedisCleanupResult {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.state.clone()
}

func (r *redisCleanupRun) store(ctx context.Context, state *RedisCleanupResult) error {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), defaultCleanupRedisOpTimeout)
	defer cancel()
	return r.manager.storeState(ctx, state)
}

func (r *RedisCleanupResult) clone() *RedisCleanupResult {
	if r == nil {
		return nil
	}
	cloned := *r
	cloned.SampleKeys = append([]string(nil), r.SampleKeys...)
	cloned.HeartbeatAt = cloneTimePtr(r.HeartbeatAt)
	cloned.LastProgressAt = cloneTimePtr(r.LastProgressAt)
	cloned.StartedAt = cloneTimePtr(r.StartedAt)
	cloned.UpdatedAt = cloneTimePtr(r.UpdatedAt)
	cloned.FinishedAt = cloneTimePtr(r.FinishedAt)
	cloned.normalizeAfterDecode()
	return &cloned
}

func (r *RedisCleanupResult) normalizeAfterDecode() {
	if r == nil {
		return
	}
	if r.SampleKeys == nil {
		r.SampleKeys = []string{}
	}
	if r.sampleLimit <= 0 {
		r.sampleLimit = defaultCleanupSampleLimit
	}
	if r.Pattern == "" && r.Prefix != "" {
		r.Pattern = r.Prefix + ":*"
	}
	r.Done = r.Status == RedisCleanupStatusDone
}

func normalizeAllowedPrefixes(prefixes []string) []string {
	allowed := make([]string, 0, len(prefixes))
	for _, prefix := range prefixes {
		prefix = normalizePrefix(prefix)
		if prefix == "" || !strings.HasPrefix(prefix, socketIORedisPrefixRoot) || slices.Contains(allowed, prefix) {
			continue
		}
		allowed = append(allowed, prefix)
	}
	return allowed
}

func normalizePrefix(prefix string) string {
	return strings.TrimRight(strings.TrimSpace(prefix), ":*")
}

func normalizeDuration(value, fallback time.Duration) time.Duration {
	if value > 0 {
		return value
	}
	return fallback
}

func normalizeOwner(owner string) string {
	owner = strings.TrimSpace(owner)
	if owner != "" {
		return owner
	}
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		host = "unknown"
	}
	return fmt.Sprintf("%s:%d", strings.TrimSpace(host), os.Getpid())
}

func cloneTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func appendSampleKeys(current, keys []string, limit int) []string {
	if limit <= 0 || len(keys) == 0 || len(current) >= limit {
		return current
	}
	remaining := limit - len(current)
	remaining = min(len(keys), remaining)
	return append(current, keys[:remaining]...)
}
