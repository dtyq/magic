package fragmentrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

const legacySyncStatusSynced = 2

type fragmentListMode uint8

const (
	fragmentListModeKnowledge fragmentListMode = iota
	fragmentListModeKnowledgeAndDocument
	fragmentListModeKnowledgeAndBusinessID
)

type fragmentSecondaryScopeMode uint8

const (
	fragmentSecondaryScopeDocument fragmentSecondaryScopeMode = iota
	fragmentSecondaryScopeBusinessID
)

var errUnsupportedFragmentListMode = errors.New("unsupported fragment list mode")
var (
	errInvalidDocumentSecondaryFragmentRows   = errors.New("invalid document secondary fragment rows type")
	errInvalidBusinessIDSecondaryFragmentRows = errors.New("invalid business id secondary fragment rows type")
)

type fragmentRowMapper[T any] func(T) (*fragmodel.KnowledgeBaseFragment, error)

type fragmentFilteredListPlan struct {
	contentLike      string
	syncStatusValues []int32
	limit            int32
	offset           int32
}

type secondaryFragmentListConfig struct {
	countFn func(context.Context) (int64, error)
	listFn  func(context.Context, fragmentFilteredListPlan) ([]*fragmodel.KnowledgeBaseFragment, error)
}

type secondaryFragmentRowsMapper func(any) ([]*fragmodel.KnowledgeBaseFragment, error)

// FindByID 根据 ID 查询片段
func (repo *FragmentRepository) FindByID(ctx context.Context, id int64) (*fragmodel.KnowledgeBaseFragment, error) {
	row, err := repo.queries.FindFragmentByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrFragmentNotFound
		}
		return nil, fmt.Errorf("failed to find fragment by id: %w", err)
	}
	return toFragmentFromFindByID(row)
}

// FindByPointIDs 根据 PointID 批量查询片段。
func (repo *FragmentRepository) FindByPointIDs(ctx context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	if len(pointIDs) == 0 {
		return []*fragmodel.KnowledgeBaseFragment{}, nil
	}

	rows, err := repo.queries.FindFragmentsByPointIDs(ctx, pointIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query fragments by point ids: %w", err)
	}
	return mapFragmentRows(rows, toFragmentFromFindByPointIDs)
}

// FindByIDs 根据 ID 批量查询片段。
func (repo *FragmentRepository) FindByIDs(ctx context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	if len(ids) == 0 {
		return []*fragmodel.KnowledgeBaseFragment{}, nil
	}

	rows, err := repo.queries.FindFragmentsByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to query fragments by ids: %w", err)
	}
	return mapFragmentRows(rows, toFragmentFromFindByIDs)
}

// List 分页查询片段列表
func (repo *FragmentRepository) List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	if query == nil {
		query = &fragmodel.Query{}
	}

	mode, err := resolveFragmentListMode(query)
	if err != nil {
		return nil, 0, err
	}

	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid offset: %w", err)
	}

	contentLike := buildFragmentContentLike(query.Content)
	syncStatusValues, err := buildFragmentSyncStatusValues(query.SyncStatus)
	if err != nil {
		return nil, 0, err
	}

	switch mode {
	case fragmentListModeKnowledge:
		return repo.listFragmentsByKnowledge(ctx, query, fragmentFilteredListPlan{
			contentLike:      contentLike,
			syncStatusValues: syncStatusValues,
			limit:            limit,
			offset:           offset,
		})
	case fragmentListModeKnowledgeAndDocument:
		return repo.listFragmentsByDocument(ctx, query, fragmentFilteredListPlan{
			contentLike:      contentLike,
			syncStatusValues: syncStatusValues,
			limit:            limit,
			offset:           offset,
		})
	case fragmentListModeKnowledgeAndBusinessID:
		return repo.listFragmentsByBusinessID(ctx, query, fragmentFilteredListPlan{
			contentLike:      contentLike,
			syncStatusValues: syncStatusValues,
			limit:            limit,
			offset:           offset,
		})
	default:
		return nil, 0, fmt.Errorf("%w: %d", errUnsupportedFragmentListMode, mode)
	}
}

