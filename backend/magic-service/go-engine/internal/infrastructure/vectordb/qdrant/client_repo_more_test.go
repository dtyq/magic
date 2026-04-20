package qdrant_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

const (
	demoTitle              = "demo"
	testLogLevelWarn       = "WARN"
	testSparseModeDocument = "document"
	testSparseModeVector   = "vector"
)

var (
	errUnexpectedSearchResultCount = errors.New("unexpected search result count")
	errQdrantUnavailable           = errors.New("qdrant unavailable")
)

func newCollectionsClientForLoggingTests() pb.CollectionsClient {
	return newDefaultCollectionsClient()
}

func newClientWithLogBuffer(
	collections pb.CollectionsClient,
	points pb.PointsClient,
	logBuffer *bytes.Buffer,
	logTimingEnabled bool,
	logSlowThresholdMs int,
) *qdrantpkg.Client {
	return qdrantpkg.NewClientForTestWithLogger(
		collections,
		points,
		"api-key",
		defaultMaxConcurrentWritesForTest,
		qdrantpkg.TestLoggerConfig{
			Writer:          logBuffer,
			Enabled:         logTimingEnabled,
			SlowThresholdMs: logSlowThresholdMs,
		},
	)
}

func decodeSingleLogEntry(t *testing.T, buffer *bytes.Buffer) map[string]any {
	t.Helper()
	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buffer.Bytes()), &entry); err != nil {
		t.Fatalf("unmarshal log entry: %v, raw=%s", err, buffer.String())
	}
	return entry
}

func TestClientCollectionOperations(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()

	if err := client.CreateCollection(ctx, testCollectionName, 2); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}
	if err := client.CreateCollection(ctx, testCollectionName, 0); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if exists, err := client.CollectionExists(ctx, testCollectionName); err != nil || !exists {
		t.Fatalf("CollectionExists() = (%v, %v)", exists, err)
	}
	if collections, err := client.ListCollections(ctx); err != nil || len(collections) != 1 || collections[0] != testCollectionName {
		t.Fatalf("ListCollections() = (%v, %v)", collections, err)
	}
	if target, exists, err := client.GetAliasTarget(ctx, "missing_alias"); err != nil || exists || target != "" {
		t.Fatalf("GetAliasTarget() = (%q, %v, %v)", target, exists, err)
	}
	if err := client.EnsureAlias(ctx, "magic_knowledge", testCollectionName); err != nil {
		t.Fatalf("EnsureAlias() error = %v", err)
	}
	if err := client.SwapAliasAtomically(ctx, "magic_knowledge", testCollectionName, "shadow"); err != nil {
		t.Fatalf("SwapAliasAtomically() error = %v", err)
	}
	if err := client.DeleteAlias(ctx, "magic_knowledge"); err != nil {
		t.Fatalf("DeleteAlias() error = %v", err)
	}
	if _, err := client.GetCollectionInfo(ctx, "missing"); !errors.Is(err, qdrantpkg.ErrCollectionNotFound) {
		t.Fatalf("expected ErrCollectionNotFound, got %v", err)
	}
	if _, err := client.GetCollectionInfo(ctx, "overflow"); !errors.Is(err, qdrantpkg.ErrIntegerOverflow) {
		t.Fatalf("expected ErrIntegerOverflow, got %v", err)
	}
	if err := client.DeleteCollection(ctx, testCollectionName); err != nil {
		t.Fatalf("DeleteCollection() error = %v", err)
	}
}

