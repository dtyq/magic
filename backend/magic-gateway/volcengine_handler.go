package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// VolcengineAPMHandler 处理火山全栈可观测平台的请求转换
type VolcengineAPMHandler struct {
	endpoint string
	appKey   string
}

// NewVolcengineAPMHandler 创建新的火山可观测平台处理器
func NewVolcengineAPMHandler(endpoint, appKey string) *VolcengineAPMHandler {
	return &VolcengineAPMHandler{
		endpoint: endpoint,
		appKey:   appKey,
	}
}

// decompressIfNeeded 检查并解压缩请求体（如果需要）
func decompressIfNeeded(r *http.Request, bodyBytes []byte) ([]byte, error) {
	// 检查 Content-Encoding 头
	encoding := r.Header.Get("Content-Encoding")

	if encoding == "gzip" {
		if debugMode {
			logger.Printf("检测到 gzip 压缩，开始解压缩...")
		}
		reader, err := gzip.NewReader(bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("创建 gzip reader 失败: %w", err)
		}
		defer reader.Close()

		decompressed, err := io.ReadAll(reader)
		if err != nil {
			return nil, fmt.Errorf("解压缩失败: %w", err)
		}

		if debugMode {
			logger.Printf("解压缩成功: %d bytes -> %d bytes", len(bodyBytes), len(decompressed))
		}
		return decompressed, nil
	}

	// 尝试自动检测 gzip 格式（即使没有 Content-Encoding 头）
	// gzip 文件魔数是 0x1f 0x8b
	if len(bodyBytes) >= 2 && bodyBytes[0] == 0x1f && bodyBytes[1] == 0x8b {
		if debugMode {
			logger.Printf("检测到 gzip 魔数，尝试解压缩...")
		}
		reader, err := gzip.NewReader(bytes.NewReader(bodyBytes))
		if err != nil {
			// 如果解压失败，返回原始数据
			if debugMode {
				logger.Printf("gzip 解压失败，使用原始数据: %v", err)
			}
			return bodyBytes, nil
		}
		defer reader.Close()

		decompressed, err := io.ReadAll(reader)
		if err != nil {
			// 如果解压失败，返回原始数据
			if debugMode {
				logger.Printf("gzip 解压失败，使用原始数据: %v", err)
			}
			return bodyBytes, nil
		}

		if debugMode {
			logger.Printf("自动解压缩成功: %d bytes -> %d bytes", len(bodyBytes), len(decompressed))
		}
		return decompressed, nil
	}

	// 不需要解压缩
	return bodyBytes, nil
}

// isVolcengineAPMDomain 检查域名是否是火山全栈可观测平台
func isVolcengineAPMDomain(domain string) bool {
	// 提取域名部分（去除协议和路径）
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	if idx := strings.Index(domain, "/"); idx > 0 {
		domain = domain[:idx]
	}

	// 检查是否匹配火山可观测平台域名
	return strings.Contains(domain, "apmplus-cn-beijing.volces.com")
}

// HandleVolcengineAPMRequest 处理火山可观测平台的请求
// 将 HTTP 请求转换为 gRPC 请求
func (h *VolcengineAPMHandler) HandleVolcengineAPMRequest(
	w http.ResponseWriter,
	r *http.Request,
	targetURL string,
	bodyBytes []byte,
) error {
	// 先检查并解压缩请求体
	decompressed, err := decompressIfNeeded(r, bodyBytes)
	if err != nil {
		logger.Printf("解压缩请求失败: %v", err)
		return fmt.Errorf("解压缩请求失败: %w", err)
	}
	bodyBytes = decompressed

	// 判断请求类型（先从 URL 路径判断）
	requestType := h.detectRequestType(r.URL.Path)

	if debugMode {
		logger.Printf("从URL检测到类型: %s，准备智能检测实际类型...", requestType)
	}

	// 如果 URL 无法判断类型，尝试智能检测
	if requestType == "trace" && !strings.Contains(strings.ToLower(r.URL.Path), "trace") {
		// 尝试通过解析请求体来判断类型
		detectedType := h.detectRequestTypeFromBody(bodyBytes, r.Header.Get("Content-Type"))
		if detectedType != "" {
			requestType = detectedType
			if debugMode {
				logger.Printf("通过请求体智能检测到类型: %s", requestType)
			}
		}
	}

	if debugMode {
		logger.Printf("最终确定请求类型: %s", requestType)
	}

	// 根据请求类型进行不同的处理
	switch requestType {
	case "trace":
		return h.handleTraceRequest(w, r, bodyBytes)
	case "metrics":
		return h.handleMetricsRequest(w, r, bodyBytes)
	case "logs":
		return h.handleLogsRequest(w, r, bodyBytes)
	default:
		return fmt.Errorf("不支持的请求类型: %s", requestType)
	}
}

