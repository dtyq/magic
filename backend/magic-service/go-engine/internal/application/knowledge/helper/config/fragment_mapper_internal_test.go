package config

import (
	"encoding/json"
	"strings"
	"testing"

	"magic/internal/domain/knowledge/shared"
)

func TestFragmentConfigMapperRoundTripAndClone(t *testing.T) {
	t.Parallel()

	dto := buildFragmentConfigDTO()
	cfg := FragmentConfigDTOToEntity(dto)

	assertFragmentConfigEntity(t, cfg)

	dto.Normal.TextPreprocessRule[0] = 88
	dto.Hierarchy.TextPreprocessRule[0] = 77
	if cfg.Normal == nil || cfg.Normal.TextPreprocessRule[0] != 3 {
		t.Fatalf("expected cloned slices, got %#v", cfg)
	}
	if cfg.Hierarchy == nil || cfg.Hierarchy.TextPreprocessRule[0] != 1 || !cfg.Hierarchy.KeepHierarchyInfo {
		t.Fatalf("expected hierarchy config to be cloned, got %#v", cfg.Hierarchy)
	}

	assertFragmentConfigRoundTrip(t, cfg)
}

func buildFragmentConfigDTO() *FragmentConfigDTO {
	return &FragmentConfigDTO{
		Mode: int(shared.FragmentModeCustom),
		Normal: &NormalFragmentConfigDTO{
			TextPreprocessRule: []int{3, 4},
			SegmentRule: &SegmentRuleDTO{
				Separator:        "\n",
				ChunkSize:        128,
				ChunkOverlap:     16,
				ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
			},
		},
		Hierarchy: &HierarchyFragmentConfigDTO{
			MaxLevel:           4,
			TextPreprocessRule: []int{1, 3},
			KeepHierarchyInfo:  true,
		},
	}
}

func assertFragmentConfigEntity(t *testing.T, cfg *shared.FragmentConfig) {
	t.Helper()

	if cfg == nil || cfg.Mode != shared.FragmentModeCustom {
		t.Fatalf("unexpected entity config: %#v", cfg)
	}
	if cfg.Normal == nil || cfg.Normal.SegmentRule == nil || cfg.Normal.SegmentRule.ChunkOverlap != 16 {
		t.Fatalf("expected normal config kept, got %#v", cfg.Normal)
	}
	if cfg.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("expected overlap unit kept, got %#v", cfg.Normal.SegmentRule)
	}
}

func assertFragmentConfigRoundTrip(t *testing.T, cfg *shared.FragmentConfig) {
	t.Helper()

	roundTripDTO := FragmentConfigEntityToDTO(cfg)
	if roundTripDTO == nil || roundTripDTO.Mode != int(shared.FragmentModeCustom) {
		t.Fatalf("unexpected dto: %#v", roundTripDTO)
	}
	if roundTripDTO.Normal == nil || roundTripDTO.Normal.SegmentRule == nil || roundTripDTO.Normal.SegmentRule.ChunkOverlap != 16 {
		t.Fatalf("expected normal segment rule, got %#v", roundTripDTO.Normal)
	}
	if roundTripDTO.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("expected overlap unit round trip, got %#v", roundTripDTO.Normal.SegmentRule)
	}
	if roundTripDTO.Hierarchy == nil || !roundTripDTO.Hierarchy.KeepHierarchyInfo {
		t.Fatalf("expected hierarchy keep flag kept, got %#v", roundTripDTO.Hierarchy)
	}

	outputDTO := FragmentConfigEntityToOutputDTO(cfg)
	if outputDTO == nil || outputDTO.Normal == nil || outputDTO.Normal.SegmentRule == nil {
		t.Fatalf("unexpected output dto: %#v", outputDTO)
	}
	if outputDTO.Normal.SegmentRule.ChunkOverlap != 16 {
		t.Fatalf("unexpected overlap output: %#v", outputDTO.Normal.SegmentRule)
	}
	if outputDTO.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitPercent {
		t.Fatalf("unexpected overlap unit output: %#v", outputDTO.Normal.SegmentRule)
	}
	if outputDTO.Hierarchy == nil || !outputDTO.Hierarchy.KeepHierarchyInfo {
		t.Fatalf("expected keep_hierarchy_info kept in output, got %#v", outputDTO.Hierarchy)
	}

	normalizedOutput := NormalizeFragmentConfigOutputDTO(&FragmentConfigOutputDTO{
		Mode: int(shared.FragmentModeCustom),
		Normal: &NormalFragmentConfigOutputDTO{
			SegmentRule: &SegmentRuleOutputDTO{
				ChunkSize:    64,
				ChunkOverlap: 8,
			},
		},
	})
	if normalizedOutput == nil || normalizedOutput.Normal == nil || normalizedOutput.Normal.SegmentRule == nil {
		t.Fatalf("unexpected normalized output dto: %#v", normalizedOutput)
	}
	if normalizedOutput.Normal.SegmentRule.ChunkOverlapUnit != shared.ChunkOverlapUnitAbsolute {
		t.Fatalf("expected output normalize absolute unit, got %#v", normalizedOutput.Normal.SegmentRule)
	}
}

