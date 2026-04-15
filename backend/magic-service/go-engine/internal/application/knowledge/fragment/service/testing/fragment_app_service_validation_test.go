package fragapp_test

import (
	"context"
	"errors"
	"testing"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	appservice "magic/internal/application/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
)

func TestFragmentAppServiceCreateRejectsEmptyDocumentCode(t *testing.T) {
	t.Parallel()

	svc := &appservice.FragmentAppService{}
	_, err := svc.Create(context.Background(), &fragdto.CreateFragmentInput{
		KnowledgeCode: "kb-1",
		Content:       "hello",
	})
	if !errors.Is(err, shared.ErrFragmentDocumentCodeRequired) {
		t.Fatalf("expected ErrFragmentDocumentCodeRequired, got %v", err)
	}
}
