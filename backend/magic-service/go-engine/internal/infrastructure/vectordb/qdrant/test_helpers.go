package qdrant

import (
	"context"
	"strings"

	pb "github.com/qdrant/go-client/qdrant"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

// ExtractVectorSizeForTest 暴露 extractVectorSize 供测试使用。
func ExtractVectorSizeForTest(info *pb.CollectionInfo) (int64, error) {
	return extractVectorSize(info)
}

// ExtractCollectionSchemaForTest 暴露 collection schema 检测逻辑供测试使用。
func ExtractCollectionSchemaForTest(info *pb.CollectionInfo) (bool, bool) {
	return hasNamedDenseVector(info), hasSparseVector(info)
}

// ConvertToQdrantPayloadForTest 暴露 convertToQdrantPayload 供测试使用。
func ConvertToQdrantPayloadForTest(payload map[string]any) map[string]*pb.Value {
	return convertToQdrantPayload(payload)
}

// ExtractPayloadForTest 暴露 extractPayload 供测试使用。
func ExtractPayloadForTest(payload map[string]*pb.Value) map[string]any {
	return extractPayload(payload)
}

// BuildQdrantFilterForTest 暴露 buildQdrantFilter 供测试使用。
func BuildQdrantFilterForTest(filter *fragmodel.VectorFilter) *pb.Filter {
	return buildQdrantFilter(filter)
}

// BuildFieldConditionsForTest 暴露 buildFieldConditions 供测试使用。
func BuildFieldConditionsForTest(filter fragmodel.FieldFilter) []*pb.Condition {
	return buildFieldConditions(filter)
}

// GetStringFromPayloadForTest 暴露 getStringFromPayload 供测试使用。
func GetStringFromPayloadForTest(payload map[string]any, key string) string {
	return getStringFromPayload(payload, key)
}

// GetMapFromPayloadForTest 暴露 getMapFromPayload 供测试使用。
func GetMapFromPayloadForTest(payload map[string]any, key string) map[string]any {
	return getMapFromPayload(payload, key)
}

// AuthContextForTest 暴露鉴权上下文构建逻辑供测试使用。
func AuthContextForTest(ctx context.Context, apiKey string) context.Context {
	client := &Client{apiKey: strings.TrimSpace(apiKey)}
	return client.authContext(ctx)
}
