package fragmentrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	sq "github.com/Masterminds/squirrel"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

const legacySyncStatusSynced = 2

const fragmentListColumns = `id,
	knowledge_code,
	COALESCE(document_code, '') AS document_code,
	content,
	COALESCE(metadata, CAST('null' AS JSON)) AS metadata,
	business_id,
	sync_status,
	sync_times,
	sync_status_message,
	point_id,
	word_count,
	created_uid,
	updated_uid,
	created_at,
	updated_at,
	deleted_at`

const listContextFragmentsInnerColumns = `id,
	knowledge_code,
	document_code,
	content,
	metadata,
	business_id,
	sync_status,
	sync_times,
	sync_status_message,
	point_id,
	word_count,
	created_uid,
	updated_uid,
	created_at,
	updated_at,
	deleted_at,
	ROW_NUMBER() OVER (PARTITION BY document_code ORDER BY id ASC) AS rn`

const fragmentMissingDocumentCodeColumns = `f.id,
	f.knowledge_code,
	COALESCE(f.document_code, '') AS document_code,
	f.content,
	COALESCE(f.metadata, CAST('null' AS JSON)) AS metadata,
	f.business_id,
	f.sync_status,
	f.sync_times,
	f.sync_status_message,
	f.point_id,
	f.word_count,
	f.created_uid,
	f.updated_uid,
	f.created_at,
	f.updated_at,
	f.deleted_at`

const backfillDocumentCodePrefix = `UPDATE magic_flow_knowledge_fragment
SET document_code = ?,
    updated_at = ?
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND id IN (`

const backfillDocumentCodeSuffix = `)`

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

// FindByPointID 根据 PointID 查询片段
func (repo *FragmentRepository) FindByPointID(
	ctx context.Context,
	knowledgeCode,
	documentCode,
	pointID string,
) (*fragmodel.KnowledgeBaseFragment, error) {
	knowledgeCode = strings.TrimSpace(knowledgeCode)
	documentCode = strings.TrimSpace(documentCode)
	pointID = strings.TrimSpace(pointID)
	if knowledgeCode == "" {
		return nil, shared.ErrFragmentKnowledgeCodeRequired
	}
	if documentCode == "" {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}
	rows, err := repo.listFragmentsByKnowledgeAndDocumentNoLimit(ctx, knowledgeCode, documentCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragment by point id: %w", err)
	}
	for _, fragment := range rows {
		if fragment != nil && strings.TrimSpace(fragment.PointID) == pointID {
			return fragment, nil
		}
	}
	return nil, shared.ErrFragmentNotFound
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

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, convErr := toFragmentFromFindByPointIDs(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, fragment)
	}
	return results, nil
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

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(ids))
	for _, row := range rows {
		fragment, convErr := toFragmentFromFindByIDs(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, fragment)
	}
	return results, nil
}

// List 分页查询片段列表
func (repo *FragmentRepository) List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	if query == nil {
		query = &fragmodel.Query{}
	}

	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid offset: %w", err)
	}

	params, err := buildFragmentListParams(query)
	if err != nil {
		return nil, 0, fmt.Errorf("build fragment list params: %w", err)
	}

	count, err := repo.queries.CountFragments(ctx, mysqlsqlc.CountFragmentsParams{
		KnowledgeCode: params.KnowledgeCode,
		DocumentCode:  params.DocumentCode,
		BusinessID:    params.BusinessID,
		ContentLike:   params.ContentLike,
		SyncStatus:    params.SyncStatus,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count fragments: %w", err)
	}

	rows, err := repo.queries.ListFragments(ctx, mysqlsqlc.ListFragmentsParams{
		KnowledgeCode: params.KnowledgeCode,
		DocumentCode:  params.DocumentCode,
		BusinessID:    params.BusinessID,
		ContentLike:   params.ContentLike,
		SyncStatus:    params.SyncStatus,
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query fragments: %w", err)
	}

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, convErr := toFragmentFromList(row)
		if convErr != nil {
			return nil, 0, convErr
		}
		results = append(results, fragment)
	}
	return results, count, nil
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
		return nil, 0, fmt.Errorf("failed to query fragments by document: %w", err)
	}

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, convErr := toFragmentFromListByKnowledgeAndDocument(row)
		if convErr != nil {
			return nil, 0, convErr
		}
		results = append(results, fragment)
	}
	return results, count, nil
}