func TestClientPointAndSearchOperations(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()

	if err := client.StoreHybridPoint(ctx, testCollectionName, "p1", []float64{1, 2}, &fragmodel.SparseInput{Document: &fragmodel.SparseDocument{
		Text:  "中文 标题",
		Model: fragmodel.DefaultSparseModelName,
	}}, map[string]any{"title": demoTitle}); err != nil {
		t.Fatalf("StoreHybridPoint() error = %v", err)
	}
	if err := client.StoreHybridPoints(ctx, testCollectionName, []string{"p1"}, [][]float64{{1, 2}}, []*fragmodel.SparseInput{{Document: &fragmodel.SparseDocument{Text: "中文 标题", Model: fragmodel.DefaultSparseModelName}}}, []map[string]any{{"title": demoTitle}}); err != nil {
		t.Fatalf("StoreHybridPoints() error = %v", err)
	}
	if err := client.StoreHybridPoints(ctx, testCollectionName, []string{"p1"}, [][]float64{{1, 2}}, nil, nil); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if err := client.StoreHybridPoint(ctx, testCollectionName, "invalid", []float64{1, 2}, &fragmodel.SparseInput{
		Vector: &fragmodel.SparseVector{
			Indices: []uint32{1, 2},
			Values:  []float32{1},
		},
	}, map[string]any{"title": demoTitle}); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for invalid sparse vector, got %v", err)
	}
	if err := client.DeletePoint(ctx, testCollectionName, "p1"); err != nil {
		t.Fatalf("DeletePoint() error = %v", err)
	}
	if err := client.DeletePoints(ctx, testCollectionName, []string{"p1", "p2"}); err != nil {
		t.Fatalf("DeletePoints() error = %v", err)
	}
	if err := client.DeletePointsByFilter(ctx, testCollectionName, nil); err != nil {
		t.Fatalf("DeletePointsByFilter() error = %v", err)
	}
	if _, err := client.SearchDenseWithFilter(ctx, fragmodel.DenseSearchRequest{Collection: testCollectionName, TopK: -1}); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	results, err := client.SearchDenseWithFilter(ctx, fragmodel.DenseSearchRequest{
		Collection: testCollectionName,
		Vector:     []float64{1, 2},
		TopK:       1,
	})
	if err != nil || len(results) != 1 || results[0].Metadata["lang"] != "zh" {
		t.Fatalf("SearchDenseWithFilter() = (%+v, %v)", results, err)
	}
}

func TestClientSetPayloadByPointIDs(t *testing.T) {
	t.Parallel()

	var requests []*pb.SetPayloadPoints
	client := newClientWithClients(1, newDefaultCollectionsClient(), fakePointsClient{
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
		setPayloadFn: func(_ context.Context, in *pb.SetPayloadPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
			requests = append(requests, in)
			return &pb.PointsOperationResponse{}, nil
		},
	})

	err := client.SetPayloadByPointIDs(context.Background(), testCollectionName, map[string]map[string]any{
		"p2": {"fragment_id": int64(12)},
		"p1": {"business_id": "BIZ-1", "fragment_id": int64(11)},
		"":   {"fragment_id": int64(99)},
	})
	if err != nil {
		t.Fatalf("SetPayloadByPointIDs() error = %v", err)
	}
	if len(requests) != 2 {
		t.Fatalf("expected two set-payload requests, got %d", len(requests))
	}
	if requests[0].GetCollectionName() != testCollectionName || requests[1].GetCollectionName() != testCollectionName {
		t.Fatalf("unexpected collection names: %#v", requests)
	}
	if ids := requests[0].GetPointsSelector().GetPoints().GetIds(); len(ids) != 1 || ids[0].GetUuid() != "p1" {
		t.Fatalf("expected sorted first point p1, got %#v", ids)
	}
	if payload := requests[0].GetPayload(); payload["fragment_id"] == nil || payload["business_id"] == nil {
		t.Fatalf("unexpected first payload: %#v", payload)
	}
	if ids := requests[1].GetPointsSelector().GetPoints().GetIds(); len(ids) != 1 || ids[0].GetUuid() != "p2" {
		t.Fatalf("expected second point p2, got %#v", ids)
	}
	if payload := requests[1].GetPayload(); payload["fragment_id"] == nil || payload["business_id"] != nil {
		t.Fatalf("unexpected second payload: %#v", payload)
	}
}

func TestClientDeleteOperationsIgnoreMissingCollection(t *testing.T) {
	t.Parallel()

	deleteNotFound := func(_ context.Context, _ *pb.DeletePoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
		return nil, status.Error(codes.NotFound, "Not found: Collection `missing` doesn't exist!")
	}
	client := newClientWithClients(1, newDefaultCollectionsClient(), fakePointsClient{
		deleteFn: deleteNotFound,
	})

	if err := client.DeletePoints(context.Background(), "missing", []string{"p1"}); err != nil {
		t.Fatalf("DeletePoints() should ignore missing collection, got %v", err)
	}
	if err := client.DeletePointsByFilter(context.Background(), "missing", nil); err != nil {
		t.Fatalf("DeletePointsByFilter() should ignore missing collection, got %v", err)
	}
}

