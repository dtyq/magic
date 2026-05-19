// Package logkey 定义结构化日志键的标准常量和通用格式化工具。
package logkey

import (
	"math"
	"time"
)

const durationMSPrecision = 100

// RoundDurationMS 将毫秒值四舍五入到 2 位小数。
func RoundDurationMS(ms float64) float64 {
	return math.Round(ms*durationMSPrecision) / durationMSPrecision
}

// DurationToMS 将 time.Duration 转换为毫秒并四舍五入到 2 位小数。
func DurationToMS(d time.Duration) float64 {
	return RoundDurationMS(float64(d) / float64(time.Millisecond))
}
