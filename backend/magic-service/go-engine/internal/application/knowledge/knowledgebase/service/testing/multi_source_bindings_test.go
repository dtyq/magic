package kbapp_test

import (
	"context"
	"reflect"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	service "magic/internal/application/knowledge/knowledgebase/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	"magic/internal/pkg/projectfile"
)

func TestKnowledgeBaseAppServiceCreateWithMultipleProjectBindings(t *testing.T) {
	t.Parallel()

	domain := &recordingKnowledgeBaseDomainService{effectiveModel: effectiveEmbeddingModel}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			11: newResolvedProjectFile(100, 11, "selected-11.md"),
			31: newResolvedProjectFile(200, 31, "project-200-31.md"),
			32: newResolvedProjectFile(200, 32, "project-200-32.md"),
		},
		visibleLeafFileIDsByProject: map[int64][]int64{
			200: {31, 32},
		},
	}

	sourceType := int(kbentity.SourceTypeProject)
	app := newProjectBindingCreateApp(t, domain, docManager, sourceBindingRepo, projectFileResolver)
	_, err := app.Create(context.Background(), &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		Name:             "多项目知识库",
		Type:             1,
		SourceType:       &sourceType,
		AgentCodes:       []string{"1"},
		SourceBindings: []kbdto.SourceBindingInput{
			{
				Provider: sourcebindingdomain.ProviderProject,
				RootType: sourcebindingdomain.RootTypeProject,
				RootRef:  "100",
				SyncMode: sourcebindingdomain.SyncModeManual,
				Targets: []kbdto.SourceBindingTargetInput{
					{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "11"},
				},
			},
			{
				Provider: sourcebindingdomain.ProviderProject,
				RootType: sourcebindingdomain.RootTypeProject,
				RootRef:  "200",
				SyncMode: sourcebindingdomain.SyncModeManual,
				Targets:  []kbdto.SourceBindingTargetInput{},
			},
		},
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 2 {
		t.Fatalf("expected two source bindings, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if len(docManager.createInputs) != 3 {
		t.Fatalf("expected three materialized project documents, got %#v", docManager.createInputs)
	}
	if docManager.createInputs[0].AutoAdded {
		t.Fatalf("expected selected project file not auto-added, got %#v", docManager.createInputs[0])
	}
	if !docManager.createInputs[1].AutoAdded || !docManager.createInputs[2].AutoAdded {
		t.Fatalf("expected whole-project documents auto-added, got %#v", docManager.createInputs)
	}
}

func TestKnowledgeBaseAppServiceUpdateWithMultipleProjectBindings(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeProject)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:                99,
			Code:              testAppKnowledgeBaseCode,
			Name:              "old",
			OrganizationCode:  "ORG-1",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
	docManager := &recordingKnowledgeBaseDocumentManager{
		listByProject: map[int64][]*service.ManagedDocument{
			300: {
				{Code: "DOC-41", KnowledgeBaseCode: testAppKnowledgeBaseCode, ProjectID: 300, ProjectFileID: 41},
				{Code: "DOC-42", KnowledgeBaseCode: testAppKnowledgeBaseCode, ProjectID: 300, ProjectFileID: 42},
			},
		},
	}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	projectFileResolver := &projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			42: newResolvedProjectFile(300, 42, "keep-42.md"),
			51: newResolvedProjectFile(400, 51, "whole-51.md"),
		},
		visibleLeafFileIDsByProject: map[int64][]int64{
			400: {51},
		},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetProjectFileResolver(projectFileResolver)
	app.SetTaskFileService(projectFileResolver)
	app.SetKnowledgeBaseBindingRepository(&recordingKnowledgeBaseBindingRepository{
		bindIDsByKnowledgeBase: map[string][]string{testAppKnowledgeBaseCode: {"1"}},
	})

	sourceBindings := newProjectUpdateSourceBindings()
	result, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceBindings:   &sourceBindings,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 2 {
		t.Fatalf("expected two source bindings replaced, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if result == nil || len(result.SourceBindings) != 2 {
		t.Fatalf("expected update result to include two source bindings, got %#v", result)
	}
	if !reflect.DeepEqual(result.SourceBindings[0].Targets, []kbdto.SourceBindingTargetDTO{
		{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
	}) {
		t.Fatalf("expected first project binding targets preserved, got %#v", result.SourceBindings[0].Targets)
	}
	if len(result.SourceBindings[1].Targets) != 0 {
		t.Fatalf("expected second project binding whole-project targets omitted, got %#v", result.SourceBindings[1].Targets)
	}
}

func newProjectUpdateSourceBindings() []kbdto.SourceBindingInput {
	return []kbdto.SourceBindingInput{
		{
			Provider: sourcebindingdomain.ProviderProject,
			RootType: sourcebindingdomain.RootTypeProject,
			RootRef:  "300",
			SyncMode: sourcebindingdomain.SyncModeManual,
			Targets: []kbdto.SourceBindingTargetInput{
				{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "42"},
			},
		},
		{
			Provider: sourcebindingdomain.ProviderProject,
			RootType: sourcebindingdomain.RootTypeProject,
			RootRef:  "400",
			SyncMode: sourcebindingdomain.SyncModeManual,
			Targets:  []kbdto.SourceBindingTargetInput{},
		},
	}
}

func TestKnowledgeBaseAppServiceUpdateWithMultipleEnterpriseBindings(t *testing.T) {
	t.Parallel()

	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	domain := &recordingKnowledgeBaseDomainService{
		showKB: &kbentity.KnowledgeBase{
			ID:               99,
			Code:             testAppKnowledgeBaseCode,
			Name:             "enterprise",
			OrganizationCode: "ORG-1",
			SourceType:       &sourceType,
		},
		effectiveModel: effectiveEmbeddingModel,
	}
	docManager := &recordingKnowledgeBaseDocumentManager{}
	sourceBindingRepo := &recordingSourceBindingRepository{}
	expander := &teamshareKnowledgeExpander{
		expandResults: []*docentity.File{{
			Type:            "third_platform",
			Name:            "文档-1",
			ThirdID:         "FILE-1",
			SourceType:      sourcebindingdomain.ProviderTeamshare,
			KnowledgeBaseID: testTeamshareKnowledgeID,
		}},
	}

	app := service.NewKnowledgeBaseAppServiceForTest(t, domain, docManager, nil, nil, effectiveEmbeddingModel)
	app.SetSourceBindingRepository(sourceBindingRepo)
	app.SetThirdPlatformExpander(expander)

	sourceBindings := []kbdto.SourceBindingInput{
		{
			Provider: sourcebindingdomain.ProviderTeamshare,
			RootType: sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:  "TS-KB-1",
			SyncMode: sourcebindingdomain.SyncModeManual,
		},
		{
			Provider: sourcebindingdomain.ProviderTeamshare,
			RootType: sourcebindingdomain.RootTypeKnowledgeBase,
			RootRef:  "TS-KB-2",
			SyncMode: sourcebindingdomain.SyncModeManual,
			Targets: []kbdto.SourceBindingTargetInput{
				{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "FOLDER-2"},
			},
		},
	}
	result, err := app.Update(context.Background(), &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-2",
		Code:             testAppKnowledgeBaseCode,
		SourceBindings:   &sourceBindings,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(sourceBindingRepo.lastReplaceBindings) != 2 {
		t.Fatalf("expected two enterprise source bindings replaced, got %#v", sourceBindingRepo.lastReplaceBindings)
	}
	if result == nil || len(result.SourceBindings) != 2 {
		t.Fatalf("expected update result to include two enterprise bindings, got %#v", result)
	}
	if result.SourceBindings[0].RootRef != "TS-KB-1" || result.SourceBindings[1].RootRef != "TS-KB-2" {
		t.Fatalf("unexpected enterprise binding roots: %#v", result.SourceBindings)
	}
	if !reflect.DeepEqual(result.SourceBindings[1].Targets, []kbdto.SourceBindingTargetDTO{
		{TargetType: sourcebindingdomain.TargetTypeFolder, TargetRef: "FOLDER-2"},
	}) {
		t.Fatalf("expected enterprise targets preserved, got %#v", result.SourceBindings[1].Targets)
	}
}
