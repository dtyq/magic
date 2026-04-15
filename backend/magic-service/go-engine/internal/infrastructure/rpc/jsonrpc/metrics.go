// Package ipcrpc 提供 JSON-RPC 2.0 over UDS 服务器实现
package ipcrpc

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type metricsFactory interface {
	NewCounterVec(opts prometheus.CounterOpts, labelNames []string) *prometheus.CounterVec
	NewHistogramVec(opts prometheus.HistogramOpts, labelNames []string) *prometheus.HistogramVec
	NewGauge(opts prometheus.GaugeOpts) prometheus.Gauge
	NewCounter(opts prometheus.CounterOpts) prometheus.Counter
}

// Metrics IPC 指标集合
type Metrics struct {
	RPCCallsTotal          *prometheus.CounterVec
	RPCCallDuration        *prometheus.HistogramVec
	RPCActiveConnections   prometheus.Gauge
	RPCPendingRequests     prometheus.Gauge
	RPCOversizeFrames      prometheus.Counter
	RPCOversizeBytes       prometheus.Counter
	RPCOversizeDisconnects prometheus.Counter
}

// NewMetrics 创建新的指标集合
// 注意：promauto 会自动注册指标，如果在同一个进程中多次调用此函数（例如测试中创建多个 Server），
// 可能会导致 duplicate metrics 恐慌。
// 在生产环境中 Server 通常是单例的，或者应该改进为接受 Registerer。
func NewMetrics() *Metrics {
	return newMetricsWithFactory(promauto.With(prometheus.DefaultRegisterer))
}

func newMetricsWithFactory(factory metricsFactory) *Metrics {
	return &Metrics{
		RPCCallsTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "rpc_calls_total",
				Help:      "RPC 调用总数",
			},
			[]string{"method", "direction", "status"},
		),

		RPCCallDuration: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "rpc_call_duration_seconds",
				Help:      "RPC 调用耗时",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			},
			[]string{"method", "direction"},
		),

		RPCActiveConnections: factory.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "rpc_active_connections",
				Help:      "当前活跃的 RPC 连接数",
			},
		),

		RPCPendingRequests: factory.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "rpc_pending_requests",
				Help:      "当前等待响应的 RPC 请求数",
			},
		),

		RPCOversizeFrames: factory.NewCounter(
			prometheus.CounterOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "oversize_frames_total",
				Help:      "超限帧总数",
			},
		),
		RPCOversizeBytes: factory.NewCounter(
			prometheus.CounterOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "oversize_bytes_total",
				Help:      "超限帧总字节数",
			},
		),
		RPCOversizeDisconnects: factory.NewCounter(
			prometheus.CounterOpts{
				Namespace: "magic",
				Subsystem: "ipc",
				Name:      "oversize_disconnects_total",
				Help:      "超限导致的断开次数",
			},
		),
	}
}

// Direction 常量
const (
	DirectionRecv = "recv" // PHP -> Go（接收）
	DirectionSend = "send" // Go -> PHP（发送）
)

// Status 常量
const (
	StatusSuccess = "success"
	StatusError   = "error"
	StatusTimeout = "timeout"
)