func (repo *FragmentRepository) listFragmentsByKnowledge(
	ctx context.Context,
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	params := mysqlsqlc.CountFragmentsByKnowledgeParams{
		KnowledgeCode:    strings.TrimSpace(query.KnowledgeCode),
		ContentLike:      plan.contentLike,
		SyncStatusValues: plan.syncStatusValues,
	}
	return listFragmentsWithCount(
		func() (int64, error) {
			count, err := repo.queries.CountFragmentsByKnowledge(ctx, params)
			if err != nil {
				return 0, fmt.Errorf("failed to count fragments by knowledge: %w", err)
			}
			return count, nil
		},
		buildFilteredFragmentListFunc(
			func() ([]mysqlsqlc.MagicFlowKnowledgeFragment, error) {
				rows, err := repo.queries.ListFragmentsByKnowledge(ctx, mysqlsqlc.ListFragmentsByKnowledgeParams{
					KnowledgeCode:    params.KnowledgeCode,
					ContentLike:      params.ContentLike,
					SyncStatusValues: params.SyncStatusValues,
					Limit:            plan.limit,
					Offset:           plan.offset,
				})
				if err != nil {
					return nil, fmt.Errorf("failed to list fragments by knowledge: %w", err)
				}
				return rows, nil
			},
			toFragmentFromListByKnowledge,
		),
	)
}

func (repo *FragmentRepository) listFragmentsByDocument(
	ctx context.Context,
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return repo.listFragmentsBySecondaryScope(
		ctx,
		fragmentSecondaryScopeDocument,
		query,
		plan,
	)
}

func (repo *FragmentRepository) listFragmentsByBusinessID(
	ctx context.Context,
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return repo.listFragmentsBySecondaryScope(
		ctx,
		fragmentSecondaryScopeBusinessID,
		query,
		plan,
	)
}

// ListByDocument 根据知识库和文档查询片段列表。
func (repo *FragmentRepository) ListByDocument(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
	offset,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	limit32, err := convert.SafeIntToInt32(limit, "limit")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid limit: %w", err)
	}
	offset32, err := convert.SafeIntToInt32(offset, "offset")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid offset: %w", err)
	}

	params := mysqlsqlc.CountFragmentsByKnowledgeAndDocumentParams{
		KnowledgeCode: strings.TrimSpace(knowledgeCode),
		DocumentCode:  strings.TrimSpace(documentCode),
	}
	count, err := repo.queries.CountFragmentsByKnowledgeAndDocument(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count fragments by document: %w", err)
	}

	rows, err := repo.queries.ListFragmentsByKnowledgeAndDocument(ctx, mysqlsqlc.ListFragmentsByKnowledgeAndDocumentParams{
		KnowledgeCode: params.KnowledgeCode,
		DocumentCode:  params.DocumentCode,
		Limit:         limit32,
		Offset:        offset32,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list fragments by document: %w", err)
	}

	results, err := mapFragmentRows(rows, toFragmentFromListByKnowledgeAndDocument)
	if err != nil {
		return nil, 0, err
	}
	return results, count, nil
}

