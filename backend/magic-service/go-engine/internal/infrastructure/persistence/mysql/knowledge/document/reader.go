package documentrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	sq "github.com/Masterminds/squirrel"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

// FindByID 按主键查询文档。
func (repo *DocumentRepository) FindByID(ctx context.Context, id int64) (*documentdomain.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByIDCompat(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by id: %w", err)
	}
	record, err := documentRecordFromFindDocumentByIDCompatRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

// FindByCode 按文档编码查询文档。
func (repo *DocumentRepository) FindByCode(ctx context.Context, code string) (*documentdomain.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByCodeCompat(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by code: %w", err)
	}
	record, err := documentRecordFromFindDocumentByCodeCompatRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

// FindByCodeAndKnowledgeBase 按知识库和文档编码查询文档。
func (repo *DocumentRepository) FindByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*documentdomain.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByCodeAndKnowledgeBaseCompat(ctx, mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseCompatParams{
		Code:              code,
		KnowledgeBaseCode: knowledgeBaseCode,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by code and knowledge base: %w", err)
	}
	record, err := documentRecordFromFindDocumentByCodeAndKnowledgeBaseCompatRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

// FindByThirdFile 按第三方文件标识查询文档。
func (repo *DocumentRepository) FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*documentdomain.KnowledgeBaseDocument, error) {
	return repo.findOne(
		ctx,
		documentSelectSQL+" WHERE d.deleted_at IS NULL AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC LIMIT 1",
		thirdPlatformType,
		thirdFileID,
	)
}

// FindByKnowledgeBaseAndProjectFile 按知识库与项目文件查询文档。
func (repo *DocumentRepository) FindByKnowledgeBaseAndProjectFile(
	ctx context.Context,
	knowledgeBaseCode string,
	projectFileID int64,
) (*documentdomain.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByKnowledgeBaseAndProjectFileCompat(ctx, mysqlsqlc.FindDocumentByKnowledgeBaseAndProjectFileCompatParams{
		KnowledgeBaseCode: knowledgeBaseCode,
		ItemRef:           strconv.FormatInt(projectFileID, 10),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by knowledge base and project file: %w", err)
	}
	record, err := documentRecordFromFindDocumentByKnowledgeBaseAndProjectFileCompatRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

// ListByKnowledgeBaseAndProject 列出知识库下某项目的全部文档。
func (repo *DocumentRepository) ListByKnowledgeBaseAndProject(
	ctx context.Context,
	knowledgeBaseCode string,
	projectID int64,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	bindingIDs, err := repo.listProjectSourceBindingIDs(ctx, knowledgeBaseCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list documents by knowledge base and project: %w", err)
	}
	if len(bindingIDs) == 0 {
		return []*documentdomain.KnowledgeBaseDocument{}, nil
	}
	return repo.listDocumentsBySourceBindingIDs(ctx, bindingIDs, strconv.FormatInt(projectID, 10))
}

// ListByProjectFileInOrg 按组织和项目文件列出全部关联文档。
func (repo *DocumentRepository) ListByProjectFileInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	itemIDs, err := repo.listProjectSourceItemIDs(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("list documents by project file in org: %w", err)
	}
	if len(itemIDs) == 0 {
		return []*documentdomain.KnowledgeBaseDocument{}, nil
	}
	return repo.listDocumentsBySourceItemIDs(ctx, itemIDs, strconv.FormatInt(projectFileID, 10))
}

// List 按查询条件列出文档并返回总数。
func (repo *DocumentRepository) List(ctx context.Context, query *documentdomain.Query) ([]*documentdomain.KnowledgeBaseDocument, int64, error) {
	if query == nil {
		query = &documentdomain.Query{}
	}
	limit, err := convert.SafeIntToInt32(query.Limit, "limit")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid limit: %w", err)
	}
	offset, err := convert.SafeIntToInt32(query.Offset, "offset")
	if err != nil {
		return nil, 0, fmt.Errorf("invalid offset: %w", err)
	}

	sqlSet, err := buildDocumentListSQL(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	countParams, err := buildCountDocumentsParams(query)
	if err != nil {
		return nil, 0, err
	}

	total, err := repo.queries.CountDocuments(ctx, countParams)
	if err != nil {
		return nil, 0, fmt.Errorf("count documents: %w", err)
	}

	docs, err := repo.listByQuery(ctx, sqlSet.dataSQL, sqlSet.dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}

// ListByKnowledgeBase 按知识库分页列出文档。
func (repo *DocumentRepository) ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*documentdomain.KnowledgeBaseDocument, int64, error) {
	return repo.List(ctx, &documentdomain.Query{
		KnowledgeBaseCode: knowledgeBaseCode,
		Offset:            offset,
		Limit:             limit,
	})
}

// CountByKnowledgeBaseCodes 统计组织内多个知识库的文档数。
func (repo *DocumentRepository) CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error) {
	if len(knowledgeBaseCodes) == 0 {
		return map[string]int64{}, nil
	}
	rows, err := repo.queries.CountDocumentsByKnowledgeBaseCodes(ctx, mysqlsqlc.CountDocumentsByKnowledgeBaseCodesParams{
		OrganizationCode:   organizationCode,
		KnowledgeBaseCodes: knowledgeBaseCodes,
	})
	if err != nil {
		return nil, fmt.Errorf("count documents by knowledge base codes: %w", err)
	}
	result := make(map[string]int64, len(knowledgeBaseCodes))
	for _, row := range rows {
		result[row.KnowledgeBaseCode] = row.Count
	}
	return result, nil
}

func (repo *DocumentRepository) findOne(ctx context.Context, query string, args ...any) (*documentdomain.KnowledgeBaseDocument, error) {
	record, err := scanDocumentRecord(repo.client.QueryRowContext(ctx, query, args...))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document: %w", err)
	}
	return toKnowledgeBaseDocument(record)
}

func (repo *DocumentRepository) listByQuery(ctx context.Context, query string, args ...any) ([]*documentdomain.KnowledgeBaseDocument, error) {
	rows, err := repo.client.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query documents: %w", err)
	}
	defer func() { _ = rows.Close() }()
	docs := make([]*documentdomain.KnowledgeBaseDocument, 0)
	for rows.Next() {
		record, err := scanDocumentRecord(rows)
		if err != nil {
			return nil, err
		}
		doc, err := toKnowledgeBaseDocument(record)
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}
	return docs, nil
}

