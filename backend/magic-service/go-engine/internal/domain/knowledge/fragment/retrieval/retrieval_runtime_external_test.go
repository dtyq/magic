package retrieval_test

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/go-ego/gse"

	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
)

func TestRetrievalAnalyzerUsesSingletonSegmenter(t *testing.T) {
	t.Parallel()

	service := retrieval.NewService(nil, nil, retrieval.Infra{})

	var loadCalls atomic.Int32
	loadStarted := make(chan struct{})
	releaseLoad := make(chan struct{})
	retrieval.SetSegmenterLoaderForTest(service, func(segmenter *gse.Segmenter) error {
		loadCalls.Add(1)
		select {
		case <-loadStarted:
		default:
			close(loadStarted)
		}
		<-releaseLoad
		return nil
	})

	const goroutines = 16
	segmenters := make([]*gse.Segmenter, goroutines)
	var wg sync.WaitGroup
	for i := range goroutines {
		index := i
		wg.Go(func() {
			segmenters[index] = retrieval.SharedSegmenterForTest(service)
		})
	}

	<-loadStarted
	close(releaseLoad)
	wg.Wait()

	if loadCalls.Load() != 1 {
		t.Fatalf("expected segmenter to load once, got %d", loadCalls.Load())
	}

	firstSegmenter := segmenters[0]
	if firstSegmenter == nil {
		t.Fatal("expected shared segmenter to be initialized")
	}
	for i := 1; i < len(segmenters); i++ {
		if segmenters[i] != firstSegmenter {
			t.Fatalf("expected all analyzers to share one segmenter instance, mismatch at %d", i)
		}
	}
}
