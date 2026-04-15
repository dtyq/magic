package qdrant_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

type restSparseVector struct {
	Indices []uint32  `json:"indices"`
	Values  []float32 `json:"values"`
}

type restPointWriteRequest struct {
	ID      string                     `json:"id"`
	Vector  map[string]json.RawMessage `json:"vector"`
	Payload map[string]any             `json:"payload"`
}

type restPointsWriteRequest struct {
	Points []restPointWriteRequest `json:"points"`
}

type restWriteCapture struct {
	Method string
	Path   string
	Query  string
	APIKey string
	Body   restPointsWriteRequest
}

func TestClientStoreHybridPointsUsesRESTForLegacySparseWrites(t *testing.T) {
	t.Parallel()

	capture, server := newLegacyRESTWriteServer(t)
	defer server.Close()

	client := newRESTWriteTestClient(t, server.URL, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.9.3",
		QuerySupported:    false,
		SelectedSparseAPI: "legacy_search",
		ProbeStatus:       "ready",
	}, grpcTransportExpectation{
		expectCall: false,
	})
	err := client.StoreHybridPoints(
		context.Background(),
		"magic_knowledge_shadow",
		[]string{"11111111-1111-1111-1111-111111111111"},
		[][]float64{{0.1, 0.2, 0.3, 0.4}},
		[]*fragmodel.SparseInput{{
			Vector: &fragmodel.SparseVector{
				Indices: []uint32{1, 3, 5},
				Values:  []float32{1, 0.5, 0.25},
			},
		}},
		[]map[string]any{{"title": "rest"}},
	)
	if err != nil {
		t.Fatalf("StoreHybridPoints() error = %v", err)
	}

	assertLegacyRESTWriteRequest(t, capture)
}

func TestClientStoreHybridPointsKeepsGRPCForModernVersions(t *testing.T) {
	t.Parallel()

	capture, server := newLegacyRESTWriteServer(t)
	defer server.Close()

	grpcCalls := 0
	client := newRESTWriteTestClient(t, server.URL, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.12.2",
		QuerySupported:    false,
		SelectedSparseAPI: "legacy_search",
		ProbeStatus:       "ready",
	}, grpcTransportExpectation{
		expectCall: true,
		onUpsert: func(_ context.Context, in *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			grpcCalls++
			if in.GetCollectionName() != "magic_knowledge_shadow" {
				t.Fatalf("unexpected grpc collection: %q", in.GetCollectionName())
			}
			if len(in.GetPoints()) != 1 {
				t.Fatalf("expected 1 grpc point, got %d", len(in.GetPoints()))
			}
			return &pb.PointsOperationResponse{}, nil
		},
	})

	err := client.StoreHybridPoints(
		context.Background(),
		"magic_knowledge_shadow",
		[]string{"11111111-1111-1111-1111-111111111111"},
		[][]float64{{0.1, 0.2, 0.3, 0.4}},
		[]*fragmodel.SparseInput{{
			Vector: &fragmodel.SparseVector{
				Indices: []uint32{1, 3, 5},
				Values:  []float32{1, 0.5, 0.25},
			},
		}},
		[]map[string]any{{"title": "grpc"}},
	)
	if err != nil {
		t.Fatalf("StoreHybridPoints() error = %v", err)
	}
	if grpcCalls != 1 {
		t.Fatalf("expected grpc upsert to be used once, got %d", grpcCalls)
	}
	if capture.Method != "" || capture.Path != "" {
		t.Fatalf("expected no REST write request, got method=%q path=%q", capture.Method, capture.Path)
	}
}

