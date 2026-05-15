package docapp_test

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"testing"

	docdto "magic/internal/application/knowledge/document/dto"
	appservice "magic/internal/application/knowledge/document/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	"magic/internal/pkg/projectfile"
)

func TestDocumentAppServiceProjectDirectoryDeletedDestroysDescendantDocuments(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{
		listRealtimeByProjectFilesResult: []*docentity.KnowledgeBaseDocument{
			newProjectDirectoryDeleteDocument(11, 1, "DOC-101"),
			newProjectDirectoryDeleteDocument(12, 2, "DOC-102"),
		},
	}
	fragmentSvc := &fragmentDestroyServiceStub{}
	scheduler := &documentSyncSchedulerStub{}
	svc := newProjectDirectoryDeleteServiceForTest(
		t,
		domain,
		scheduler,
		fragmentSvc,
		projectDirectoryDeleteBinding(1, testKnowledgeBaseCode),
		projectDirectoryDeleteBinding(2, "KB2", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFolder,
			TargetRef:  "100",
		}),
	)

	err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{
		ProjectFileID:    100,
		OrganizationCode: "ORG1",
		ProjectID:        900,
		Status:           projectfile.ResolveStatusDeleted,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	assertInt64Set(t, domain.lastListProjectFileIDs, []int64{101, 102})
	assertInt64Set(t, domain.lastListSourceBindingIDs, []int64{1, 2})
	assertInt64Set(t, domain.deletedIDs, []int64{11, 12})
	if fragmentSvc.deletePointsByDocumentCalls != 2 || fragmentSvc.deleteByDocumentCalls != 2 {
		t.Fatalf("expected hard delete for two docs, got points=%d fragments=%d",
			fragmentSvc.deletePointsByDocumentCalls,
			fragmentSvc.deleteByDocumentCalls,
		)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected no revectorize schedule for deleted directory, got %d", scheduler.scheduleCalls)
	}
}

func TestDocumentAppServiceProjectDirectoryDeletedMatchesProjectFolderAndFileBindings(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{
		listRealtimeByProjectFilesResult: []*docentity.KnowledgeBaseDocument{
			newProjectDirectoryDeleteDocument(11, 1, "DOC-101"),
		},
	}
	svc := newProjectDirectoryDeleteServiceForTest(
		t,
		domain,
		&documentSyncSchedulerStub{},
		&fragmentDestroyServiceStub{},
		projectDirectoryDeleteBinding(1, "KB1"),
		projectDirectoryDeleteBinding(2, "KB2", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFolder,
			TargetRef:  "100",
		}),
		projectDirectoryDeleteBinding(3, "KB3", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFolder,
			TargetRef:  "10",
		}),
		projectDirectoryDeleteBinding(4, "KB4", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFolder,
			TargetRef:  "200",
		}),
		projectDirectoryDeleteBinding(5, "KB5", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFile,
			TargetRef:  "102",
		}),
		projectDirectoryDeleteBinding(6, "KB6", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFolder,
			TargetRef:  "999",
		}),
		projectDirectoryDeleteBinding(7, "KB7", sourcebindingdomain.BindingTarget{
			TargetType: sourcebindingdomain.TargetTypeFile,
			TargetRef:  "999",
		}),
	)

	err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{
		ProjectFileID:    100,
		OrganizationCode: "ORG1",
		ProjectID:        900,
		Status:           projectfile.ResolveStatusDeleted,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	assertInt64Set(t, domain.lastListSourceBindingIDs, []int64{1, 2, 3, 4, 5})
}

func TestDocumentAppServiceProjectDirectoryDeletedAggregatesPartialDestroyFailures(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{
		listRealtimeByProjectFilesResult: []*docentity.KnowledgeBaseDocument{
			newProjectDirectoryDeleteDocument(11, 1, "DOC-101"),
			newProjectDirectoryDeleteDocument(12, 1, "DOC-102"),
		},
		deleteErrByID: map[int64]error{12: errDocumentDestroyFailed},
	}
	svc := newProjectDirectoryDeleteServiceForTest(
		t,
		domain,
		&documentSyncSchedulerStub{},
		&fragmentDestroyServiceStub{},
		projectDirectoryDeleteBinding(1, testKnowledgeBaseCode),
	)

	err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{
		ProjectFileID:    100,
		OrganizationCode: "ORG1",
		ProjectID:        900,
		Status:           projectfile.ResolveStatusDeleted,
	})
	if !errors.Is(err, errDocumentDestroyFailed) {
		t.Fatalf("expected aggregated destroy error, got %v", err)
	}
	assertInt64Set(t, domain.deletedIDs, []int64{11, 12})
}

