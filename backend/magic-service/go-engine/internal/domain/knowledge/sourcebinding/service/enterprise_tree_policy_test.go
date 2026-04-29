package sourcebinding_test

import (
	"testing"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
)

const testEnterpriseKnowledgeBaseID = "KB-1"

func TestBuildEnterpriseBindingExpansionSpecsWholeKnowledgeBase(t *testing.T) {
	t.Parallel()

	specs := sourcebindingservice.BuildEnterpriseBindingExpansionSpecs(sourcebindingentity.Binding{
		Provider: sourcebindingentity.ProviderTeamshare,
		RootType: sourcebindingentity.RootTypeKnowledgeBase,
		RootRef:  testEnterpriseKnowledgeBaseID,
	})
	if len(specs) != 1 {
		t.Fatalf("expected one whole-knowledge-base spec, got %#v", specs)
	}
	if specs[0].RootType != sourcebindingentity.RootTypeKnowledgeBase || specs[0].RootRef != testEnterpriseKnowledgeBaseID {
		t.Fatalf("unexpected spec: %#v", specs[0])
	}
	if specs[0].RootContext["knowledge_base_id"] != testEnterpriseKnowledgeBaseID {
		t.Fatalf("expected knowledge_base_id root context, got %#v", specs[0].RootContext)
	}
}

func TestBuildEnterpriseBindingExpansionSpecsTargetsRespectFolderAndFileSemantics(t *testing.T) {
	t.Parallel()

	specs := sourcebindingservice.BuildEnterpriseBindingExpansionSpecs(sourcebindingentity.Binding{
		Provider: sourcebindingentity.ProviderTeamshare,
		RootType: sourcebindingentity.RootTypeKnowledgeBase,
		RootRef:  testEnterpriseKnowledgeBaseID,
		SyncConfig: map[string]any{
			"root_context": map[string]any{
				"knowledge_base_id": testEnterpriseKnowledgeBaseID,
				"tenant_id":         "TENANT-1",
			},
		},
		Targets: []sourcebindingentity.BindingTarget{
			{TargetType: sourcebindingentity.TargetTypeFolder, TargetRef: "folder-1"},
			{TargetType: "", TargetRef: "file-1"},
		},
	})
	if len(specs) != 2 {
		t.Fatalf("expected two target specs, got %#v", specs)
	}
	if specs[0].RootType != sourcebindingentity.RootTypeFolder || specs[0].RootRef != "folder-1" {
		t.Fatalf("unexpected folder spec: %#v", specs[0])
	}
	if specs[1].RootType != sourcebindingentity.RootTypeFile || specs[1].RootRef != "file-1" {
		t.Fatalf("unexpected file spec: %#v", specs[1])
	}
	if specs[0].RootContext["tenant_id"] != "TENANT-1" || specs[1].RootContext["knowledge_base_id"] != testEnterpriseKnowledgeBaseID {
		t.Fatalf("expected root context preserved, got %#v", specs)
	}
}
