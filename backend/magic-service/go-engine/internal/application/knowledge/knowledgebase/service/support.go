package kbapp

import (
	"context"
	"fmt"
	"strings"

	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/pkg/timeformat"
)

const (
	defaultKnowledgeBaseVectorDB = "odin_qdrant"
	knowledgeBaseCodePrefix      = "KNOWLEDGE"
)

func normalizeVectorDB(vectorDB string) string {
	return kbentity.NormalizeVectorDB(vectorDB)
}

func ensureKnowledgeBaseCode(code string) string {
	return kbentity.EnsureKnowledgeBaseCode(code)
}

func (s *KnowledgeBaseAppService) populateFragmentCounts(ctx context.Context, dto *kbdto.KnowledgeBaseDTO) {
	if dto == nil || dto.Code == "" || s.fragmentCounter == nil {
		return
	}

	if counter, ok := s.fragmentCounter.(fragmentCountStatsProvider); ok {
		total, synced, err := counter.CountStatsByKnowledgeBase(ctx, dto.Code)
		if err != nil {
			s.warnCountFailure(ctx, "fragment_count/expected_count/completed_count", dto.Code, err)
			return
		}
		s.applyFragmentCounts(ctx, dto, total, synced)
		return
	}

	total, err := s.fragmentCounter.CountByKnowledgeBase(ctx, dto.Code)
	if err != nil {
		s.warnCountFailure(ctx, "fragment_count", dto.Code, err)
	} else if count, convErr := convertCount(total, "fragment_count"); convErr != nil {
		s.warnCountFailure(ctx, "fragment_count", dto.Code, convErr)
	} else {
		dto.FragmentCount = count
	}

	synced, err := s.fragmentCounter.CountSyncedByKnowledgeBase(ctx, dto.Code)
	if err != nil {
		s.warnCountFailure(ctx, "expected_count/completed_count", dto.Code, err)
		return
	}

	count, convErr := convertCount(synced, "synced_fragment_count")
	if convErr != nil {
		s.warnCountFailure(ctx, "expected_count/completed_count", dto.Code, convErr)
		return
	}
	dto.ExpectedCount = count
	dto.CompletedCount = count
}

func (s *KnowledgeBaseAppService) populateFragmentCountsBatch(
	ctx context.Context,
	items []*kbdto.KnowledgeBaseDTO,
) {
	if len(items) == 0 || s == nil || s.fragmentCounter == nil {
		return
	}
	if s.tryPopulateFragmentCountsBatch(ctx, items) {
		return
	}

	for _, item := range items {
		s.populateFragmentCounts(ctx, item)
	}
}

func (s *KnowledgeBaseAppService) tryPopulateFragmentCountsBatch(
	ctx context.Context,
	items []*kbdto.KnowledgeBaseDTO,
) bool {
	counter, ok := s.fragmentCounter.(fragmentCountBatchStatsProvider)
	if !ok {
		return false
	}

	knowledgeCodes := collectKnowledgeBaseCodes(items)
	totals, synced, err := counter.CountStatsByKnowledgeBases(ctx, knowledgeCodes)
	if err != nil {
		s.warnCountFailure(ctx, "fragment_count batch", strings.Join(knowledgeCodes, ","), err)
		return false
	}
	for _, item := range items {
		if item == nil || strings.TrimSpace(item.Code) == "" {
			continue
		}
		s.applyFragmentCounts(ctx, item, totals[item.Code], synced[item.Code])
	}
	return true
}

func collectKnowledgeBaseCodes(items []*kbdto.KnowledgeBaseDTO) []string {
	knowledgeCodes := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		knowledgeCode := strings.TrimSpace(item.Code)
		if knowledgeCode == "" {
			continue
		}
		if _, exists := seen[knowledgeCode]; exists {
			continue
		}
		seen[knowledgeCode] = struct{}{}
		knowledgeCodes = append(knowledgeCodes, knowledgeCode)
	}
	return knowledgeCodes
}

