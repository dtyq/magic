package docapp_test

import (
	"context"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	"magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/knowledgebase/service"
	domainshared "magic/internal/domain/knowledge/shared"
)

const effectiveEmbeddingModel = "text-embedding-3-large"

func TestDocumentEntityToDTOWithContext_UsesEffectiveRouteModel(t *testing.T) {
	t.Parallel()
	svc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{},
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{Code: "KB1", Model: effectiveEmbeddingModel},
			showResult:             &knowledgebase.KnowledgeBase{Code: "KB1", Model: effectiveEmbeddingModel},
			routeModel:             effectiveEmbeddingModel,
		},
		nil,
	)
	doc := &document.KnowledgeBaseDocument{
		KnowledgeBaseCode: "KB1",
		EmbeddingModel:    "text-embedding-3-small",
		EmbeddingConfig:   &domainshared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
	}

	dto := appservice.DocumentEntityToDTOWithContextForTest(context.Background(), svc, doc)
	if dto == nil {
		t.Fatal("expected dto not nil")
	}
	if dto.EmbeddingModel != effectiveEmbeddingModel {
		t.Fatalf("expected effective embedding model text-embedding-3-large, got %q", dto.EmbeddingModel)
	}
	if dto.EmbeddingConfig == nil || dto.EmbeddingConfig.ModelID != effectiveEmbeddingModel {
		t.Fatalf("expected embedding_config.model_id overridden, got %#v", dto.EmbeddingConfig)
	}
}
