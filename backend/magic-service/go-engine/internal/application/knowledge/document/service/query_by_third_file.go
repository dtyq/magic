package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

// GetByThirdFileID 按第三方文件查询文档。
func (s *DocumentAppService) GetByThirdFileID(
	ctx context.Context,
	input *docdto.GetDocumentsByThirdFileIDInput,
) ([]*docdto.DocumentDTO, error) {
	if s == nil || input == nil {
		return []*docdto.DocumentDTO{}, nil
	}

	organizationCode := strings.TrimSpace(input.OrganizationCode)
	knowledgeBaseCode := strings.TrimSpace(input.KnowledgeBaseCode)
	thirdPlatformType := strings.TrimSpace(input.ThirdPlatformType)
	thirdFileID := strings.TrimSpace(input.ThirdFileID)
	if organizationCode == "" || thirdPlatformType == "" || thirdFileID == "" {
		return []*docdto.DocumentDTO{}, nil
	}

	if knowledgeBaseCode != "" {
		doc, err := s.domainService.FindByKnowledgeBaseAndThirdFile(ctx, knowledgeBaseCode, thirdPlatformType, thirdFileID)
		if errors.Is(err, shared.ErrDocumentNotFound) {
			return []*docdto.DocumentDTO{}, nil
		}
		if err != nil {
			return nil, fmt.Errorf("failed to find document by third file: %w", err)
		}
		if err := s.validateDocumentOrg(doc, organizationCode); errors.Is(err, ErrDocumentOrgMismatch) {
			return []*docdto.DocumentDTO{}, nil
		} else if err != nil {
			return nil, err
		}
		return []*docdto.DocumentDTO{s.entityToDTOWithContext(ctx, doc)}, nil
	}

	docs, err := s.domainService.ListByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents by third file: %w", err)
	}

	filteredDocs := make([]*documentdomain.KnowledgeBaseDocument, 0, len(docs))
	for _, doc := range docs {
		if err := s.validateDocumentOrg(doc, organizationCode); err != nil {
			continue
		}
		filteredDocs = append(filteredDocs, doc)
	}
	return s.entitiesToDTOsWithContext(ctx, filteredDocs), nil
}
