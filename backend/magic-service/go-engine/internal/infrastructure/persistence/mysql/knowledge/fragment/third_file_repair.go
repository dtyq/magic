package fragmentrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
	"magic/pkg/convert"
)

// ListThirdFileRepairOrganizationCodes 列出存在历史第三方文件修复候选的组织编码。
func (repo *FragmentRepository) ListThirdFileRepairOrganizationCodes(
	ctx context.Context,
) ([]string, error) {
	knowledgeCodes, err := repo.queries.ListThirdFileRepairKnowledgeCodes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair knowledge codes: %w", err)
	}
	if len(knowledgeCodes) == 0 {
		return []string{}, nil
	}

	organizationCodes, err := repo.queries.ListActiveKnowledgeBaseOrganizationsByCodes(ctx, knowledgeCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to list active knowledge base organizations: %w", err)
	}

	result := make([]string, 0, len(organizationCodes))
	seen := make(map[string]struct{}, len(organizationCodes))
	for _, organizationCode := range organizationCodes {
		organizationCode = strings.TrimSpace(organizationCode)
		if organizationCode == "" {
			continue
		}
		if _, ok := seen[organizationCode]; ok {
			continue
		}
		seen[organizationCode] = struct{}{}
		result = append(result, organizationCode)
	}
	return result, nil
}

// ListThirdFileRepairGroups 按组织列出历史第三方文件修复分组。
func (repo *FragmentRepository) ListThirdFileRepairGroups(
	ctx context.Context,
	query thirdfilemappingpkg.RepairGroupQuery,
) ([]*thirdfilemappingpkg.RepairGroup, error) {
	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return nil, fmt.Errorf("invalid offset: %w", err)
	}

	knowledgeCodes, err := repo.listActiveKnowledgeCodesByOrganization(ctx, query.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to list active knowledge codes by organization: %w", err)
	}
	if len(knowledgeCodes) == 0 {
		return []*thirdfilemappingpkg.RepairGroup{}, nil
	}

	rows, err := repo.queries.ListThirdFileRepairGroupsByKnowledgeCodes(ctx, mysqlsqlc.ListThirdFileRepairGroupsByKnowledgeCodesParams{
		KnowledgeCodes: knowledgeCodes,
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair groups: %w", err)
	}

	results := make([]*thirdfilemappingpkg.RepairGroup, 0, len(rows))
	for _, row := range rows {
		group, convErr := toThirdFileRepairGroup(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, group)
	}
	return results, nil
}

// BackfillDocumentCodeByThirdFile 按 knowledge_code + file_id 回填缺失的 document_code。
func (repo *FragmentRepository) BackfillDocumentCodeByThirdFile(
	ctx context.Context,
	input thirdfilemappingpkg.BackfillByThirdFileInput,
) (int64, error) {
	active, err := repo.knowledgeBaseActiveInOrganization(ctx, input.KnowledgeCode, input.OrganizationCode)
	if err != nil {
		return 0, fmt.Errorf("failed to check knowledge base activity: %w", err)
	}
	if !active {
		return 0, nil
	}

	rows, err := repo.queries.BackfillFragmentDocumentCodeByThirdFile(ctx, mysqlsqlc.BackfillFragmentDocumentCodeByThirdFileParams{
		DocumentCode:  strings.TrimSpace(input.DocumentCode),
		UpdatedAt:     time.Now(),
		KnowledgeCode: strings.TrimSpace(input.KnowledgeCode),
		ThirdFileID:   strings.TrimSpace(input.ThirdFileID),
	})
	if err != nil {
		return 0, fmt.Errorf("backfill fragment document code by third file: %w", err)
	}
	return rows, nil
}

func (repo *FragmentRepository) knowledgeBaseActiveInOrganization(
	ctx context.Context,
	knowledgeCode string,
	organizationCode string,
) (bool, error) {
	_, err := repo.queries.FindKnowledgeBaseByCodeAndOrg(ctx, mysqlsqlc.FindKnowledgeBaseByCodeAndOrgParams{
		Code:             strings.TrimSpace(knowledgeCode),
		OrganizationCode: strings.TrimSpace(organizationCode),
	})
	if err == nil {
		return true, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return false, fmt.Errorf("query active knowledge base in organization: %w", err)
}

func toThirdFileRepairGroup(row mysqlsqlc.ListThirdFileRepairGroupsByKnowledgeCodesRow) (*thirdfilemappingpkg.RepairGroup, error) {
	missingDocumentCodeCount, err := convert.ParseInt64(row.MissingDocumentCodeCount)
	if err != nil {
		return nil, fmt.Errorf("parse missing_document_code_count: %w", err)
	}
	return &thirdfilemappingpkg.RepairGroup{
		KnowledgeCode:            strings.TrimSpace(row.KnowledgeCode),
		ThirdFileID:              cleanQueryText(string(row.ThirdFileID)),
		KnowledgeBaseID:          cleanQueryText(stringValue(row.KnowledgeBaseID)),
		GroupRef:                 cleanQueryText(stringValue(row.GroupRef)),
		ThirdFileType:            cleanQueryText(stringValue(row.ThirdFileType)),
		DocumentCode:             cleanQueryText(stringValue(row.DocumentCode)),
		DocumentName:             cleanQueryText(stringValue(row.DocumentName)),
		PreviewURL:               cleanQueryText(stringValue(row.PreviewUrl)),
		CreatedUID:               cleanQueryText(stringValue(row.CreatedUid)),
		UpdatedUID:               cleanQueryText(stringValue(row.UpdatedUid)),
		FragmentCount:            row.FragmentCount,
		MissingDocumentCodeCount: missingDocumentCodeCount,
	}, nil
}

func cleanQueryText(value string) string {
	return strings.Trim(strings.TrimSpace(value), "\"")
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case []byte:
		return string(typed)
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}
