package embedapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/robfig/cron/v3"

	"magic/internal/constants"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/logging"
	lockpkg "magic/internal/pkg/lock"
	"magic/internal/pkg/logkey"
)

const (
	// 清理服务常量
	defaultCleanupIntervalHours  = 24 // 每24小时清理一次
	defaultCleanupTimeoutMinutes = 30 // 清理任务30分钟超时
)

var errSinglePodJobRunnerNil = errors.New("single pod job runner is nil")

// EmbeddingCacheCleanupService 向量化缓存清理服务
// 专门负责缓存的定时清理和维护任务
type EmbeddingCacheCleanupService struct {
	embeddingDomain *embeddingdomain.DomainService
	jobRunner       lockpkg.SinglePodJobRunner
	config          *CleanupConfig
	scheduler       *cron.Cron
	logger          *logging.SugaredLogger
}

// CleanupConfig 清理配置
type CleanupConfig struct {
	// 清理任务执行间隔
	CleanupInterval time.Duration `json:"cleanup_interval"`

	// 清理标准
	CleanupCriteria *embeddingdomain.CacheCleanupCriteria `json:"cleanup_criteria"`

	// 是否启用自动清理
	AutoCleanupEnabled bool `json:"auto_cleanup_enabled"`

	// 清理任务超时时间
	CleanupTimeout time.Duration `json:"cleanup_timeout"`
}

// DefaultCleanupConfig 默认清理配置
func DefaultCleanupConfig() *CleanupConfig {
	return &CleanupConfig{
		CleanupInterval:    time.Duration(defaultCleanupIntervalHours) * time.Hour, // 每24小时清理一次
		CleanupCriteria:    embeddingdomain.DefaultCleanupCriteria(),
		AutoCleanupEnabled: true,
		CleanupTimeout:     time.Duration(defaultCleanupTimeoutMinutes) * time.Minute, // 清理任务30分钟超时
	}
}

// NewEmbeddingCacheCleanupService 创建新的缓存清理服务
func NewEmbeddingCacheCleanupService(
	embeddingDomain *embeddingdomain.DomainService,
	config *CleanupConfig,
	jobRunner lockpkg.SinglePodJobRunner,
	logger *logging.SugaredLogger,
) (*EmbeddingCacheCleanupService, error) {
	if config == nil {
		config = DefaultCleanupConfig()
	}
	if jobRunner == nil {
		return nil, errSinglePodJobRunnerNil
	}

	// 创建调度器（robfig/cron 使用 cron 语法；此处用 @every 动态间隔）
	scheduler := cron.New(cron.WithLocation(time.Local))

	return &EmbeddingCacheCleanupService{
		embeddingDomain: embeddingDomain,
		jobRunner:       jobRunner,
		config:          config,
		scheduler:       scheduler,
		logger:          logger,
	}, nil
}

// StartCleanupDaemon 启动清理守护进程
func (s *EmbeddingCacheCleanupService) StartCleanupDaemon(ctx context.Context) error {
	// 调度清理任务
	if s.config.AutoCleanupEnabled {
		spec := "@every " + s.config.CleanupInterval.String()
		if _, err := s.scheduler.AddFunc(spec, func() {
			if err := s.runScheduledCleanup(ctx); err != nil {
				s.logger.KnowledgeErrorContext(ctx, "Cleanup job failed", logkey.Error, err)
			} else {
				s.logger.InfoContext(ctx, "Completed scheduled cleanup job")
			}
		}); err != nil {
			return fmt.Errorf("failed to schedule cleanup job: %w", err)
		}
	}

	// 启动调度器
	s.scheduler.Start()
	s.logger.DebugContext(ctx, "Embedding cache cleanup daemon started successfully")

	// 等待上下文取消，然后优雅关闭
	<-ctx.Done()
	s.logger.DebugContext(ctx, "Cleanup daemon context cancelled, shutting down...")

	// 优雅关闭
	return s.shutdown(ctx)
}

// ManualCleanup 手动执行清理
func (s *EmbeddingCacheCleanupService) ManualCleanup(ctx context.Context, criteria *embeddingdomain.CacheCleanupCriteria) (*CleanupResult, error) {
	if criteria == nil {
		criteria = s.config.CleanupCriteria
	}

	s.logger.InfoContext(ctx, "Starting manual cache cleanup...")
	start := time.Now()

	// 获取清理前的统计
	beforeStats, err := s.embeddingDomain.GetCacheStatistics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get before cleanup statistics: %w", err)
	}

	// 执行清理
	deletedCount, err := s.embeddingDomain.CleanupExpiredCaches(ctx, criteria)
	if err != nil {
		return nil, fmt.Errorf("cleanup failed: %w", err)
	}

	// 获取清理后的统计
	afterStats, err := s.embeddingDomain.GetCacheStatistics(ctx)
	if err != nil {
		s.logger.KnowledgeWarnContext(ctx, "failed to get after cleanup statistics", logkey.Error, err)
	}

	duration := time.Since(start)

	result := &CleanupResult{
		DeletedCount:    deletedCount,
		Duration:        duration,
		BeforeStats:     beforeStats,
		AfterStats:      afterStats,
		CleanupCriteria: criteria,
		ExecutedAt:      start,
	}

	s.logger.InfoContext(ctx, "Manual cleanup completed", "result", result.String())

	return result, nil
}

