package docapp_test

import (
	"context"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	domainshared "magic/internal/domain/knowledge/shared"
)

const effectiveEmbeddingModel = "text-embedding-3-large"

func TestDocumentEntityToDTOWithContext_UsesEffectiveRouteModel(t *testing.T) {
	t.Parallel()
	svc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{},
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{Code: "KB1", Model: effectiveEmbeddingModel},
			showResult:             &kbentity.KnowledgeBase{Code: "KB1", Model: effectiveEmbeddingModel},
			routeModel:             effectiveEmbeddingModel,
		},
		nil,
	)
	doc := &docentity.KnowledgeBaseDocument{
		KnowledgeBaseCode: "KB1",
		EmbeddingModel:    "text-embedding-3-small",
		EmbeddingConfig:   &domainshared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
		FragmentConfig: &domainshared.FragmentConfig{
			Mode: domainshared.FragmentModeCustom,
			Normal: &domainshared.NormalFragmentConfig{
				SegmentRule: &domainshared.SegmentRule{
					Separator:    "\n\n",
					ChunkSize:    500,
					ChunkOverlap: 50,
				},
			},
		},
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
	if dto.FragmentConfig == nil || dto.FragmentConfig.Normal == nil {
		t.Fatalf("expected fragment config kept, got %#v", dto.FragmentConfig)
	}
	if dto.FragmentConfig.Normal.TextPreprocessRule == nil || len(dto.FragmentConfig.Normal.TextPreprocessRule) != 0 {
		t.Fatalf("expected normal text preprocess rule to be empty slice, got %#v", dto.FragmentConfig.Normal.TextPreprocessRule)
	}
}
