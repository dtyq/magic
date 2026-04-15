package sourcebinding_test

import (
	"errors"
	"testing"

	sourcebinding "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestValidateBindingsProjectRejectsInvalidTargetType(t *testing.T) {
	t.Parallel()

	err := sourcebinding.ValidateBindings(sourcebinding.SemanticProject, []sourcebinding.Binding{{
		Provider: sourcebinding.ProviderProject,
		RootType: sourcebinding.RootTypeProject,
		RootRef:  "300",
		SyncMode: sourcebinding.SyncModeManual,
		Targets: []sourcebinding.BindingTarget{{
			TargetType: "workspace",
			TargetRef:  "1",
		}},
	}})
	if !errors.Is(err, sourcebinding.ErrTargetTypeInvalid) {
		t.Fatalf("expected ErrTargetTypeInvalid, got %v", err)
	}
}

func TestNormalizeBindingsCanonicalizesGroupTargetAndDefaultSyncMode(t *testing.T) {
	t.Parallel()

	bindings := sourcebinding.NormalizeBindings([]sourcebinding.Binding{{
		Provider: " TeamShare ",
		RootType: " Knowledge_Base ",
		RootRef:  " KB-1 ",
		Targets: []sourcebinding.BindingTarget{{
			TargetType: "group",
			TargetRef:  " G-1 ",
		}},
	}})
	if len(bindings) != 1 {
		t.Fatalf("expected one binding, got %d", len(bindings))
	}
	if bindings[0].Provider != sourcebinding.ProviderTeamshare {
		t.Fatalf("unexpected provider: %#v", bindings[0])
	}
	if bindings[0].RootType != sourcebinding.RootTypeKnowledgeBase {
		t.Fatalf("unexpected root type: %#v", bindings[0])
	}
	if bindings[0].SyncMode != sourcebinding.SyncModeManual {
		t.Fatalf("expected default sync mode manual, got %#v", bindings[0])
	}
	if bindings[0].Targets[0].TargetType != sourcebinding.TargetTypeFolder {
		t.Fatalf("expected group target normalized to folder, got %#v", bindings[0].Targets[0])
	}
	if bindings[0].Targets[0].TargetRef != "G-1" {
		t.Fatalf("expected trimmed target ref, got %#v", bindings[0].Targets[0])
	}
}
