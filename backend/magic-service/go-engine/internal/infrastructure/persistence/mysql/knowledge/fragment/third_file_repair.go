package fragmentrepo

import (
	"context"
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
	rows, err := repo.queries.ListThirdFileRepairOrganizationCodes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair organization codes: %w", err)
	}

	result := make([]string, 0, len(rows))
	for _, row := range rows {
		if trimmed := strings.TrimSpace(row); trimmed != "" {
			result = append(result, trimmed)
		}
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
	rows, err := repo.queries.ListThirdFileRepairGroups(ctx, mysqlsqlc.ListThirdFileRepairGroupsParams{
		OrganizationCode: query.OrganizationCode,
		Limit:            limit,
		Offset:           offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair groups: %w", err)
	}

	results := make([]*thirdfilemappingpkg.RepairGroup, 0, query.Limit)
	for _, row := range rows {
		missingCount, convErr := convert.ParseInt64(row.MissingDocumentCodeCount)
		if convErr != nil {
			return nil, fmt.Errorf("parse missing document code count: %w", convErr)
		}
		results = append(results, &thirdfilemappingpkg.RepairGroup{
			KnowledgeCode:            strings.TrimSpace(row.KnowledgeCode),
			ThirdFileID:              cleanQueryText(string(row.ThirdFileID)),
			KnowledgeBaseID:          cleanQueryText(anyToString(row.KnowledgeBaseID)),
			GroupRef:                 cleanQueryText(anyToString(row.GroupRef)),
			ThirdFileType:            cleanQueryText(anyToString(row.ThirdFileType)),
			DocumentCode:             cleanQueryText(anyToString(row.DocumentCode)),
			DocumentName:             cleanQueryText(anyToString(row.DocumentName)),
			PreviewURL:               cleanQueryText(anyToString(row.PreviewUrl)),
			CreatedUID:               cleanQueryText(anyToString(row.CreatedUid)),
			UpdatedUID:               cleanQueryText(anyToString(row.UpdatedUid)),
			FragmentCount:            row.FragmentCount,
			MissingDocumentCodeCount: missingCount,
		})
	}

	return results, nil
}

// BackfillDocumentCodeByThirdFile 按 knowledge_code + file_id 回填缺失的 document_code。
func (repo *FragmentRepository) BackfillDocumentCodeByThirdFile(
	ctx context.Context,
	input thirdfilemappingpkg.BackfillByThirdFileInput,
) (int64, error) {
	result, err := repo.queries.BackfillDocumentCodeByThirdFile(ctx, mysqlsqlc.BackfillDocumentCodeByThirdFileParams{
		DocumentCode:     input.DocumentCode,
		UpdatedAt:        time.Now(),
		OrganizationCode: input.OrganizationCode,
		KnowledgeCode:    input.KnowledgeCode,
		ThirdFileID:      input.ThirdFileID,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to backfill document code by third file: %w", err)
	}
	return result, nil
}

func anyToString(value any) string {
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

func cleanQueryText(value string) string {
	return strings.Trim(strings.TrimSpace(value), "\"")
}
