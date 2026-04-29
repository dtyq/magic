package qdrant_test

import (
	"bytes"
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	shared "magic/internal/domain/knowledge/shared"
	qdrantpkg "magic/internal/infrastructure/vectordb/qdrant"
)

func decodeLogEntries(t *testing.T, buffer *bytes.Buffer) []map[string]any {
	t.Helper()
	raw := bytes.TrimSpace(buffer.Bytes())
	if len(raw) == 0 {
		t.Fatal("expected log entries, got empty buffer")
	}
	lines := bytes.Split(raw, []byte{'\n'})
	entries := make([]map[string]any, 0, len(lines))
	for _, line := range lines {
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}
		var entry map[string]any
		if err := json.Unmarshal(line, &entry); err != nil {
			t.Fatalf("unmarshal log entry: %v, raw=%s", err, line)
		}
		entries = append(entries, entry)
	}
	if len(entries) == 0 {
		t.Fatal("expected parsed log entries")
	}
	return entries
}

func requireLogEntryByOperation(t *testing.T, entries []map[string]any, operation string) map[string]any {
	t.Helper()
	for _, entry := range entries {
		if entry["operation"] == operation {
			return entry
		}
	}
	t.Fatalf("log entry with operation %q not found in %#v", operation, entries)
	return nil
}

func TestClientDefaultsToAssumedModernCapability(t *testing.T) {
	t.Parallel()

	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{},
		&bytes.Buffer{},
		false,
		100,
	)

	snapshot := qdrantpkg.CurrentCapabilityForTest(client)
	if snapshot.Version != ">=1.12.2" {
		t.Fatalf("expected assumed version >=1.12.2, got %q", snapshot.Version)
	}
	if !snapshot.QuerySupported || snapshot.SelectedSparseAPI != "query_points" {
		t.Fatalf("unexpected default snapshot: %#v", snapshot)
	}

	selection := client.DefaultSparseBackend()
	if selection.Effective != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected default sparse backend %q, got %#v", shared.SparseBackendClientBM25QdrantIDFV1, selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonCapabilityDefault {
		t.Fatalf("unexpected selection reason: %#v", selection.Reason)
	}
}

func TestClientSelectSparseBackendAllowsQdrantBackendWhenNativeBM25Supported(t *testing.T) {
	t.Parallel()

	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{},
		&bytes.Buffer{},
		false,
		100,
	)
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.15.2",
		QuerySupported:    true,
		SelectedSparseAPI: "query_points",
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	selection := client.SelectSparseBackend(shared.SparseBackendQdrantBM25ZHV1)
	if selection.Effective != shared.SparseBackendQdrantBM25ZHV1 {
		t.Fatalf("expected qdrant sparse backend, got %#v", selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonExplicitRequested {
		t.Fatalf("unexpected selection reason: %#v", selection.Reason)
	}
}

func TestClientSelectSparseBackendDowngradesWhenNativeBM25UnsupportedDespiteQuerySupport(t *testing.T) {
	t.Parallel()

	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{},
		&bytes.Buffer{},
		false,
		100,
	)
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.12.2",
		QuerySupported:    true,
		SelectedSparseAPI: "query_points",
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	selection := client.SelectSparseBackend(shared.SparseBackendQdrantBM25ZHV1)
	if selection.Effective != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected downgraded sparse backend %q, got %#v", shared.SparseBackendClientBM25QdrantIDFV1, selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonNativeBM25Unsupported {
		t.Fatalf("unexpected selection reason: %#v", selection.Reason)
	}
}

func TestClientSelectSparseBackendDowngradesUnsupportedQdrantBackend(t *testing.T) {
	t.Parallel()

	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{},
		&bytes.Buffer{},
		false,
		100,
	)
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.9.0",
		QuerySupported:    false,
		SelectedSparseAPI: "legacy_search",
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	selection := client.SelectSparseBackend(shared.SparseBackendQdrantBM25ZHV1)
	if selection.Effective != shared.SparseBackendClientBM25QdrantIDFV1 {
		t.Fatalf("expected downgraded sparse backend %q, got %#v", shared.SparseBackendClientBM25QdrantIDFV1, selection)
	}
	if selection.Reason != shared.SparseBackendSelectionReasonQueryPointsUnsupported {
		t.Fatalf("unexpected selection reason: %#v", selection.Reason)
	}
}

