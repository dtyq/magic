package sourcebinding_test

import (
	"testing"

	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebinding "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestBindingCoversSourceFileTargets(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		binding sourcebindingdomain.Binding
		want    bool
	}{
		{
			name:    "whole root",
			binding: realtimeTeamshareCoverageBinding(nil),
			want:    true,
		},
		{
			name: "target file",
			binding: realtimeTeamshareCoverageBinding([]sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "FILE-1"},
			}),
			want: true,
		},
		{
			name: "target folder ancestor",
			binding: realtimeTeamshareCoverageBinding([]sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "FOLDER-1"},
			}),
			want: true,
		},
		{
			name: "target folder outside",
			binding: realtimeTeamshareCoverageBinding([]sourcebindingdomain.BindingTarget{
				{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "FOLDER-2"},
			}),
			want: false,
		},
		{
			name: "manual binding ignored",
			binding: sourcebindingdomain.Binding{
				OrganizationCode: "ORG1",
				Provider:         sourcebindingdomain.ProviderTeamshare,
				RootType:         sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:          "KB-TS",
				SyncMode:         sourcebindingdomain.SyncModeManual,
				Enabled:          true,
			},
			want: false,
		},
	}

	assertCoverageCases(t, cases)
}

func TestBindingCoversSourceFileRoots(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		binding sourcebindingdomain.Binding
		want    bool
	}{
		{
			name: "root file exact",
			binding: sourcebindingdomain.Binding{
				OrganizationCode: "ORG1",
				Provider:         sourcebindingdomain.ProviderTeamshare,
				RootType:         sourcebindingdomain.RootTypeFile,
				RootRef:          "FILE-1",
				SyncMode:         sourcebindingdomain.SyncModeRealtime,
				Enabled:          true,
			},
			want: true,
		},
		{
			name: "root folder ancestor",
			binding: sourcebindingdomain.Binding{
				OrganizationCode: "ORG1",
				Provider:         sourcebindingdomain.ProviderTeamshare,
				RootType:         sourcebindingdomain.RootTypeFolder,
				RootRef:          "ROOT-FOLDER",
				SyncMode:         sourcebindingdomain.SyncModeRealtime,
				Enabled:          true,
			},
			want: true,
		},
	}

	assertCoverageCases(t, cases)
}

func assertCoverageCases(
	t *testing.T,
	cases []struct {
		name    string
		binding sourcebindingdomain.Binding
		want    bool
	},
) {
	t.Helper()
	input := sourcebinding.SourceFileCoverageInput{
		OrganizationCode:   "ORG1",
		Provider:           sourcebindingdomain.ProviderTeamshare,
		RootType:           sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:            "KB-TS",
		FileRef:            "FILE-1",
		AncestorFolderRefs: []string{"FOLDER-1", "ROOT-FOLDER"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := sourcebinding.BindingCoversSourceFile(tc.binding, input); got != tc.want {
				t.Fatalf("BindingCoversSourceFile() = %v, want %v", got, tc.want)
			}
		})
	}
}

func realtimeTeamshareCoverageBinding(targets []sourcebindingdomain.BindingTarget) sourcebindingdomain.Binding {
	return sourcebindingdomain.Binding{
		OrganizationCode: "ORG1",
		Provider:         sourcebindingdomain.ProviderTeamshare,
		RootType:         sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:          "KB-TS",
		SyncMode:         sourcebindingdomain.SyncModeRealtime,
		Enabled:          true,
		Targets:          targets,
	}
}