type documentListSQLSet struct {
	dataSQL  string
	dataArgs []any
}

func buildDocumentListSQL(
	query *documentdomain.Query,
	limit int32,
	offset int32,
) (documentListSQLSet, error) {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)

	dataBuilder := builder.
		Select(documentSelectColumns).
		From("knowledge_base_documents d").
		LeftJoin("knowledge_source_bindings b ON b.id = d.source_binding_id").
		LeftJoin("knowledge_source_items si ON si.id = d.source_item_id")

	applyDocumentListFilters(&dataBuilder, query)
	dataSQL, dataArgs, err := dataBuilder.
		OrderBy("d.id DESC").
		Suffix("LIMIT ? OFFSET ?", limit, offset).
		ToSql()
	if err != nil {
		return documentListSQLSet{}, fmt.Errorf("build list documents sql: %w", err)
	}
	return documentListSQLSet{
		dataSQL:  dataSQL,
		dataArgs: dataArgs,
	}, nil
}

func buildCountDocumentsParams(query *documentdomain.Query) (mysqlsqlc.CountDocumentsParams, error) {
	docType := sql.NullInt32{}
	if query.DocType != nil {
		value, err := convert.SafeIntToInt32(*query.DocType, "doc_type")
		if err != nil {
			return mysqlsqlc.CountDocumentsParams{}, fmt.Errorf("invalid doc_type: %w", err)
		}
		docType = sql.NullInt32{Int32: value, Valid: true}
	}
	syncStatus, err := knowledgeShared.NullableSyncStatusToInt32(query.SyncStatus, "sync_status")
	if err != nil {
		return mysqlsqlc.CountDocumentsParams{}, fmt.Errorf("invalid sync_status: %w", err)
	}
	nameLike := sql.NullString{}
	if name := strings.TrimSpace(query.Name); name != "" {
		nameLike = knowledgeShared.OptionalString("%" + name + "%")
	}
	return mysqlsqlc.CountDocumentsParams{
		OrganizationCode:  knowledgeShared.OptionalString(strings.TrimSpace(query.OrganizationCode)),
		KnowledgeBaseCode: knowledgeShared.OptionalString(strings.TrimSpace(query.KnowledgeBaseCode)),
		NameLike:          nameLike,
		DocType:           docType,
		Enabled:           nullableBool(query.Enabled),
		SyncStatus:        syncStatus,
	}, nil
}

func nullableBool(value *bool) sql.NullBool {
	if value == nil {
		return sql.NullBool{}
	}
	return sql.NullBool{Bool: *value, Valid: true}
}

