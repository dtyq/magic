package document_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
)

type syncLifecycleStoreStub struct {
	events            *[]string
	updateCalls       int
	markSyncingCalls  int
	markSyncedCalls   int
	markFailedCalls   int
	lastFailedMessage string
}

func (s *syncLifecycleStoreStub) Update(_ context.Context, _ *documentdomain.KnowledgeBaseDocument) error {
	s.updateCalls++
	s.appendEvent("update")
	return nil
}

func (s *syncLifecycleStoreStub) MarkSyncing(_ context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	s.markSyncingCalls++
	s.appendEvent("mark_syncing")
	doc.MarkSyncing()
	return nil
}

func (s *syncLifecycleStoreStub) MarkSynced(_ context.Context, doc *documentdomain.KnowledgeBaseDocument, wordCount int) error {
	s.markSyncedCalls++
	s.appendEvent("mark_synced")
	doc.MarkSynced(wordCount)
	return nil
}

func (s *syncLifecycleStoreStub) MarkSyncFailed(_ context.Context, doc *documentdomain.KnowledgeBaseDocument, message string) error {
	s.markFailedCalls++
	s.lastFailedMessage = message
	s.appendEvent("mark_failed")
	doc.MarkSyncFailed(message)
	return nil
}

func (s *syncLifecycleStoreStub) appendEvent(event string) {
	if s == nil || s.events == nil {
		return
	}
	*s.events = append(*s.events, event)
}

type syncLifecycleContentStub struct {
	events           *[]string
	persistExtension string
	syncExtension    string
	parseResult      documentdomain.SyncContentResult
	parseErr         error
}

func (s *syncLifecycleContentStub) ResolveDocumentFileExtension(
	_ context.Context,
	_ *documentdomain.KnowledgeBaseDocument,
	stage documentdomain.SyncDocumentFileExtensionStage,
) string {
	switch stage {
	case documentdomain.SyncDocumentFileExtensionStagePersist:
		return s.persistExtension
	case documentdomain.SyncDocumentFileExtensionStageSync:
		return s.syncExtension
	default:
		return ""
	}
}

func (s *syncLifecycleContentStub) PreflightSource(_ context.Context, _ *documentdomain.KnowledgeBaseDocument, _ *documentdomain.SourceOverride) error {
	s.appendEvent("preflight")
	return nil
}

func (s *syncLifecycleContentStub) ParseContent(
	_ context.Context,
	_ *documentdomain.KnowledgeBaseDocument,
	_ *ctxmeta.BusinessParams,
	_ *documentdomain.SourceOverride,
) (documentdomain.SyncContentResult, error) {
	s.appendEvent("parse")
	if s.parseErr != nil {
		return documentdomain.SyncContentResult{}, s.parseErr
	}
	return s.parseResult, nil
}

func (s *syncLifecycleContentStub) appendEvent(event string) {
	if s == nil || s.events == nil {
		return
	}
	*s.events = append(*s.events, event)
}

type syncLifecycleFragmentStub struct {
	events       *[]string
	buildResult  documentdomain.SyncFragmentBatch
	buildErr     error
	syncErr      error
	lastSyncMode string
}

func (s *syncLifecycleFragmentStub) BuildFragments(_ context.Context, _ documentdomain.SyncBuildFragmentsInput) (documentdomain.SyncFragmentBatch, error) {
	s.appendEvent("build_fragments")
	if s.buildErr != nil {
		return documentdomain.SyncFragmentBatch{}, s.buildErr
	}
	return s.buildResult, nil
}

func (s *syncLifecycleFragmentStub) SyncFragments(_ context.Context, input documentdomain.SyncFragmentsInput) error {
	s.lastSyncMode = input.Mode
	s.appendEvent("sync_fragments")
	return s.syncErr
}

func (s *syncLifecycleFragmentStub) appendEvent(event string) {
	if s == nil || s.events == nil {
		return
	}
	*s.events = append(*s.events, event)
}