// CleanupResult 清理结果
type CleanupResult struct {
	DeletedCount    int64                                 `json:"deleted_count"`
	Duration        time.Duration                         `json:"duration"`
	BeforeStats     *embeddingdomain.CacheStatistics      `json:"before_stats"`
	AfterStats      *embeddingdomain.CacheStatistics      `json:"after_stats"`
	CleanupCriteria *embeddingdomain.CacheCleanupCriteria `json:"cleanup_criteria"`
	ExecutedAt      time.Time                             `json:"executed_at"`
}

// String 返回清理结果的字符串表示
func (r *CleanupResult) String() string {
	sizeBefore := float64(0)
	sizeAfter := float64(0)

	if r.BeforeStats != nil {
		sizeBefore = float64(r.BeforeStats.StorageSizeBytes) / float64(embeddingdomain.BytesPerMB)
	}

	if r.AfterStats != nil {
		sizeAfter = float64(r.AfterStats.StorageSizeBytes) / float64(embeddingdomain.BytesPerMB)
	}

	sizeReduced := sizeBefore - sizeAfter

	return fmt.Sprintf("Deleted %d entries in %v (%.2f MB → %.2f MB, saved %.2f MB)",
		r.DeletedCount, r.Duration, sizeBefore, sizeAfter, sizeReduced)
}

// UpdateCleanupConfig 更新清理配置
func (s *EmbeddingCacheCleanupService) UpdateCleanupConfig(config *CleanupConfig) {
	if config != nil {
		s.config = config
		s.logger.InfoContext(context.Background(), "Updated embedding cache cleanup configuration")
	}
}

// GetCleanupConfig 获取当前清理配置
func (s *EmbeddingCacheCleanupService) GetCleanupConfig() *CleanupConfig {
	return s.config
}

// shutdown 优雅关闭调度器
func (s *EmbeddingCacheCleanupService) shutdown(ctx context.Context) error {
	s.logger.DebugContext(ctx, "Shutting down embedding cache cleanup daemon...")
	s.scheduler.Stop()
	s.logger.DebugContext(ctx, "Embedding cache cleanup daemon stopped successfully")
	return nil
}

func (s *EmbeddingCacheCleanupService) runScheduledCleanup(ctx context.Context) error {
	result, err := s.jobRunner.Run(ctx, lockpkg.SinglePodJobRequest{
		LockKey:        constants.EmbeddingCacheCleanupJobLockKey,
		AcquireTimeout: 2 * time.Second,
	}, s.performScheduledCleanupWithRetry)

	switch result.Status {
	case lockpkg.SinglePodJobStatusSkippedLocked:
		s.logger.DebugContext(ctx, "Skip scheduled cache cleanup because lock is held by another pod", "lock_key", constants.EmbeddingCacheCleanupJobLockKey)
		return nil
	case lockpkg.SinglePodJobStatusSkippedRedisUnavailable:
		fields := []any{"lock_key", constants.EmbeddingCacheCleanupJobLockKey}
		if err != nil {
			fields = append(fields, logkey.Error, err)
		}
		s.logger.KnowledgeWarnContext(ctx, "Skip scheduled cache cleanup because redis lock is unavailable", fields...)
		return nil
	case lockpkg.SinglePodJobStatusAbortedLockLost:
		fields := []any{"lock_key", constants.EmbeddingCacheCleanupJobLockKey}
		if err != nil {
			fields = append(fields, logkey.Error, err)
		}
		s.logger.KnowledgeWarnContext(ctx, "Abort scheduled cache cleanup because lock ownership was lost", fields...)
		return nil
	default:
		if err != nil {
			return fmt.Errorf("run scheduled cleanup with distributed lock: %w", err)
		}
		return nil
	}
}

// performScheduledCleanupWithRetry 执行带重试的计划清理任务
func (s *EmbeddingCacheCleanupService) performScheduledCleanupWithRetry(ctx context.Context) error {
	const maxRetries = 3
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		cleanupCtx, cancel := context.WithTimeout(ctx, s.config.CleanupTimeout)

		s.logger.InfoContext(ctx, "Starting scheduled cache cleanup", "attempt", attempt, "max", maxRetries)
		start := time.Now()

		deletedCount, err := s.embeddingDomain.CleanupExpiredCaches(cleanupCtx, s.config.CleanupCriteria)
		cancel()

		if err != nil {
			lastErr = err
			s.logger.KnowledgeErrorContext(ctx, "Cleanup attempt failed", "attempt", attempt, logkey.Error, err)

			if attempt < maxRetries {
				waitTime := time.Duration(attempt*attempt) * time.Second // 指数退避
				s.logger.InfoContext(ctx, "Retrying cleanup", "wait", waitTime)
				select {
				case <-ctx.Done():
					if errors.Is(context.Cause(ctx), lockpkg.ErrSinglePodJobLockLost) {
						return lockpkg.ErrSinglePodJobLockLost
					}
					return fmt.Errorf("operation cancelled during cleanup retry wait: %w", ctx.Err())
				case <-time.After(waitTime):
					continue
				}
			}
			continue
		}

		duration := time.Since(start)
		s.logger.InfoContext(ctx, "Scheduled cleanup completed", "duration", duration, "deleted", deletedCount)
		return nil
	}

	return fmt.Errorf("cleanup failed after %d attempts: %w", maxRetries, lastErr)
}
