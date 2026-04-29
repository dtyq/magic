// Package rebuild 提供 Redis 持久化的向量重建协调器实现。
package rebuild

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"magic/internal/domain/knowledge/rebuild"
	"magic/internal/infrastructure/logging"
)

const (
	lockKey                = "magic:kb:rebuild:lock"
	currentRunKey          = "magic:kb:rebuild:current"
	heartbeatKeyPrefix     = "magic:kb:rebuild:heartbeat:"
	dualWriteStateKey      = "magic:kb:rebuild:dualwrite"
	jobKeyPrefix           = "magic:kb:rebuild:job:"
	metricsKeyPrefix       = "magic:kb:rebuild:metrics:"
	retryKeyPrefix         = "magic:kb:rebuild:retry:"
	defaultTTL             = 7 * 24 * time.Hour
	defaultHeartbeatTTL    = 90 * time.Second
	rebuildLockOwnerPrefix = "knowledge-rebuild:"
)

var (
	errRedisClientNil         = errors.New("redis client is nil")
	errDualWriteStateNil      = errors.New("dual write state is nil")
	errFailureEventNil        = errors.New("failure event is nil")
	errFailureEventRunIDEmpty = errors.New("failure event run_id is empty")
)

// Coordinator 管理知识库重建运行状态。
type Coordinator struct {
	client *redis.Client
	logger *logging.SugaredLogger
}

// NewCoordinator 创建 Redis 重建协调器。
func NewCoordinator(client *redis.Client, logger *logging.SugaredLogger) *Coordinator {
	return &Coordinator{
		client: client,
		logger: logger,
	}
}

// AcquireLock 获取重建任务互斥锁。
func (c *Coordinator) AcquireLock(ctx context.Context, owner string, ttl time.Duration) (bool, error) {
	if c.client == nil {
		return false, errRedisClientNil
	}
	if ttl <= 0 {
		ttl = time.Minute
	}
	status, err := c.client.SetArgs(ctx, lockKey, owner, redis.SetArgs{
		TTL:  ttl,
		Mode: "NX",
	}).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("acquire rebuild lock: %w", err)
	}
	return status == "OK", nil
}

// RefreshLock 续期重建任务互斥锁，只有 owner 匹配时才会成功。
func (c *Coordinator) RefreshLock(ctx context.Context, owner string, ttl time.Duration) (bool, error) {
	if c.client == nil {
		return false, errRedisClientNil
	}
	if ttl <= 0 {
		ttl = time.Minute
	}

	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("PEXPIRE", KEYS[1], ARGV[2])
		end
		return 0
	`)
	ttlMS := ttl.Milliseconds()
	if ttlMS <= 0 {
		ttlMS = 1000
	}
	result, err := script.Run(ctx, c.client, []string{lockKey}, owner, ttlMS).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		return false, fmt.Errorf("refresh rebuild lock: %w", err)
	}
	return result == 1, nil
}

// ReleaseLock 释放重建任务互斥锁。
func (c *Coordinator) ReleaseLock(ctx context.Context, owner string) error {
	if c.client == nil {
		return errRedisClientNil
	}
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		end
		return 0
	`)
	if _, err := script.Run(ctx, c.client, []string{lockKey}, owner).Result(); err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("release rebuild lock: %w", err)
	}
	return nil
}

// SetCurrentRun 记录当前运行中的任务 ID。
func (c *Coordinator) SetCurrentRun(ctx context.Context, runID string) error {
	if c.client == nil {
		return errRedisClientNil
	}
	trimmedRunID := strings.TrimSpace(runID)
	if trimmedRunID == "" {
		return nil
	}

	pipe := c.client.TxPipeline()
	pipe.Set(ctx, currentRunKey, trimmedRunID, defaultTTL)
	pipe.Set(ctx, heartbeatKey(trimmedRunID), "1", defaultHeartbeatTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("set current run: %w", err)
	}
	return nil
}