// detectRequestType 从URL路径中检测请求类型
func (h *VolcengineAPMHandler) detectRequestType(path string) string {
	path = strings.ToLower(path)

	if strings.Contains(path, "/v1/traces") || strings.Contains(path, "trace") {
		return "trace"
	}
	if strings.Contains(path, "/v1/metrics") || strings.Contains(path, "metric") {
		return "metrics"
	}
	if strings.Contains(path, "/v1/logs") || strings.Contains(path, "log") {
		return "logs"
	}

	// 默认返回trace
	return "trace"
}

// detectRequestTypeFromBody 通过尝试解析请求体来智能检测类型
func (h *VolcengineAPMHandler) detectRequestTypeFromBody(bodyBytes []byte, contentType string) string {
	if len(bodyBytes) == 0 {
		return ""
	}

	// 根据 Content-Type 决定使用哪种解析方式
	isJSON := strings.Contains(contentType, "application/json")

	// 尝试解析为 Metrics（最常见）
	if isJSON {
		var metricsRequest colmetricspb.ExportMetricsServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &metricsRequest); err == nil {
			// 检查是否有有效的 metrics 数据
			if len(metricsRequest.ResourceMetrics) > 0 {
				return "metrics"
			}
		}
	} else {
		var metricsRequest colmetricspb.ExportMetricsServiceRequest
		if err := proto.Unmarshal(bodyBytes, &metricsRequest); err == nil {
			// 检查是否有有效的 metrics 数据
			if len(metricsRequest.ResourceMetrics) > 0 {
				return "metrics"
			}
		}
	}

	// 尝试解析为 Trace
	if isJSON {
		var traceRequest coltracepb.ExportTraceServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &traceRequest); err == nil {
			// 检查是否有有效的 trace 数据
			if len(traceRequest.ResourceSpans) > 0 {
				return "trace"
			}
		}
	} else {
		var traceRequest coltracepb.ExportTraceServiceRequest
		if err := proto.Unmarshal(bodyBytes, &traceRequest); err == nil {
			// 检查是否有有效的 trace 数据
			if len(traceRequest.ResourceSpans) > 0 {
				return "trace"
			}
		}
	}

	// 尝试解析为 Logs
	if isJSON {
		var logsRequest collogspb.ExportLogsServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &logsRequest); err == nil {
			// 检查是否有有效的 logs 数据
			if len(logsRequest.ResourceLogs) > 0 {
				return "logs"
			}
		}
	} else {
		var logsRequest collogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(bodyBytes, &logsRequest); err == nil {
			// 检查是否有有效的 logs 数据
			if len(logsRequest.ResourceLogs) > 0 {
				return "logs"
			}
		}
	}

	// 无法检测
	return ""
}

