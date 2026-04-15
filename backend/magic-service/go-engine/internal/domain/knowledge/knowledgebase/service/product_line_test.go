package knowledgebase_test

import (
	"context"
	"errors"
	"testing"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
)

var errProductLineBindingReaderBoom = errors.New("boom")

func TestResolveKnowledgeBaseTypeByAgentCodes(t *testing.T) {
	t.Parallel()

	if got := knowledgebasedomain.ResolveKnowledgeBaseTypeByAgentCodes(nil); got != knowledgebasedomain.KnowledgeBaseTypeFlowVector {
		t.Fatalf("expected flow vector, got %q", got)
	}
	if got := knowledgebasedomain.ResolveKnowledgeBaseTypeByAgentCodes([]string{" SMA-1 "}); got != knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee {
		t.Fatalf("expected digital employee, got %q", got)
	}
}

func TestProductLineResolverResolveKnowledgeBaseTypeDefaultsToFlowVectorWhenBindingMissing(t *testing.T) {
	t.Parallel()

	resolver := knowledgebasedomain.NewProductLineResolver(&bindingReaderStub{})

	got, err := resolver.ResolveKnowledgeBaseType(context.Background(), "KB-1")
	if err != nil {
		t.Fatalf("ResolveKnowledgeBaseType returned error: %v", err)
	}
	if got != knowledgebasedomain.KnowledgeBaseTypeFlowVector {
		t.Fatalf("expected flow vector, got %q", got)
	}
}

func TestProductLineResolverResolveSnapshotUsesBatchBindingLookupAndDefaultsMissingToFlowVector(t *testing.T) {
	t.Parallel()

	reader := &bindingReaderStub{
		batchResult: map[string][]string{
			"KB-1": {"SMA-1"},
		},
	}
	resolver := knowledgebasedomain.NewProductLineResolver(reader)

	snapshot, err := resolver.ResolveSnapshot(context.Background(), []string{"KB-1", "KB-2", "KB-1"})
	if err != nil {
		t.Fatalf("ResolveSnapshot returned error: %v", err)
	}
	if reader.batchCalls != 1 {
		t.Fatalf("expected one batch call, got %d", reader.batchCalls)
	}
	if snapshot.KnowledgeBaseTypes["KB-1"] != knowledgebasedomain.KnowledgeBaseTypeDigitalEmployee {
		t.Fatalf("expected KB-1 digital employee, got %q", snapshot.KnowledgeBaseTypes["KB-1"])
	}
	if snapshot.KnowledgeBaseTypes["KB-2"] != knowledgebasedomain.KnowledgeBaseTypeFlowVector {
		t.Fatalf("expected KB-2 flow vector, got %q", snapshot.KnowledgeBaseTypes["KB-2"])
	}
}

func TestProductLineResolverResolveSnapshotReturnsBindingLookupError(t *testing.T) {
	t.Parallel()

	reader := &bindingReaderStub{err: errProductLineBindingReaderBoom}
	resolver := knowledgebasedomain.NewProductLineResolver(reader)

	_, err := resolver.ResolveSnapshot(context.Background(), []string{"KB-1"})
	if err == nil {
		t.Fatal("expected error")
	}
}

type bindingReaderStub struct {
	batchResult map[string][]string
	err         error
	batchCalls  int
}

func (s *bindingReaderStub) ListBindIDsByKnowledgeBase(
	context.Context,
	string,
	knowledgebasedomain.BindingType,
) ([]string, error) {
	return nil, nil
}

func (s *bindingReaderStub) ListBindIDsByKnowledgeBases(
	context.Context,
	[]string,
	knowledgebasedomain.BindingType,
) (map[string][]string, error) {
	s.batchCalls++
	if s.err != nil {
		return nil, s.err
	}
	return s.batchResult, nil
}