// GetCurrentRun 获取当前运行中的任务 ID。
func (c *Coordinator) GetCurrentRun(ctx context.Context) (string, error) {
	if c.client == nil {
		return "", errRedisClientNil
	}
	value, err := c.client.Get(ctx, currentRunKey).Result()
	if errors.Is(err, redis.Nil) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get current run: %w", err)
	}
	runID := strings.TrimSpace(value)
	if runID == "" {
		return "", nil
	}

	heartbeatExists, err := c.client.Exists(ctx, heartbeatKey(runID)).Result()
	if err != nil {
		return "", fmt.Errorf("check heartbeat key: %w", err)
	}
	if heartbeatExists > 0 {
		return runID, nil
	}

	if err := c.clearStaleRunState(ctx, runID); err != nil {
		return "", err
	}
	return "", nil
}

// ClearCurrentRun 按 runID 清理当前运行任务标记。
func (c *Coordinator) ClearCurrentRun(ctx context.Context, runID string) error {
	if c.client == nil {
		return errRedisClientNil
	}
	script := redis.NewScript(`
		local current = redis.call("GET", KEYS[1])
		if not current then
			return 0
		end
		if current == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		end
		return 0
	`)
	if _, err := script.Run(ctx, c.client, []string{currentRunKey}, runID).Result(); err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("clear current run: %w", err)
	}
	return nil
}

// SaveJob 保存重建任务状态。
func (c *Coordinator) SaveJob(ctx context.Context, runID string, values map[string]any) error {
	if c.client == nil {
		return errRedisClientNil
	}
	key := jobKeyPrefix + runID
	values["updated_at"] = time.Now().Unix()
	normalized, err := normalizeRedisMap(values)
	if err != nil {
		return fmt.Errorf("normalize job state: %w", err)
	}
	if _, err := c.client.HSet(ctx, key, normalized).Result(); err != nil {
		return fmt.Errorf("save job state: %w", err)
	}
	if err := c.expireKey(ctx, key); err != nil {
		return fmt.Errorf("expire job state: %w", err)
	}
	return nil
}

// LoadJob 读取重建任务状态。
func (c *Coordinator) LoadJob(ctx context.Context, runID string) (map[string]string, error) {
	if c.client == nil {
		return nil, errRedisClientNil
	}
	key := jobKeyPrefix + runID
	values, err := c.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("load job state: %w", err)
	}
	if len(values) == 0 {
		return map[string]string{}, nil
	}
	return values, nil
}

// IncrMetric 增加任务指标计数。
func (c *Coordinator) IncrMetric(ctx context.Context, runID, field string, delta int64) error {
	if c.client == nil {
		return errRedisClientNil
	}
	key := metricsKeyPrefix + runID
	if _, err := c.client.HIncrBy(ctx, key, field, delta).Result(); err != nil {
		return fmt.Errorf("increment metric: %w", err)
	}
	if err := c.expireKey(ctx, key); err != nil {
		return fmt.Errorf("expire metric key: %w", err)
	}
	return nil
}

// SetDualWriteState 设置双写状态。
func (c *Coordinator) SetDualWriteState(ctx context.Context, state *rebuild.VectorDualWriteState) error {
	if c.client == nil {
		return errRedisClientNil
	}
	if state == nil {
		return errDualWriteStateNil
	}
	enabled := 0
	if state.Enabled {
		enabled = 1
	}
	values := map[string]any{
		"run_id":            state.RunID,
		"enabled":           enabled,
		"mode":              state.Mode,
		"active_collection": state.ActiveCollection,
		"shadow_collection": state.ShadowCollection,
		"active_model":      state.ActiveModel,
		"target_model":      state.TargetModel,
		"updated_at":        time.Now().Unix(),
	}
	normalized, err := normalizeRedisMap(values)
	if err != nil {
		return fmt.Errorf("normalize dual write state: %w", err)
	}
	if _, err := c.client.HSet(ctx, dualWriteStateKey, normalized).Result(); err != nil {
		return fmt.Errorf("set dual write state: %w", err)
	}
	if err := c.expireKey(ctx, dualWriteStateKey); err != nil {
		return fmt.Errorf("expire dual write state: %w", err)
	}
	return nil
}