// ListContextByDocuments 按文档批量拉取上下文片段，不返回总数。
func (repo *FragmentRepository) ListContextByDocuments(
	ctx context.Context,
	documentKeys []fragmodel.DocumentKey,
	limit int,
) (map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, error) {
	normalizedDocumentKeys := normalizeContextDocumentKeys(documentKeys)
	result := make(map[fragmodel.DocumentKey][]*fragmodel.KnowledgeBaseFragment, len(normalizedDocumentKeys))
	if len(normalizedDocumentKeys) == 0 || limit <= 0 {
		return result, nil
	}

	for knowledgeCode, groupedDocumentCodes := range groupContextDocumentCodesByKnowledgeCode(normalizedDocumentKeys) {
		querySQL, args, err := buildListContextFragmentsByDocumentsSQL(knowledgeCode, groupedDocumentCodes, limit)
		if err != nil {
			return nil, err
		}
		if err := func() error {
			rows, err := repo.client.QueryContext(ctx, querySQL, args...)
			if err != nil {
				return fmt.Errorf("failed to query context fragments by documents: %w", err)
			}
			defer func() {
				_ = rows.Close()
			}()

			for rows.Next() {
				row, scanErr := scanFragmentListRow(rows)
				if scanErr != nil {
					return scanErr
				}
				fragment, convErr := toFragmentFromList(row)
				if convErr != nil {
					return convErr
				}
				key := fragmodel.DocumentKey{
					KnowledgeCode: row.KnowledgeCode,
					DocumentCode:  row.DocumentCode,
				}
				result[key] = append(result[key], fragment)
			}
			if err := rows.Err(); err != nil {
				return fmt.Errorf("iterate context fragments by documents: %w", err)
			}
			return nil
		}(); err != nil {
			return nil, err
		}
	}

	return result, nil
}

// ListByKnowledgeBase 根据知识库查询片段列表
func (repo *FragmentRepository) ListByKnowledgeBase(ctx context.Context, knowledgeCode string, offset, limit int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	return repo.List(ctx, &fragmodel.Query{
		KnowledgeCode: knowledgeCode,
		Offset:        offset,
		Limit:         limit,
	})
}

func normalizeContextDocumentKeys(documentKeys []fragmodel.DocumentKey) []fragmodel.DocumentKey {
	seen := make(map[fragmodel.DocumentKey]struct{}, len(documentKeys))
	normalized := make([]fragmodel.DocumentKey, 0, len(documentKeys))
	for _, documentKey := range documentKeys {
		normalizedKey := fragmodel.DocumentKey{
			KnowledgeCode: strings.TrimSpace(documentKey.KnowledgeCode),
			DocumentCode:  strings.TrimSpace(documentKey.DocumentCode),
		}
		if normalizedKey.KnowledgeCode == "" || normalizedKey.DocumentCode == "" {
			continue
		}
		if _, exists := seen[normalizedKey]; exists {
			continue
		}
		seen[normalizedKey] = struct{}{}
		normalized = append(normalized, normalizedKey)
	}
	return normalized
}

