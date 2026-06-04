package service

import (
	"time"

	"github.com/redis/go-redis/v9"

	socketioapp "magic/internal/application/socketio"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/lock"
)

// ProvideOpsRPCService 组装运维 RPC 服务。
func ProvideOpsRPCService(
	cfg *autoloadcfg.Config,
	redisClient *redis.Client,
	lockManager *lock.RedisLockManager,
	officialChecker OfficialOrganizationMemberChecker,
	logger *logging.SugaredLogger,
) *OpsRPCService {
	opts := socketioapp.RedisCleanupOptions{}
	if cfg != nil {
		opts.ExtraAllowedPrefixes = cfg.Redis.SocketIOCleanupAllowedPrefixes
		opts.CountMax = cfg.Redis.SocketIOCleanupCountMax
		opts.HeartbeatInterval = time.Duration(cfg.Redis.SocketIOCleanupHeartbeatSeconds) * time.Second
		opts.StaleThreshold = time.Duration(cfg.Redis.SocketIOCleanupStaleSeconds) * time.Second
		opts.StateTTL = time.Duration(cfg.Redis.SocketIOCleanupStateTTLSeconds) * time.Second
	}
	opts.Logger = logger
	cleaner := socketioapp.NewRedisCleanupManager(redisClient, lockManager, opts)
	return NewOpsRPCService(cleaner, officialChecker, logger)
}
