package knowledgeroute_test

import (
	"context"
	"testing"

	"magic/internal/pkg/knowledgeroute"
)

func TestWithResolveRebuildOverride(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection:     " active ",
		TargetTermCollection: " shadow_term ",
		TargetModel:          " text-embedding-3-large ",
		TargetSparseBackend:  " bm25 ",
	})

	override, ok := knowledgeroute.ResolveRebuildOverride(ctx)
	if !ok {
		t.Fatal("expected override in context")
	}
	if override.TargetCollection != "active" || override.TargetTermCollection != "shadow_term" {
		t.Fatalf("unexpected collection override: %#v", override)
	}
	if override.TargetModel != "text-embedding-3-large" || override.TargetSparseBackend != "bm25" {
		t.Fatalf("unexpected model override: %#v", override)
	}
}

func TestWithResolveRebuildOverrideRejectsEmpty(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetCollection: "   ",
	})
	if _, ok := knowledgeroute.ResolveRebuildOverride(ctx); ok {
		t.Fatal("expected empty override to be ignored")
	}
}