func TestClientSearchDenseWithFilterLogsTiming(t *testing.T) {
	t.Parallel()

	var logBuffer bytes.Buffer
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
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
		},
		&logBuffer,
		true,
		100,
	)

	results, err := client.SearchDenseWithFilter(context.Background(), fragmodel.DenseSearchRequest{
		Collection:     testCollectionName,
		VectorName:     fragmodel.DefaultDenseVectorName,
		Vector:         []float64{1, 2},
		TopK:           3,
		ScoreThreshold: 0.4,
		Filter:         &fragmodel.VectorFilter{},
	})
	if err != nil || len(results) != 1 {
		t.Fatalf("SearchDenseWithFilter() = (%+v, %v)", results, err)
	}

	entry := decodeSingleLogEntry(t, &logBuffer)
	if entry["msg"] != "Qdrant operation success" {
		t.Fatalf("unexpected log message: %#v", entry["msg"])
	}
	if entry["level"] != "DEBUG" {
		t.Fatalf("unexpected level: %#v", entry["level"])
	}
	if entry["operation"] != "search_dense" || entry["component"] != "qdrant" {
		t.Fatalf("unexpected operation fields: %#v", entry)
	}
	if entry["collection"] != testCollectionName || entry["vector_name"] != fragmodel.DefaultDenseVectorName {
		t.Fatalf("unexpected collection/vector_name: %#v", entry)
	}
	if entry["top_k"] != float64(3) || entry["result_count"] != float64(1) || entry["query_vector_dim"] != float64(2) {
		t.Fatalf("unexpected numeric fields: %#v", entry)
	}
	if entry["score_threshold"] != 0.4 {
		t.Fatalf("unexpected score_threshold: %#v", entry["score_threshold"])
	}
	if entry["filter_applied"] != true {
		t.Fatalf("expected filter_applied=true, got %#v", entry["filter_applied"])
	}
}

func TestClientSearchSparseWithFilterLogsDocumentModeAndSlowThreshold(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var logBuffer bytes.Buffer
		client := newSparseSearchLoggingClient(&logBuffer)

		results, err := client.SearchSparseWithFilter(context.Background(), fragmodel.SparseSearchRequest{
			Collection: testCollectionName,
			Document: &fragmodel.SparseDocument{
				Text:  "中文 标题",
				Model: fragmodel.DefaultSparseModelName,
			},
			TopK:           2,
			ScoreThreshold: 0.1,
		})
		if err != nil || len(results) != 1 {
			t.Fatalf("SearchSparseWithFilter(document) = (%+v, %v)", results, err)
		}

		entry := decodeSingleLogEntry(t, &logBuffer)
		if entry["msg"] != "Qdrant operation slow" || entry["level"] != testLogLevelWarn {
			t.Fatalf("unexpected slow log entry: %#v", entry)
		}
		if entry["operation"] != "search_sparse" || entry["sparse_mode"] != testSparseModeDocument {
			t.Fatalf("unexpected sparse fields: %#v", entry)
		}
		if entry["document_model"] != fragmodel.DefaultSparseModelName {
			t.Fatalf("unexpected document model: %#v", entry["document_model"])
		}
		if entry["query_term_count"] != float64(0) {
			t.Fatalf("unexpected query_term_count: %#v", entry["query_term_count"])
		}
	})
}

func TestClientSearchSparseWithFilterLogsVectorModeAndSlowThreshold(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var logBuffer bytes.Buffer
		client := newSparseSearchLoggingClient(&logBuffer)

		results, err := client.SearchSparseWithFilter(context.Background(), fragmodel.SparseSearchRequest{
			Collection: testCollectionName,
			Vector: &fragmodel.SparseVector{
				Indices: []uint32{1, 3, 5},
				Values:  []float32{1, 1, 1},
			},
			TopK: 1,
		})
		if err != nil || len(results) != 1 {
			t.Fatalf("SearchSparseWithFilter(vector) = (%+v, %v)", results, err)
		}

		entry := decodeSingleLogEntry(t, &logBuffer)
		if entry["msg"] != "Qdrant operation slow" || entry["level"] != testLogLevelWarn {
			t.Fatalf("unexpected slow log entry: %#v", entry)
		}
		if entry["sparse_mode"] != testSparseModeVector || entry["query_term_count"] != float64(3) {
			t.Fatalf("unexpected vector sparse fields: %#v", entry)
		}
	})
}

