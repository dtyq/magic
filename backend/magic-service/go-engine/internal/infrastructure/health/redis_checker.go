package health

import (
	"context"
	"fmt"
)

// RedisHealthChecker 实现 Redis 连接健康检查
type RedisHealthChecker struct {
	client RedisPinger // 使用接口解耦
}

// RedisPinger 定义需要的 Ping 方法
type RedisPinger interface {
	Ping(ctx context.Context) error
}

// NewRedisHealthChecker 创建 Redis 健康检查器
func NewRedisHealthChecker(client RedisPinger) *RedisHealthChecker {
	return &RedisHealthChecker{client: client}
}

// HealthCheck 执行 Redis Ping 健康检查
func (c *RedisHealthChecker) HealthCheck(ctx context.Context) error {
	if err := c.client.Ping(ctx); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}
	return nil
}
