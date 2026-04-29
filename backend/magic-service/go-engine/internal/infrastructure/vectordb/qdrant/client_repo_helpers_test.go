package qdrant_test

import (
	"context"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

const (
	testCollectionName        = "demo"
	testVectorSize     uint64 = 2
)

func newClientWithClients(writeLimit int, collections pb.CollectionsClient, points pb.PointsClient) *qdrantpkg.Client {
	return qdrantpkg.NewClientForTestWithWriteLimit(collections, points, "api-key", writeLimit)
}

type fakeCollectionsClient struct {
	pb.CollectionsClient
	createFn        fakeUnaryCall[pb.CreateCollection, pb.CollectionOperationResponse]
	listFn          fakeUnaryCall[pb.ListCollectionsRequest, pb.ListCollectionsResponse]
	listAliasesFn   fakeUnaryCall[pb.ListAliasesRequest, pb.ListAliasesResponse]
	updateAliasesFn fakeUnaryCall[pb.ChangeAliases, pb.CollectionOperationResponse]
	getFn           fakeUnaryCall[pb.GetCollectionInfoRequest, pb.GetCollectionInfoResponse]
	deleteFn        fakeUnaryCall[pb.DeleteCollection, pb.CollectionOperationResponse]
}

func (f fakeCollectionsClient) Create(ctx context.Context, in *pb.CreateCollection, opts ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
	return f.createFn(ctx, in, opts...)
}

func (f fakeCollectionsClient) List(ctx context.Context, in *pb.ListCollectionsRequest, opts ...grpc.CallOption) (*pb.ListCollectionsResponse, error) {
	return f.listFn(ctx, in, opts...)
}

func (f fakeCollectionsClient) Get(ctx context.Context, in *pb.GetCollectionInfoRequest, opts ...grpc.CallOption) (*pb.GetCollectionInfoResponse, error) {
	return f.getFn(ctx, in, opts...)
}

func (f fakeCollectionsClient) ListAliases(ctx context.Context, in *pb.ListAliasesRequest, opts ...grpc.CallOption) (*pb.ListAliasesResponse, error) {
	return f.listAliasesFn(ctx, in, opts...)
}

func (f fakeCollectionsClient) UpdateAliases(ctx context.Context, in *pb.ChangeAliases, opts ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
	return f.updateAliasesFn(ctx, in, opts...)
}

func (f fakeCollectionsClient) Delete(ctx context.Context, in *pb.DeleteCollection, opts ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
	return f.deleteFn(ctx, in, opts...)
}

type fakePointsClient struct {
	pb.PointsClient
	upsertFn           fakeUnaryCall[pb.UpsertPoints, pb.PointsOperationResponse]
	deleteFn           fakeUnaryCall[pb.DeletePoints, pb.PointsOperationResponse]
	getFn              fakeUnaryCall[pb.GetPoints, pb.GetResponse]
	searchFn           fakeUnaryCall[pb.SearchPoints, pb.SearchResponse]
	queryFn            fakeUnaryCall[pb.QueryPoints, pb.QueryResponse]
	setPayloadFn       fakeUnaryCall[pb.SetPayloadPoints, pb.PointsOperationResponse]
	createFieldIndexFn fakeUnaryCall[pb.CreateFieldIndexCollection, pb.PointsOperationResponse]
}

type fakeUnaryCall[Req any, Resp any] func(context.Context, *Req, ...grpc.CallOption) (*Resp, error)

func (f fakePointsClient) Upsert(ctx context.Context, in *pb.UpsertPoints, opts ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
	return f.upsertFn(ctx, in, opts...)
}

func (f fakePointsClient) Delete(ctx context.Context, in *pb.DeletePoints, opts ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
	return f.deleteFn(ctx, in, opts...)
}

func (f fakePointsClient) Get(ctx context.Context, in *pb.GetPoints, opts ...grpc.CallOption) (*pb.GetResponse, error) {
	return f.getFn(ctx, in, opts...)
}

func (f fakePointsClient) Search(ctx context.Context, in *pb.SearchPoints, opts ...grpc.CallOption) (*pb.SearchResponse, error) {
	return f.searchFn(ctx, in, opts...)
}

func (f fakePointsClient) Query(ctx context.Context, in *pb.QueryPoints, opts ...grpc.CallOption) (*pb.QueryResponse, error) {
	return f.queryFn(ctx, in, opts...)
}

func (f fakePointsClient) SetPayload(ctx context.Context, in *pb.SetPayloadPoints, opts ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
	return f.setPayloadFn(ctx, in, opts...)
}

func (f fakePointsClient) CreateFieldIndex(ctx context.Context, in *pb.CreateFieldIndexCollection, opts ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
	return f.createFieldIndexFn(ctx, in, opts...)
}

func collectionInfo(points uint64) *pb.CollectionInfo {
	denseVectors := map[string]*pb.VectorParams{
		fragmodel.DefaultDenseVectorName: {Size: testVectorSize},
	}
	sparseVectors := map[string]*pb.SparseVectorParams{
		fragmodel.DefaultSparseVectorName: {},
	}

	return &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_ParamsMap{
						ParamsMap: &pb.VectorParamsMap{
							Map: denseVectors,
						},
					},
				},
				SparseVectorsConfig: &pb.SparseVectorConfig{
					Map: sparseVectors,
				},
			},
		},
		PointsCount: &points,
	}
}