func newSparseSearchLoggingClient(logBuffer *bytes.Buffer) *qdrantpkg.Client {
	return newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				time.Sleep(15 * time.Millisecond)
				return &pb.QueryResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score: 0.7,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title":    demoTitle,
							"content":  "body",
							"metadata": map[string]any{"lang": "zh"},
						}),
					}},
				}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				time.Sleep(15 * time.Millisecond)
				return &pb.SearchResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score: 0.7,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title":    demoTitle,
							"content":  "body",
							"metadata": map[string]any{"lang": "zh"},
						}),
					}},
				}, nil
			},
		},
		logBuffer,
		true,
		5,
	)
}

func TestClientStoreHybridPointsAndFailuresLogTiming(t *testing.T) {
	t.Parallel()

	var logBuffer bytes.Buffer
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			upsertFn: func(_ context.Context, _ *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				return &pb.PointsOperationResponse{}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				return nil, errQdrantUnavailable
			},
		},
		&logBuffer,
		true,
		100,
	)

	if err := client.StoreHybridPoints(context.Background(), testCollectionName, []string{"p1", "p2"}, [][]float64{{1, 2}, {1, 2}}, []*fragmodel.SparseInput{{
		Vector: &fragmodel.SparseVector{Indices: []uint32{1}, Values: []float32{1}},
	}, {
		Vector: &fragmodel.SparseVector{Indices: []uint32{2}, Values: []float32{1}},
	}}, []map[string]any{{"title": demoTitle}, {"title": demoTitle}}); err != nil {
		t.Fatalf("StoreHybridPoints() error = %v", err)
	}
	entry := decodeSingleLogEntry(t, &logBuffer)
	if entry["operation"] != "store_hybrid_points" || entry["point_count"] != float64(2) || entry["payload_count"] != float64(2) {
		t.Fatalf("unexpected store log entry: %#v", entry)
	}
	if entry["sparse_mode"] != testSparseModeVector {
		t.Fatalf("unexpected sparse_mode: %#v", entry["sparse_mode"])
	}

	logBuffer.Reset()
	if _, err := client.SearchDenseWithFilter(context.Background(), fragmodel.DenseSearchRequest{
		Collection: testCollectionName,
		Vector:     []float64{1, 2},
		TopK:       1,
	}); err == nil {
		t.Fatal("expected SearchDenseWithFilter to fail")
	}
	entry = decodeSingleLogEntry(t, &logBuffer)
	if entry["msg"] != "Qdrant operation failed" || entry["level"] != testLogLevelWarn {
		t.Fatalf("unexpected failed log entry: %#v", entry)
	}
	if entry["error"] == nil {
		t.Fatalf("expected error field in failed log: %#v", entry)
	}
}

func TestClientTimingLogDisabledByDefault(t *testing.T) {
	t.Parallel()

	var logBuffer bytes.Buffer
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				return &pb.SearchResponse{}, nil
			},
		},
		&logBuffer,
		false,
		100,
	)

	if _, err := client.SearchDenseWithFilter(context.Background(), fragmodel.DenseSearchRequest{
		Collection: testCollectionName,
		Vector:     []float64{1, 2},
		TopK:       1,
	}); err != nil {
		t.Fatalf("SearchDenseWithFilter() error = %v", err)
	}
	if logBuffer.Len() != 0 {
		t.Fatalf("expected no qdrant timing log when disabled, got %s", logBuffer.String())
	}
}

