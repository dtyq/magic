package knowledgebase_test

import (
	"context"
	"testing"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
)

func TestBuildKnowledgeBaseForCreateNormalizesEmptyConfigs(t *testing.T) {
	t.Parallel()

	kb := knowledgebasedomain.BuildKnowledgeBaseForCreate(&knowledgebasedomain.CreateInput{
		Name: "知识库",
	})
	if kb == nil {
		t.Fatal("expected knowledge base")
	}
	if kb.RetrieveConfig == nil || kb.FragmentConfig == nil {
		t.Fatalf("expected configs normalized on create, got %#v", kb)
	}
	if kb.RetrieveConfig.SearchMethod != "hybrid_search" || kb.FragmentConfig.Mode != shared.FragmentModeAuto {
		t.Fatalf("unexpected default configs: %#v", kb)
	}
}

func TestNormalizeKnowledgeBaseConfigsKeepsExistingConfigs(t *testing.T) {
	t.Parallel()

	retrieveConfig := &shared.RetrieveConfig{TopK: 3}
	fragmentConfig := &shared.FragmentConfig{Mode: shared.FragmentModeHierarchy}
	kb := &knowledgebasedomain.KnowledgeBase{
		RetrieveConfig: retrieveConfig,
		FragmentConfig: fragmentConfig,
	}

	got := knowledgebasedomain.NormalizeKnowledgeBaseConfigs(kb)
	if got != kb {
		t.Fatal("expected in-place normalization")
	}
	if kb.RetrieveConfig != retrieveConfig || kb.FragmentConfig != fragmentConfig {
		t.Fatalf("expected existing configs preserved, got %#v", kb)
	}
}

func TestKnowledgeBaseDomainServiceSaveNormalizesEmptyConfigsBeforePersist(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	vectorRepo := &stubVectorDBManagementRepository{collectionExists: false}
	resolver := &stubEmbeddingDimensionResolver{dimension: 3072}
	svc := knowledgebasedomain.NewDomainService(repo, vectorRepo, resolver, "", "", testKnowledgeBaseDomainLogger())

	kb := &knowledgebasedomain.KnowledgeBase{Code: testKnowledgeBaseCode}
	if err := svc.Save(context.Background(), kb); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if repo.savedKB == nil || repo.savedKB.RetrieveConfig == nil || repo.savedKB.FragmentConfig == nil {
		t.Fatalf("expected persisted configs normalized, got %#v", repo.savedKB)
	}
	if kb.RetrieveConfig == nil || kb.FragmentConfig == nil {
		t.Fatalf("expected original entity normalized, got %#v", kb)
	}
}

func TestKnowledgeBaseDomainServiceUpdateNormalizesEmptyConfigsBeforePersist(t *testing.T) {
	t.Parallel()

	repo := &stubKnowledgeBaseRepository{}
	svc := knowledgebasedomain.NewDomainService(repo, &stubVectorDBManagementRepository{}, nil, "", "", testKnowledgeBaseDomainLogger())

	kb := &knowledgebasedomain.KnowledgeBase{Code: testKnowledgeBaseCode}
	if err := svc.Update(context.Background(), kb); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if repo.updatedKB == nil || repo.updatedKB.RetrieveConfig == nil || repo.updatedKB.FragmentConfig == nil {
		t.Fatalf("expected persisted configs normalized, got %#v", repo.updatedKB)
	}
}
