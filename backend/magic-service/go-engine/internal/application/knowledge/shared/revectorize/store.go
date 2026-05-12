// Package revectorize 提供知识库级批量重向量化用例共享的 DTO 与 session 进度存储。
//
// 这里的 shared 不是为了“抽公共代码”，而是为了给 revectorize 这条跨 app 用例提供稳定边界：
// - revectorize app 负责总编排
// - knowledgebase app 负责 knowledge prepare / progress 落库
// - document app 负责单文档异步执行与终态回调
// 三者都需要共享一套最小业务语言和 session 进度能力，但又不应该互相直接依赖彼此的 app 私有类型。
package revectorize

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	sessionTTL        = 7 * 24 * time.Hour
	sessionWatchRetry = 8
	finalizeLockTTL   = 30 * time.Second
	finalizeLockWait  = 50 * time.Millisecond
)

var (
	// ErrProgressStoreRequired 表示缺少知识库重向量化进度存储。
	ErrProgressStoreRequired = errors.New("knowledge revectorize progress store is required")
	// ErrProgressWatchRetryExceeded 表示 Redis optimistic lock 重试次数耗尽。
	ErrProgressWatchRetryExceeded = errors.New("knowledge revectorize progress watch retry exceeded")
	// ErrProgressPersistCallbackRequired 表示推进文档进度时缺少持久化回调。
	ErrProgressPersistCallbackRequired = errors.New("knowledge revectorize progress persist callback is required")
)

// SessionProgress 表示某个知识库当前重向量化 session 的稳定进度快照。
//
// 这里显式引入 session，而不是只记 knowledge_base_code 的累计进度，
// 是为了解决重复点击 start-vector 时多轮任务并发回调的问题。
// 有了 session，旧任务晚到时可以被识别并忽略，避免把新一轮 expected/completed 冲脏。
type SessionProgress struct {
	KnowledgeBaseCode string
	SessionID         string
	ExpectedNum       int
	CompletedNum      int
}

// ProgressStore 定义知识库重向量化 session 进度的最小读写能力。
//
// 这里只暴露 start session 和 advance document 两个动作，
// 因为这条用例真正需要的共享能力只有“开启一轮”和“推进一篇完成”。
// 再往外暴露更多 Redis 细节，会把 app 层重新绑回基础设施实现。
type ProgressStore interface {
	StartSession(
		ctx context.Context,
		knowledgeBaseCode string,
		sessionID string,
		documentCodes []string,
	) (*SessionProgress, error)
	AdvanceDocument(
		ctx context.Context,
		knowledgeBaseCode string,
		sessionID string,
		documentCode string,
		persist func(progress *SessionProgress) error,
	) (bool, error)
}

// RedisProgressStore 用 Redis 保存知识库重向量化 session 状态。
//
// 这里显式记录 active session，是为了隔离重复点击 start-vector 的多轮任务：
// 旧任务晚到的回调只能推进自己那一轮，不能污染当前这一轮的 expected/completed。
//
// 进度放 Redis 而不是只放 MySQL，是因为这条链路是高频异步回调：
// - 需要一个轻量的 active session / done set 做快速判重
// - 需要跨 MQ worker 共享状态
// - 但对外展示仍以 knowledge_base 表中的 expected/completed 为准
type RedisProgressStore struct {
	client *redis.Client
	ttl    time.Duration
}

// finalizeLock 是知识库级文档终态提交锁。
//
// 这里单独做一个轻量锁，而不是只靠 Redis set 判重，
// 是为了串行化“读当前 completed -> 持久化 knowledge base -> 提交 Redis done/completed”这段流程。
// 否则多篇文档同时终态时，completed_num 很容易出现覆盖写。
type finalizeLock struct {
	store *RedisProgressStore
	key   string
	value string
}

// NewRedisProgressStore 创建知识库重向量化 Redis 进度存储。
func NewRedisProgressStore(client *redis.Client) *RedisProgressStore {
	if client == nil {
		return nil
	}
	return &RedisProgressStore{client: client, ttl: sessionTTL}
}

// StartSession 初始化新的知识库重向量化 session，并覆盖旧 session 的完成集合。
//
// 新 session 开始时必须清掉旧 done set，
// 否则上一轮已经完成过的 document code 会把这一轮的同文档回调错误去重掉。
func (s *RedisProgressStore) StartSession(
	ctx context.Context,
	knowledgeBaseCode string,
	sessionID string,
	documentCodes []string,
) (*SessionProgress, error) {
	if s == nil || s.client == nil {
		return nil, ErrProgressStoreRequired
	}

	trimmedKnowledgeBaseCode := strings.TrimSpace(knowledgeBaseCode)
	trimmedSessionID := strings.TrimSpace(sessionID)
	if trimmedKnowledgeBaseCode == "" || trimmedSessionID == "" {
		return &SessionProgress{}, nil
	}

	uniqueDocumentCodes := uniqueDocumentCodes(documentCodes)
	progress := &SessionProgress{
		KnowledgeBaseCode: trimmedKnowledgeBaseCode,
		SessionID:         trimmedSessionID,
		ExpectedNum:       len(uniqueDocumentCodes),
		CompletedNum:      0,
	}

	pipe := s.client.TxPipeline()
	pipe.HSet(ctx, s.stateKey(trimmedKnowledgeBaseCode), map[string]any{
		"session_id":    trimmedSessionID,
		"expected_num":  progress.ExpectedNum,
		"completed_num": 0,
	})
	pipe.Expire(ctx, s.stateKey(trimmedKnowledgeBaseCode), s.ttl)
	pipe.Del(ctx, s.doneKey(trimmedKnowledgeBaseCode))
	pipe.Expire(ctx, s.doneKey(trimmedKnowledgeBaseCode), s.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, fmt.Errorf("start knowledge revectorize session: %w", err)
	}
	return progress, nil
}