func TestRepositoryOperationsAndHelpers(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()
	management := qdrantpkg.NewVectorDBManagementRepository(client)
	dataRepo := qdrantpkg.NewVectorDBDataRepository[map[string]any](client)

	if _, err := management.GetCollectionInfo(ctx, testCollectionName); err != nil {
		t.Fatalf("GetCollectionInfo() error = %v", err)
	}
	if err := dataRepo.StorePoint(ctx, testCollectionName, "p1", []float64{1, 2}, map[string]any{"title": demoTitle}); err != nil {
		t.Fatalf("StorePoint() error = %v", err)
	}
	if results, err := dataRepo.Search(ctx, testCollectionName, []float64{1, 2}, 1, 0.1); err != nil || len(results) != 1 || results[0].Payload["title"] != demoTitle {
		t.Fatalf("Search() = (%+v, %v)", results, err)
	}
	if err := qdrantpkg.EnsureVectorDimensionForTest(ctx, dataRepo, testCollectionName, [][]float64{{1}}); !errors.Is(err, qdrantpkg.ErrVectorDimensionMismatch) {
		t.Fatalf("expected ErrVectorDimensionMismatch, got %v", err)
	}

	converted, err := qdrantpkg.ConvertResultsForTest[map[string]any]([]*qdrantpkg.SimilarityResult{{
		ID:      "p1",
		Score:   0.7,
		Payload: map[string]any{"title": demoTitle},
	}})
	if err != nil || len(converted) != 1 || converted[0].Payload["title"] != demoTitle {
		t.Fatalf("ConvertResultsForTest() = (%+v, %v)", converted, err)
	}
	if _, err := qdrantpkg.ToMapForTest(struct {
		C chan int `json:"c"`
	}{C: make(chan int)}); err == nil {
		t.Fatal("expected ToMapForTest to fail")
	}
	if err := qdrantpkg.FromMapForTest(map[string]any{"title": demoTitle}, 1); err == nil {
		t.Fatal("expected FromMapForTest to fail")
	}
	vectors, err := qdrantpkg.BuildPointVectorsForTest([]float64{1, 2}, &qdrantpkg.SparseInputForTest{Document: &qdrantpkg.SparseDocumentForTest{
		Text:  "中文 标题",
		Model: fragmodel.DefaultSparseModelName,
	}})
	if err != nil {
		t.Fatalf("BuildPointVectorsForTest() error = %v", err)
	}
	if vectors.GetVectors() == nil {
		t.Fatalf("expected named vectors, got %#v", vectors)
	}
	if got := qdrantpkg.ToFloat32VectorForTest([]float64{1.5, 2.5}); len(got) != 2 || got[0] != 1.5 {
		t.Fatalf("unexpected float32 vector: %#v", got)
	}
	if qdrantpkg.OrDefaultForTest("", "fallback") != "fallback" {
		t.Fatal("expected fallback value")
	}
	payloadJSON, err := json.Marshal(converted[0].Payload)
	if err != nil || len(payloadJSON) == 0 {
		t.Fatalf("json.Marshal() err = %v", err)
	}
}

func TestManagementRepositoryWrapperMethods(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()
	repo := qdrantpkg.NewVectorDBManagementRepository(client)
	filterValue := demoTitle

	if err := repo.CreateCollection(ctx, testCollectionName, 2); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}
	exists, err := repo.CollectionExists(ctx, testCollectionName)
	if err != nil || !exists {
		t.Fatalf("CollectionExists() = (%v, %v)", exists, err)
	}
	if collections, err := repo.ListCollections(ctx); err != nil || len(collections) != 1 {
		t.Fatalf("ListCollections() = (%v, %v)", collections, err)
	}
	if err := repo.EnsureAlias(ctx, "magic_knowledge", testCollectionName); err != nil {
		t.Fatalf("EnsureAlias() error = %v", err)
	}
	if err := repo.SwapAliasAtomically(ctx, "magic_knowledge", testCollectionName, "shadow"); err != nil {
		t.Fatalf("SwapAliasAtomically() error = %v", err)
	}
	if err := repo.DeleteAlias(ctx, "magic_knowledge"); err != nil {
		t.Fatalf("DeleteAlias() error = %v", err)
	}
	if err := repo.DeletePoint(ctx, testCollectionName, "p1"); err != nil {
		t.Fatalf("DeletePoint() error = %v", err)
	}
	if err := repo.DeletePoints(ctx, testCollectionName, []string{"p1", "p2"}); err != nil {
		t.Fatalf("DeletePoints() error = %v", err)
	}
	if err := repo.DeletePointsByFilter(ctx, testCollectionName, &fragmodel.VectorFilter{
		Must: []fragmodel.FieldFilter{{
			Key: "title",
			Match: fragmodel.Match{
				EqString: &filterValue,
			},
		}},
	}); err != nil {
		t.Fatalf("DeletePointsByFilter() error = %v", err)
	}
	if err := repo.DeleteCollection(ctx, testCollectionName); err != nil {
		t.Fatalf("DeleteCollection() error = %v", err)
	}
}