func TestDocumentAppServiceProjectDirectoryDeletedWithoutDocumentsSucceeds(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{}
	svc := newProjectDirectoryDeleteServiceForTest(
		t,
		domain,
		&documentSyncSchedulerStub{},
		&fragmentDestroyServiceStub{},
		projectDirectoryDeleteBinding(1, testKnowledgeBaseCode),
	)
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{
		metas: map[int64]*projectfile.Meta{
			100: {
				Status:           projectfile.ResolveStatusDeleted,
				OrganizationCode: "ORG1",
				ProjectID:        900,
				ProjectFileID:    100,
				ParentID:         10,
				IsDirectory:      true,
			},
		},
	})

	err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{
		ProjectFileID:    100,
		OrganizationCode: "ORG1",
		ProjectID:        900,
		Status:           projectfile.ResolveStatusDeleted,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(domain.deletedIDs) != 0 || len(domain.lastListProjectFileIDs) != 0 {
		t.Fatalf("expected no document delete attempt, got deleted=%v listed=%v",
			domain.deletedIDs,
			domain.lastListProjectFileIDs,
		)
	}
}

func (s *projectFileMetadataReaderStub) ListDescendants(_ context.Context, projectID, directoryID int64) ([]projectfile.TreeNode, error) {
	if s == nil || s.metas == nil || projectID <= 0 || directoryID <= 0 {
		return nil, nil
	}
	queue := []int64{directoryID}
	seen := map[int64]struct{}{directoryID: {}}
	result := make([]projectfile.TreeNode, 0)
	for len(queue) > 0 {
		parentID := queue[0]
		queue = queue[1:]
		children := make([]*projectfile.Meta, 0)
		for _, meta := range s.metas {
			if meta == nil || meta.ProjectID != projectID || meta.ParentID != parentID {
				continue
			}
			children = append(children, meta)
		}
		slices.SortFunc(children, func(a, b *projectfile.Meta) int {
			return cmp.Compare(a.ProjectFileID, b.ProjectFileID)
		})
		for _, meta := range children {
			if _, exists := seen[meta.ProjectFileID]; exists {
				continue
			}
			seen[meta.ProjectFileID] = struct{}{}
			result = append(result, projectfile.TreeNode{
				ProjectID:     meta.ProjectID,
				ProjectFileID: meta.ProjectFileID,
				ParentID:      meta.ParentID,
				FileName:      meta.FileName,
				FileExtension: meta.FileExtension,
				IsDirectory:   meta.IsDirectory,
			})
			if meta.IsDirectory {
				queue = append(queue, meta.ProjectFileID)
			}
		}
	}
	return result, nil
}

func newProjectDirectoryDeleteServiceForTest(
	tb testing.TB,
	domain *documentDomainServiceStub,
	scheduler *documentSyncSchedulerStub,
	fragmentSvc *fragmentDestroyServiceStub,
	bindings ...sourcebindingdomain.Binding,
) *appservice.DocumentAppService {
	tb.Helper()
	svc := appservice.NewDocumentAppServiceForTest(
		tb,
		domain,
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{
				Code:             testKnowledgeBaseCode,
				OrganizationCode: "ORG1",
				Model:            "text-embedding-3-small",
			},
			routeCollection: "kb_custom",
		},
		scheduler,
		fragmentSvc,
	)
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{metas: projectDirectoryDeleteMetas()})
	svc.SetSourceBindingRepository(&sourceBindingRepositoryStub{realtimeBindings: bindings})
	return svc
}

func projectDirectoryDeleteMetas() map[int64]*projectfile.Meta {
	return map[int64]*projectfile.Meta{
		10: {
			Status:           projectfile.ResolveStatusActive,
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    10,
			IsDirectory:      true,
		},
		100: {
			Status:           projectfile.ResolveStatusDeleted,
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    100,
			ParentID:         10,
			IsDirectory:      true,
		},
		101: {
			Status:           projectfile.ResolveStatusActive,
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    101,
			ParentID:         100,
			FileName:         "a.md",
			FileExtension:    "md",
		},
		200: {
			Status:           projectfile.ResolveStatusActive,
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    200,
			ParentID:         100,
			IsDirectory:      true,
		},
		102: {
			Status:           projectfile.ResolveStatusActive,
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    102,
			ParentID:         200,
			FileName:         "b.md",
			FileExtension:    "md",
		},
	}
}

func newProjectDirectoryDeleteDocument(id, sourceBindingID int64, code string) *docentity.KnowledgeBaseDocument {
	return &docentity.KnowledgeBaseDocument{
		ID:                id,
		Code:              code,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              code,
		Enabled:           true,
		SourceBindingID:   sourceBindingID,
	}
}

func projectDirectoryDeleteBinding(
	id int64,
	knowledgeBaseCode string,
	targets ...sourcebindingdomain.BindingTarget,
) sourcebindingdomain.Binding {
	return sourcebindingdomain.Binding{
		ID:                id,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: knowledgeBaseCode,
		Provider:          sourcebindingdomain.ProviderProject,
		RootType:          sourcebindingdomain.RootTypeProject,
		RootRef:           "900",
		SyncMode:          sourcebindingdomain.SyncModeRealtime,
		Enabled:           true,
		Targets:           targets,
	}
}

func assertInt64Set(tb testing.TB, got, want []int64) {
	tb.Helper()
	got = slices.Clone(got)
	want = slices.Clone(want)
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		tb.Fatalf("unexpected int64 set: got %v, want %v", got, want)
	}
}
