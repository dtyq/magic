package document_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/projectfile"
)

type projectFileChangeResolverStub struct {
	source documentdomain.ProjectFileChangeSource
	err    error
	events *[]string
}

func (s *projectFileChangeResolverStub) ResolveEnterpriseSource(
	_ context.Context,
	projectFileID int64,
) (documentdomain.ProjectFileChangeSource, error) {
	if s.events != nil {
		*s.events = append(*s.events, "resolve")
	}
	if projectFileID <= 0 {
		return documentdomain.ProjectFileChangeSource{}, nil
	}
	return s.source, s.err
}

type projectFileChangeOperatorStub struct {
	createCodes []string
	createErr   error
	destroyErr  error
	events      *[]string
	scheduled   []*documentdomain.SyncDocumentInput
}

func (s *projectFileChangeOperatorStub) DestroyDocument(_ context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	if s.events != nil && doc != nil {
		*s.events = append(*s.events, "destroy:"+doc.Code)
	}
	return s.destroyErr
}

func (s *projectFileChangeOperatorStub) CreateManagedDocument(
	_ context.Context,
	input documentdomain.ProjectFileChangeCreateDocumentInput,
) (string, error) {
	if s.events != nil {
		overrideState := "standard"
		if input.Override != nil {
			overrideState = "enterprise"
		}
		*s.events = append(*s.events, "create:"+input.Target.KnowledgeBaseCode+":"+overrideState)
	}
	if s.createErr != nil {
		return "", s.createErr
	}
	if len(s.createCodes) == 0 {
		return "", nil
	}
	code := s.createCodes[0]
	s.createCodes = s.createCodes[1:]
	return code, nil
}

func (s *projectFileChangeOperatorStub) ScheduleSync(_ context.Context, input *documentdomain.SyncDocumentInput) {
	if s.events != nil && input != nil {
		overrideState := "standard"
		if input.SourceOverride != nil {
			overrideState = "enterprise"
		}
		*s.events = append(*s.events, "schedule:"+input.Code+":"+input.Mode+":"+overrideState)
	}
	s.scheduled = append(s.scheduled, input)
}

func TestProjectFileChangeLifecycleServiceDeletesDocumentsAndStops(t *testing.T) {
	t.Parallel()

	events := make([]string, 0, 2)
	operator := &projectFileChangeOperatorStub{events: &events}
	svc := documentdomain.NewProjectFileChangeLifecycleService(nil, operator)

	err := svc.Handle(context.Background(), documentdomain.ProjectFileChangeLifecycleInput{
		ProjectFileID: 501,
		Meta: &projectfile.Meta{
			Status:           "deleted",
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    501,
		},
		Documents: []*documentdomain.KnowledgeBaseDocument{
			{Code: "DOC-1"},
		},
	})
	if err != nil {
		t.Fatalf("Handle returned error: %v", err)
	}

	expected := []string{"destroy:DOC-1"}
	if !slices.Equal(events, expected) {
		t.Fatalf("unexpected lifecycle events: got %v want %v", events, expected)
	}
}

func TestProjectFileChangeLifecycleServiceExecutesStandardAndEnterpriseGroups(t *testing.T) {
	t.Parallel()

	events := make([]string, 0, 8)
	operator := &projectFileChangeOperatorStub{
		createCodes: []string{"DOC-STD-NEW", "DOC-ENT-NEW"},
		events:      &events,
	}
	resolver := &projectFileChangeResolverStub{
		source: projectFileChangeEnterpriseSource(),
		events: &events,
	}
	svc := documentdomain.NewProjectFileChangeLifecycleService(resolver, operator)

	err := svc.Handle(context.Background(), projectFileChangeLifecycleInput())
	if err != nil {
		t.Fatalf("Handle returned error: %v", err)
	}

	expected := []string{
		"resolve",
		"schedule:DOC-STD-OLD:resync:standard",
		"create:KB-STD:standard",
		"schedule:DOC-STD-NEW:create:standard",
		"schedule:DOC-ENT-OLD:resync:enterprise",
		"create:KB-ENT:enterprise",
		"schedule:DOC-ENT-NEW:create:enterprise",
	}
	if !slices.Equal(events, expected) {
		t.Fatalf("unexpected lifecycle events: got %v want %v", events, expected)
	}
	if len(operator.scheduled) != 4 {
		t.Fatalf("expected 4 scheduled sync requests, got %d", len(operator.scheduled))
	}
}