func TestDataRepositoryWrapperMethods(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()
	repo := qdrantpkg.NewVectorDBDataRepository[map[string]any](client)
	filterValue := "demo"

	if err := repo.StoreHybridPoint(ctx, testCollectionName, "p1", []float64{1, 2}, &fragmodel.SparseInput{Document: &fragmodel.SparseDocument{
		Text:  "中文 标题",
		Model: fragmodel.DefaultSparseModelName,
	}}, map[string]any{"title": demoTitle}); err != nil {
		t.Fatalf("StoreHybridPoint() error = %v", err)
	}
	if err := repo.StorePoints(ctx, testCollectionName, []string{"p1"}, [][]float64{{1, 2}}, []map[string]any{{"title": demoTitle}}); err != nil {
		t.Fatalf("StorePoints() error = %v", err)
	}
	if err := repo.StoreHybridPoints(ctx, testCollectionName, []string{"p1"}, [][]float64{{1, 2}}, []*fragmodel.SparseInput{{
		Document: &fragmodel.SparseDocument{
			Text:  "中文 标题",
			Model: fragmodel.DefaultSparseModelName,
		},
	}}, []map[string]any{{"title": demoTitle}}); err != nil {
		t.Fatalf("StoreHybridPoints() error = %v", err)
	}

	results, err := repo.SearchWithFilter(ctx, testCollectionName, []float64{1, 2}, 1, 0.1, &fragmodel.VectorFilter{
		Must: []fragmodel.FieldFilter{{
			Key: "title",
			Match: fragmodel.Match{
				EqString: &filterValue,
			},
		}},
	})
	if err != nil || len(results) != 1 {
		t.Fatalf("SearchWithFilter() = (%+v, %v)", results, err)
	}

	denseResults, err := repo.SearchDenseWithFilter(ctx, fragmodel.DenseSearchRequest{
		Collection: testCollectionName,
		Vector:     []float64{1, 2},
		TopK:       1,
	})
	if err != nil || len(denseResults) != 1 {
		t.Fatalf("SearchDenseWithFilter() = (%+v, %v)", denseResults, err)
	}

	sparseResults, err := repo.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Document: &fragmodel.SparseDocument{
			Text:  "中文 查询",
			Model: fragmodel.DefaultSparseModelName,
		},
		TopK: 1,
	})
	if err != nil || len(sparseResults) != 1 {
		t.Fatalf("SearchSparseWithFilter() = (%+v, %v)", sparseResults, err)
	}

	sparseResults, err = repo.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Vector: &fragmodel.SparseVector{
			Indices: []uint32{1, 2},
			Values:  []float32{1.2, 0.8},
		},
		TopK: 1,
	})
	if err != nil || len(sparseResults) != 1 {
		t.Fatalf("SearchSparseWithFilter(vector) = (%+v, %v)", sparseResults, err)
	}

	existing, err := repo.ListExistingPointIDs(ctx, testCollectionName, []string{"p1", "missing", "p1"})
	if err != nil {
		t.Fatalf("ListExistingPointIDs() error = %v", err)
	}
	if len(existing) != 1 {
		t.Fatalf("ListExistingPointIDs() len = %d, want 1", len(existing))
	}
	if _, ok := existing["p1"]; !ok {
		t.Fatalf("ListExistingPointIDs() missing point p1: %#v", existing)
	}
}

func TestDataRepositoryStorePointRejectsUnmarshalablePayload(t *testing.T) {
	t.Parallel()

	type badPayload struct {
		C chan int `json:"c"`
	}

	repo := qdrantpkg.NewVectorDBDataRepository[badPayload](newClient())
	err := repo.StorePoint(context.Background(), testCollectionName, "p1", []float64{1, 2}, badPayload{
		C: make(chan int),
	})
	if err == nil {
		t.Fatal("expected StorePoint() to fail")
	}
}

func TestClientSearchSparseWithFilterBranches(t *testing.T) {
	t.Parallel()

	client := newClient()
	ctx := context.Background()

	if _, err := client.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		TopK:       -1,
	}); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}

	empty, err := client.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Document:   &fragmodel.SparseDocument{},
		TopK:       1,
	})
	if err != nil || len(empty) != 0 {
		t.Fatalf("SearchSparseWithFilter(empty) = (%+v, %v)", empty, err)
	}
	if _, err := client.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Document:   &fragmodel.SparseDocument{Text: "中文"},
		Vector:     &fragmodel.SparseVector{Indices: []uint32{1}, Values: []float32{1}},
		TopK:       1,
	}); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if _, err := client.SearchSparseWithFilter(ctx, fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Vector:     &fragmodel.SparseVector{Indices: []uint32{1, 2}, Values: []float32{1}},
		TopK:       1,
	}); !errors.Is(err, qdrantpkg.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for invalid sparse vector, got %v", err)
	}
}