// ClearDualWriteState 清除双写状态。
func (c *Coordinator) ClearDualWriteState(ctx context.Context, runID string) error {
	if c.client == nil {
		return errRedisClientNil
	}
	if runID == "" {
		if err := c.client.Del(ctx, dualWriteStateKey).Err(); err != nil {
			return fmt.Errorf("clear dual write state: %w", err)
		}
		return nil
	}
	state, err := c.GetDualWriteState(ctx)
	if err != nil {
		return err
	}
	if state == nil || state.RunID == "" || state.RunID == runID {
		if err := c.client.Del(ctx, dualWriteStateKey).Err(); err != nil {
			return fmt.Errorf("clear dual write state: %w", err)
		}
	}
	return nil
}

// GetDualWriteState 获取当前双写状态。
func (c *Coordinator) GetDualWriteState(ctx context.Context) (*rebuild.VectorDualWriteState, error) {
	if c.client == nil {
		return nil, errRedisClientNil
	}
	values, err := c.client.HGetAll(ctx, dualWriteStateKey).Result()
	if err != nil {
		return nil, fmt.Errorf("get dual write state: %w", err)
	}
	if len(values) == 0 {
		return &rebuild.VectorDualWriteState{}, nil
	}
	enabled := false
	if raw, ok := values["enabled"]; ok {
		enabled = raw == "1" || strings.EqualFold(raw, "true")
	}
	return &rebuild.VectorDualWriteState{
		RunID:            values["run_id"],
		Enabled:          enabled,
		Mode:             values["mode"],
		ActiveCollection: values["active_collection"],
		ShadowCollection: values["shadow_collection"],
		ActiveModel:      values["active_model"],
		TargetModel:      values["target_model"],
	}, nil
}

// EnqueueFailure 将失败事件加入补偿队列。
func (c *Coordinator) EnqueueFailure(ctx context.Context, event *rebuild.VectorRebuildFailureEvent) error {
	if c.client == nil {
		return errRedisClientNil
	}
	if event == nil {
		return errFailureEventNil
	}
	runID := strings.TrimSpace(event.RunID)
	if runID == "" {
		state, err := c.GetDualWriteState(ctx)
		if err == nil && state != nil {
			runID = strings.TrimSpace(state.RunID)
		}
	}
	if runID == "" {
		return errFailureEventRunIDEmpty
	}
	event.RunID = runID
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal failure event: %w", err)
	}
	key := retryKeyPrefix + runID
	if err := c.client.RPush(ctx, key, payload).Err(); err != nil {
		return fmt.Errorf("enqueue failure event: %w", err)
	}
	if err := c.expireKey(ctx, key); err != nil {
		return fmt.Errorf("expire failure queue: %w", err)
	}
	_ = c.IncrMetric(ctx, runID, "failure_enqueued", 1)
	return nil
}

func (c *Coordinator) expireKey(ctx context.Context, key string) error {
	if c.client == nil {
		return errRedisClientNil
	}
	if err := c.client.Expire(ctx, key, defaultTTL).Err(); err != nil {
		return fmt.Errorf("expire redis key %s: %w", key, err)
	}
	return nil
}

func heartbeatKey(runID string) string {
	return heartbeatKeyPrefix + strings.TrimSpace(runID)
}

func rebuildLockOwner(runID string) string {
	return rebuildLockOwnerPrefix + strings.TrimSpace(runID)
}

func (c *Coordinator) clearStaleRunState(ctx context.Context, runID string) error {
	if c.client == nil {
		return errRedisClientNil
	}

	trimmedRunID := strings.TrimSpace(runID)
	if trimmedRunID == "" {
		return nil
	}

	script := redis.NewScript(`
		local current = redis.call("GET", KEYS[1])
		if not current then
			return 0
		end
		if current ~= ARGV[1] then
			return 0
		end
		if redis.call("EXISTS", KEYS[2]) == 1 then
			return 0
		end

		if redis.call("GET", KEYS[3]) == ARGV[2] then
			redis.call("DEL", KEYS[3])
		end

		if redis.call("HGET", KEYS[4], "run_id") == ARGV[1] then
			redis.call("DEL", KEYS[4])
		end

		redis.call("DEL", KEYS[1])
		return 1
	`)

	_, err := script.Run(
		ctx,
		c.client,
		[]string{currentRunKey, heartbeatKey(trimmedRunID), lockKey, dualWriteStateKey},
		trimmedRunID,
		rebuildLockOwner(trimmedRunID),
	).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("clear stale run state: %w", err)
	}
	return nil
}

