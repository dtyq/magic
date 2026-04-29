package kbapp

import (
	"context"
	"testing"

	bindingplan "magic/internal/domain/knowledge/binding_plan"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
)

func TestCreateBindingChangeDocumentsUsesExplicitSyncUserID(t *testing.T) {
	t.Parallel()

	const (
		organizationCode = "ORG-1"
		knowledgeCode    = "KB-1"
		resolvedUserID   = "resolved-user"
		syncUserID       = "sync-user"
	)

	bindingKey := bindingplan.BindingKey(
		sourcebindingentity.ProviderProject,
		sourcebindingentity.RootTypeProject,
		"300",
	)
	store := &bindingChangeManagedDocumentStore{
		createResult: &ManagedDocument{Code: "DOC-43"},
	}
	flow := &KnowledgeBaseDocumentFlowApp{managedDocuments: store}
	prepared := &preparedBindingChange{
		plan: bindingplan.BindingChangePlan{
			CreateTargets: []bindingplan.CreateTarget{{
				BindingKey:   bindingKey,
				SourceItemID: 2,
			}},
		},
		resolvedItemsByID: map[string]incrementalBindingResolvedItem{
			resolvedItemKey(bindingKey, 2): {
				bindingKey:     bindingKey,
				resolvedUserID: resolvedUserID,
				sourceItem: &sourcebindingentity.SourceItem{
					ItemRef: "43",
				},
				document: sourcebindingservice.ResolvedDocument{
					Name:         "new-43.md",
					DocumentType: 1,
					DocumentFile: &docentity.File{Name: "new-43.md"},
					AutoAdded:    true,
				},
			},
		},
	}
	savedBindings := []sourcebindingentity.Binding{{
		ID:       11,
		Provider: sourcebindingentity.ProviderProject,
		RootType: sourcebindingentity.RootTypeProject,
		RootRef:  "300",
	}}

	createdDocs, pendingSyncs, err := flow.createBindingChangeDocuments(
		context.Background(),
		&kbentity.KnowledgeBase{Code: knowledgeCode},
		organizationCode,
		savedBindings,
		prepared,
		syncUserID,
	)
	if err != nil {
		t.Fatalf("createBindingChangeDocuments returned error: %v", err)
	}
	if len(createdDocs) != 1 || createdDocs[0] == nil || createdDocs[0].Code != "DOC-43" {
		t.Fatalf("expected created document DOC-43, got %#v", createdDocs)
	}
	if len(store.createInputs) != 1 {
		t.Fatalf("expected one create input, got %#v", store.createInputs)
	}
	if got := store.createInputs[0].UserID; got != resolvedUserID {
		t.Fatalf("expected create input user %q, got %q", resolvedUserID, got)
	}
	if len(pendingSyncs) != 1 {
		t.Fatalf("expected one pending sync, got %#v", pendingSyncs)
	}
	if pendingSyncs[0].BusinessParams == nil {
		t.Fatalf("expected business params, got %#v", pendingSyncs[0])
	}
	if got := pendingSyncs[0].BusinessParams.UserID; got != syncUserID {
		t.Fatalf("expected sync user %q, got %q", syncUserID, got)
	}
}

type bindingChangeManagedDocumentStore struct {
	createResult *ManagedDocument
	createInputs []*CreateManagedDocumentInput
}

func (s *bindingChangeManagedDocumentStore) CreateManagedDocument(
	_ context.Context,
	input *CreateManagedDocumentInput,
) (*ManagedDocument, error) {
	cloned := *input
	cloned.DocumentFile = cloneDocumentFile(input.DocumentFile)
	s.createInputs = append(s.createInputs, &cloned)
	if s.createResult != nil {
		result := *s.createResult
		return &result, nil
	}
	return &ManagedDocument{Code: "DOC-DEFAULT"}, nil
}

func (*bindingChangeManagedDocumentStore) DestroyManagedDocument(context.Context, string, string) error {
	return nil
}

func (*bindingChangeManagedDocumentStore) DestroyManagedDocumentsByCodes(context.Context, string, string, []string) error {
	return nil
}

func (*bindingChangeManagedDocumentStore) DestroyKnowledgeBaseDocuments(context.Context, string, string) error {
	return nil
}

func (*bindingChangeManagedDocumentStore) ScheduleManagedDocumentSync(context.Context, *SyncDocumentInput) {
}

func (*bindingChangeManagedDocumentStore) ListManagedDocumentsByKnowledgeBase(context.Context, string) ([]*ManagedDocument, error) {
	return nil, nil
}

func (*bindingChangeManagedDocumentStore) ListManagedDocumentsBySourceBindingIDs(
	context.Context,
	string,
	[]int64,
) ([]*ManagedDocument, error) {
	return nil, nil
}
