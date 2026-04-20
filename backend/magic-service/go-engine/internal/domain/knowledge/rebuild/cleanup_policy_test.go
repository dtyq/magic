package rebuild_test

import (
	"testing"

	rebuild "magic/internal/domain/knowledge/rebuild"
)

func TestCleanupPolicyCandidates(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		collection string
		want       bool
	}{
		{name: "shared alias", collection: "magic_knowledge", want: false},
		{name: "fixed active", collection: "magic_knowledge_active", want: false},
		{name: "fixed shadow", collection: "magic_knowledge_shadow", want: false},
		{name: "shadow", collection: "magic_knowledge_shadow_r1", want: true},
		{name: "active physical", collection: "magic_knowledge_r_r1", want: true},
		{name: "memory", collection: "magic_memory", want: true},
		{name: "blank", collection: "   ", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := rebuild.IsCleanupCandidate(tc.collection); got != tc.want {
				t.Fatalf("IsCleanupCandidate(%q) = %v, want %v", tc.collection, got, tc.want)
			}
		})
	}
}

func TestCleanupPolicyDecision(t *testing.T) {
	t.Parallel()

	if safe, reason := rebuild.DecideCleanupAction("magic_knowledge_shadow_r1", 0, "", "", false); !safe || reason != "" {
		t.Fatalf("expected safe cleanup, got (%v, %q)", safe, reason)
	}
	if safe, reason := rebuild.DecideCleanupAction("magic_knowledge_shadow_r1", 0, "magic_knowledge_shadow_r1", "", false); safe || reason == "" {
		t.Fatalf("expected alias target kept, got (%v, %q)", safe, reason)
	}
	if safe, reason := rebuild.DecideCleanupAction("magic_knowledge_shadow_r1", 0, "", "magic_knowledge_shadow_r1", false); safe || reason == "" {
		t.Fatalf("expected meta physical kept, got (%v, %q)", safe, reason)
	}
	if safe, reason := rebuild.DecideCleanupAction("magic_knowledge_shadow_r1", 2, "", "", false); safe || reason == "" {
		t.Fatalf("expected non-empty collection kept, got (%v, %q)", safe, reason)
	}
	if safe, reason := rebuild.DecideCleanupAction("magic_knowledge_shadow_r1", 2, "", "", true); !safe || reason != "" {
		t.Fatalf("expected forced delete for non-empty collection, got (%v, %q)", safe, reason)
	}
}

func TestCleanupPolicyApplyDeletePrefix(t *testing.T) {
	t.Parallel()

	if !rebuild.CanApplyDeleteCollection("KNOWLEDGE-abc--1") {
		t.Fatal("expected KNOWLEDGE-prefixed collection to be deletable on apply")
	}
	if rebuild.CanApplyDeleteCollection("cleanup_probe_non_empty") {
		t.Fatal("expected non-KNOWLEDGE collection to be blocked on apply")
	}
}

func TestCleanupPolicyDualWriteState(t *testing.T) {
	t.Parallel()

	if rebuild.ShouldDeleteDualWriteState("run-1", &rebuild.VectorDualWriteState{RunID: "run-1"}) {
		t.Fatal("current running rebuild should block dualwrite cleanup")
	}
	if rebuild.ShouldDeleteDualWriteState("", nil) {
		t.Fatal("nil dualwrite state should not be deleted")
	}
	if rebuild.ShouldDeleteDualWriteState("", &rebuild.VectorDualWriteState{}) {
		t.Fatal("empty dualwrite state should not be deleted")
	}
	if rebuild.ShouldDeleteDualWriteState("", &rebuild.VectorDualWriteState{RunID: "run-1", Enabled: true}) {
		t.Fatal("enabled dualwrite state should not be deleted")
	}
	if !rebuild.ShouldDeleteDualWriteState("", &rebuild.VectorDualWriteState{RunID: "run-1", Enabled: false}) {
		t.Fatal("disabled stale dualwrite state should be deleted")
	}
}
