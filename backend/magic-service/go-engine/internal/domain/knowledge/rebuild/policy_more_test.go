package rebuild_test

import (
	"errors"
	"testing"

	rebuild "magic/internal/domain/knowledge/rebuild"
)

func TestNormalizeExecutionOptionsAndScope(t *testing.T) {
	t.Parallel()

	got := rebuild.NormalizeExecutionOptions(rebuild.ExecutionOptions{
		Scope:       rebuild.Scope{Mode: rebuild.ScopeModeRequestUserKnowledgeBases, OrganizationCode: " ORG "},
		Concurrency: 99,
		BatchSize:   0,
		Retry:       -1,
	}, rebuild.ModeBlueGreen, 4, 8, 32, 2)

	if got.Scope.Mode != rebuild.ScopeModeOrganization || got.Scope.OrganizationCode != "ORG" {
		t.Fatalf("unexpected normalized scope: %#v", got.Scope)
	}
	if got.Concurrency != 8 || got.BatchSize != 32 || got.Retry != 2 || got.Mode != rebuild.ModeBlueGreen {
		t.Fatalf("unexpected normalized options: %#v", got)
	}
}

func TestRebuildPolicyRoutingHelpers(t *testing.T) {
	t.Parallel()

	scope, escalated, reason := rebuild.DetermineEffectiveScope(rebuild.Scope{Mode: rebuild.ScopeModeOrganization}, true)
	if scope.Mode != rebuild.ScopeModeAll || !escalated || reason != rebuild.ScopeEscalationBootstrap {
		t.Fatalf("unexpected effective scope: %#v escalated=%v reason=%q", scope, escalated, reason)
	}
	if got := rebuild.ResolveRequestedTargetModel("", rebuild.CollectionMeta{Model: "m1"}); got != "m1" {
		t.Fatalf("unexpected target model: %q", got)
	}
	if got := rebuild.SelectMode(rebuild.ModeAuto, rebuild.CollectionMeta{Exists: true, Model: "m1", SparseBackend: "bm25"}, "m1", "bm42"); got != rebuild.ModeBlueGreen {
		t.Fatalf("expected sparse backend mismatch to force bluegreen, got %q", got)
	}
	if got := rebuild.ResolveFixedBlueGreenTarget("active", true, "active", "shadow"); got != "shadow" {
		t.Fatalf("unexpected bluegreen target: %q", got)
	}
	if got := rebuild.ResolveStandbyCollection("shadow", "active", "shadow"); got != "active" {
		t.Fatalf("unexpected standby collection: %q", got)
	}
}

func TestResolveActiveCollectionStateAndValidation(t *testing.T) {
	t.Parallel()

	state := rebuild.ResolveActiveCollectionState(
		rebuild.CollectionMeta{Exists: true, Model: "m1", VectorDimension: 1536, PhysicalCollectionName: "legacy"},
		"alias",
		"",
		&rebuild.VectorCollectionInfo{VectorSize: 3072, HasNamedDenseVector: true, HasSparseVector: true},
		"active",
	)
	if state.PhysicalCollection != "legacy" || state.Dimension != 1536 || !state.SchemaOK || !state.NeedsNormalization {
		t.Fatalf("unexpected active collection state: %#v", state)
	}

	err := rebuild.ValidateInplaceTargetDimension("active", 1536, 1024)
	if !errors.Is(err, rebuild.ErrInplaceModeMismatch) {
		t.Fatalf("expected inplace mismatch, got %v", err)
	}
	if rebuild.NeedsPhysicalNameNormalization(" active ", "active") {
		t.Fatal("fixed collection should not need normalization")
	}
}
