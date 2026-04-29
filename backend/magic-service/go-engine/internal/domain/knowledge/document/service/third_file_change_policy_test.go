package document_test

import (
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
)

func TestBuildThirdFileChangePlanCreatesResyncsAndDeletesByBindingCoverage(t *testing.T) {
	t.Parallel()

	task := &document.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		UserID:            "CALLBACK-USER",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE1",
	}
	bindings := []document.ThirdFileBindingRef{
		{
			ID:                10,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB-ROOT",
			Provider:          "teamshare",
			RootType:          "knowledge_base",
			RootRef:           "TS-KB",
			UserID:            "BIND-USER",
		},
		{
			ID:                20,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB-FOLDER",
			Provider:          "teamshare",
			RootType:          "knowledge_base",
			RootRef:           "TS-KB",
			TargetCount:       1,
		},
	}
	docs := []*docentity.KnowledgeBaseDocument{
		{Code: "DOC-EXISTING", KnowledgeBaseCode: "KB-ROOT", OrganizationCode: "ORG1", SourceBindingID: 10},
		{Code: "DOC-STALE", KnowledgeBaseCode: "KB-OLD", OrganizationCode: "ORG1", SourceBindingID: 99},
	}

	plan := document.BuildThirdFileChangePlan(task, document.ThirdFileCurrentRef{
		ThirdFileID:  "FILE1",
		DocumentName: "current.xlsx",
	}, bindings, docs)

	if len(plan.ResyncDocuments) != 1 || plan.ResyncDocuments[0].Code != "DOC-EXISTING" {
		t.Fatalf("unexpected resync documents: %#v", plan.ResyncDocuments)
	}
	if len(plan.DeleteDocuments) != 1 || plan.DeleteDocuments[0].Code != "DOC-STALE" {
		t.Fatalf("unexpected delete documents: %#v", plan.DeleteDocuments)
	}
	if len(plan.CreateTargets) != 1 {
		t.Fatalf("expected one create target, got %#v", plan.CreateTargets)
	}
	target := plan.CreateTargets[0]
	if target.BindingID != 20 || target.KnowledgeBaseCode != "KB-FOLDER" || target.UserID != "CALLBACK-USER" {
		t.Fatalf("unexpected create target: %#v", target)
	}
	if target.AutoAdded {
		t.Fatal("folder/file targeted binding should not mark document auto-added")
	}
}

func TestBuildThirdFileChangePlanRootBindingAutoAdded(t *testing.T) {
	t.Parallel()

	plan := document.BuildThirdFileChangePlan(
		&document.ThirdFileRevectorizeInput{OrganizationCode: "ORG1", UserID: "U1", ThirdFileID: "FILE1"},
		document.ThirdFileCurrentRef{ThirdFileID: "FILE1", DocumentName: "current.md"},
		[]document.ThirdFileBindingRef{{
			ID:                10,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
			Provider:          "teamshare",
			RootType:          "knowledge_base",
			RootRef:           "TS-KB",
		}},
		nil,
	)

	if len(plan.CreateTargets) != 1 {
		t.Fatalf("expected root binding create target, got %#v", plan.CreateTargets)
	}
	if !plan.CreateTargets[0].AutoAdded {
		t.Fatal("root binding without targets should mark document auto-added")
	}
}