func groupContextDocumentCodesByKnowledgeCode(documentKeys []fragmodel.DocumentKey) map[string][]string {
	grouped := make(map[string][]string, len(documentKeys))
	for _, documentKey := range documentKeys {
		grouped[documentKey.KnowledgeCode] = append(grouped[documentKey.KnowledgeCode], documentKey.DocumentCode)
	}
	return grouped
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

	sqlText, args, err := buildListMissingDocumentCodeSQL(query, limit)
	if err != nil {
		return nil, err
	}
	rows, err := repo.client.QueryContext(ctx, sqlText, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments missing document code: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, query.Limit)
	for rows.Next() {
		row, scanErr := scanFragmentListRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		fragment, convErr := toFragmentFromList(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, fragment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate fragments missing document code: %w", err)
	}

	return results, nil
}

func buildFragmentListParams(query *fragmodel.Query) (mysqlsqlc.CountFragmentsParams, error) {
	if query == nil {
		query = &fragmodel.Query{}
	}
	knowledgeCode := strings.TrimSpace(query.KnowledgeCode)
	documentCode := strings.TrimSpace(query.DocumentCode)
	if documentCode != "" && knowledgeCode == "" {
		return mysqlsqlc.CountFragmentsParams{}, shared.ErrFragmentKnowledgeCodeRequired
	}

	params := mysqlsqlc.CountFragmentsParams{
		KnowledgeCode: nullableString(knowledgeCode),
		DocumentCode:  nullableString(documentCode),
		BusinessID:    nullableString(strings.TrimSpace(query.BusinessID)),
	}
	if content := strings.TrimSpace(query.Content); content != "" {
		params.ContentLike = nullableString("%" + content + "%")
	}
	if query.SyncStatus != nil {
		syncStatus, err := knowledgeShared.SyncStatusToInt32(*query.SyncStatus, "sync_status")
		if err != nil {
			return mysqlsqlc.CountFragmentsParams{}, fmt.Errorf("invalid sync_status: %w", err)
		}
		params.SyncStatus = sql.NullInt32{Int32: syncStatus, Valid: true}
	}
	return params, nil
}

func (repo *FragmentRepository) listFragmentsByKnowledgeAndDocumentNoLimit(
	ctx context.Context,
	knowledgeCode,
	documentCode string,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	rows, err := repo.client.QueryContext(
		ctx,
		`SELECT `+fragmentListColumns+`
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
ORDER BY id ASC`,
		knowledgeCode,
		documentCode,
	)
	if err != nil {
		return nil, fmt.Errorf("query fragments by knowledge and document: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	results := make([]*fragmodel.KnowledgeBaseFragment, 0)
	for rows.Next() {
		row, scanErr := scanFragmentListRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		fragment, convErr := toFragmentFromList(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, fragment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate fragments by knowledge and document: %w", err)
	}
	return results, nil
}

func buildListMissingDocumentCodeSQL(query fragmodel.MissingDocumentCodeQuery, limit int32) (string, []any, error) {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	queryBuilder := builder.
		Select(fragmentMissingDocumentCodeColumns).
		From("magic_flow_knowledge_fragment AS f").
		InnerJoin("magic_flow_knowledge AS kb ON kb.code = f.knowledge_code AND kb.deleted_at IS NULL").
		Where(sq.Expr("f.deleted_at IS NULL")).
		Where(sq.Expr("(f.document_code = '' OR f.document_code IS NULL)")).
		Where(sq.Gt{"f.id": query.StartID}).
		OrderBy("f.id ASC").
		Suffix("LIMIT ?", limit)

	if organizationCode := strings.TrimSpace(query.OrganizationCode); organizationCode != "" {
		queryBuilder = queryBuilder.Where(sq.Eq{"kb.organization_code": organizationCode})
	}
	if knowledgeCode := strings.TrimSpace(query.KnowledgeCode); knowledgeCode != "" {
		queryBuilder = queryBuilder.Where(sq.Eq{"f.knowledge_code": knowledgeCode})
	}

	sqlText, args, err := queryBuilder.ToSql()
	if err != nil {
		return "", nil, fmt.Errorf("build list fragments missing document code sql: %w", err)
	}
	return sqlText, args, nil
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
		KnowledgeCode: knowledgeCode,
		SyncStatus:    pendingStatus,
		SyncStatus_2:  failedStatus,
		Limit:         limit32,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query pending fragments: %w", err)
	}

	results := make([]*fragmodel.KnowledgeBaseFragment, 0, len(rows))
	for _, row := range rows {
		fragment, convErr := toFragmentFromListPending(row)
		if convErr != nil {
			return nil, convErr
		}
		results = append(results, fragment)
	}

	return results, nil
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
		KnowledgeCode: knowledgeCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("failed to count fragment stats by knowledge base: %w", err)
	}
	syncedV2Count, err := convert.ParseInt64(row.SyncedV2Count)
	if err != nil {
		return 0, 0, fmt.Errorf("parse synced v2 fragment count: %w", err)
	}
	syncedV1Count, err := convert.ParseInt64(row.SyncedV1Count)
	if err != nil {
		return 0, 0, fmt.Errorf("parse synced v1 fragment count: %w", err)
	}

	synced := syncedV2Count
	if synced == 0 {
		synced = syncedV1Count
	}
	return row.FragmentCount, synced, nil
}

// CountStatsByKnowledgeBases 批量统计知识库下片段总数与已同步片段数。
func (repo *FragmentRepository) CountStatsByKnowledgeBases(
	ctx context.Context,
	knowledgeCodes []string,
) (map[string]int64, map[string]int64, error) {
	if len(knowledgeCodes) == 0 {
		return map[string]int64{}, map[string]int64{}, nil
	}

	syncedV2Status, err := knowledgeShared.SyncStatusToInt32(shared.SyncStatusSynced, "sync_status_synced")
	if err != nil {
		return nil, nil, fmt.Errorf("invalid sync_status_synced: %w", err)
	}

	rows, err := repo.queries.CountFragmentStatsByKnowledgeBases(ctx, mysqlsqlc.CountFragmentStatsByKnowledgeBasesParams{
		SyncStatus:     syncedV2Status,
		SyncStatus_2:   legacySyncStatusSynced,
		KnowledgeCodes: knowledgeCodes,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to count fragment stats by knowledge bases: %w", err)
	}

	totals := make(map[string]int64, len(rows))
	synced := make(map[string]int64, len(rows))
	for _, row := range rows {
		syncedV2Count, convErr := convert.ParseInt64(row.SyncedV2Count)
		if convErr != nil {
			return nil, nil, fmt.Errorf("parse synced v2 fragment count: %w", convErr)
		}
		syncedV1Count, convErr := convert.ParseInt64(row.SyncedV1Count)
		if convErr != nil {
			return nil, nil, fmt.Errorf("parse synced v1 fragment count: %w", convErr)
		}
		totalSynced := syncedV2Count
		if totalSynced == 0 {
			totalSynced = syncedV1Count
		}
		totals[row.KnowledgeCode] = row.FragmentCount
		synced[row.KnowledgeCode] = totalSynced
	}
	return totals, synced, nil
}

func buildListContextFragmentsByDocumentsSQL(knowledgeCode string, documentCodes []string, limit int) (string, []any, error) {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	innerBuilder := builder.
		Select(listContextFragmentsInnerColumns).
		From("magic_flow_knowledge_fragment").
		Where(sq.Expr("deleted_at IS NULL")).
		Where(sq.Eq{"knowledge_code": knowledgeCode}).
		Where(sq.Eq{"document_code": documentCodes})

	outerBuilder := builder.
		Select(fragmentListColumns).
		FromSelect(innerBuilder, "ranked").
		Where(sq.LtOrEq{"rn": limit}).
		OrderBy("document_code ASC", "id ASC")

	sqlText, args, err := outerBuilder.ToSql()
	if err != nil {
		return "", nil, fmt.Errorf("build context fragments by documents sql: %w", err)
	}
	return sqlText, args, nil
}

func nullableString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}
