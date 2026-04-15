package sourcebinding_test

import (
	"testing"

	sourcebinding "magic/internal/domain/knowledge/sourcebinding/service"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

const testLegacyTeamshareNewFileID = "FILE-NEW"

func TestBuildLegacyTeamshareBindingPrefersKnowledgeBaseRoot(t *testing.T) {
	t.Parallel()

	binding := sourcebinding.BuildLegacyTeamshareBinding("ORG-1", "KB-1", "user-1", thirdfilemappingpkg.RepairGroup{
		KnowledgeCode:   "KB-1",
		ThirdFileID:     "FILE-1",
		KnowledgeBaseID: "TS-KB-1",
		GroupRef:        "GROUP-1",
	})

	if binding.Provider != sourcebinding.ProviderTeamshare || binding.RootType != sourcebinding.RootTypeKnowledgeBase || binding.RootRef != "TS-KB-1" {
		t.Fatalf("unexpected binding: %#v", binding)
	}
	rootContext, _ := binding.SyncConfig["root_context"].(map[string]any)
	if rootContext["knowledge_base_id"] != "TS-KB-1" {
		t.Fatalf("expected root context knowledge_base_id, got %#v", binding.SyncConfig)
	}
}

func TestBuildLegacyTeamshareBindingFallsBackToFolderAndFile(t *testing.T) {
	t.Parallel()

	folderBinding := sourcebinding.BuildLegacyTeamshareBinding("ORG-1", "KB-1", "user-1", thirdfilemappingpkg.RepairGroup{
		ThirdFileID: "FILE-1",
		GroupRef:    "GROUP-1",
	})
	if folderBinding.RootType != sourcebinding.RootTypeFolder || folderBinding.RootRef != "GROUP-1" {
		t.Fatalf("expected folder binding, got %#v", folderBinding)
	}

	fileBinding := sourcebinding.BuildLegacyTeamshareBinding("ORG-1", "KB-1", "user-1", thirdfilemappingpkg.RepairGroup{
		ThirdFileID: "FILE-2",
	})
	if fileBinding.RootType != sourcebinding.RootTypeFile || fileBinding.RootRef != "FILE-2" {
		t.Fatalf("expected file binding, got %#v", fileBinding)
	}
}

func TestPlanLegacyTeamshareBindingsSkipsCoveredGroups(t *testing.T) {
	t.Parallel()

	planned := sourcebinding.PlanLegacyTeamshareBindings(
		"ORG-1",
		"KB-1",
		"user-1",
		[]sourcebinding.Binding{{
			Provider: sourcebinding.ProviderTeamshare,
			RootType: sourcebinding.RootTypeFile,
			RootRef:  "FILE-EXIST",
			Enabled:  true,
		}},
		[]thirdfilemappingpkg.RepairGroup{
			{ThirdFileID: "FILE-EXIST"},
			{ThirdFileID: testLegacyTeamshareNewFileID},
		},
	)

	if len(planned) != 1 {
		t.Fatalf("expected one planned binding, got %#v", planned)
	}
	if planned[0].RootRef != testLegacyTeamshareNewFileID {
		t.Fatalf("expected %s planned, got %#v", testLegacyTeamshareNewFileID, planned[0])
	}
}