func newDefaultCollectionsClient() pb.CollectionsClient {
	return fakeCollectionsClient{
		createFn: func(_ context.Context, _ *pb.CreateCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		listFn: func(_ context.Context, _ *pb.ListCollectionsRequest, _ ...grpc.CallOption) (*pb.ListCollectionsResponse, error) {
			return &pb.ListCollectionsResponse{Collections: []*pb.CollectionDescription{{Name: testCollectionName}}}, nil
		},
		listAliasesFn: func(_ context.Context, _ *pb.ListAliasesRequest, _ ...grpc.CallOption) (*pb.ListAliasesResponse, error) {
			return &pb.ListAliasesResponse{}, nil
		},
		updateAliasesFn: func(_ context.Context, _ *pb.ChangeAliases, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		getFn: func(_ context.Context, in *pb.GetCollectionInfoRequest, _ ...grpc.CallOption) (*pb.GetCollectionInfoResponse, error) {
			switch in.CollectionName {
			case testCollectionName:
				return &pb.GetCollectionInfoResponse{Result: collectionInfo(2)}, nil
			case "overflow":
				return &pb.GetCollectionInfoResponse{Result: collectionInfo(1 << 63)}, nil
			default:
				return nil, status.Error(codes.NotFound, "missing")
			}
		},
		deleteFn: func(_ context.Context, _ *pb.DeleteCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
	}
}

func newClient() *qdrantpkg.Client {
	return newClientWithWriteLimit(defaultMaxConcurrentWritesForTest)
}

const defaultMaxConcurrentWritesForTest = 4

func newClientWithWriteLimit(writeLimit int) *qdrantpkg.Client {
	return qdrantpkg.NewClientForTestWithWriteLimit(
		newDefaultCollectionsClient(),
		fakePointsClient{
			upsertFn: func(_ context.Context, _ *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
			deleteFn: func(_ context.Context, _ *pb.DeletePoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
			getFn: func(_ context.Context, in *pb.GetPoints, _ ...grpc.CallOption) (*pb.GetResponse, error) {
				result := make([]*pb.RetrievedPoint, 0, len(in.GetIds()))
				for _, id := range in.GetIds() {
					if id == nil || id.GetUuid() == "" || id.GetUuid() == "missing" {
						continue
					}
					result = append(result, &pb.RetrievedPoint{
						Id: &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: id.GetUuid()}},
					})
				}
				return &pb.GetResponse{Result: result}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				return &pb.SearchResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score: 0.8,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title":    "demo",
							"content":  "body",
							"metadata": map[string]any{"lang": "zh"},
						}),
					}},
				}, nil
			},
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				return &pb.QueryResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score: 0.7,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title":    "demo",
							"content":  "body",
							"metadata": map[string]any{"lang": "zh"},
						}),
					}},
				}, nil
			},
			setPayloadFn: func(_ context.Context, _ *pb.SetPayloadPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
			createFieldIndexFn: func(_ context.Context, _ *pb.CreateFieldIndexCollection, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
		},
		"api-key",
		writeLimit,
	)
}