// handleTraceRequest 处理trace请求
func (h *VolcengineAPMHandler) handleTraceRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var traceRequest coltracepb.ExportTraceServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		// JSON 格式
		if err := protojson.Unmarshal(bodyBytes, &traceRequest); err != nil {
			logger.Printf("解析trace请求失败(JSON): %v", err)
			return fmt.Errorf("解析trace请求失败(JSON): %w", err)
		}
		if debugMode {
			logger.Printf("使用JSON格式解析trace请求")
		}
	} else {
		// Protobuf 二进制格式（默认）
		if err := proto.Unmarshal(bodyBytes, &traceRequest); err != nil {
			logger.Printf("解析trace请求失败(Protobuf): %v", err)
			return fmt.Errorf("解析trace请求失败(Protobuf): %w", err)
		}
		if debugMode {
			logger.Printf("使用Protobuf格式解析trace请求")
		}
	}

	// 创建gRPC连接，并设置header
	md := metadata.New(map[string]string{
		"x-byteapm-appkey": h.appKey,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	conn, err := grpc.Dial(
		h.endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Printf("创建gRPC连接失败: %v", err)
		return fmt.Errorf("创建gRPC连接失败: %w", err)
	}
	defer conn.Close()

	// 创建trace服务客户端
	client := coltracepb.NewTraceServiceClient(conn)

	// 发送gRPC请求
	resp, err := client.Export(ctx, &traceRequest)
	if err != nil {
		logger.Printf("发送trace gRPC请求失败: %v", err)
		return fmt.Errorf("发送trace gRPC请求失败: %w", err)
	}

	// 将gRPC响应转换为HTTP响应
	return h.writeJSONResponse(w, resp)
}

// handleMetricsRequest 处理metrics请求
func (h *VolcengineAPMHandler) handleMetricsRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var metricsRequest colmetricspb.ExportMetricsServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		// JSON 格式
		if err := protojson.Unmarshal(bodyBytes, &metricsRequest); err != nil {
			logger.Printf("解析metrics请求失败(JSON): %v", err)
			return fmt.Errorf("解析metrics请求失败(JSON): %w", err)
		}
		if debugMode {
			logger.Printf("使用JSON格式解析metrics请求")
		}
	} else {
		// Protobuf 二进制格式（默认）
		if err := proto.Unmarshal(bodyBytes, &metricsRequest); err != nil {
			logger.Printf("解析metrics请求失败(Protobuf): %v", err)
			return fmt.Errorf("解析metrics请求失败(Protobuf): %w", err)
		}
		if debugMode {
			logger.Printf("使用Protobuf格式解析metrics请求")
		}
	}

	// 创建gRPC连接，并设置header
	md := metadata.New(map[string]string{
		"x-byteapm-appkey": h.appKey,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	conn, err := grpc.Dial(
		h.endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Printf("创建gRPC连接失败: %v", err)
		return fmt.Errorf("创建gRPC连接失败: %w", err)
	}
	defer conn.Close()

	// 创建metrics服务客户端
	client := colmetricspb.NewMetricsServiceClient(conn)

	// 发送gRPC请求
	resp, err := client.Export(ctx, &metricsRequest)
	if err != nil {
		logger.Printf("发送metrics gRPC请求失败: %v", err)
		return fmt.Errorf("发送metrics gRPC请求失败: %w", err)
	}

	// 将gRPC响应转换为HTTP响应
	return h.writeJSONResponse(w, resp)
}

// handleLogsRequest 处理logs请求
func (h *VolcengineAPMHandler) handleLogsRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var logsRequest collogspb.ExportLogsServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		// JSON 格式
		if err := protojson.Unmarshal(bodyBytes, &logsRequest); err != nil {
			logger.Printf("解析logs请求失败(JSON): %v", err)
			return fmt.Errorf("解析logs请求失败(JSON): %w", err)
		}
		if debugMode {
			logger.Printf("使用JSON格式解析logs请求")
		}
	} else {
		// Protobuf 二进制格式（默认）
		if err := proto.Unmarshal(bodyBytes, &logsRequest); err != nil {
			logger.Printf("解析logs请求失败(Protobuf): %v", err)
			return fmt.Errorf("解析logs请求失败(Protobuf): %w", err)
		}
		if debugMode {
			logger.Printf("使用Protobuf格式解析logs请求")
		}
	}

	// 创建gRPC连接，并设置header
	md := metadata.New(map[string]string{
		"x-byteapm-appkey": h.appKey,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	conn, err := grpc.Dial(
		h.endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Printf("创建gRPC连接失败: %v", err)
		return fmt.Errorf("创建gRPC连接失败: %w", err)
	}
	defer conn.Close()

	// 创建logs服务客户端
	client := collogspb.NewLogsServiceClient(conn)

	// 发送gRPC请求
	resp, err := client.Export(ctx, &logsRequest)
	if err != nil {
		logger.Printf("发送logs gRPC请求失败: %v", err)
		return fmt.Errorf("发送logs gRPC请求失败: %w", err)
	}

	// 将gRPC响应转换为HTTP响应
	return h.writeJSONResponse(w, resp)
}

// writeJSONResponse 将响应写入HTTP ResponseWriter
func (h *VolcengineAPMHandler) writeJSONResponse(w http.ResponseWriter, resp interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	respBytes, err := json.Marshal(resp)
	if err != nil {
		logger.Printf("序列化响应失败: %v", err)
		return fmt.Errorf("序列化响应失败: %w", err)
	}

	if _, err := w.Write(respBytes); err != nil {
		logger.Printf("写入响应失败: %v", err)
		return fmt.Errorf("写入响应失败: %w", err)
	}

	return nil
}

// GetVolcengineAPMConfig 从环境变量获取火山可观测平台配置
func GetVolcengineAPMConfig() (endpoint string, appKey string, ok bool) {
	// 从环境变量获取配置
	endpoint = getEnvWithDefault("VOLCENGINE_APM_ENDPOINT", "apmplus-cn-beijing.ivolces.com:4317")
	appKey = getEnvWithDefault("VOLCENGINE_APM_APPKEY", "")

	// 如果没有配置AppKey，则返回false
	if appKey == "" {
		// 尝试从OTEL配置中获取
		if otelHeaders := getEnvWithDefault("OTEL_EXPORTER_OTLP_HEADERS", ""); otelHeaders != "" {
			// 解析OTEL_EXPORTER_OTLP_HEADERS获取X-ByteAPM-AppKey
			if strings.Contains(otelHeaders, "X-ByteAPM-AppKey=") {
				parts := strings.Split(otelHeaders, "=")
				if len(parts) >= 2 {
					appKey = strings.TrimSpace(parts[1])
					// 去除可能的逗号、分号等分隔符
					if idx := strings.IndexAny(appKey, ",;"); idx > 0 {
						appKey = appKey[:idx]
					}
				}
			}
		}
	}

	ok = appKey != ""
	return
}

// ShouldUseVolcengineAPMHandler 检查是否应该使用火山可观测平台处理器
func ShouldUseVolcengineAPMHandler(targetURL string) bool {
	return isVolcengineAPMDomain(targetURL)
}
