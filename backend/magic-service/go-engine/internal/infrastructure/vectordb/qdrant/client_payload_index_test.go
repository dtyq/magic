package qdrant_test

import (
	"context"
	"testing"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"magic/internal/domain/knowledge/shared"
)

func TestClientGetCollectionInfoIncludesPayloadSchemaKeys(t *testing.T) {
	t.Parallel()

	client := newClientWithClients(defaultMaxConcurrentWritesForTest, fakeCollectionsClient{
		createFn: func(_ context.Context, _ *pb.CreateCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		listFn: func(_ context.Context, _ *pb.ListCollectionsRequest, _ ...grpc.CallOption) (*pb.ListCollectionsResponse, error) {
			return &pb.ListCollectionsResponse{}, nil
		},
		listAliasesFn: func(_ context.Context, _ *pb.ListAliasesRequest, _ ...grpc.CallOption) (*pb.ListAliasesResponse, error) {
			return &pb.ListAliasesResponse{}, nil
		},
		updateAliasesFn: func(_ context.Context, _ *pb.ChangeAliases, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		getFn: func(_ context.Context, in *pb.GetCollectionInfoRequest, _ ...grpc.CallOption) (*pb.GetCollectionInfoResponse, error) {
			if in.GetCollectionName() != testCollectionName {
				return nil, status.Error(codes.NotFound, "missing")
			}
			info := collectionInfo(2)
			info.PayloadSchema = map[string]*pb.PayloadSchemaInfo{
				"organization_code":      {DataType: pb.PayloadSchemaType_Keyword},
				"metadata.created_at_ts": {DataType: pb.PayloadSchemaType_Integer},
			}
			return &pb.GetCollectionInfoResponse{Result: info}, nil
		},
		deleteFn: func(_ context.Context, _ *pb.DeleteCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
	}, fakePointsClient{
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
		setPayloadFn: func(_ context.Context, _ *pb.SetPayloadPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			return &pb.PointsOperationResponse{}, nil
		},
		createFieldIndexFn: func(_ context.Context, _ *pb.CreateFieldIndexCollection, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			return &pb.PointsOperationResponse{}, nil
		},
	})

	info, err := client.GetCollectionInfo(context.Background(), testCollectionName)
	if err != nil {
		t.Fatalf("GetCollectionInfo() error = %v", err)
	}
	if len(info.PayloadSchemaKeys) != 2 || info.PayloadSchemaKeys[0] != "metadata.created_at_ts" || info.PayloadSchemaKeys[1] != "organization_code" {
		t.Fatalf("unexpected payload schema keys: %#v", info.PayloadSchemaKeys)
	}
}

func TestClientEnsurePayloadIndexesCreatesOnlyMissingIndexes(t *testing.T) {
	t.Parallel()

	var requests []*pb.CreateFieldIndexCollection
	client := newClientWithClients(defaultMaxConcurrentWritesForTest, fakeCollectionsClient{
		createFn: func(_ context.Context, _ *pb.CreateCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		listFn: func(_ context.Context, _ *pb.ListCollectionsRequest, _ ...grpc.CallOption) (*pb.ListCollectionsResponse, error) {
			return &pb.ListCollectionsResponse{}, nil
		},
		listAliasesFn: func(_ context.Context, _ *pb.ListAliasesRequest, _ ...grpc.CallOption) (*pb.ListAliasesResponse, error) {
			return &pb.ListAliasesResponse{}, nil
		},
		updateAliasesFn: func(_ context.Context, _ *pb.ChangeAliases, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
		getFn: func(_ context.Context, in *pb.GetCollectionInfoRequest, _ ...grpc.CallOption) (*pb.GetCollectionInfoResponse, error) {
			if in.GetCollectionName() != testCollectionName {
				return nil, status.Error(codes.NotFound, "missing")
			}
			info := collectionInfo(2)
			info.PayloadSchema = map[string]*pb.PayloadSchemaInfo{
				"knowledge_code": {DataType: pb.PayloadSchemaType_Keyword},
			}
			return &pb.GetCollectionInfoResponse{Result: info}, nil
		},
		deleteFn: func(_ context.Context, _ *pb.DeleteCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
			return &pb.CollectionOperationResponse{}, nil
		},
	}, fakePointsClient{
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
		setPayloadFn: func(_ context.Context, _ *pb.SetPayloadPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			return &pb.PointsOperationResponse{}, nil
		},
		createFieldIndexFn: func(_ context.Context, in *pb.CreateFieldIndexCollection, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			requests = append(requests, in)
			return &pb.PointsOperationResponse{}, nil
		},
	})

	err := client.EnsurePayloadIndexes(context.Background(), testCollectionName, []shared.PayloadIndexSpec{
		{FieldName: "knowledge_code", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "organization_code", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "metadata.created_at_ts", Kind: shared.PayloadIndexKindInteger},
	})
	if err != nil {
		t.Fatalf("EnsurePayloadIndexes() error = %v", err)
	}
	if len(requests) != 2 {
		t.Fatalf("expected two create-field-index requests, got %d", len(requests))
	}
	if requests[0].GetFieldName() != "organization_code" || requests[1].GetFieldName() != "metadata.created_at_ts" {
		t.Fatalf("unexpected field order: %#v", requests)
	}
	if requests[0].GetFieldType() != pb.FieldType_FieldTypeKeyword {
		t.Fatalf("expected keyword field type, got %v", requests[0].GetFieldType())
	}
	if requests[1].GetFieldType() != pb.FieldType_FieldTypeInteger {
		t.Fatalf("expected integer field type, got %v", requests[1].GetFieldType())
	}
	if !requests[0].GetWait() || !requests[1].GetWait() {
		t.Fatalf("expected wait=true, got %#v", requests)
	}
}