// ListByDocumentAfterID 根据知识库和文档按主键游标查询片段。
func (repo *FragmentRepository) ListByDocumentAfterID(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
	afterID int64,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	limit32, err := convert.SafeIntToInt32(limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}

	rows, err := repo.queries.ListFragmentsByKnowledgeAndDocumentAfterID(ctx, mysqlsqlc.ListFragmentsByKnowledgeAndDocumentAfterIDParams{
		KnowledgeCode: strings.TrimSpace(knowledgeCode),
		DocumentCode:  strings.TrimSpace(documentCode),
		ID:            afterID,
		Limit:         limit32,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query fragments by document after id: %w", err)
	}

	return mapFragmentRows(rows, toFragmentFromListByKnowledgeAndDocumentAfterID)
}

// ListByKnowledgeBase 根据知识库查询片段列表
func (repo *FragmentRepository) ListByKnowledgeBase(ctx context.Context, knowledgeCode string, offset, limit int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return repo.List(ctx, &fragmodel.Query{
		KnowledgeCode: knowledgeCode,
		Offset:        offset,
		Limit:         limit,
	})
}

// ListMissingDocumentCode 查询 document_code 为空的历史片段。
func (repo *FragmentRepository) ListMissingDocumentCode(
	ctx context.Context,
	query fragmodel.MissingDocumentCodeQuery,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}

	activeKnowledgeCodes, allowed, err := repo.resolveMissingDocumentCodeKnowledgeCodes(ctx, query)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return []*fragmodel.KnowledgeBaseFragment{}, nil
	}

	knowledgeCode := strings.TrimSpace(query.KnowledgeCode)
	if knowledgeCode != "" {
		rows, err := repo.queries.ListFragmentsMissingDocumentCodeByKnowledge(ctx, mysqlsqlc.ListFragmentsMissingDocumentCodeByKnowledgeParams{
			KnowledgeCode: knowledgeCode,
			StartID:       query.StartID,
			Limit:         limit,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list fragments missing document code: %w", err)
		}
		return mapMissingDocumentCodeRows(rows)
	}

	rows, err := repo.queries.ListFragmentsMissingDocumentCodeByKnowledgeCodes(ctx, mysqlsqlc.ListFragmentsMissingDocumentCodeByKnowledgeCodesParams{
		KnowledgeCodes: activeKnowledgeCodes,
		StartID:        query.StartID,
		Limit:          limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments missing document code by knowledge codes: %w", err)
	}
	return mapMissingDocumentCodeRowsByCodes(rows)
}

func (repo *FragmentRepository) listActiveKnowledgeCodesByOrganization(
	ctx context.Context,
	organizationCode string,
) ([]string, error) {
	rows, err := repo.queries.ListActiveKnowledgeBaseCodesByOrganization(ctx, strings.TrimSpace(organizationCode))
	if err != nil {
		return nil, fmt.Errorf("query active knowledge codes by organization: %w", err)
	}
	return rows, nil
}

func (repo *FragmentRepository) resolveMissingDocumentCodeKnowledgeCodes(
	ctx context.Context,
	query fragmodel.MissingDocumentCodeQuery,
) ([]string, bool, error) {
	organizationCode := strings.TrimSpace(query.OrganizationCode)
	if organizationCode == "" {
		return nil, true, nil
	}

	activeKnowledgeCodes, err := repo.listActiveKnowledgeCodesByOrganization(ctx, organizationCode)
	if err != nil {
		return nil, false, fmt.Errorf("list active knowledge codes by organization: %w", err)
	}
	knowledgeCode := strings.TrimSpace(query.KnowledgeCode)
	if knowledgeCode == "" {
		return activeKnowledgeCodes, len(activeKnowledgeCodes) > 0, nil
	}
	if slices.Contains(activeKnowledgeCodes, knowledgeCode) {
		return nil, true, nil
	}
	return nil, false, nil
}

// ListPendingSync 查询待同步的片段
func (repo *FragmentRepository) ListPendingSync(ctx context.Context, knowledgeCode string, limit int) ([]*fragmodel.KnowledgeBaseFragment, error) {
	limit32, err := convert.SafeIntToInt32(limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}
	pendingStatus, err := knowledgeShared.SyncStatusToInt32(shared.SyncStatusPending, "sync_status_pending")
	if err != nil {
		return nil, fmt.Errorf("invalid sync_status_pending: %w", err)
	}
	failedStatus, err := knowledgeShared.SyncStatusToInt32(shared.SyncStatusSyncFailed, "sync_status_failed")
	if err != nil {
		return nil, fmt.Errorf("invalid sync_status_failed: %w", err)
	}
	rows, err := repo.queries.ListPendingFragments(ctx, mysqlsqlc.ListPendingFragmentsParams{
		KnowledgeCode: strings.TrimSpace(knowledgeCode),
		SyncStatus:    pendingStatus,
		SyncStatus_2:  failedStatus,
		Limit:         limit32,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query pending fragments: %w", err)
	}

	return mapFragmentRows(rows, toFragmentFromListPending)
}

func listFragmentsWithCount(
	countFn func() (int64, error),
	listFn func() ([]*fragmodel.KnowledgeBaseFragment, error),
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	count, err := countFn()
	if err != nil {
		return nil, 0, err
	}
	fragments, err := listFn()
	if err != nil {
		return nil, 0, err
	}
	return fragments, count, nil
}

func mapFragmentRows[T any](rows []T, mapper fragmentRowMapper[T]) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, err := mapper(row)
		if err != nil {
			return nil, err
		}
		fragments = append(fragments, fragment)
	}
	return fragments, nil
}

func buildFilteredFragmentListFunc[T any](
	queryFn func() ([]T, error),
	mapper fragmentRowMapper[T],
) func() ([]*fragmodel.KnowledgeBaseFragment, error) {
	return func() ([]*fragmodel.KnowledgeBaseFragment, error) {
		rows, err := queryFn()
		if err != nil {
			return nil, err
		}
		return mapFragmentRows(rows, mapper)
	}
}