func TestProjectFileChangeLifecycleServiceRequiresResolverForEnterprise(t *testing.T) {
	t.Parallel()

	svc := documentdomain.NewProjectFileChangeLifecycleService(nil, &projectFileChangeOperatorStub{})

	err := svc.Handle(context.Background(), documentdomain.ProjectFileChangeLifecycleInput{
		ProjectFileID: 501,
		Meta: &projectfile.Meta{
			Status:           "active",
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    501,
			FileName:         "enterprise.md",
		},
		Bindings: []documentdomain.ProjectFileBindingRef{
			{
				ID:                1,
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB-ENT",
				Provider:          "project",
				RootType:          "project",
				RootRef:           "900",
				SyncMode:          "realtime",
				Enabled:           true,
			},
		},
		UseSourceOverrideByKnowledgeBase: map[string]bool{
			"KB-ENT": true,
		},
	})
	if !errors.Is(err, documentdomain.ErrProjectFileChangeLifecycleResolverNil) {
		t.Fatalf("expected ErrProjectFileChangeLifecycleResolverNil, got %v", err)
	}
}

func projectFileChangeEnterpriseSource() documentdomain.ProjectFileChangeSource {
	return documentdomain.ProjectFileChangeSource{
		Resolved: &projectfile.ResolveResult{
			Status:           "active",
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    501,
			FileName:         "enterprise.md",
		},
		Override: &documentdomain.SourceOverride{
			Content:      "enterprise content",
			DocumentFile: map[string]any{"name": "enterprise.md"},
		},
	}
}

func projectFileChangeLifecycleInput() documentdomain.ProjectFileChangeLifecycleInput {
	return documentdomain.ProjectFileChangeLifecycleInput{
		ProjectFileID: 501,
		Meta: &projectfile.Meta{
			Status:           "active",
			OrganizationCode: "ORG1",
			ProjectID:        900,
			ProjectFileID:    501,
			FileName:         "standard.md",
			FileExtension:    "md",
		},
		Bindings: []documentdomain.ProjectFileBindingRef{
			projectFileChangeBinding(1, "KB-STD", "USER-1"),
			projectFileChangeBinding(2, "KB-STD", "USER-2"),
			projectFileChangeBinding(3, "KB-ENT", "USER-3"),
			projectFileChangeBinding(4, "KB-ENT", "USER-4"),
		},
		Documents: []*documentdomain.KnowledgeBaseDocument{
			projectFileChangeDocument("DOC-STD-OLD", "KB-STD", 1),
			projectFileChangeDocument("DOC-ENT-OLD", "KB-ENT", 3),
		},
		UseSourceOverrideByKnowledgeBase: map[string]bool{
			"KB-ENT": true,
		},
	}
}

func projectFileChangeBinding(id int64, knowledgeBaseCode, userID string) documentdomain.ProjectFileBindingRef {
	return documentdomain.ProjectFileBindingRef{
		ID:                id,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: knowledgeBaseCode,
		Provider:          "project",
		RootType:          "project",
		RootRef:           "900",
		SyncMode:          "realtime",
		Enabled:           true,
		UserID:            userID,
	}
}

func projectFileChangeDocument(
	code string,
	knowledgeBaseCode string,
	sourceBindingID int64,
) *documentdomain.KnowledgeBaseDocument {
	return &documentdomain.KnowledgeBaseDocument{
		Code:              code,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: knowledgeBaseCode,
		SourceBindingID:   sourceBindingID,
	}
}