func normalizeRedisMap(values map[string]any) (map[string]any, error) {
	normalized := make(map[string]any, len(values))
	for key, value := range values {
		normalizedValue, include, err := normalizeRedisValue(value)
		if err != nil {
			return nil, fmt.Errorf("normalize key %s: %w", key, err)
		}
		if !include {
			continue
		}
		normalized[key] = normalizedValue
	}
	return normalized, nil
}

func normalizeRedisValue(value any) (any, bool, error) {
	if value == nil {
		return nil, false, nil
	}

	switch typed := value.(type) {
	case time.Time:
		return typed.Unix(), true, nil
	case fmt.Stringer:
		return typed.String(), true, nil
	case error:
		return typed.Error(), true, nil
	}

	return normalizeRedisReflectValue(reflect.ValueOf(value))
}

func normalizeRedisReflectValue(rv reflect.Value) (any, bool, error) {
	if !rv.IsValid() {
		return nil, false, nil
	}

	switch rv.Kind() {
	case reflect.Invalid:
		return nil, false, nil
	case reflect.Interface, reflect.Pointer:
		if rv.IsNil() {
			return nil, false, nil
		}
		return normalizeRedisReflectValue(rv.Elem())
	case reflect.String:
		return rv.String(), true, nil
	case reflect.Bool:
		if rv.Bool() {
			return "1", true, nil
		}
		return "0", true, nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int(), true, nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return rv.Uint(), true, nil
	case reflect.Float32, reflect.Float64:
		return rv.Float(), true, nil
	case reflect.Slice:
		if rv.Type().Elem().Kind() == reflect.Uint8 {
			return rv.Bytes(), true, nil
		}
		return marshalRedisValue(rv.Interface())
	default:
		return marshalRedisValue(rv.Interface())
	}
}

func marshalRedisValue(value any) (any, bool, error) {
	payload, err := json.Marshal(value)
	if err == nil {
		return string(payload), true, nil
	}
	return fmt.Sprint(value), true, nil
}

// DequeueFailures 批量弹出失败事件。
func (c *Coordinator) DequeueFailures(ctx context.Context, runID string, batchSize int64) ([]rebuild.VectorRebuildFailureEvent, error) {
	if c.client == nil {
		return nil, errRedisClientNil
	}
	if batchSize <= 0 {
		batchSize = 100
	}
	key := retryKeyPrefix + runID
	values, err := c.client.LPopCount(ctx, key, int(batchSize)).Result()
	if errors.Is(err, redis.Nil) || len(values) == 0 {
		return []rebuild.VectorRebuildFailureEvent{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("dequeue failures: %w", err)
	}
	out := make([]rebuild.VectorRebuildFailureEvent, 0, len(values))
	for _, value := range values {
		var event rebuild.VectorRebuildFailureEvent
		if unmarshalErr := json.Unmarshal([]byte(value), &event); unmarshalErr != nil {
			if c.logger != nil {
				c.logger.KnowledgeWarnContext(ctx, "Skip invalid rebuild failure payload", "payload", value, "error", unmarshalErr)
			}
			continue
		}
		out = append(out, event)
	}
	return out, nil
}

// FailureQueueLength 返回失败队列长度。
func (c *Coordinator) FailureQueueLength(ctx context.Context, runID string) (int64, error) {
	if c.client == nil {
		return 0, errRedisClientNil
	}
	key := retryKeyPrefix + runID
	count, err := c.client.LLen(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("query failure queue length: %w", err)
	}
	return count, nil
}
