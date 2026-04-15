//go:build e2e && external

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// TestVectorAPIEndToEnd 向量化 API 端到端测试
func TestVectorAPIEndToEnd(t *testing.T) {
	baseURL := getBaseURL(t)
	t.Logf("🚀 开始向量化 API E2E 测试...")
	t.Logf("服务地址: %s", baseURL)

	// 1. 健康检查
	waitHealthy(t, baseURL, 60*time.Second)
	t.Logf("✅ 健康检查通过")

	// 2. 测试内容向量化（严格模式：外部依赖必须通过）
	t.Run("ContentIngest", func(t *testing.T) {
		if !testContentIngest(t, baseURL) {
			t.Fatalf("content ingest failed: strict mode requires external dependencies to pass")
		}
		t.Logf("✅ 内容向量化成功")
	})

	// 3. 测试 URL 向量化（严格模式）
	t.Run("URLIngest", func(t *testing.T) {
		if !testURLIngest(t, baseURL) {
			t.Fatalf("url ingest failed: strict mode requires external dependencies to pass")
		}
		t.Logf("✅ URL 向量化成功")
	})

	// 4. 测试向量搜索（严格模式）
	t.Run("VectorSearch", func(t *testing.T) {
		if !testVectorSearch(t, baseURL) {
			t.Fatalf("vector search failed: strict mode requires external dependencies to pass")
		}
		t.Logf("✅ 向量搜索成功")
	})

	// 5. 测试混合搜索（严格模式）
	t.Run("HybridSearch", func(t *testing.T) {
		if !testHybridSearch(t, baseURL) {
			t.Fatalf("hybrid search failed: strict mode requires external dependencies to pass")
		}
		t.Logf("✅ 混合搜索成功")
	})

	// 6. 验证 Qdrant 中的向量数据（严格模式）
	t.Run("QdrantVerification", func(t *testing.T) {
		if !verifyQdrantVectors(t) {
			t.Fatalf("qdrant verification failed: strict mode requires external dependencies to pass")
		}
		t.Logf("✅ Qdrant 向量验证成功")
	})

	t.Logf("🎉 E2E 测试完成！")
}

// testContentIngest 测试内容向量化
func testContentIngest(t *testing.T, baseURL string) bool {
	t.Helper()

	testCases := []struct {
		name     string
		content  string
		model    string
		expected bool
	}{
		{
			name:     "简单文本",
			content:  "这是一个测试文档，用于验证向量化功能。包含中文和English mixed content.",
			model:    "text-embedding-3-small",
			expected: true,
		},
		{
			name:     "技术文档",
			content:  "Go语言是一种编程语言。它支持并发、垃圾回收和静态类型。常用于构建微服务架构。",
			model:    "text-embedding-3-small",
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Logf("测试内容向量化: %s", tc.name)

		payload := map[string]interface{}{
			"content":    tc.content,
			"model":      tc.model,
			"chunk_size": 500,
			"overlap":    50,
		}

		jsonData, _ := json.Marshal(payload)
		resp, err := http.Post(baseURL+"/api/v1/memory/ingest", "application/json", bytes.NewReader(jsonData))
		if err != nil {
			t.Logf("  请求失败: %v", err)
			if tc.expected {
				return false
			}
			continue
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		t.Logf("  状态码: %d", resp.StatusCode)
		t.Logf("  响应: %s", string(body))

		// 对于嵌入服务，我们允许失败（因为可能没有配置API密钥）
		if resp.StatusCode == http.StatusOK {
			var result map[string]interface{}
			if err := json.Unmarshal(body, &result); err == nil {
				if success, ok := result["success"].(bool); ok && success {
					if chunkCount, ok := result["chunk_count"].(float64); ok {
						t.Logf("  成功处理 %.0f 个文档块", chunkCount)
					}
				}
			}
			return true
		}
	}

	return false // 如果所有测试都失败，返回false
}

// testURLIngest 测试URL向量化
func testURLIngest(t *testing.T, baseURL string) bool {
	t.Helper()

	// 使用一个简单的JSON API作为测试
	testURL := "https://httpbin.org/json"

	payload := map[string]interface{}{
		"url":   testURL,
		"model": "text-embedding-3-small",
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(baseURL+"/api/v1/memory/ingest", "application/json", bytes.NewReader(jsonData))
	if err != nil {
		t.Logf("URL向量化请求失败: %v", err)
		return false
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	t.Logf("URL向量化状态码: %d", resp.StatusCode)
	t.Logf("URL向量化响应: %s", string(body))

	return resp.StatusCode == http.StatusOK
}

// testVectorSearch 测试向量搜索
func testVectorSearch(t *testing.T, baseURL string) bool {
	t.Helper()

	// 使用一个简单的向量进行搜索
	testVector := make([]float64, 1024) // dmeta-embedding 的维度
	for i := range testVector {
		testVector[i] = 0.1 // 简单填充
	}

	payload := map[string]interface{}{
		"org_id":    "test_org",
		"embedding": testVector,
		"top_k":     5,
		"filter":    map[string]interface{}{},
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(baseURL+"/api/v1/memory/vector-search", "application/json", bytes.NewReader(jsonData))
	if err != nil {
		t.Logf("向量搜索请求失败: %v", err)
		return false
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	t.Logf("向量搜索状态码: %d", resp.StatusCode)
	t.Logf("向量搜索响应: %s", string(body))

	return resp.StatusCode == http.StatusOK
}

// testHybridSearch 测试混合搜索
func testHybridSearch(t *testing.T, baseURL string) bool {
	t.Helper()

	testVector := make([]float64, 1024) // dmeta-embedding 的维度
	for i := range testVector {
		testVector[i] = 0.1
	}

	payload := map[string]interface{}{
		"org_id":    "demo_org",
		"embedding": testVector,
		"top_k":     3,
		"cypher":    "MATCH (n) RETURN n LIMIT 5",
		"params":    map[string]interface{}{},
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(baseURL+"/api/v1/memory/hybrid-search", "application/json", bytes.NewReader(jsonData))
	if err != nil {
		t.Logf("混合搜索请求失败: %v", err)
		return false
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	t.Logf("混合搜索状态码: %d", resp.StatusCode)
	t.Logf("混合搜索响应: %s", string(body))

	return resp.StatusCode == http.StatusOK
}

// verifyQdrantVectors 验证 Qdrant 中的向量数据
func verifyQdrantVectors(t *testing.T) bool {
	t.Helper()

	qHost := getenvDefault("QDRANT_HOST", "localhost")
	qPort := getenvDefault("QDRANT_PORT", "6334")

	cc, err := grpc.Dial(qHost+":"+qPort, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Logf("连接 Qdrant 失败: %v", err)
		return false
	}
	defer cc.Close()

	col := qdrant.NewCollectionsClient(cc)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 列出所有集合
	collections, err := col.List(ctx, &qdrant.ListCollectionsRequest{})
	if err != nil {
		t.Logf("列出 Qdrant 集合失败: %v", err)
		return false
	}

	t.Logf("Qdrant 集合列表:")
	for _, coll := range collections.Collections {
		t.Logf("  - %s", coll.Name)

		// 获取集合信息
		info, err := col.Get(ctx, &qdrant.GetCollectionInfoRequest{CollectionName: coll.Name})
		if err == nil {
			t.Logf("    点数: %d", info.Result.PointsCount)
		}
	}

	return true
}

// 注意：getBaseURL, waitHealthy, getenvDefault 函数已在 memory_api_e2e_test.go 中定义
