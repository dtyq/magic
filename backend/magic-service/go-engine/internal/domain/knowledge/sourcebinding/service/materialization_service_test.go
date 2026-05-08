package sourcebinding_test

import (
	"context"
	"errors"
	"testing"
	"time"

	sourcebinding "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
)

var errNoPermission = errors.New("没有文件权限")

const (
	testBindingUpdater = "binding-updater"
	testKnowledgeOwner = "kb-owner"
	testTriggerUser    = "trigger-user"
)

type materializationResolverStub struct {
	resultsByUser map[string][]sourcebindingservice.ResolvedDocument
	errByUser     map[string]error
	calls         []string
}

func (s *materializationResolverStub) ResolveBindingDocuments(
	_ context.Context,
	_ sourcebinding.Binding,
	_ string,
	userID string,
	_ int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	s.calls = append(s.calls, userID)
	if err := s.errByUser[userID]; err != nil {
		return nil, err
	}
	return append([]sourcebindingservice.ResolvedDocument(nil), s.resultsByUser[userID]...), nil
}

type materializationRepoStub struct {
	replaceCalls [][]sourcebinding.BindingItem
}

func (s *materializationRepoStub) UpsertSourceItem(_ context.Context, item sourcebinding.SourceItem) (*sourcebinding.SourceItem, error) {
	item.ID = int64(len(s.replaceCalls) + 1)
	return &item, nil
}

func (s *materializationRepoStub) ReplaceBindingItems(_ context.Context, _ int64, items []sourcebinding.BindingItem) error {
	cloned := append([]sourcebinding.BindingItem(nil), items...)
	s.replaceCalls = append(s.replaceCalls, cloned)
	return nil
}

type managedDocumentManagerStub struct {
	created   []sourcebindingservice.CreateManagedDocumentInput
	scheduled []sourcebindingservice.SyncRequest
	destroyed []string
}

func (s *managedDocumentManagerStub) CreateManagedDocument(
	_ context.Context,
	input sourcebindingservice.CreateManagedDocumentInput,
) (*sourcebindingservice.ManagedDocument, error) {
	s.created = append(s.created, input)
	return &sourcebindingservice.ManagedDocument{Code: input.Name + "-code"}, nil
}

func (s *managedDocumentManagerStub) DestroyManagedDocument(
	_ context.Context,
	code string,
	_ string,
) error {
	s.destroyed = append(s.destroyed, code)
	return nil
}

func (s *managedDocumentManagerStub) ScheduleManagedDocumentSync(_ context.Context, input sourcebindingservice.SyncRequest) {
	s.scheduled = append(s.scheduled, input)
}

func TestMaterializationServiceMaterializeFallsBackToKnowledgeBaseUser(t *testing.T) {
	t.Parallel()

	resolver := &materializationResolverStub{
		errByUser: map[string]error{
			testBindingUpdater: errNoPermission,
		},
		resultsByUser: map[string][]sourcebindingservice.ResolvedDocument{
			testKnowledgeOwner: {{
				Name:         "doc-1",
				DocumentFile: map[string]any{"name": "doc-1"},
				DocumentType: 1,
				ItemRef:      "item-1",
			}},
		},
	}
	repo := &materializationRepoStub{}
	docManager := &managedDocumentManagerStub{}
	now := time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC)
	svc := sourcebindingservice.NewMaterializationService(repo, resolver, docManager, func() time.Time { return now })

	count, err := svc.Materialize(context.Background(), sourcebindingservice.MaterializationInput{
		KnowledgeBaseCode:   "KB-1",
		OrganizationCode:    "ORG-1",
		KnowledgeBaseUserID: testKnowledgeOwner,
		KnowledgeBaseOwner:  "kb-creator",
		FallbackUserID:      testTriggerUser,
		ScheduleSync:        true,
		Bindings: []sourcebinding.Binding{{
			ID:         11,
			Provider:   sourcebinding.ProviderTeamshare,
			RootType:   sourcebinding.RootTypeFile,
			RootRef:    "FILE-1",
			Enabled:    true,
			UpdatedUID: testBindingUpdater,
		}},
	})
	if err != nil {
		t.Fatalf("Materialize returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one created document, got %d", count)
	}
	if got := resolver.calls; len(got) != 2 || got[0] != testBindingUpdater || got[1] != testKnowledgeOwner {
		t.Fatalf("unexpected resolver calls: %#v", got)
	}
	if len(docManager.created) != 1 || docManager.created[0].UserID != testKnowledgeOwner {
		t.Fatalf("expected created document to use fallback kb user, got %#v", docManager.created)
	}
	if docManager.created[0].ThirdPlatformType != sourcebinding.ProviderTeamshare || docManager.created[0].ThirdFileID != "item-1" {
		t.Fatalf("expected created document to carry third-file mapping, got %#v", docManager.created[0])
	}
	if len(docManager.scheduled) != 1 || docManager.scheduled[0].UserID != testKnowledgeOwner {
		t.Fatalf("expected scheduled sync to follow fallback user, got %#v", docManager.scheduled)
	}
	if len(repo.replaceCalls) != 1 || len(repo.replaceCalls[0]) != 1 {
		t.Fatalf("expected one binding item replacement, got %#v", repo.replaceCalls)
	}
	if repo.replaceCalls[0][0].LastResolvedAt == nil || !repo.replaceCalls[0][0].LastResolvedAt.Equal(now) {
		t.Fatalf("expected deterministic resolved timestamp, got %#v", repo.replaceCalls[0][0].LastResolvedAt)
	}
}

