package sourcebinding_test

import (
	"testing"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebinding "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestNormalizeBindingsForKnowledgeBaseTypeForcesFlowTeamshareRealtime(t *testing.T) {
	t.Parallel()

	bindings := sourcebinding.NormalizeBindingsForKnowledgeBaseType("flow_vector", []sourcebindingentity.Binding{{
		ID:       1,
		Provider: sourcebindingentity.ProviderTeamshare,
		RootType: sourcebindingentity.RootTypeKnowledgeBase,
		RootRef:  "KB-1",
		SyncMode: sourcebindingentity.SyncModeManual,
		Enabled:  true,
	}})

	if got := bindings[0].SyncMode; got != sourcebindingentity.SyncModeRealtime {
		t.Fatalf("expected flow teamshare binding sync_mode=%q, got %q", sourcebindingentity.SyncModeRealtime, got)
	}
}

func TestNormalizeBindingsForKnowledgeBaseTypeKeepsDigitalEmployeeSyncMode(t *testing.T) {
	t.Parallel()

	bindings := sourcebinding.NormalizeBindingsForKnowledgeBaseType("digital_employee", []sourcebindingentity.Binding{{
		ID:       1,
		Provider: sourcebindingentity.ProviderTeamshare,
		RootType: sourcebindingentity.RootTypeKnowledgeBase,
		RootRef:  "KB-1",
		SyncMode: sourcebindingentity.SyncModeManual,
		Enabled:  true,
	}})

	if got := bindings[0].SyncMode; got != sourcebindingentity.SyncModeManual {
		t.Fatalf("expected digital employee teamshare binding sync_mode=%q, got %q", sourcebindingentity.SyncModeManual, got)
	}
}

func TestFlowTeamshareBindingIDsNeedingRealtimeFiltersByProductLine(t *testing.T) {
	t.Parallel()

	ids := sourcebinding.FlowTeamshareBindingIDsNeedingRealtime(map[string]string{
		"KB-FLOW":    "flow_vector",
		"KB-DIGITAL": "digital_employee",
	}, []sourcebindingentity.Binding{
		{
			ID:                11,
			KnowledgeBaseCode: "KB-FLOW",
			Provider:          sourcebindingentity.ProviderTeamshare,
			RootType:          sourcebindingentity.RootTypeKnowledgeBase,
			RootRef:           "ROOT",
			SyncMode:          sourcebindingentity.SyncModeManual,
			Enabled:           true,
		},
		{
			ID:                12,
			KnowledgeBaseCode: "KB-FLOW",
			Provider:          sourcebindingentity.ProviderTeamshare,
			RootType:          sourcebindingentity.RootTypeKnowledgeBase,
			RootRef:           "ROOT",
			SyncMode:          sourcebindingentity.SyncModeRealtime,
			Enabled:           true,
		},
		{
			ID:                13,
			KnowledgeBaseCode: "KB-DIGITAL",
			Provider:          sourcebindingentity.ProviderTeamshare,
			RootType:          sourcebindingentity.RootTypeKnowledgeBase,
			RootRef:           "ROOT",
			SyncMode:          sourcebindingentity.SyncModeManual,
			Enabled:           true,
		},
	})

	if len(ids) != 1 || ids[0] != 11 {
		t.Fatalf("expected only flow manual teamshare binding to need repair, got %#v", ids)
	}
}
