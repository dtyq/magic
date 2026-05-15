package kbapp

import (
	"testing"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
)

func TestBuildSourceBindingsForcesFlowTeamshareRealtime(t *testing.T) {
	t.Parallel()

	app := &KnowledgeBaseAppService{}
	bindings := app.buildSourceBindings(&kbentity.KnowledgeBase{
		Code:              "KB-FLOW",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
	}, "ORG1", "U1", []sourcebindingdomain.Binding{{
		Provider: sourcebindingdomain.ProviderTeamshare,
		RootType: sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:  "TEAMSHARE-KB",
		SyncMode: sourcebindingdomain.SyncModeManual,
		Enabled:  true,
	}})

	if len(bindings) != 1 || bindings[0].SyncMode != sourcebindingdomain.SyncModeRealtime {
		t.Fatalf("expected flow teamshare binding to be realtime, got %#v", bindings)
	}
}

func TestBuildSourceBindingsKeepsDigitalEmployeeTeamshareManual(t *testing.T) {
	t.Parallel()

	app := &KnowledgeBaseAppService{}
	bindings := app.buildSourceBindings(&kbentity.KnowledgeBase{
		Code:              "KB-DIGITAL",
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
	}, "ORG1", "U1", []sourcebindingdomain.Binding{{
		Provider: sourcebindingdomain.ProviderTeamshare,
		RootType: sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:  "TEAMSHARE-KB",
		SyncMode: sourcebindingdomain.SyncModeManual,
		Enabled:  true,
	}})

	if len(bindings) != 1 || bindings[0].SyncMode != sourcebindingdomain.SyncModeManual {
		t.Fatalf("expected digital employee teamshare binding to stay manual, got %#v", bindings)
	}
}