// AdvanceDocument 在 active session 下推进单文档完成数。
//
// 它会先拿知识库级 finalize 锁，先调用持久化回调更新 knowledge base，
// 成功后才把 Redis 里的 done/completed 提交出去，避免 Redis 先前进、MySQL 落后造成永久不一致。
func (s *RedisProgressStore) AdvanceDocument(
	ctx context.Context,
	knowledgeBaseCode string,
	sessionID string,
	documentCode string,
	persist func(progress *SessionProgress) error,
) (bool, error) {
	if s == nil || s.client == nil {
		return false, ErrProgressStoreRequired
	}
	if persist == nil {
		return false, ErrProgressPersistCallbackRequired
	}

	trimmedKnowledgeBaseCode, trimmedSessionID, trimmedDocumentCode := normalizeProgressIdentity(
		knowledgeBaseCode,
		sessionID,
		documentCode,
	)
	if trimmedKnowledgeBaseCode == "" || trimmedSessionID == "" || trimmedDocumentCode == "" {
		return false, nil
	}

	lock, err := s.acquireFinalizeLock(ctx, trimmedKnowledgeBaseCode)
	if err != nil {
		return false, err
	}
	releaseCtx, releaseCancel := context.WithTimeout(context.WithoutCancel(ctx), finalizeLockWait)
	defer releaseCancel()
	defer releaseFinalizeLock(releaseCtx, lock)

	progress, advanced, err := s.prepareDocumentAdvance(
		ctx,
		trimmedKnowledgeBaseCode,
		trimmedSessionID,
		trimmedDocumentCode,
	)
	if err != nil || !advanced {
		return advanced, err
	}
	if err := persist(progress); err != nil {
		return false, fmt.Errorf("persist knowledge revectorize progress: %w", err)
	}
	if err := s.commitDocumentAdvance(ctx, trimmedKnowledgeBaseCode, trimmedDocumentCode, progress.CompletedNum); err != nil {
		return false, err
	}
	return true, nil
}

func (s *RedisProgressStore) prepareDocumentAdvance(
	ctx context.Context,
	knowledgeBaseCode string,
	sessionID string,
	documentCode string,
) (*SessionProgress, bool, error) {
	progress, err := s.loadSessionProgress(ctx, s.client, knowledgeBaseCode)
	if err != nil {
		return nil, false, err
	}
	// session 不匹配时直接忽略。
	// 这表示回调属于旧一轮 start-vector，不应该再推进当前知识库进度。
	if progress.SessionID == "" || progress.SessionID != sessionID {
		return progress, false, nil
	}

	done, err := s.client.SIsMember(ctx, s.doneKey(knowledgeBaseCode), documentCode).Result()
	if err != nil {
		return nil, false, fmt.Errorf("check knowledge revectorize done set: %w", err)
	}
	if done {
		return progress, false, nil
	}

	nextProgress := *progress
	nextProgress.CompletedNum++
	return &nextProgress, true, nil
}

func (s *RedisProgressStore) loadSessionProgress(
	ctx context.Context,
	hashGetter interface {
		HMGet(ctx context.Context, key string, fields ...string) *redis.SliceCmd
	},
	knowledgeBaseCode string,
) (*SessionProgress, error) {
	values, err := hashGetter.HMGet(
		ctx,
		s.stateKey(knowledgeBaseCode),
		"session_id",
		"expected_num",
		"completed_num",
	).Result()
	if err != nil {
		return nil, fmt.Errorf("load knowledge revectorize session state: %w", err)
	}
	return &SessionProgress{
		KnowledgeBaseCode: knowledgeBaseCode,
		SessionID:         strings.TrimSpace(stringValueAt(values, 0)),
		ExpectedNum:       intValueAt(values, 1),
		CompletedNum:      intValueAt(values, 2),
	}, nil
}