func TestSyncLifecycleServiceSyncCreateFlow(t *testing.T) {
	t.Parallel()

	events := make([]string, 0, 6)
	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-1",
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md", Extension: "md"},
	}
	store := &syncLifecycleStoreStub{events: &events}
	content := &syncLifecycleContentStub{
		events: &events,
		parseResult: documentdomain.SyncContentResult{
			Parsed: &documentdomain.ParsedDocument{
				PlainText:    "alpha\n\nbeta",
				DocumentMeta: map[string]any{documentdomain.ParsedMetaSourceFormat: "md"},
			},
			Content: "alpha\n\nbeta",
		},
	}
	fragments := &syncLifecycleFragmentStub{
		events:      &events,
		buildResult: documentdomain.SyncFragmentBatch{Value: []string{"f1", "f2"}, Count: 2},
	}
	svc := documentdomain.NewSyncLifecycleService(store, content, fragments)

	err := svc.Sync(context.Background(), documentdomain.SyncLifecycleInput{
		Document: doc,
		KnowledgeBase: &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
			Code:  "KB-1",
			Model: "text-embedding-3-small",
		},
		Mode: documentdomain.SyncModeCreate,
	})
	if err != nil {
		t.Fatalf("sync lifecycle: %v", err)
	}
	if store.markSyncingCalls != 1 || store.markSyncedCalls != 1 || store.markFailedCalls != 0 {
		t.Fatalf("unexpected store calls: %#v", store)
	}
	if doc.SyncStatus != shared.SyncStatusSynced || doc.WordCount != len([]rune("alpha\n\nbeta")) {
		t.Fatalf("unexpected doc state: %#v", doc)
	}
	if got := doc.DocMetadata[documentdomain.ParsedMetaSourceFormat]; got != "md" {
		t.Fatalf("expected parsed metadata merged, got %#v", doc.DocMetadata)
	}
	if fragments.lastSyncMode != documentdomain.SyncModeCreate {
		t.Fatalf("expected sync mode create, got %q", fragments.lastSyncMode)
	}

	expectedEvents := []string{
		"preflight",
		"mark_syncing",
		"parse",
		"build_fragments",
		"sync_fragments",
		"mark_synced",
	}
	if !slices.Equal(events, expectedEvents) {
		t.Fatalf("unexpected event order: %#v", events)
	}
}

func TestSyncLifecycleServicePersistsSourceOverrideBeforePreflight(t *testing.T) {
	t.Parallel()

	events := make([]string, 0, 7)
	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-OVERRIDE",
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
	}
	store := &syncLifecycleStoreStub{events: &events}
	content := &syncLifecycleContentStub{
		events:           &events,
		persistExtension: "md",
		syncExtension:    "md",
		parseResult: documentdomain.SyncContentResult{
			Parsed:  documentdomain.NewPlainTextParsedDocument("md", "override"),
			Content: "override",
		},
	}
	fragments := &syncLifecycleFragmentStub{
		events:      &events,
		buildResult: documentdomain.SyncFragmentBatch{Value: []string{"f1"}, Count: 1},
	}
	svc := documentdomain.NewSyncLifecycleService(store, content, fragments)

	err := svc.Sync(context.Background(), documentdomain.SyncLifecycleInput{
		Document: doc,
		KnowledgeBase: &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
			Code:  "KB-1",
			Model: "text-embedding-3-small",
		},
		SourceOverride: &documentdomain.SourceOverride{
			DocType: int(documentdomain.DocTypeText),
			DocumentFile: map[string]any{
				"name": "override.md",
			},
			Content: "override",
		},
	})
	if err != nil {
		t.Fatalf("sync lifecycle with source override: %v", err)
	}
	if store.updateCalls != 1 {
		t.Fatalf("expected override persisted once, got %d", store.updateCalls)
	}
	if doc.DocType != int(documentdomain.DocTypeText) || doc.DocumentFile == nil || doc.DocumentFile.Extension != "md" {
		t.Fatalf("expected override applied to document, got %#v", doc)
	}
	if len(events) == 0 || events[0] != "update" {
		t.Fatalf("expected update before preflight, got %#v", events)
	}
}

func TestSyncLifecycleServiceMarksFailedWithStageReason(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-FAIL",
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "https://example.com/doc.md", Extension: "md"},
	}
	store := &syncLifecycleStoreStub{}
	content := &syncLifecycleContentStub{
		parseErr: documentdomain.NewSyncStageError(documentdomain.SyncFailureDocumentFileEmpty, shared.ErrDocumentFileEmpty),
	}
	fragments := &syncLifecycleFragmentStub{}
	svc := documentdomain.NewSyncLifecycleService(store, content, fragments)

	err := svc.Sync(context.Background(), documentdomain.SyncLifecycleInput{
		Document: doc,
		KnowledgeBase: &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
			Code:  "KB-1",
			Model: "text-embedding-3-small",
		},
		Mode: documentdomain.SyncModeResync,
	})
	if err == nil {
		t.Fatal("expected sync lifecycle error")
	}
	if !errors.Is(err, shared.ErrDocumentFileEmpty) {
		t.Fatalf("expected wrapped document file empty error, got %v", err)
	}
	if store.markFailedCalls != 1 {
		t.Fatalf("expected failed status persisted once, got %d", store.markFailedCalls)
	}
	if store.lastFailedMessage != documentdomain.SyncFailureDocumentFileEmpty+": "+shared.ErrDocumentFileEmpty.Error() {
		t.Fatalf("unexpected failed message: %q", store.lastFailedMessage)
	}
	if doc.SyncStatus != shared.SyncStatusSyncFailed {
		t.Fatalf("expected sync failed status, got %#v", doc)
	}
}