func newLegacyRESTWriteServer(t *testing.T) (*restWriteCapture, *httptest.Server) {
	t.Helper()

	capture := &restWriteCapture{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capture.Method = r.Method
		capture.Path = r.URL.Path
		capture.Query = r.URL.RawQuery
		capture.APIKey = r.Header.Get("api-key")

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("ReadAll() error = %v", err)
		}
		if err := json.Unmarshal(body, &capture.Body); err != nil {
			t.Fatalf("Unmarshal() error = %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","result":{"operation_id":1,"status":"completed"}}`))
	}))
	return capture, server
}

type grpcTransportExpectation struct {
	expectCall bool
	onUpsert   func(context.Context, *pb.UpsertPoints, ...grpc.CallOption) (*pb.PointsOperationResponse, error)
}

func newRESTWriteTestClient(
	t *testing.T,
	baseURI string,
	snapshot qdrantpkg.CapabilitySnapshotForTest,
	expectation grpcTransportExpectation,
) *qdrantpkg.Client {
	t.Helper()

	client := newClientWithClients(
		1,
		newDefaultCollectionsClient(),
		fakePointsClient{
			upsertFn: func(ctx context.Context, in *pb.UpsertPoints, opts ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				if expectation.onUpsert != nil {
					return expectation.onUpsert(ctx, in, opts...)
				}
				if expectation.expectCall {
					return &pb.PointsOperationResponse{}, nil
				}
				return nil, status.Error(codes.Internal, "grpc upsert should not be used for legacy sparse write fallback")
			},
			deleteFn: func(_ context.Context, _ *pb.DeletePoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
			getFn: func(_ context.Context, _ *pb.GetPoints, _ ...grpc.CallOption) (*pb.GetResponse, error) {
				return &pb.GetResponse{}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				return &pb.SearchResponse{}, nil
			},
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				return &pb.QueryResponse{}, nil
			},
		},
	)
	qdrantpkg.SetProbeBaseURIForTest(client, baseURI)
	qdrantpkg.SetCapabilityForTest(client, snapshot)
	return client
}

func assertLegacyRESTWriteRequest(t *testing.T, capture *restWriteCapture) {
	t.Helper()

	if capture.Method != http.MethodPut {
		t.Fatalf("expected PUT request, got %q", capture.Method)
	}
	if capture.Path != "/collections/magic_knowledge_shadow/points" {
		t.Fatalf("unexpected request path: %q", capture.Path)
	}
	if capture.Query != "wait=true" {
		t.Fatalf("unexpected request query: %q", capture.Query)
	}
	if capture.APIKey != "api-key" {
		t.Fatalf("expected api-key header to be forwarded, got %q", capture.APIKey)
	}
	if len(capture.Body.Points) != 1 {
		t.Fatalf("expected 1 point, got %d", len(capture.Body.Points))
	}

	point := capture.Body.Points[0]
	if point.ID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("unexpected point id: %q", point.ID)
	}
	if got := point.Payload["title"]; got != "rest" {
		t.Fatalf("unexpected payload title: %#v", got)
	}

	assertLegacyDenseVector(t, point.Vector[fragmodel.DefaultDenseVectorName])
	assertLegacySparseVector(t, point.Vector[fragmodel.DefaultSparseVectorName])
}

func assertLegacyDenseVector(t *testing.T, raw json.RawMessage) {
	t.Helper()

	var dense []float64
	if err := json.Unmarshal(raw, &dense); err != nil {
		t.Fatalf("unmarshal dense vector: %v", err)
	}
	if len(dense) != 4 || dense[0] != 0.1 || dense[3] != 0.4 {
		t.Fatalf("unexpected dense vector: %#v", dense)
	}
}

func assertLegacySparseVector(t *testing.T, raw json.RawMessage) {
	t.Helper()

	var sparse restSparseVector
	if err := json.Unmarshal(raw, &sparse); err != nil {
		t.Fatalf("unmarshal sparse vector: %v", err)
	}
	if len(sparse.Indices) != 3 || sparse.Indices[1] != 3 {
		t.Fatalf("unexpected sparse indices: %#v", sparse.Indices)
	}
	if len(sparse.Values) != 3 || sparse.Values[2] != 0.25 {
		t.Fatalf("unexpected sparse values: %#v", sparse.Values)
	}
}