func applyDocumentListFilters(dataBuilder *sq.SelectBuilder, query *documentdomain.Query) {
	if query == nil {
		query = &documentdomain.Query{}
	}
	addDocumentListFilter(dataBuilder, sq.Expr("d.deleted_at IS NULL"))

	if organizationCode := strings.TrimSpace(query.OrganizationCode); organizationCode != "" {
		addDocumentListFilter(dataBuilder, sq.Eq{"d.organization_code": organizationCode})
	}
	if knowledgeBaseCode := strings.TrimSpace(query.KnowledgeBaseCode); knowledgeBaseCode != "" {
		addDocumentListFilter(dataBuilder, sq.Eq{"d.knowledge_base_code": knowledgeBaseCode})
	}
	if name := strings.TrimSpace(query.Name); name != "" {
		addDocumentListFilter(dataBuilder, sq.Like{"d.name": "%" + name + "%"})
	}
	if query.DocType != nil {
		addDocumentListFilter(dataBuilder, sq.Eq{"d.doc_type": *query.DocType})
	}
	if query.Enabled != nil {
		addDocumentListFilter(dataBuilder, sq.Eq{"d.enabled": *query.Enabled})
	}
	if query.SyncStatus != nil {
		addDocumentListFilter(dataBuilder, sq.Eq{"d.sync_status": int(*query.SyncStatus)})
	}
}

func addDocumentListFilter(dataBuilder *sq.SelectBuilder, predicate any) {
	*dataBuilder = dataBuilder.Where(predicate)
}

func (repo *DocumentRepository) findOrganizationCodeByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) (string, error) {
	var organizationCode string
	if err := repo.client.QueryRowContext(
		ctx,
		`SELECT organization_code
FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1`,
		strings.TrimSpace(knowledgeBaseCode),
	).Scan(&organizationCode); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", shared.ErrDocumentNotFound
		}
		return "", fmt.Errorf("find organization code by knowledge base: %w", err)
	}
	return strings.TrimSpace(organizationCode), nil
}

func (repo *DocumentRepository) listProjectSourceBindingIDs(
	ctx context.Context,
	knowledgeBaseCode string,
	projectID int64,
) ([]int64, error) {
	rows, err := repo.client.QueryContext(
		ctx,
		`SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?`,
		strings.TrimSpace(knowledgeBaseCode),
		strconv.FormatInt(projectID, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("query project source binding ids: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanInt64Rows(rows, "project source binding ids")
}

func (repo *DocumentRepository) listProjectSourceItemIDs(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]int64, error) {
	rows, err := repo.client.QueryContext(
		ctx,
		`SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = 'project'
  AND item_ref = ?`,
		strings.TrimSpace(organizationCode),
		strconv.FormatInt(projectFileID, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("query project source item ids: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanInt64Rows(rows, "project source item ids")
}

func (repo *DocumentRepository) listDocumentsBySourceBindingIDs(
	ctx context.Context,
	sourceBindingIDs []int64,
	projectRootRef string,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	sqlText, args, err := builder.
		Select(documentScopedSelectColumns).
		From("knowledge_base_documents d").
		Where(sq.Expr("d.deleted_at IS NULL")).
		Where(sq.Eq{"d.source_binding_id": sourceBindingIDs}).
		OrderBy("d.id DESC").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("build documents by source binding ids sql: %w", err)
	}
	args = append([]any{"project", projectRootRef, ""}, args...)
	return repo.listByQuery(ctx, sqlText, args...)
}

func (repo *DocumentRepository) listDocumentsBySourceItemIDs(
	ctx context.Context,
	sourceItemIDs []int64,
	projectFileRef string,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	sqlText, args, err := builder.
		Select(documentScopedSelectColumns).
		From("knowledge_base_documents d").
		Where(sq.Expr("d.deleted_at IS NULL")).
		Where(sq.Eq{"d.source_item_id": sourceItemIDs}).
		OrderBy("d.id DESC").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("build documents by source item ids sql: %w", err)
	}
	args = append([]any{"project", "", projectFileRef}, args...)
	return repo.listByQuery(ctx, sqlText, args...)
}

func scanInt64Rows(rows *sql.Rows, target string) ([]int64, error) {
	items := make([]int64, 0)
	for rows.Next() {
		var value int64
		if err := rows.Scan(&value); err != nil {
			return nil, fmt.Errorf("scan %s: %w", target, err)
		}
		items = append(items, value)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s: %w", target, err)
	}
	return items, nil
}
