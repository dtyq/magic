package fragapp

import (
	"context"
	"fmt"
	"slices"
	"strings"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	kshared "magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
)

const (
	employeeKnowledgeTopK             = 5
	employeeKnowledgeContextHitLimit  = 5
	employeeKnowledgeContextCharLimit = 400
)

type agentSimilarityInput struct {
	organizationCode string
	userID           string
	agentCode        string
	query            string
	businessParams   *ctxmeta.BusinessParams
}

// SimilarityByAgent 按数字员工维度检索其已绑定知识库中的知识片段。
func (s *FragmentAppService) SimilarityByAgent(
	ctx context.Context,
	input *fragdto.AgentSimilarityInput,
) (*fragdto.AgentSimilarityResultDTO, error) {
	normalizedInput, err := validateAgentSimilarityInput(input)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAgentSimilarityDependencies(); err != nil {
		return nil, err
	}
	if err := s.ensureAgentAccessible(
		ctx,
		normalizedInput.organizationCode,
		normalizedInput.userID,
		normalizedInput.agentCode,
	); err != nil {
		return nil, err
	}

	knowledgeBases, err := s.listBoundKnowledgeBasesByAgent(
		ctx,
		normalizedInput.organizationCode,
		normalizedInput.userID,
		normalizedInput.agentCode,
	)
	if err != nil {
		return nil, err
	}
	if len(knowledgeBases) == 0 {
		return &fragdto.AgentSimilarityResultDTO{
			QueryUsed: normalizedInput.query,
			Hits:      []*fragdto.SimilarityResultDTO{},
		}, nil
	}

	hits, err := s.collectAgentSimilarityHits(
		ctx,
		normalizedInput.organizationCode,
		normalizedInput.query,
		knowledgeBases,
		normalizedInput.businessParams,
	)
	if err != nil {
		return nil, err
	}

	slices.SortStableFunc(hits, func(a, b *fragdto.SimilarityResultDTO) int {
		switch {
		case a == nil && b == nil:
			return 0
		case a == nil:
			return 1
		case b == nil:
			return -1
		case a.Score > b.Score:
			return -1
		case a.Score < b.Score:
			return 1
		default:
			return strings.Compare(a.CitationID, b.CitationID)
		}
	})

	if len(hits) > employeeKnowledgeTopK {
		hits = hits[:employeeKnowledgeTopK]
	}
	for _, hit := range hits {
		if hit == nil {
			continue
		}
		hit.CitationID = buildSimilarityCitationID(hit)
	}

	return &fragdto.AgentSimilarityResultDTO{
		QueryUsed:   normalizedInput.query,
		HitCount:    len(hits),
		ContextText: buildAgentSimilarityContextText(hits),
		Hits:        hits,
	}, nil
}

func validateAgentSimilarityInput(input *fragdto.AgentSimilarityInput) (*agentSimilarityInput, error) {
	if input == nil {
		return nil, kshared.ErrKnowledgeBaseNotFound
	}
	organizationCode := strings.TrimSpace(input.OrganizationCode)
	userID := strings.TrimSpace(input.UserID)
	agentCode := strings.TrimSpace(input.AgentCode)
	query := strings.TrimSpace(input.Query)
	if organizationCode == "" || userID == "" || agentCode == "" || query == "" {
		return nil, kshared.ErrKnowledgeBaseNotFound
	}
	return &agentSimilarityInput{
		organizationCode: organizationCode,
		userID:           userID,
		agentCode:        agentCode,
		query:            query,
		businessParams:   input.BusinessParams,
	}, nil
}

func (s *FragmentAppService) ensureAgentSimilarityDependencies() error {
	if s.superMagicAgentAccess == nil {
		return ErrFragmentSuperMagicAgentAccessCheckerRequired
	}
	if s.knowledgeBaseBindingRepo == nil {
		return ErrFragmentKnowledgeBaseBindingReaderRequired
	}
	return nil
}

func (s *FragmentAppService) ensureAgentAccessible(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCode string,
) error {
	accessibleCodes, err := s.superMagicAgentAccess.ListAccessibleCodes(
		ctx,
		organizationCode,
		userID,
		[]string{agentCode},
	)
	if err != nil {
		return fmt.Errorf("list accessible super magic agents: %w", err)
	}
	if _, ok := accessibleCodes[agentCode]; !ok {
		return ErrFragmentPermissionDenied
	}
	return nil
}

func (s *FragmentAppService) listBoundKnowledgeBasesByAgent(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCode string,
) ([]*kbentity.KnowledgeBase, error) {
	bindings, err := s.knowledgeBaseBindingRepo.ListKnowledgeBaseBindingsByBindID(
		ctx,
		kbentity.BindingTypeSuperMagicAgent,
		agentCode,
		organizationCode,
	)
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases by agent code: %w", err)
	}
	knowledgeBaseCodes := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		if binding.KnowledgeBaseCode == "" || !binding.Metadata.IsEnabled() {
			continue
		}
		knowledgeBaseCodes = append(knowledgeBaseCodes, binding.KnowledgeBaseCode)
	}
	if len(knowledgeBaseCodes) == 0 {
		return nil, nil
	}
	knowledgeBases, err := s.listAgentBoundEnabledKnowledgeBases(ctx, organizationCode, knowledgeBaseCodes)
	if err != nil {
		return nil, err
	}
	return s.filterAgentSimilarityKnowledgeBasesByRead(ctx, organizationCode, userID, knowledgeBases)
}

