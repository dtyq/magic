package shared_test

import (
	"testing"

	"magic/internal/domain/knowledge/shared"
)

func TestResolveEffectiveSegmentRuleConvertsPercentOverlap(t *testing.T) {
	t.Parallel()

	effective := shared.ResolveEffectiveSegmentRule(&shared.SegmentRule{
		Separator:        `\n`,
		ChunkSize:        800,
		ChunkOverlap:     10,
		ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
	}, shared.SegmentRuleDefaults{
		Separator:    "\n\n",
		ChunkSize:    1000,
		ChunkOverlap: 80,
	})

	if effective.Separator != "\n" {
		t.Fatalf("expected decoded separator, got %q", effective.Separator)
	}
	if effective.ChunkSize != 800 || effective.ChunkOverlap != 80 {
		t.Fatalf("unexpected effective segment rule: %#v", effective)
	}
	if effective.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("expected percent overlap unit, got %#v", effective)
	}
}

func TestResolveEffectiveSegmentRuleKeepsAbsoluteOverlap(t *testing.T) {
	t.Parallel()

	effective := shared.ResolveEffectiveSegmentRule(&shared.SegmentRule{
		ChunkSize:        800,
		ChunkOverlap:     10,
		ChunkOverlapUnit: shared.ChunkOverlapUnitAbsolute,
	}, shared.SegmentRuleDefaults{
		Separator:    "\n\n",
		ChunkSize:    1000,
		ChunkOverlap: 80,
	})

	if effective.ChunkSize != 800 || effective.ChunkOverlap != 10 {
		t.Fatalf("unexpected absolute segment rule: %#v", effective)
	}
}

func TestResolveEffectiveSegmentRuleClampsPercentOverlap(t *testing.T) {
	t.Parallel()

	effective := shared.ResolveEffectiveSegmentRule(&shared.SegmentRule{
		ChunkSize:        3,
		ChunkOverlap:     100,
		ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
	}, shared.SegmentRuleDefaults{
		Separator:    "\n\n",
		ChunkSize:    1000,
		ChunkOverlap: 80,
	})

	if effective.ChunkOverlap != 2 {
		t.Fatalf("expected clamped overlap 2, got %#v", effective)
	}
}

func TestNormalizeFragmentConfigDefaultsOverlapUnitToAbsolute(t *testing.T) {
	t.Parallel()

	normalized := shared.NormalizeFragmentConfig(&shared.FragmentConfig{
		Mode: shared.FragmentModeCustom,
		Normal: &shared.NormalFragmentConfig{
			SegmentRule: &shared.SegmentRule{
				ChunkSize:    200,
				ChunkOverlap: 20,
			},
		},
	})

	if normalized == nil || normalized.Normal == nil || normalized.Normal.SegmentRule == nil {
		t.Fatalf("expected normalized config, got %#v", normalized)
	}
	if normalized.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitAbsolute {
		t.Fatalf("expected absolute overlap unit, got %#v", normalized.Normal.SegmentRule)
	}
}
