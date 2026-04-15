package retrieval

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/go-ego/gse"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

func TestBuildSparseSearchRequestUsesSharedServiceSegmenter(t *testing.T) {
	service := NewService(nil, nil, Infra{})

	var loadCalls atomic.Int32
	service.segmenterProvider = newRetrievalSegmenterProvider(func(segmenter *gse.Segmenter) error {
		loadCalls.Add(1)
		return loadTestSegmenterDict(segmenter)
	})

	input := similaritySingleQueryInput{
		VectorCollectionName:    "collection",
		TermCollectionName:      "collection",
		SparseBackend:           fragmodel.SparseBackendClientBM25QdrantIDFV1,
		Query:                   "小哥对录音纪要提出了哪些问题",
		CandidateScoreThreshold: 0.1,
		Hybrid: hybridSearchConfig{
			SparseTopK: 5,
		},
	}

	for range 5 {
		request, ok := service.buildSparseSearchRequest(context.Background(), input)
		if !ok {
			t.Fatal("expected sparse search request to be built")
		}
		if request.Vector == nil {
			t.Fatalf("expected sparse vector request, got %#v", request)
		}
		if request.ScoreThreshold != 0.1 {
			t.Fatalf("expected sparse threshold to follow candidate threshold, got %#v", request)
		}
	}

	if loadCalls.Load() != 1 {
		t.Fatalf("expected service segmenter to load once, got %d", loadCalls.Load())
	}
}

func TestDefaultSegmenterProviderIsProcessSingleton(t *testing.T) {
	serviceA := NewService(nil, nil, Infra{})
	serviceB := NewService(nil, nil, Infra{})
	if serviceA.segmenterProvider == nil || serviceB.segmenterProvider == nil {
		t.Fatal("expected default services to initialize segmenter provider")
	}
	if serviceA.segmenterProvider != defaultRetrievalSegmenterProvider {
		t.Fatalf("expected serviceA to reuse default singleton provider, got %p want %p", serviceA.segmenterProvider, defaultRetrievalSegmenterProvider)
	}
	if serviceB.segmenterProvider != defaultRetrievalSegmenterProvider {
		t.Fatalf("expected serviceB to reuse default singleton provider, got %p want %p", serviceB.segmenterProvider, defaultRetrievalSegmenterProvider)
	}
	if NewDefaultSegmenterProvider() != defaultRetrievalSegmenterProvider {
		t.Fatal("expected public default provider accessor to return singleton provider")
	}

	packageSegmenter := sharedSegmenterFromAnalyzer(newRetrievalAnalyzer())
	if packageSegmenter == nil {
		t.Fatal("expected package-level analyzer to initialize segmenter")
	}

	serviceSegmenterA := SharedSegmenterForTest(serviceA)
	if serviceSegmenterA == nil {
		t.Fatal("expected first service analyzer to initialize segmenter")
	}
	serviceSegmenterB := SharedSegmenterForTest(serviceB)
	if serviceSegmenterB == nil {
		t.Fatal("expected second service analyzer to initialize segmenter")
	}

	if packageSegmenter != serviceSegmenterA || serviceSegmenterA != serviceSegmenterB {
		t.Fatalf(
			"expected package helpers and services to share one segmenter instance, got package=%p serviceA=%p serviceB=%p",
			packageSegmenter,
			serviceSegmenterA,
			serviceSegmenterB,
		)
	}
}

func sharedSegmenterFromAnalyzer(analyzer retrievalAnalyzer) *gse.Segmenter {
	switch segmenter := analyzer.segmenter.(type) {
	case nil:
		return nil
	case *gse.Segmenter:
		return segmenter
	case lockedSegmenter:
		return segmenter.unwrap()
	default:
		return nil
	}
}
