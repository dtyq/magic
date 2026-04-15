package knowledgebaserepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"magic/internal/domain/knowledge/knowledgebase/service"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

type knowledgeBaseListFilterMode string

const (
	knowledgeBaseListFilterModeNone           knowledgeBaseListFilterMode = "none"
	knowledgeBaseListFilterModeCodes          knowledgeBaseListFilterMode = "codes"
	knowledgeBaseListFilterModeBusinessIDs    knowledgeBaseListFilterMode = "business_ids"
	knowledgeBaseListFilterModeCodesAndBizIDs knowledgeBaseListFilterMode = "codes_and_business_ids"
)

var errUnknownKnowledgeBaseListFilterMode = errors.New("unknown knowledge base list filter mode")

func (repo *BaseRepository) buildKnowledgeBasesParams(query *knowledgebase.Query) (mysqlsqlc.CountKnowledgeBasesParams, mysqlsqlc.ListKnowledgeBasesParams, error) {
	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid offset: %w", err)
	}

	orgCode := knowledgeShared.OptionalString(query.OrganizationCode)
	nameLike := sql.NullString{}
	if query.Name != "" {
		nameLike = knowledgeShared.OptionalString("%" + query.Name + "%")
	}

	typeFilter := sql.NullInt32{}
	if query.Type != nil {
		typeValue, convErr := convert.SafeIntToInt32(*query.Type, "type")
		if convErr != nil {
			return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid type: %w", convErr)
		}
		typeFilter = sql.NullInt32{Int32: typeValue, Valid: true}
	}
	knowledgeBaseTypeFilter := sql.NullString{}
	if query.KnowledgeBaseType != nil {
		knowledgeBaseTypeFilter = knowledgeShared.OptionalString(string(knowledgebase.NormalizeKnowledgeBaseTypeOrDefault(*query.KnowledgeBaseType)))
	}

	enabledFilter := sql.NullBool{}
	if query.Enabled != nil {
		enabledFilter = sql.NullBool{Bool: *query.Enabled, Valid: true}
	}

	syncStatus, err := knowledgeShared.NullableSyncStatusToInt32(query.SyncStatus, "sync_status")
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid sync_status: %w", err)
	}

	countParams := mysqlsqlc.CountKnowledgeBasesParams{
		OrganizationCode:  orgCode,
		NameLike:          nameLike,
		Type:              typeFilter,
		KnowledgeBaseType: knowledgeBaseTypeFilter,
		Enabled:           enabledFilter,
		SyncStatus:        syncStatus,
	}
	listParams := mysqlsqlc.ListKnowledgeBasesParams{
		OrganizationCode:  orgCode,
		NameLike:          nameLike,
		Type:              typeFilter,
		KnowledgeBaseType: knowledgeBaseTypeFilter,
		Enabled:           enabledFilter,
		SyncStatus:        syncStatus,
		Limit:             limit,
		Offset:            offset,
	}
	return countParams, listParams, nil
}

func buildCountByBusinessIDsParams(params mysqlsqlc.CountKnowledgeBasesParams, businessIDs []string) mysqlsqlc.CountKnowledgeBasesByBusinessIDsParams {
	return mysqlsqlc.CountKnowledgeBasesByBusinessIDsParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		BusinessIds:       businessIDs,
	}
}

func buildListByBusinessIDsParams(params mysqlsqlc.ListKnowledgeBasesParams, businessIDs []string) mysqlsqlc.ListKnowledgeBasesByBusinessIDsParams {
	return mysqlsqlc.ListKnowledgeBasesByBusinessIDsParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		BusinessIds:       businessIDs,
		Limit:             params.Limit,
		Offset:            params.Offset,
	}
}

func buildCountByCodesParams(params mysqlsqlc.CountKnowledgeBasesParams, codes []string) mysqlsqlc.CountKnowledgeBasesByCodesParams {
	return mysqlsqlc.CountKnowledgeBasesByCodesParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		Codes:             codes,
	}
}

func buildListByCodesParams(params mysqlsqlc.ListKnowledgeBasesParams, codes []string) mysqlsqlc.ListKnowledgeBasesByCodesParams {
	return mysqlsqlc.ListKnowledgeBasesByCodesParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		Codes:             codes,
		Limit:             params.Limit,
		Offset:            params.Offset,
	}
}

func buildCountByCodesAndBusinessIDsParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	codes []string,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsParams {
	return mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		Codes:             codes,
		BusinessIds:       businessIDs,
	}
}

func buildListByCodesAndBusinessIDsParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	codes []string,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsParams {
	return mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsParams{
		OrganizationCode:  params.OrganizationCode,
		NameLike:          params.NameLike,
		Type:              params.Type,
		KnowledgeBaseType: params.KnowledgeBaseType,
		Enabled:           params.Enabled,
		SyncStatus:        params.SyncStatus,
		Codes:             codes,
		BusinessIds:       businessIDs,
		Limit:             params.Limit,
		Offset:            params.Offset,
	}
}

