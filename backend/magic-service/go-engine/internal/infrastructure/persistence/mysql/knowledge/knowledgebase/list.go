package knowledgebaserepo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	shared "magic/internal/domain/knowledge/shared"
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

func (repo *BaseRepository) buildKnowledgeBasesParams(
	query *kbrepository.Query,
) (mysqlsqlc.CountKnowledgeBasesParams, mysqlsqlc.ListKnowledgeBasesParams, error) {
	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, fmt.Errorf("invalid offset: %w", err)
	}

	typeValues, err := buildKnowledgeBaseTypeValues(query.Type)
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, err
	}
	syncStatusValues, err := buildKnowledgeBaseSyncStatusValues(query.SyncStatus)
	if err != nil {
		return mysqlsqlc.CountKnowledgeBasesParams{}, mysqlsqlc.ListKnowledgeBasesParams{}, err
	}

	countParams := mysqlsqlc.CountKnowledgeBasesParams{
		NameLike:                buildKnowledgeBaseNameLike(query.Name),
		TypeValues:              typeValues,
		KnowledgeBaseTypeValues: buildKnowledgeBaseKindValues(query.KnowledgeBaseType),
		EnabledValues:           buildKnowledgeBaseEnabledValues(query.Enabled),
		SyncStatusValues:        syncStatusValues,
	}
	listParams := mysqlsqlc.ListKnowledgeBasesParams{
		NameLike:                countParams.NameLike,
		TypeValues:              countParams.TypeValues,
		KnowledgeBaseTypeValues: countParams.KnowledgeBaseTypeValues,
		EnabledValues:           countParams.EnabledValues,
		SyncStatusValues:        countParams.SyncStatusValues,
		Limit:                   limit,
		Offset:                  offset,
	}
	return countParams, listParams, nil
}

func buildKnowledgeBaseNameLike(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "%"
	}
	return "%" + trimmed + "%"
}

func buildKnowledgeBaseTypeValues(value *int) ([]int32, error) {
	if value == nil {
		return []int32{1, 2}, nil
	}
	typeValue, err := convert.SafeIntToInt32(*value, "type")
	if err != nil {
		return nil, fmt.Errorf("invalid type: %w", err)
	}
	return []int32{typeValue}, nil
}

func buildKnowledgeBaseKindValues(value *kbentity.Type) []string {
	if value == nil {
		return []string{
			string(kbentity.KnowledgeBaseTypeFlowVector),
			string(kbentity.KnowledgeBaseTypeDigitalEmployee),
		}
	}
	return []string{string(kbentity.NormalizeKnowledgeBaseTypeOrDefault(*value))}
}

func buildKnowledgeBaseEnabledValues(value *bool) []int8 {
	if value == nil {
		return []int8{0, 1}
	}
	if *value {
		return []int8{1}
	}
	return []int8{0}
}

func buildKnowledgeBaseSyncStatusValues(value *shared.SyncStatus) ([]int32, error) {
	if value == nil {
		return []int32{0, 1, 2, 3, 4, 5, 6}, nil
	}
	syncStatus, err := convert.SafeIntToInt32(int(*value), "sync_status")
	if err != nil {
		return nil, fmt.Errorf("invalid sync_status: %w", err)
	}
	return []int32{syncStatus}, nil
}

func buildCountByBusinessIDsParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	organizationCode string,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByBusinessIDsParams {
	return mysqlsqlc.CountKnowledgeBasesByBusinessIDsParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		BusinessIds:             businessIDs,
	}
}

func buildCountByBusinessIDsNoOrganizationParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByBusinessIDsNoOrganizationParams {
	return mysqlsqlc.CountKnowledgeBasesByBusinessIDsNoOrganizationParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		BusinessIds:             businessIDs,
	}
}

func buildListByBusinessIDsParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByBusinessIDsParams {
	return mysqlsqlc.ListKnowledgeBasesByBusinessIDsParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		BusinessIds:             businessIDs,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildListByBusinessIDsNoOrganizationParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByBusinessIDsNoOrganizationParams {
	return mysqlsqlc.ListKnowledgeBasesByBusinessIDsNoOrganizationParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		BusinessIds:             businessIDs,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildCountByCodesParams(params mysqlsqlc.CountKnowledgeBasesParams, codes []string) mysqlsqlc.CountKnowledgeBasesByCodesParams {
	return mysqlsqlc.CountKnowledgeBasesByCodesParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
	}
}

func buildListByCodesParams(params mysqlsqlc.ListKnowledgeBasesParams, codes []string) mysqlsqlc.ListKnowledgeBasesByCodesParams {
	return mysqlsqlc.ListKnowledgeBasesByCodesParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildCountByOrganizationAndCodesParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	organizationCode string,
	codes []string,
) mysqlsqlc.CountKnowledgeBasesByOrganizationAndCodesParams {
	return mysqlsqlc.CountKnowledgeBasesByOrganizationAndCodesParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
	}
}

func buildListByOrganizationAndCodesParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
	codes []string,
) mysqlsqlc.ListKnowledgeBasesByOrganizationAndCodesParams {
	return mysqlsqlc.ListKnowledgeBasesByOrganizationAndCodesParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildCountByCodesAndBusinessIDsParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	organizationCode string,
	codes []string,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsParams {
	return mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		BusinessIds:             businessIDs,
	}
}

func buildCountByCodesAndBusinessIDsNoOrganizationParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	codes []string,
	businessIDs []string,
) mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsNoOrganizationParams {
	return mysqlsqlc.CountKnowledgeBasesByCodesAndBusinessIDsNoOrganizationParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		BusinessIds:             businessIDs,
	}
}

func buildListByCodesAndBusinessIDsParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
	codes []string,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsParams {
	return mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		BusinessIds:             businessIDs,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildListByCodesAndBusinessIDsNoOrganizationParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	codes []string,
	businessIDs []string,
) mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsNoOrganizationParams {
	return mysqlsqlc.ListKnowledgeBasesByCodesAndBusinessIDsNoOrganizationParams{
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Codes:                   codes,
		BusinessIds:             businessIDs,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func buildCountByOrganizationParams(
	params mysqlsqlc.CountKnowledgeBasesParams,
	organizationCode string,
) mysqlsqlc.CountKnowledgeBasesByOrganizationParams {
	return mysqlsqlc.CountKnowledgeBasesByOrganizationParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
	}
}

func buildListByOrganizationParams(
	params mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
) mysqlsqlc.ListKnowledgeBasesByOrganizationParams {
	return mysqlsqlc.ListKnowledgeBasesByOrganizationParams{
		OrganizationCode:        strings.TrimSpace(organizationCode),
		NameLike:                params.NameLike,
		TypeValues:              params.TypeValues,
		KnowledgeBaseTypeValues: params.KnowledgeBaseTypeValues,
		EnabledValues:           params.EnabledValues,
		SyncStatusValues:        params.SyncStatusValues,
		Limit:                   params.Limit,
		Offset:                  params.Offset,
	}
}

func resolveKnowledgeBaseListFilterMode(query *kbrepository.Query) knowledgeBaseListFilterMode {
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
func (repo *BaseRepository) List(ctx context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	if query == nil {
		query = &kbrepository.Query{}
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
		return repo.listKnowledgeBasesByCodesAndBusinessIDs(ctx, countParams, listParams, &normalizedQuery)
	case knowledgeBaseListFilterModeCodes:
		if strings.TrimSpace(normalizedQuery.OrganizationCode) != "" {
			return repo.listKnowledgeBasesByOrganizationAndCodes(ctx, countParams, listParams, normalizedQuery.OrganizationCode, normalizedQuery.Codes)
		}
		return repo.listKnowledgeBasesByCodes(ctx, countParams, listParams, normalizedQuery.Codes)
	case knowledgeBaseListFilterModeBusinessIDs:
		return repo.listKnowledgeBasesByBusinessIDs(ctx, countParams, listParams, &normalizedQuery)
	case knowledgeBaseListFilterModeNone:
		if strings.TrimSpace(normalizedQuery.OrganizationCode) != "" {
			return repo.listKnowledgeBasesByOrganization(ctx, countParams, listParams, normalizedQuery.OrganizationCode)
		}
		return repo.listKnowledgeBasesWithoutFilters(ctx, countParams, listParams)
	default:
		return nil, 0, fmt.Errorf("%w: %s", errUnknownKnowledgeBaseListFilterMode, filterMode)
	}
}

func (repo *BaseRepository) listKnowledgeBasesByCodesAndBusinessIDs(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	query *kbrepository.Query,
) ([]*kbentity.KnowledgeBase, int64, error) {
	organizationCode := strings.TrimSpace(query.OrganizationCode)
	var (
		total int64
		rows  []mysqlsqlc.MagicFlowKnowledge
		err   error
	)
	if organizationCode != "" {
		total, err = repo.queries.CountKnowledgeBasesByCodesAndBusinessIDs(
			ctx,
			buildCountByCodesAndBusinessIDsParams(countParams, organizationCode, query.Codes, query.BusinessIDs),
		)
		if err == nil {
			rows, err = repo.queries.ListKnowledgeBasesByCodesAndBusinessIDs(
				ctx,
				buildListByCodesAndBusinessIDsParams(listParams, organizationCode, query.Codes, query.BusinessIDs),
			)
		}
	} else {
		total, err = repo.queries.CountKnowledgeBasesByCodesAndBusinessIDsNoOrganization(
			ctx,
			buildCountByCodesAndBusinessIDsNoOrganizationParams(countParams, query.Codes, query.BusinessIDs),
		)
		if err == nil {
			rows, err = repo.queries.ListKnowledgeBasesByCodesAndBusinessIDsNoOrganization(
				ctx,
				buildListByCodesAndBusinessIDsNoOrganizationParams(listParams, query.Codes, query.BusinessIDs),
			)
		}
	}
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by codes and business ids: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
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
) ([]*kbentity.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByCodes(ctx, buildCountByCodesParams(countParams, codes))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by codes: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByCodes(ctx, buildListByCodesParams(listParams, codes))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by codes: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesByOrganizationAndCodes(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
	codes []string,
) ([]*kbentity.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByOrganizationAndCodes(
		ctx,
		buildCountByOrganizationAndCodesParams(countParams, organizationCode, codes),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by organization and codes: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByOrganizationAndCodes(
		ctx,
		buildListByOrganizationAndCodesParams(listParams, organizationCode, codes),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by organization and codes: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesByBusinessIDs(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	query *kbrepository.Query,
) ([]*kbentity.KnowledgeBase, int64, error) {
	organizationCode := strings.TrimSpace(query.OrganizationCode)
	var (
		total int64
		rows  []mysqlsqlc.MagicFlowKnowledge
		err   error
	)
	if organizationCode != "" {
		total, err = repo.queries.CountKnowledgeBasesByBusinessIDs(
			ctx,
			buildCountByBusinessIDsParams(countParams, organizationCode, query.BusinessIDs),
		)
		if err == nil {
			rows, err = repo.queries.ListKnowledgeBasesByBusinessIDs(
				ctx,
				buildListByBusinessIDsParams(listParams, organizationCode, query.BusinessIDs),
			)
		}
	} else {
		total, err = repo.queries.CountKnowledgeBasesByBusinessIDsNoOrganization(
			ctx,
			buildCountByBusinessIDsNoOrganizationParams(countParams, query.BusinessIDs),
		)
		if err == nil {
			rows, err = repo.queries.ListKnowledgeBasesByBusinessIDsNoOrganization(
				ctx,
				buildListByBusinessIDsNoOrganizationParams(listParams, query.BusinessIDs),
			)
		}
	}
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by business ids: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesByOrganization(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
	organizationCode string,
) ([]*kbentity.KnowledgeBase, int64, error) {
	total, err := repo.queries.CountKnowledgeBasesByOrganization(ctx, buildCountByOrganizationParams(countParams, organizationCode))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count knowledge bases by organization: %w", err)
	}
	rows, err := repo.queries.ListKnowledgeBasesByOrganization(ctx, buildListByOrganizationParams(listParams, organizationCode))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases by organization: %w", err)
	}
	results, err := mapKnowledgeBases(rows)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (repo *BaseRepository) listKnowledgeBasesWithoutFilters(
	ctx context.Context,
	countParams mysqlsqlc.CountKnowledgeBasesParams,
	listParams mysqlsqlc.ListKnowledgeBasesParams,
) ([]*kbentity.KnowledgeBase, int64, error) {
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

func mapKnowledgeBases(rows []mysqlsqlc.MagicFlowKnowledge) ([]*kbentity.KnowledgeBase, error) {
	results := make([]*kbentity.KnowledgeBase, 0, len(rows))
	for _, row := range rows {
		kb, err := toKnowledgeBaseFromRow(row)
		if err != nil {
			return nil, err
		}
		results = append(results, kb)
	}
	return results, nil
}