func (s *RedisProgressStore) commitDocumentAdvance(
	ctx context.Context,
	knowledgeBaseCode string,
	documentCode string,
	completedNum int,
) error {
	// Redis 的最终提交只做两件事：
	// 1. 记录文档已经在当前 session 内完成，用于去重
	// 2. 更新 session completed_num，用于后续回调继续基于最新进度推进
	// 它刻意不承担“对外最终真相”，对外仍以 knowledge_base 表落库结果为准。
	_, err := s.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.SAdd(ctx, s.doneKey(knowledgeBaseCode), documentCode)
		pipe.Expire(ctx, s.doneKey(knowledgeBaseCode), s.ttl)
		pipe.HSet(ctx, s.stateKey(knowledgeBaseCode), "completed_num", completedNum)
		pipe.Expire(ctx, s.stateKey(knowledgeBaseCode), s.ttl)
		return nil
	})
	if err != nil {
		return fmt.Errorf("advance knowledge revectorize progress: %w", err)
	}
	return nil
}

func (s *RedisProgressStore) acquireFinalizeLock(
	ctx context.Context,
	knowledgeBaseCode string,
) (*finalizeLock, error) {
	lockKey := s.finalizeLockKey(knowledgeBaseCode)
	lockValue := uuid.NewString()
	for {
		status, err := s.client.SetArgs(ctx, lockKey, lockValue, redis.SetArgs{
			TTL:  finalizeLockTTL,
			Mode: "NX",
		}).Result()
		switch {
		case errors.Is(err, redis.Nil):
		case err != nil:
			return nil, fmt.Errorf("acquire knowledge revectorize finalize lock: %w", err)
		}
		if status == "OK" {
			return &finalizeLock{
				store: s,
				key:   lockKey,
				value: lockValue,
			}, nil
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("wait knowledge revectorize finalize lock: %w", ctx.Err())
		case <-time.After(finalizeLockWait):
		}
	}
}

// Release 只会释放自己持有的 finalize 锁。
//
// 这里必须做 owner 校验，不能简单 DEL。
// 否则锁 TTL 到期后如果已经被别的 worker 重新拿到，旧持有者晚到的释放会误删新锁。
func (l *finalizeLock) Release(ctx context.Context) error {
	if l == nil || l.store == nil {
		return nil
	}
	_, err := l.store.releaseFinalizeLock(ctx, l.key, l.value)
	return err
}

func releaseFinalizeLock(ctx context.Context, lock *finalizeLock) {
	if lock == nil {
		return
	}
	_ = lock.Release(ctx)
}

func (s *RedisProgressStore) releaseFinalizeLock(
	ctx context.Context,
	lockKey string,
	lockValue string,
) (bool, error) {
	for range sessionWatchRetry {
		var released bool
		err := s.client.Watch(ctx, func(tx *redis.Tx) error {
			currentValue, err := tx.Get(ctx, lockKey).Result()
			switch {
			case errors.Is(err, redis.Nil):
				return nil
			case err != nil:
				return fmt.Errorf("load knowledge revectorize finalize lock owner: %w", err)
			case currentValue != lockValue:
				return nil
			}

			released = true
			_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Del(ctx, lockKey)
				return nil
			})
			if err != nil {
				return fmt.Errorf("delete knowledge revectorize finalize lock: %w", err)
			}
			return nil
		}, lockKey)
		switch {
		case err == nil:
			return released, nil
		case errors.Is(err, redis.TxFailedErr):
			continue
		default:
			return false, fmt.Errorf("release knowledge revectorize finalize lock: %w", err)
		}
	}
	return false, ErrProgressWatchRetryExceeded
}

func (s *RedisProgressStore) stateKey(knowledgeBaseCode string) string {
	return "knowledge:revectorize:session:" + knowledgeBaseCode
}

func (s *RedisProgressStore) doneKey(knowledgeBaseCode string) string {
	return "knowledge:revectorize:session:" + knowledgeBaseCode + ":done"
}

func (s *RedisProgressStore) finalizeLockKey(knowledgeBaseCode string) string {
	return "knowledge:revectorize:session:" + knowledgeBaseCode + ":finalize-lock"
}

func uniqueDocumentCodes(documentCodes []string) []string {
	if len(documentCodes) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(documentCodes))
	result := make([]string, 0, len(documentCodes))
	for _, code := range documentCodes {
		trimmedCode := strings.TrimSpace(code)
		if trimmedCode == "" {
			continue
		}
		if _, ok := seen[trimmedCode]; ok {
			continue
		}
		seen[trimmedCode] = struct{}{}
		result = append(result, trimmedCode)
	}
	return result
}

func normalizeProgressIdentity(knowledgeBaseCode, sessionID, documentCode string) (string, string, string) {
	return strings.TrimSpace(knowledgeBaseCode), strings.TrimSpace(sessionID), strings.TrimSpace(documentCode)
}

func stringValueAt(values []any, idx int) string {
	if idx < 0 || idx >= len(values) || values[idx] == nil {
		return ""
	}
	return fmt.Sprintf("%v", values[idx])
}

func intValueAt(values []any, idx int) int {
	raw := strings.TrimSpace(stringValueAt(values, idx))
	if raw == "" {
		return 0
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return value
}