func TestClientSearchSparseWithFilterDoesNotFallbackAfterQueryFailure(t *testing.T) {
	t.Parallel()

	var logBuffer bytes.Buffer
	var queryCalls atomic.Int32
	var searchCalls atomic.Int32

	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				queryCalls.Add(1)
				return nil, status.Error(codes.Unimplemented, "query api unavailable")
			},
			searchFn: func(_ context.Context, req *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				searchCalls.Add(1)
				if req.GetCollectionName() != testCollectionName {
					t.Fatalf("unexpected collection: %q", req.GetCollectionName())
				}
				if req.GetVectorName() != fragmodel.DefaultSparseVectorName {
					t.Fatalf("unexpected vector_name: %q", req.GetVectorName())
				}
				if len(req.GetVector()) != 2 || req.GetVector()[0] != 1 || req.GetVector()[1] != 0.5 {
					t.Fatalf("unexpected sparse values: %#v", req.GetVector())
				}
				if req.GetSparseIndices() == nil || len(req.GetSparseIndices().GetData()) != 2 {
					t.Fatalf("unexpected sparse indices: %#v", req.GetSparseIndices())
				}
				return &pb.SearchResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score: 0.6,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title":    "demo",
							"content":  "body",
							"metadata": map[string]any{"lang": "zh"},
						}),
					}},
				}, nil
			},
		},
		&logBuffer,
		true,
		100,
	)
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.13.0",
		QuerySupported:    true,
		SelectedSparseAPI: "query_points",
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	results, err := client.SearchSparseWithFilter(context.Background(), fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		VectorName: fragmodel.DefaultSparseVectorName,
		Vector: &fragmodel.SparseVector{
			Indices: []uint32{2, 9},
			Values:  []float32{1, 0.5},
		},
		TopK:           2,
		ScoreThreshold: 0.1,
	})
	if err == nil {
		t.Fatalf("expected SearchSparseWithFilter() to fail, got results=%+v", results)
	}
	if queryCalls.Load() != 1 || searchCalls.Load() != 0 {
		t.Fatalf("expected query only, got query=%d search=%d", queryCalls.Load(), searchCalls.Load())
	}

	entries := decodeLogEntries(t, &logBuffer)
	searchEntry := requireLogEntryByMessage(t, entries, "Qdrant operation failed")
	if searchEntry["selected_sparse_api"] != testQueryPointsAPI {
		t.Fatalf("unexpected selected_sparse_api: %#v", searchEntry["selected_sparse_api"])
	}
	if searchEntry["sparse_mode"] != testSparseModeVector {
		t.Fatalf("unexpected sparse_mode: %#v", searchEntry["sparse_mode"])
	}
}

func TestClientWriteOperationsRespectConfiguredConcurrencyLimit(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var inflight atomic.Int32
		var maxInflight atomic.Int32
		entered := make(chan struct{}, 3)
		release := make(chan struct{})

		client := newClientWithClients(2, fakeCollectionsClient{}, fakePointsClient{
			upsertFn: func(_ context.Context, _ *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				current := inflight.Add(1)
				for {
					peak := maxInflight.Load()
					if current <= peak || maxInflight.CompareAndSwap(peak, current) {
						break
					}
				}
				entered <- struct{}{}
				<-release
				inflight.Add(-1)
				return &pb.PointsOperationResponse{}, nil
			},
		})

		ctx := context.Background()
		var wg sync.WaitGroup
		for i := range 3 {
			id := fmt.Sprintf("%s%d", demoTitle, i)
			wg.Go(func() {
				if err := client.StoreHybridPoint(ctx, testCollectionName, id, []float64{1, 2}, nil, map[string]any{"title": demoTitle}); err != nil {
					t.Errorf("StoreHybridPoint() error = %v", err)
				}
			})
		}

		waitForWriteEntries(t, entered, 2, "timed out waiting for first two writes to enter")
		assertWriteBlocked(t, entered)

		releaseOneWrite(release)
		waitForWriteEntry(t, entered, "timed out waiting for third write after releasing permit")

		release <- struct{}{}
		release <- struct{}{}
		wg.Wait()

		if got := maxInflight.Load(); got != 2 {
			t.Fatalf("expected max inflight writes 2, got %d", got)
		}
	})
}

func waitForWriteEntries(t *testing.T, entered <-chan struct{}, count int, message string) {
	t.Helper()
	for range count {
		waitForWriteEntry(t, entered, message)
	}
}

func waitForWriteEntry(t *testing.T, entered <-chan struct{}, message string) {
	t.Helper()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal(message)
	}
}

