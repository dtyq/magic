package kbapp

import (
	"context"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/ctxmeta"
)

func TestKnowledgeBaseManagedDocumentSyncSchedulesAsyncTask(t *testing.T) {
	t.Parallel()

	scheduler := &recordingKnowledgeBaseDocumentSyncScheduler{}
	store := knowledgeBaseDomainManagedDocumentStore{syncScheduler: scheduler}

	store.ScheduleManagedDocumentSync(context.Background(), &SyncDocumentInput{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		Code:              "DOC-1",
		Mode:              knowledgeBaseSyncModeCreate,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: "ORG-1",
			UserID:           "USER-1",
			BusinessID:       "KB-1",
		},
	})

	if scheduler.input == nil {
		t.Fatal("expected document sync input to be scheduled")
	}
	if !scheduler.input.Async {
		t.Fatalf("expected knowledge base managed document sync to be async, got %#v", scheduler.input)
	}
}

type recordingKnowledgeBaseDocumentSyncScheduler struct {
	input *documentdomain.SyncDocumentInput
}

func (s *recordingKnowledgeBaseDocumentSyncScheduler) ScheduleSync(
	_ context.Context,
	input *documentdomain.SyncDocumentInput,
) {
	s.input = input
}