func (s *FragmentAppService) filterAgentSimilarityKnowledgeBasesByRead(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBases []*kbentity.KnowledgeBase,
) ([]*kbentity.KnowledgeBase, error) {
	if len(knowledgeBases) == 0 {
		return nil, nil
	}
	flowCodes := make([]string, 0, len(knowledgeBases))
	for _, kb := range knowledgeBases {
		if kb != nil && kb.KnowledgeBaseType == kbentity.KnowledgeBaseTypeFlowVector {
			flowCodes = append(flowCodes, kb.Code)
		}
	}
	operations := map[string]kbaccess.Operation{}
	if len(flowCodes) > 0 {
		if accessService := s.knowledgeAccessService(); accessService != nil {
			var err error
			operations, err = accessService.BatchOperations(
				ctx,
				resolveFragmentAccessActor(ctx, organizationCode, userID),
				flowCodes,
			)
			if err != nil {
				operations = map[string]kbaccess.Operation{}
			}
		}
	}

	filtered := make([]*kbentity.KnowledgeBase, 0, len(knowledgeBases))
	for _, kb := range knowledgeBases {
		if kb == nil {
			continue
		}
		// Linked flow_vector KBs keep their original KB permission boundary:
		// agent visibility only allows entering the agent, not reading linked flow KB data.
		// digital_employee KBs still use agent visibility as their access boundary.
		if kb.KnowledgeBaseType == kbentity.KnowledgeBaseTypeFlowVector && !operations[kb.Code].CanRead() {
			continue
		}
		filtered = append(filtered, kb)
	}
	return filtered, nil
}

func (s *FragmentAppService) collectAgentSimilarityHits(
	ctx context.Context,
	organizationCode string,
	query string,
	knowledgeBases []*kbentity.KnowledgeBase,
	businessParams *ctxmeta.BusinessParams,
) ([]*fragdto.SimilarityResultDTO, error) {
	hits := make([]*fragdto.SimilarityResultDTO, 0, employeeKnowledgeTopK)
	for _, kb := range knowledgeBases {
		if kb == nil {
			continue
		}
		kbHits, err := s.similarityByKnowledgeBase(ctx, kb, &fragdto.SimilarityInput{
			OrganizationCode: organizationCode,
			KnowledgeCode:    kb.Code,
			Query:            query,
			TopK:             employeeKnowledgeTopK,
			BusinessParams:   businessParams,
		})
		if err != nil {
			return nil, fmt.Errorf("search similarity for knowledge base %s: %w", kb.Code, err)
		}
		hits = append(hits, kbHits...)
	}
	return hits, nil
}

func (s *FragmentAppService) listAgentBoundEnabledKnowledgeBases(
	ctx context.Context,
	organizationCode string,
	codes []string,
) ([]*kbentity.KnowledgeBase, error) {
	enabled := true
	items, _, err := s.kbService.List(ctx, &kbrepository.Query{
		OrganizationCode: organizationCode,
		Enabled:          &enabled,
		Codes:            append([]string(nil), codes...),
		Offset:           0,
		Limit:            len(codes),
	})
	if err != nil {
		return nil, fmt.Errorf("list agent bound knowledge bases: %w", err)
	}
	return items, nil
}

func buildSimilarityCitationID(hit *fragdto.SimilarityResultDTO) string {
	if hit == nil {
		return ""
	}
	return fmt.Sprintf("%s:%s:%d", hit.KnowledgeBaseCode, hit.DocumentCode, hit.ID)
}

func buildAgentSimilarityContextText(hits []*fragdto.SimilarityResultDTO) string {
	if len(hits) == 0 {
		return ""
	}

	var builder strings.Builder
	written := 0
	for _, hit := range hits {
		if hit == nil {
			continue
		}
		if written >= employeeKnowledgeContextHitLimit {
			break
		}
		content := strings.TrimSpace(hit.Content)
		if content == "" {
			continue
		}
		content = truncateRunes(content, employeeKnowledgeContextCharLimit)
		builder.WriteString("[")
		builder.WriteString(hit.CitationID)
		builder.WriteString("] ")
		if name := strings.TrimSpace(hit.DocumentName); name != "" {
			builder.WriteString(name)
			builder.WriteString(": ")
		}
		builder.WriteString(content)
		builder.WriteString("\n")
		written++
	}
	return strings.TrimSpace(builder.String())
}

func truncateRunes(input string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(input))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit]) + "..."
}