func (s *KnowledgeBaseAppService) applyFragmentCounts(ctx context.Context, dto *kbdto.KnowledgeBaseDTO, total, synced int64) {
	totalCount, err := convertCount(total, "fragment_count")
	if err != nil {
		s.warnCountFailure(ctx, "fragment_count", dto.Code, err)
		return
	}
	syncedCount, err := convertCount(synced, "synced_fragment_count")
	if err != nil {
		s.warnCountFailure(ctx, "expected_count/completed_count", dto.Code, err)
		return
	}
	dto.FragmentCount = totalCount
	dto.ExpectedCount = syncedCount
	dto.CompletedCount = syncedCount
}

func (s *KnowledgeBaseAppService) warnCountFailure(ctx context.Context, field, knowledgeCode string, err error) {
	if s.logger == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Failed to populate knowledge base count field",
		"field", field,
		"knowledge_code", knowledgeCode,
		"error", err,
	)
}

func convertCount(value int64, field string) (int, error) {
	if value < 0 {
		return 0, fmt.Errorf("%w: field=%s value=%d", ErrKnowledgeBaseCountNegative, field, value)
	}
	maxInt := int64(^uint(0) >> 1)
	if value > maxInt {
		return 0, fmt.Errorf("%w: field=%s value=%d", ErrKnowledgeBaseCountOverflow, field, value)
	}
	return int(value), nil
}

// EntityToDTO 将知识库实体映射为查询 DTO。
func EntityToDTO(e *kbentity.KnowledgeBase) *kbdto.KnowledgeBaseDTO {
	if e == nil {
		return nil
	}

	dto := &kbdto.KnowledgeBaseDTO{
		ID:                e.ID,
		Code:              e.Code,
		Name:              e.Name,
		Description:       e.Description,
		Type:              e.Type,
		Enabled:           e.Enabled,
		BusinessID:        e.BusinessID,
		OrganizationCode:  e.OrganizationCode,
		Creator:           e.CreatedUID,
		Modifier:          e.UpdatedUID,
		CreatedUID:        e.CreatedUID,
		UpdatedUID:        e.UpdatedUID,
		SyncStatus:        int(e.SyncStatus),
		SyncStatusMessage: e.SyncStatusMessage,
		Model:             e.Model,
		VectorDB:          e.VectorDB,
		FragmentCount:     0,
		ExpectedCount:     0,
		CompletedCount:    0,
		ExpectedNum:       e.ExpectedNum,
		CompletedNum:      e.CompletedNum,
		WordCount:         e.WordCount,
		Icon:              e.Icon,
		EmbeddingConfig:   confighelper.EmbeddingConfigEntityToDTO(e.EmbeddingConfig),
		SourceType:        e.SourceType,
		KnowledgeBaseType: string(kbentity.NormalizeKnowledgeBaseTypeOrDefault(e.KnowledgeBaseType)),
		AgentCodes:        []string{},
		CreatedAt:         timeformat.FormatAPIDatetime(e.CreatedAt),
		UpdatedAt:         timeformat.FormatAPIDatetime(e.UpdatedAt),
	}

	if e.RetrieveConfig != nil {
		dto.RetrieveConfig = confighelper.RetrieveConfigEntityToDTO(e.RetrieveConfig)
	}

	dto.FragmentConfig = confighelper.FragmentConfigEntityToOutputDTO(e.FragmentConfig)
	return dto
}

// ApplyResolvedModel 将有效模型回填到查询 DTO。
func ApplyResolvedModel(dto *kbdto.KnowledgeBaseDTO, effectiveModel string) *kbdto.KnowledgeBaseDTO {
	if dto == nil {
		return nil
	}
	dto.Model = effectiveModel
	dto.EmbeddingConfig = confighelper.CloneEmbeddingConfigWithModel(dto.EmbeddingConfig, effectiveModel)
	return dto
}
