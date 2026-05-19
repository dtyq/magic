// Package health 提供基础设施组件的健康检查服务。
package health

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// 健康检查默认超时
const defaultHealthCheckTimeout = 5 * time.Second

// Checker 定义可进行健康检查的组件接口
type Checker interface {
	HealthCheck(ctx context.Context) error
}

// Closer 定义需要在服务停止时关闭的基础设施资源。
type Closer interface {
	Close(ctx context.Context) error
}

// CheckResult 表示单个组件的健康检查结果
type CheckResult struct {
	Name      string
	Healthy   bool
	Error     error
	Timestamp time.Time
}

// CheckService 负责协调多个基础设施组件的健康检查
type CheckService struct {
	checkers map[string]Checker
	closers  []Closer
}

// NewHealthCheckService 创建带名称的检查器集合
func NewHealthCheckService(checkers map[string]Checker, closers ...Closer) *CheckService {
	return &CheckService{
		checkers: checkers,
		closers:  append([]Closer(nil), closers...),
	}
}

// HealthCheck 对所有注册组件执行健康检查
// 返回组件名称到健康状态的映射（true=健康，false=不健康）
func (s *CheckService) HealthCheck(ctx context.Context) (map[string]bool, error) {
	results := make(map[string]bool)

	for name, checker := range s.checkers {
		// 为每次健康检查设置合理超时
		checkCtx, cancel := context.WithTimeout(ctx, defaultHealthCheckTimeout)

		err := checker.HealthCheck(checkCtx)
		results[name] = err == nil

		cancel()
	}

	return results, nil
}

// HealthCheckDetailed 返回包含错误的详细健康检查结果
func (s *CheckService) HealthCheckDetailed(ctx context.Context) []CheckResult {
	results := make([]CheckResult, 0, len(s.checkers))

	for name, checker := range s.checkers {
		checkCtx, cancel := context.WithTimeout(ctx, defaultHealthCheckTimeout)

		err := checker.HealthCheck(checkCtx)
		results = append(results, CheckResult{
			Name:      name,
			Healthy:   err == nil,
			Error:     err,
			Timestamp: time.Now(),
		})

		cancel()
	}

	return results
}

// Close 关闭所有注册资源，并聚合返回关闭错误。
func (s *CheckService) Close(ctx context.Context) error {
	var errs []error
	for _, closer := range s.closers {
		if closer == nil {
			continue
		}
		if err := closer.Close(ctx); err != nil {
			errs = append(errs, fmt.Errorf("close infra resource: %w", err))
		}
	}
	return joinErrors(errs)
}

func joinErrors(errs []error) error {
	if len(errs) == 0 {
		return nil
	}
	return errors.Join(errs...)
}
