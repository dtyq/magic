package fragdomain

import (
	"context"
	"fmt"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

func (s *FragmentDomainService) retrievalService() *fragretrieval.Service {
	return s.retrievalSvc
}

// WarmupRetrieval 预热检索依赖，避免首个查询触发分词器懒加载。
func (s *FragmentDomainService) WarmupRetrieval(ctx context.Context) error {
	if s == nil || s.retrievalService() == nil {
		return nil
	}
	if err := s.retrievalService().Warmup(ctx); err != nil {
		return fmt.Errorf("warmup retrieval service: %w", err)
	}
	return nil
}

// Similarity 执行片段相似度检索。
func (s *FragmentDomainService) Similarity(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	req fragretrieval.SimilarityRequest,
) ([]*fragmodel.SimilarityResult, error) {
	results, err := s.retrievalService().Similarity(ctx, kb, req)
	if err != nil {
		return nil, fmt.Errorf("similarity search: %w", err)
	}
	return results, nil
}