func TestFragmentConfigMapperNilInputs(t *testing.T) {
	t.Parallel()

	if FragmentConfigDTOToEntity(nil) != nil {
		t.Fatal("expected nil entity config")
	}
	if FragmentConfigEntityToDTO(nil) != nil {
		t.Fatal("expected nil dto config")
	}
	if FragmentConfigEntityToOutputDTO(nil) != nil {
		t.Fatal("expected nil output dto config")
	}
	if segmentRuleDTOToEntity(nil) != nil {
		t.Fatal("expected nil segment entity")
	}
	if segmentRuleEntityToDTO(nil) != nil {
		t.Fatal("expected nil segment dto")
	}
	if segmentRuleEntityToOutputDTO(nil) != nil {
		t.Fatal("expected nil segment output dto")
	}
}

func TestFragmentConfigMapperNormalizesNilTextPreprocessRuleToEmptyArray(t *testing.T) {
	t.Parallel()

	cfg := &shared.FragmentConfig{
		Mode: shared.FragmentModeCustom,
		Normal: &shared.NormalFragmentConfig{
			SegmentRule: &shared.SegmentRule{
				Separator:    "\n\n",
				ChunkSize:    500,
				ChunkOverlap: 50,
			},
		},
		Hierarchy: &shared.HierarchyFragmentConfig{
			MaxLevel:          3,
			KeepHierarchyInfo: true,
		},
	}

	dto := FragmentConfigEntityToDTO(cfg)
	if dto == nil || dto.Normal == nil || dto.Hierarchy == nil {
		t.Fatalf("expected fragment config dto, got %#v", dto)
	}
	if dto.Normal.TextPreprocessRule == nil || len(dto.Normal.TextPreprocessRule) != 0 {
		t.Fatalf("expected normal text preprocess rule to be empty slice, got %#v", dto.Normal.TextPreprocessRule)
	}
	if dto.Hierarchy.TextPreprocessRule == nil || len(dto.Hierarchy.TextPreprocessRule) != 0 {
		t.Fatalf("expected hierarchy text preprocess rule to be empty slice, got %#v", dto.Hierarchy.TextPreprocessRule)
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("marshal dto: %v", err)
	}
	if string(data) == "" {
		t.Fatal("expected non-empty json")
	}
	if !strings.Contains(string(data), `"text_preprocess_rule":[]`) {
		t.Fatalf("expected text_preprocess_rule serialized as [], got %s", string(data))
	}

	outputDTO := FragmentConfigEntityToOutputDTO(cfg)
	if outputDTO == nil || outputDTO.Normal == nil || outputDTO.Hierarchy == nil {
		t.Fatalf("expected output dto, got %#v", outputDTO)
	}
	if outputDTO.Normal.TextPreprocessRule == nil || len(outputDTO.Normal.TextPreprocessRule) != 0 {
		t.Fatalf("expected output normal text preprocess rule to be empty slice, got %#v", outputDTO.Normal.TextPreprocessRule)
	}
	if outputDTO.Hierarchy.TextPreprocessRule == nil || len(outputDTO.Hierarchy.TextPreprocessRule) != 0 {
		t.Fatalf("expected output hierarchy text preprocess rule to be empty slice, got %#v", outputDTO.Hierarchy.TextPreprocessRule)
	}
}
