package health

import (
	"context"
	"fmt"
)

// MySQLHealthChecker 实现 MySQL 连接健康检查
type MySQLHealthChecker struct {
	db PingContexter // 使用接口解耦，方便测试
}

// PingContexter 定义需要的 Ping 方法
type PingContexter interface {
	PingContext(ctx context.Context) error
}

// NewMySQLHealthChecker 创建 MySQL 健康检查器
func NewMySQLHealthChecker(db PingContexter) *MySQLHealthChecker {
	return &MySQLHealthChecker{db: db}
}

// HealthCheck 执行 MySQL Ping 健康检查
func (c *MySQLHealthChecker) HealthCheck(ctx context.Context) error {
	if err := c.db.PingContext(ctx); err != nil {
		return fmt.Errorf("mysql ping failed: %w", err)
	}
	return nil
}