func resolveKnowledgeBaseListFilterMode(query *knowledgebase.Query) knowledgeBaseListFilterMode {
	switch {
	case len(query.Codes) > 0 && len(query.BusinessIDs) > 0:
		return knowledgeBaseListFilterModeCodesAndBizIDs
	case len(query.Codes) > 0:
		return knowledgeBaseListFilterModeCodes
	case len(query.BusinessIDs) > 0:
		return knowledgeBaseListFilterModeBusinessIDs
	default:
		return knowledgeBaseListFilterModeNone
	}
}

// List 分页查询知识库列表
func (repo *BaseRepository) List(ctx context.Context, query *knowledgebase.Query) ([]*knowledgebase.KnowledgeBase, int64, error) {
	if query == nil {
		query = &knowledgebase.Query{}
	}

	normalizedQuery := *query
	normalizedQuery.Codes = normalizeFilterValues(query.Codes)
	normalizedQuery.BusinessIDs = normalizeFilterValues(query.BusinessIDs)

	countParams, listParams, err := repo.buildKnowledgeBasesParams(&normalizedQuery)
	if err != nil {
		return nil, 0, err
	}

	filterMode := resolveKnowledgeBaseListFilterMode(&normalizedQuery)
	switch filterMode {
	case knowledgeBaseListFilterModeCodesAndBizIDs:
		return repo.listKnowledgeBasesByCodesAndBusinessIDs(ctx, countParams, listParams, normalizedQuery.Codes, normalizedQuery.BusinessIDs)
	case knowledgeBaseListFilterModeCodes:
		return repo.listKnowledgeBasesByCodes(ctx, countParams, listParams, normalizedQuery.Codes)
	case knowledgeBaseListFilterModeBusinessIDs:
		return repo.listKnowledgeBasesByBusinessIDs(ctx, countParams, listParams, normalizedQuery.BusinessIDs)
	case knowledgeBaseListFilterModeNone:
		return repo.listKnowledgeBasesWithoutFilters(ctx, countParams, listParams)
	default:
		return nil, 0, fmt.Errorf("%w: %s", errUnknownKnowledgeBaseListFilterMode, filterMode)
	}
}

func (repo *BaseRepository) listKnowledgeBasesByCodesAndBusinessIDs(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	codes []string,
	businessIDs []string,
) ([]*knowledgebase.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByCodesAndBusinessIDs(
		ctx,
		buildCountByCodesAndBusinessIDsParams(countParams, codes, businessIDs),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by codes and business ids: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByCodesAndBusinessIDs(
		ctx,
		buildListByCodesAndBusinessIDsParams(listParams, codes, businessIDs),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by codes and business ids: %w", err)
	}
	results, err := mapKnowledgeBasesByCodesAndBusinessIDs(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesByCodes(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	codes []string,
) ([]*knowledgebase.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByCodes(ctx, buildCountByCodesParams(countParams, codes))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by codes: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByCodes(ctx, buildListByCodesParams(listParams, codes))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by codes: %w", err)
	}
	results, err := mapKnowledgeBasesByCodes(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesByBusinessIDs(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	businessIDs []string,
) ([]*knowledgebase.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByBusinessIDs(ctx, buildCountByBusinessIDsParams(countParams, businessIDs))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by business ids: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByBusinessIDs(ctx, buildListByBusinessIDsParams(listParams, businessIDs))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by business ids: %w", err)
	}
	results, err := mapKnowledgeBasesByBusinessIDs(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesWithoutFilters(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
) ([]*knowledgebase.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBases(ctx, countParams)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBases(ctx, listParams)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func normalizeFilterValues(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func mapKnowledgeBases(rows []mysqlsqlc.ListKnowledgeBasesRow) ([]*knowledgebase.KnowledgeBase, error) {
	results := make([]*knowledgebase.KnowledgeBase, 0, len(rows))
	for _, row := range rows {
		kb, err := toKnowledgeBaseFromList(row)
		if err != nil {
			return nil, err
		}
		results = append(results, kb)
	}
	return results, nil
}

func mapKnowledgeBasesByCodes(rows []mysqlsqlc.ListKnowledgeBasesByCodesRow) ([]*knowledgebase.KnowledgeBase, error) {
	results := make([]*knowledgebase.KnowledgeBase, 0, len(rows))
	for _, row := range rows {
		kb, err := toKnowledgeBaseFromListByCodes(row)
		if err != nil {
			return nil, err
		}
		results = append(results, kb)
	}
	return results, nil
}

func mapKnowledgeBasesByBusinessIDs(rows []mysqlsqlc.ListKnowledgeBasesByBusinessIDsRow) ([]*knowledgebase.KnowledgeBase, error) {
	results := make([]*knowledgebase.KnowledgeBase, 0, len(rows))
	for _, row := range rows {
		kb, err := toKnowledgeBaseFromListByBusinessIDs(row)
		if err != nil {
			return nil, err
		}
		results = append(results, kb)
	}
	return results, nil
}

func mapKnowledgeBasesByCodesAndBusinessIDs(
	rows []mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsRow,
) ([]*knowledgebase.KnowledgeBase, error) {
	results := make([]*knowledgebase.KnowledgeBase, 0, len(rows))
	for _, row := range rows {
		kb, err := toKnowledgeBaseFromListByCodesAndBusinessIDs(row)
		if err != nil {
			return nil, err
		}
		results = append(results, kb)
	}
	return results, nil
}