func (repo *FragmentRepository) listFragmentsBySecondaryScope(
	ctx context.Context,
	mode fragmentSecondaryScopeMode,
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	switch mode {
	case fragmentSecondaryScopeDocument:
		return listSecondaryFragments(ctx, plan, repo.buildDocumentSecondaryFragmentListConfig(query, plan))
	case fragmentSecondaryScopeBusinessID:
		return listSecondaryFragments(ctx, plan, repo.buildBusinessIDSecondaryFragmentListConfig(query, plan))
	default:
		return nil, 0, fmt.Errorf("%w: secondary scope mode=%d", errUnsupportedFragmentListMode, mode)
	}
}

func listSecondaryFragments(ctx context.Context, plan fragmentFilteredListPlan, config secondaryFragmentListConfig) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return listFragmentsWithCount(
		func() (int64, error) { return config.countFn(ctx) },
		func() ([]*fragmodel.KnowledgeBaseFragment, error) { return config.listFn(ctx, plan) },
	)
}

func (repo *FragmentRepository) buildDocumentSecondaryFragmentListConfig(
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) secondaryFragmentListConfig {
	params := mysqlsqlc.CountFragmentsByKnowledgeAndDocumentFilteredParams{
		KnowledgeCode:    strings.TrimSpace(query.KnowledgeCode),
		DocumentCode:     strings.TrimSpace(query.DocumentCode),
		ContentLike:      plan.contentLike,
		SyncStatusValues: plan.syncStatusValues,
	}
	return buildSecondaryFragmentListConfig(
		func(ctx context.Context) (int64, error) {
			return repo.queries.CountFragmentsByKnowledgeAndDocumentFiltered(ctx, params)
		},
		func(ctx context.Context, currentPlan fragmentFilteredListPlan) (any, error) {
			return repo.queries.ListFragmentsByKnowledgeAndDocumentFiltered(ctx, mysqlsqlc.ListFragmentsByKnowledgeAndDocumentFilteredParams{
				KnowledgeCode:    params.KnowledgeCode,
				DocumentCode:     params.DocumentCode,
				ContentLike:      params.ContentLike,
				SyncStatusValues: params.SyncStatusValues,
				Limit:            currentPlan.limit,
				Offset:           currentPlan.offset,
			})
		},
		mapDocumentSecondaryFragmentRows,
		"failed to count fragments by document",
		"failed to list fragments by document",
	)
}

func (repo *FragmentRepository) buildBusinessIDSecondaryFragmentListConfig(
	query *fragmodel.Query,
	plan fragmentFilteredListPlan,
) secondaryFragmentListConfig {
	params := mysqlsqlc.CountFragmentsByKnowledgeAndBusinessIDParams{
		KnowledgeCode:    strings.TrimSpace(query.KnowledgeCode),
		BusinessID:       strings.TrimSpace(query.BusinessID),
		ContentLike:      plan.contentLike,
		SyncStatusValues: plan.syncStatusValues,
	}
	return buildSecondaryFragmentListConfig(
		func(ctx context.Context) (int64, error) {
			return repo.queries.CountFragmentsByKnowledgeAndBusinessID(ctx, params)
		},
		func(ctx context.Context, currentPlan fragmentFilteredListPlan) (any, error) {
			return repo.queries.ListFragmentsByKnowledgeAndBusinessID(ctx, mysqlsqlc.ListFragmentsByKnowledgeAndBusinessIDParams{
				KnowledgeCode:    params.KnowledgeCode,
				BusinessID:       params.BusinessID,
				ContentLike:      params.ContentLike,
				SyncStatusValues: params.SyncStatusValues,
				Limit:            currentPlan.limit,
				Offset:           currentPlan.offset,
			})
		},
		mapBusinessIDSecondaryFragmentRows,
		"failed to count fragments by business id",
		"failed to list fragments by business id",
	)
}

func buildSecondaryFragmentListConfig(
	countFn func(context.Context) (int64, error),
	listFn func(context.Context, fragmentFilteredListPlan) (any, error),
	rowsMapper secondaryFragmentRowsMapper,
	countErr string,
	listErr string,
) secondaryFragmentListConfig {
	return secondaryFragmentListConfig{
		countFn: func(ctx context.Context) (int64, error) {
			count, err := countFn(ctx)
			if err != nil {
				return 0, fmt.Errorf("%s: %w", countErr, err)
			}
			return count, nil
		},
		listFn: func(ctx context.Context, plan fragmentFilteredListPlan) ([]*fragmodel.KnowledgeBaseFragment, error) {
			rows, err := listFn(ctx, plan)
			if err != nil {
				return nil, fmt.Errorf("%s: %w", listErr, err)
			}
			return rowsMapper(rows)
		},
	}
}