func TestClientSearchSparseWithFilterUsesQueryAPIByDefault(t *testing.T) {
	t.Parallel()

	var queryCalls atomic.Int32
	var searchCalls atomic.Int32
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				queryCalls.Add(1)
				return &pb.QueryResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "query"}},
						Score: 0.5,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title": "demo",
						}),
					}},
				}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				searchCalls.Add(1)
				return &pb.SearchResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "legacy"}},
						Score: 0.5,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title": "demo",
						}),
					}},
				}, nil
			},
		},
		&bytes.Buffer{},
		false,
		100,
	)

	results, err := client.SearchSparseWithFilter(context.Background(), fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Vector: &fragmodel.SparseVector{
			Indices: []uint32{1, 3},
			Values:  []float32{1, 0.5},
		},
		TopK: 1,
	})
	if err != nil || len(results) != 1 {
		t.Fatalf("SearchSparseWithFilter() = (%+v, %v)", results, err)
	}
	if queryCalls.Load() != 1 || searchCalls.Load() != 0 {
		t.Fatalf("expected query search only, got query=%d search=%d", queryCalls.Load(), searchCalls.Load())
	}
}

func TestClientSearchSparseWithFilterUsesQueryAPIWhenSupported(t *testing.T) {
	t.Parallel()

	var queryCalls atomic.Int32
	var searchCalls atomic.Int32
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				queryCalls.Add(1)
				return &pb.QueryResponse{
					Result: []*pb.ScoredPoint{{
						Id:    &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: "query"}},
						Score: 0.8,
						Payload: qdrantpkg.ConvertToQdrantPayloadForTest(map[string]any{
							"title": "demo",
						}),
					}},
				}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				searchCalls.Add(1)
				return &pb.SearchResponse{}, nil
			},
		},
		&bytes.Buffer{},
		false,
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
		Vector: &fragmodel.SparseVector{
			Indices: []uint32{1, 3},
			Values:  []float32{1, 0.5},
		},
		TopK: 1,
	})
	if err != nil || len(results) != 1 {
		t.Fatalf("SearchSparseWithFilter() = (%+v, %v)", results, err)
	}
	if queryCalls.Load() != 1 || searchCalls.Load() != 0 {
		t.Fatalf("expected query api only, got query=%d search=%d", queryCalls.Load(), searchCalls.Load())
	}
}

func TestClientSearchSparseWithFilterDocumentFailsWhenQueryUnsupported(t *testing.T) {
	t.Parallel()

	var queryCalls atomic.Int32
	var searchCalls atomic.Int32
	client := newClientWithLogBuffer(
		newCollectionsClientForLoggingTests(),
		fakePointsClient{
			queryFn: func(_ context.Context, _ *pb.QueryPoints, _ ...grpc.CallOption) (*pb.QueryResponse, error) {
				queryCalls.Add(1)
				return &pb.QueryResponse{}, nil
			},
			searchFn: func(_ context.Context, _ *pb.SearchPoints, _ ...grpc.CallOption) (*pb.SearchResponse, error) {
				searchCalls.Add(1)
				return &pb.SearchResponse{}, nil
			},
		},
		&bytes.Buffer{},
		false,
		100,
	)
	qdrantpkg.SetCapabilityForTest(client, qdrantpkg.CapabilitySnapshotForTest{
		Version:           "1.12.2",
		QuerySupported:    false,
		SelectedSparseAPI: "legacy_search",
		ProbeStatus:       "ready",
		LastProbeAt:       time.Now(),
	})

	_, err := client.SearchSparseWithFilter(context.Background(), fragmodel.SparseSearchRequest{
		Collection: testCollectionName,
		Document: &fragmodel.SparseDocument{
			Text:  "中文 标题",
			Model: fragmodel.DefaultSparseModelName,
		},
		TopK: 1,
	})
	if err == nil {
		t.Fatal("expected document sparse search to fail when query is unsupported")
	}
	if queryCalls.Load() != 0 || searchCalls.Load() != 0 {
		t.Fatalf("expected no qdrant call, got query=%d search=%d", queryCalls.Load(), searchCalls.Load())
	}
}
