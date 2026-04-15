package fragdomain_test

import (
	"testing"

	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

func TestBuildManualDocumentPrefersResolvedRouteModel(t *testing.T) {
	t.Parallel()

	kb := &struct {
		Code            string
		Model           string
		EmbeddingConfig *shared.EmbeddingConfig
		ResolvedRoute   *sharedroute.ResolvedRoute
	}{
		Code:            "KB1",
		Model:           "stale-model",
		EmbeddingConfig: &shared.EmbeddingConfig{ModelID: "config-model"},
		ResolvedRoute: &sharedroute.ResolvedRoute{
			Model: "route-model",
		},
	}

	doc := fragdomain.BuildManualDocument(kb, fragdomain.ManualFragmentInput{
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		UserID:           "U1",
		OrganizationCode: "ORG1",
	})
	if doc.EmbeddingModel != "route-model" {
		t.Fatalf("expected manual document to use resolved route model, got %#v", doc)
	}
}

func TestBuildLegacyThirdPlatformDocumentFallsBackToKnowledgeBaseModel(t *testing.T) {
	t.Parallel()

	kb := &struct {
		Code            string
		Model           string
		EmbeddingConfig *shared.EmbeddingConfig
	}{
		Code:            "KB1",
		Model:           "kb-model",
		EmbeddingConfig: &shared.EmbeddingConfig{ModelID: "config-model"},
	}

	doc := fragdomain.BuildLegacyThirdPlatformDocument(kb, fragdomain.LegacyThirdPlatformDocumentSpec{
		Name:              "file.docx",
		DocType:           2,
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		UserID:            "U1",
		OrganizationCode:  "ORG1",
	})
	if doc.EmbeddingModel != "config-model" {
		t.Fatalf("expected legacy third-platform document to use knowledge base embedding config model, got %#v", doc)
	}
}