func mapDocumentSecondaryFragmentRows(rows any) ([]*fragmodel.KnowledgeBaseFragment, error) {
	typedRows, ok := rows.([]mysqlsqlc.MagicFlowKnowledgeFragment)
	if !ok {
		return nil, errInvalidDocumentSecondaryFragmentRows
	}
	return mapFragmentRows(typedRows, toFragmentFromListByKnowledgeAndDocumentFiltered)
}

func mapBusinessIDSecondaryFragmentRows(rows any) ([]*fragmodel.KnowledgeBaseFragment, error) {
	typedRows, ok := rows.([]mysqlsqlc.MagicFlowKnowledgeFragment)
	if !ok {
		return nil, errInvalidBusinessIDSecondaryFragmentRows
	}
	return mapFragmentRows(typedRows, toFragmentFromListByKnowledgeAndBusinessID)
}

// CountByKnowledgeBase 统计知识库下的片段数量
func (repo *FragmentRepository) CountByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error) {
	total, _, err := repo.CountStatsByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, err
	}
	return total, nil
}

// CountSyncedByKnowledgeBase 统计知识库下已同步的片段数量
func (repo *FragmentRepository) CountSyncedByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error) {
	_, synced, err := repo.CountStatsByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, err
	}
	return synced, nil
}

// CountStatsByKnowledgeBase 统计知识库下片段总数与已同步片段数（优先新状态，兜底旧状态）。
func (repo *FragmentRepository) CountStatsByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, int64, error) {
	syncedV2Status, err := knowledgeShared.SyncStatusToInt32(shared.SyncStatusSynced, "sync_status_synced")
	if err != nil {
		return 0, 0, fmt.Errorf("invalid sync_status_synced: %w", err)
	}

	row, err := repo.queries.CountFragmentStatsByKnowledgeBase(ctx, mysqlsqlc.CountFragmentStatsByKnowledgeBaseParams{
		SyncStatus:    syncedV2Status,
		SyncStatus_2:  legacySyncStatusSynced,
		KnowledgeCode: strings.TrimSpace(knowledgeCode),
	})
	if err != nil {
		return 0, 0, fmt.Errorf("failed to count fragment stats by knowledge base: %w", err)
	}
	syncedV2Count, err := convert.ParseInt64(row.SyncedV2Count)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid synced_v2_count: %w", err)
	}
	syncedV1Count, err := convert.ParseInt64(row.SyncedV1Count)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid synced_v1_count: %w", err)
	}
	syncedCount := syncedV2Count
	if syncedCount == 0 && syncedV1Count > 0 {
		syncedCount = syncedV1Count
	}
	return row.FragmentCount, syncedCount, nil
}

func resolveFragmentListMode(query *fragmodel.Query) (fragmentListMode, error) {
	knowledgeCode := strings.TrimSpace(query.KnowledgeCode)
	documentCode := strings.TrimSpace(query.DocumentCode)
	businessID := strings.TrimSpace(query.BusinessID)
	if knowledgeCode == "" {
		return 0, shared.ErrFragmentKnowledgeCodeRequired
	}
	switch {
	case documentCode != "":
		return fragmentListModeKnowledgeAndDocument, nil
	case businessID != "":
		return fragmentListModeKnowledgeAndBusinessID, nil
	default:
		return fragmentListModeKnowledge, nil
	}
}

func buildFragmentContentLike(content string) string {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return "%"
	}
	return "%" + trimmed + "%"
}

func buildFragmentSyncStatusValues(value *shared.SyncStatus) ([]int32, error) {
	if value == nil {
		return []int32{0, 1, 2, 3, 4, 5, 6}, nil
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(*value, "sync_status")
	if err != nil {
		return nil, fmt.Errorf("invalid sync_status: %w", err)
	}
	return []int32{syncStatus}, nil
}

func mapMissingDocumentCodeRows(rows []mysqlsqlc.MagicFlowKnowledgeFragment) ([]*fragmodel.KnowledgeBaseFragment, error) {
	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, err := toFragmentFromMissingDocumentCode(row)
		if err != nil {
			return nil, err
		}
		results = append(results, fragment)
	}
	return results, nil
}

func mapMissingDocumentCodeRowsByCodes(rows []mysqlsqlc.MagicFlowKnowledgeFragment) ([]*fragmodel.KnowledgeBaseFragment, error) {
	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, err := toFragmentFromMissingDocumentCodeByCodes(row)
		if err != nil {
			return nil, err
		}
		results = append(results, fragment)
	}
	return results, nil
}