func TestMaterializationServicePreflightReturnsPermissionErrorOnLastCandidate(t *testing.T) {
	t.Parallel()

	resolver := &materializationResolverStub{
		errByUser: map[string]error{
			testBindingUpdater: errNoPermission,
			testKnowledgeOwner: errNoPermission,
			testTriggerUser:    errNoPermission,
		},
	}
	svc := sourcebindingservice.NewMaterializationService(
		&materializationRepoStub{},
		resolver,
		&managedDocumentManagerStub{},
		nil,
	)

	err := svc.Preflight(context.Background(), sourcebindingservice.MaterializationInput{
		KnowledgeBaseCode:   "KB-1",
		OrganizationCode:    "ORG-1",
		KnowledgeBaseUserID: testKnowledgeOwner,
		FallbackUserID:      testTriggerUser,
		Bindings: []sourcebinding.Binding{{
			ID:         11,
			Provider:   sourcebinding.ProviderTeamshare,
			RootType:   sourcebinding.RootTypeFile,
			RootRef:    "FILE-1",
			Enabled:    true,
			UpdatedUID: testBindingUpdater,
		}},
	})
	if !errors.Is(err, errNoPermission) {
		t.Fatalf("expected permission error, got %v", err)
	}
	if got := resolver.calls; len(got) != 3 || got[2] != testTriggerUser {
		t.Fatalf("expected all candidates to be retried, got %#v", got)
	}
}

func TestMaterializationServiceMaterializeRespectsKnowledgeBaseDocumentLimit(t *testing.T) {
	t.Parallel()

	resolver := &materializationResolverStub{
		resultsByUser: map[string][]sourcebindingservice.ResolvedDocument{
			testBindingUpdater: {
				{Name: "doc-1", DocumentFile: map[string]any{"name": "doc-1"}, DocumentType: 1, ItemRef: "item-1"},
				{Name: "doc-2", DocumentFile: map[string]any{"name": "doc-2"}, DocumentType: 1, ItemRef: "item-2"},
			},
		},
	}
	repo := &materializationRepoStub{}
	docManager := &managedDocumentManagerStub{}
	svc := sourcebindingservice.NewMaterializationService(repo, resolver, docManager, nil)

	count, err := svc.Materialize(context.Background(), sourcebindingservice.MaterializationInput{
		KnowledgeBaseCode: "KB-1",
		OrganizationCode:  "ORG-1",
		MaxDocuments:      1,
		Bindings: []sourcebinding.Binding{{
			ID:         11,
			Provider:   sourcebinding.ProviderLocalUpload,
			RootType:   sourcebinding.RootTypeFile,
			RootRef:    "FILE-1",
			Enabled:    true,
			UpdatedUID: testBindingUpdater,
		}, {
			ID:         12,
			Provider:   sourcebinding.ProviderLocalUpload,
			RootType:   sourcebinding.RootTypeFile,
			RootRef:    "FILE-2",
			Enabled:    true,
			UpdatedUID: testBindingUpdater,
		}},
	})
	if err != nil {
		t.Fatalf("Materialize returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one created document under limit, got %d", count)
	}
	if len(docManager.created) != 1 || docManager.created[0].Name != "doc-1" {
		t.Fatalf("expected only first document to be materialized, got %#v", docManager.created)
	}
	if len(repo.replaceCalls) != 1 || len(repo.replaceCalls[0]) != 1 {
		t.Fatalf("expected only one binding item replace call, got %#v", repo.replaceCalls)
	}
}
