//go:build e2e && external

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	autoloadcfg "magic/internal/config/autoload"
)

// getBaseURL 返回目标服务的 base URL，默认 http://localhost:8080
func getBaseURL(t *testing.T) string {
	cfg := &autoloadcfg.Config{}
	host := cfg.Server.Host
	if host == "" {
		host = "localhost"
	}
	port := cfg.Server.Port
	if port == 0 {
		port = 8080
	}
	base := fmt.Sprintf("http://%s:%d", host, port)
	if v := os.Getenv("E2E_BASE_URL"); v != "" {
		base = v
	}
	return base
}

func waitHealthy(t *testing.T, base string, timeout time.Duration) {
	t.Helper()
	t.Logf("等待 %s/health 健康检查，超时时间 %s", base, timeout)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(base + "/health")
		if err == nil && resp.StatusCode == http.StatusOK {
			_ = resp.Body.Close()
			t.Log("健康检查通过")
			return
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
		time.Sleep(2 * time.Second)
	}
	t.Fatalf("server not healthy within %s", timeout)
}

func getenvDefault(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func TestMemoryAPIEndToEndDemoScenarioAndSearch(t *testing.T) {
	base := getBaseURL(t)
	t.Logf("使用服务地址: %s", base)
	waitHealthy(t, base, 60*time.Second)

	// 1) 通过 CLI 命令准备示例数据
	t.Log("步骤1: 运行 demo_data_init 命令初始化示例数据")
	// 这里仅保留占位说明：实际CI中应在服务启动前调用 `go run ./cmd/demo_data_init` 或可执行文件

	// 2) 搜索：/api/v1/search/user-projects
	t.Log("步骤2: 调用 /api/v1/search/user-projects 进行搜索")
	payload := map[string]any{
		"user_name":    "小明",
		"org_id":       "demo_org",
		"fuzzy_search": false,
	}
	b, _ := json.Marshal(payload)
	resp2, err := http.Post(base+"/api/v1/search/user-projects", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("search error: %v", err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("search status=%d", resp2.StatusCode)
	}

	// 2.5) 可选真实 embedding 写入（未配置 embedding 服务可能失败）
	t.Log("步骤2.5: 调用 /api/v1/memory/ingest 进行向量写入 (可选)")
	ingest := map[string]any{"content": "Hello vector world", "model": os.Getenv("EMBEDDING_MODEL")}
	if ingest["model"] == "" {
		ingest["model"] = "text-embedding-3-small"
	}
	ib, _ := json.Marshal(ingest)
	respIng, err := http.Post(base+"/api/v1/memory/ingest", "application/json", bytes.NewReader(ib))
	if err == nil {
		_ = respIng.Body.Close()
	} // 尽力而为，embedding 不可用不失败

	// 4) 通过 gRPC 进行真实的 Qdrant 向量搜索（创建临时集合并搜索）
	t.Log("步骤4: 使用 Qdrant gRPC 验证向量搜索")
	qHost := getenvDefault("QDRANT_HOST", "localhost")
	qPort := getenvDefault("QDRANT_PORT", "6334")
	cc, err := grpc.Dial(qHost+":"+qPort, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("qdrant dial: %v", err)
	}
	defer cc.Close()
	col := qdrant.NewCollectionsClient(cc)
	pts := qdrant.NewPointsClient(cc)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	collName := "e2e_test_vec"
	_, _ = col.Create(ctx, &qdrant.CreateCollection{CollectionName: collName, VectorsConfig: &qdrant.VectorsConfig{Config: &qdrant.VectorsConfig_Params{Params: &qdrant.VectorParams{Size: 3, Distance: qdrant.Distance_Cosine}}}})
	_, err = pts.Upsert(ctx, &qdrant.UpsertPoints{CollectionName: collName, Points: []*qdrant.PointStruct{
		{Id: &qdrant.PointId{PointIdOptions: &qdrant.PointId_Uuid{Uuid: "p1"}}, Vectors: &qdrant.Vectors{VectorsOptions: &qdrant.Vectors_Vector{Vector: &qdrant.Vector{Data: []float32{1, 0, 0}}}}},
		{Id: &qdrant.PointId{PointIdOptions: &qdrant.PointId_Uuid{Uuid: "p2"}}, Vectors: &qdrant.Vectors{VectorsOptions: &qdrant.Vectors_Vector{Vector: &qdrant.Vector{Data: []float32{0, 1, 0}}}}},
	}})
	if err != nil {
		t.Fatalf("qdrant upsert: %v", err)
	}
	sres, err := pts.Search(ctx, &qdrant.SearchPoints{CollectionName: collName, Vector: []float32{1, 0, 0}, Limit: 1})
	if err != nil {
		t.Fatalf("qdrant search: %v", err)
	}
	if len(sres.Result) == 0 {
		t.Fatalf("qdrant search got 0 results")
	}
}