func assertWriteBlocked(t *testing.T, entered <-chan struct{}) {
	t.Helper()
	select {
	case <-entered:
		t.Fatal("third write should be blocked by concurrency limiter")
	case <-time.After(50 * time.Millisecond):
	}
}

func releaseOneWrite(release chan<- struct{}) {
	release <- struct{}{}
}

func TestClientSearchDoesNotBlockOnWriteLimiter(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		entered := make(chan struct{}, 1)
		release := make(chan struct{})
		client := newClientWithClients(1, fakeCollectionsClient{}, fakePointsClient{
			upsertFn: func(_ context.Context, _ *pb.UpsertPoints, _ ...grpc.CallOption) (*pb.PointsOperationResponse, error) {
				entered <- struct{}{}
				<-release
				return &pb.PointsOperationResponse{}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				return &pb.SearchResponse{
					Result: []*pb.ScoredPoint{{
						Id:      &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "p1"}},
						Score:   0.8,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{"title": demoTitle, "metadata": map[string]any{"lang": "zh"}}),
					}},
				}, nil
			},
		})

		storeErrCh := make(chan error, 1)
		go func() {
			storeErrCh <- client.StoreHybridPoint(context.Background(), testCollectionName, "p1", []float64{1, 2}, nil, map[string]any{"title": demoTitle})
		}()

		select {
		case <-entered:
		case <-time.After(time.Second):
			t.Fatal("timed out waiting for write to acquire limiter")
		}

		searchDone := make(chan error, 1)
		go func() {
			results, err := client.SearchDenseWithFilter(context.Background(), fragmodel.DenseSearchRequest{
				Collection: testCollectionName,
				Vector:     []float64{1, 2},
				TopK:       1,
			})
			if err != nil {
				searchDone <- err
				return
			}
			if len(results) != 1 {
				searchDone <- errUnexpectedSearchResultCount
				return
			}
			searchDone <- nil
		}()

		select {
		case err := <-searchDone:
			if err != nil {
				t.Fatalf("search while write inflight failed: %v", err)
			}
		case <-time.After(time.Second):
			t.Fatal("search should not wait on write limiter")
		}

		release <- struct{}{}
		if err := <-storeErrCh; err != nil {
			t.Fatalf("StoreHybridPoint() error = %v", err)
		}
	})
}

func TestClientSchemaOperationsRemainSerialized(t *testing.T) {
	t.Parallel()

	var inflight atomic.Int32
	var maxInflight atomic.Int32
	firstEntered := make(chan struct{}, 1)
	secondEntered := make(chan struct{}, 1)
	release := make(chan struct{})

	createFn := func(_ context.Context, _ *pb.CreateCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
		current := inflight.Add(1)
		for {
			peak := maxInflight.Load()
			if current <= peak || maxInflight.CompareAndSwap(peak, current) {
				break
			}
		}
		firstEntered <- struct{}{}
		<-release
		inflight.Add(-1)
		return &pb.CollectionOperationResponse{}, nil
	}
	deleteFn := func(_ context.Context, _ *pb.DeleteCollection, _ ...grpc.CallOption) (*pb.CollectionOperationResponse, error) {
		current := inflight.Add(1)
		for {
			peak := maxInflight.Load()
			if current <= peak || maxInflight.CompareAndSwap(peak, current) {
				break
			}
		}
		secondEntered <- struct{}{}
		<-release
		inflight.Add(-1)
		return &pb.CollectionOperationResponse{}, nil
	}
	client := newClientWithClients(4, fakeCollectionsClient{
		createFn: createFn,
		deleteFn: deleteFn,
	}, fakePointsClient{})

	errCh := make(chan error, 2)
	go func() {
		errCh <- client.CreateCollection(context.Background(), testCollectionName, 2)
	}()

	select {
	case <-firstEntered:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for first schema operation")
	}

	go func() {
		errCh <- client.DeleteCollection(context.Background(), testCollectionName)
	}()

	select {
	case <-secondEntered:
		t.Fatal("second schema operation should be blocked by schema mutex")
	case <-time.After(50 * time.Millisecond):
	}

	release <- struct{}{}

	select {
	case <-secondEntered:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for second schema operation")
	}

	release <- struct{}{}

	for range 2 {
		if err := <-errCh; err != nil {
			t.Fatalf("schema operation error = %v", err)
		}
	}
	if got := maxInflight.Load(); got != 1 {
		t.Fatalf("expected serialized schema operations, got max inflight %d", got)
	}
}
