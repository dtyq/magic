package qdrant_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

func TestClientGetCollectionInfoFallsBackToRESTPointsCount(t *testing.T) {
	t.Parallel()

	var requestedPath string
	var requestedAPIKey string

	client := newClientWithClients(
		defaultMaxConcurrentWritesForTest,
		fakeCollectionsClient{
			getFn: func(_ context.Context, _ *pb.GetCollectionInfoRequest, _ ...grpc.CallOption) (*pb.GetCollectionInfoResponse, error) {
				return &pb.GetCollectionInfoResponse{
					Result: fallbackCollectionInfo(0),
				}, nil
			},
		},
		fakePointsClient{
			upsertFn: func(_ context.Context, _ *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
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
	qdrantpkg.SetProbeBaseURIForTest(client, "http://127.0.0.1:6333")
	qdrantpkg.SetHTTPClientForTest(client, &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			requestedPath = req.URL.Path
			requestedAPIKey = req.Header.Get("api-key")
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"result":{"points_count":3}}`)),
			}, nil
		}),
	})

	info, err := client.GetCollectionInfo(context.Background(), "magic_knowledge_shadow")
	if err != nil {
		t.Fatalf("GetCollectionInfo() error = %v", err)
	}
	if info.Points != 3 {
		t.Fatalf("expected REST fallback points=3, got %+v", info)
	}
	if requestedPath != "/collections/magic_knowledge_shadow" {
		t.Fatalf("unexpected fallback path: %q", requestedPath)
	}
	if requestedAPIKey != "api-key" {
		t.Fatalf("expected api-key header to be forwarded, got %q", requestedAPIKey)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func fallbackCollectionInfo(points uint64) *pb.CollectionInfo {
	return &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_ParamsMap{
						ParamsMap: &pb.VectorParamsMap{
							Map: map[string]*pb.VectorParams{
								fragmodel.DefaultDenseVectorName: {
									Size:     4,
									Distance: pb.Distance_Cosine,
								},
							},
						},
					},
				},
				SparseVectorsConfig: &pb.SparseVectorConfig{
					Map: map[string]*pb.SparseVectorParams{
						fragmodel.DefaultSparseVectorName: {},
					},
				},
			},
		},
		PointsCount: &points,
	}
}
