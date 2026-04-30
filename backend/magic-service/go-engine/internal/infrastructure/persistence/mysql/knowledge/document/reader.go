package documentrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	"magic/internal/domain/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/pkg/convert"
)

type sourceBindingLookup struct {
	Provider string
	RootRef  string
}

type sourceItemLookup struct {
	ItemRef string
}

var errUnsupportedDocumentListQuery = errors.New("unsupported document list query")

type documentSingleScopeMode uint8

const (
	documentSingleScopeOrganization documentSingleScopeMode = iota
	documentSingleScopeKnowledgeBase
	maxDocumentListQueryLimit int32 = 1<<31 - 1
)

// FindByID 按主键查询文档。
func (repo *DocumentRepository) FindByID(ctx context.Context, id int64) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by id: %w", err)
	}
	record, err := documentRecordFromFindByIDRow(row)
	if err != nil {
		return nil, fmt.Errorf("map document by id: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// FindByCode 按文档编码查询文档。
func (repo *DocumentRepository) FindByCode(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByCode(ctx, strings.TrimSpace(code))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by code: %w", err)
	}
	record, err := documentRecordFromFindByCodeRow(row)
	if err != nil {
		return nil, fmt.Errorf("map document by code: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// FindByCodeAndKnowledgeBase 按知识库和文档编码查询文档。
func (repo *DocumentRepository) FindByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByCodeAndKnowledgeBase(ctx, mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseParams{
		Code:              strings.TrimSpace(code),
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by code and knowledge base: %w", err)
	}
	record, err := documentRecordFromFindByCodeAndKnowledgeBaseRow(row)
	if err != nil {
		return nil, fmt.Errorf("map document by code and knowledge base: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// FindByThirdFile 按第三方文件标识查询文档。
func (repo *DocumentRepository) FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByThirdFile(ctx, mysqlsqlc.FindDocumentByThirdFileParams{
		ThirdPlatformType: sql.NullString{String: strings.TrimSpace(thirdPlatformType), Valid: strings.TrimSpace(thirdPlatformType) != ""},
		ThirdFileID:       sql.NullString{String: strings.TrimSpace(thirdFileID), Valid: strings.TrimSpace(thirdFileID) != ""},
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by third file: %w", err)
	}
	record, err := documentRecordFromFindByThirdFileRow(row)
	if err != nil {
		return nil, fmt.Errorf("map document by third file: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// FindByKnowledgeBaseAndProjectFile 按知识库与项目文件查询文档。
func (repo *DocumentRepository) FindByKnowledgeBaseAndProjectFile(
	ctx context.Context,
	knowledgeBaseCode string,
	projectFileID int64,
) (*docentity.KnowledgeBaseDocument, error) {
	organizationCode, err := repo.findOrganizationCodeByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("find document by knowledge base and project file: %w", err)
	}
	bindingIDs, err := repo.listProjectSourceBindingIDs(ctx, knowledgeBaseCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("find document by knowledge base and project file: %w", err)
	}
	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(
		ctx,
		organizationCode,
		"project",
		strconv.FormatInt(projectFileID, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("find document by knowledge base and project file: %w", err)
	}
	if len(bindingIDs) == 0 || len(itemIDs) == 0 {
		return nil, shared.ErrDocumentNotFound
	}

	row, err := repo.queries.FindLatestDocumentByKnowledgeBaseAndSourceBindingAndSourceItems(ctx,
		mysqlsqlc.FindLatestDocumentByKnowledgeBaseAndSourceBindingAndSourceItemsParams{
			KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
			SourceBindingIds:  bindingIDs,
			SourceItemIds:     itemIDs,
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find latest document by relations: %w", err)
	}
	record, err := documentRecordFromFindLatestByBindingAndItemsRow(row)
	if err != nil {
		return nil, fmt.Errorf("map latest document by relations: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// ListByKnowledgeBaseAndProject 列出知识库下某项目的全部文档。
func (repo *DocumentRepository) ListByKnowledgeBaseAndProject(
	ctx context.Context,
	knowledgeBaseCode string,
	projectID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	bindingIDs, err := repo.listProjectSourceBindingIDs(ctx, knowledgeBaseCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list documents by knowledge base and project: %w", err)
	}
	if len(bindingIDs) == 0 {
		return []*docentity.KnowledgeBaseDocument{}, nil
	}
	rows, err := repo.queries.ListDocumentsByKnowledgeBaseAndSourceBindingIDs(ctx, mysqlsqlc.ListDocumentsByKnowledgeBaseAndSourceBindingIDsParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		SourceBindingIds:  bindingIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by knowledge base and source bindings: %w", err)
	}
	records := make([]documentRecord, 0, len(rows))
	for _, row := range rows {
		record, err := documentRecordFromListByKnowledgeBaseAndSourceBindingIDsRow(row)
		if err != nil {
			return nil, fmt.Errorf("map documents by knowledge base and source bindings: %w", err)
		}
		records = append(records, record)
	}
	return repo.recordsToDocuments(ctx, records)
}

// ListByKnowledgeBaseAndSourceBindingIDs 根据知识库与 source_binding_id 批量列出文档。
func (repo *DocumentRepository) ListByKnowledgeBaseAndSourceBindingIDs(
	ctx context.Context,
	knowledgeBaseCode string,
	sourceBindingIDs []int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	if len(sourceBindingIDs) == 0 {
		return []*docentity.KnowledgeBaseDocument{}, nil
	}
	rows, err := repo.queries.ListDocumentsByKnowledgeBaseAndSourceBindingIDs(ctx, mysqlsqlc.ListDocumentsByKnowledgeBaseAndSourceBindingIDsParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		SourceBindingIds:  sourceBindingIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by knowledge base and source bindings: %w", err)
	}
	records := make([]documentRecord, 0, len(rows))
	for _, row := range rows {
		record, err := documentRecordFromListByKnowledgeBaseAndSourceBindingIDsRow(row)
		if err != nil {
			return nil, fmt.Errorf("map documents by knowledge base and source bindings: %w", err)
		}
		records = append(records, record)
	}
	return repo.recordsToDocuments(ctx, records)
}

// ListByProjectFileInOrg 按组织和项目文件列出全部关联文档。
func (repo *DocumentRepository) ListByProjectFileInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	bindingIDs, err := repo.listProjectSourceBindingIDsByOrganization(ctx, organizationCode)
	if err != nil {
		return nil, fmt.Errorf("list documents by project file in org: %w", err)
	}
	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(
		ctx,
		organizationCode,
		"project",
		strconv.FormatInt(projectFileID, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("list documents by project file in org: %w", err)
	}
	if len(bindingIDs) == 0 || len(itemIDs) == 0 {
		return []*docentity.KnowledgeBaseDocument{}, nil
	}
	rows, err := repo.queries.ListDocumentsByOrganizationAndSourceBindingAndSourceItems(ctx,
		mysqlsqlc.ListDocumentsByOrganizationAndSourceBindingAndSourceItemsParams{
			OrganizationCode: strings.TrimSpace(organizationCode),
			SourceBindingIds: bindingIDs,
			SourceItemIds:    itemIDs,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list documents by org and relations: %w", err)
	}
	records := make([]documentRecord, 0, len(rows))
	for _, row := range rows {
		record, err := documentRecordFromListByOrganizationAndSourceBindingAndSourceItemsRow(row)
		if err != nil {
			return nil, fmt.Errorf("map documents by org and relations: %w", err)
		}
		records = append(records, record)
	}
	return repo.recordsToDocuments(ctx, records)
}

// HasRealtimeProjectFileDocumentInOrg 判断组织内项目文件是否存在 enabled + realtime 绑定下的文档。
func (repo *DocumentRepository) HasRealtimeProjectFileDocumentInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) (bool, error) {
	organizationCode = strings.TrimSpace(organizationCode)
	if organizationCode == "" || projectFileID <= 0 {
		return false, nil
	}
	records, err := repo.listRealtimeProjectFileDocumentRecordsInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return false, err
	}
	return len(records) > 0, nil
}

// ListRealtimeByProjectFileInOrg 按组织和项目文件列出 enabled + realtime 绑定下的关联文档。
func (repo *DocumentRepository) ListRealtimeByProjectFileInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	organizationCode = strings.TrimSpace(organizationCode)
	if organizationCode == "" || projectFileID <= 0 {
		return []*docentity.KnowledgeBaseDocument{}, nil
	}
	records, err := repo.listRealtimeProjectFileDocumentRecordsInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, err
	}
	return repo.recordsToDocuments(ctx, records)
}

func (repo *DocumentRepository) listRealtimeProjectFileDocumentRecordsInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]documentRecord, error) {
	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(
		ctx,
		organizationCode,
		"project",
		strconv.FormatInt(projectFileID, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("list realtime project-file documents source items in org: %w", err)
	}
	if len(itemIDs) == 0 {
		return []documentRecord{}, nil
	}
	records, err := repo.listDocumentRecordsByOrganizationAndSourceItems(ctx, organizationCode, itemIDs)
	if err != nil {
		return nil, fmt.Errorf("list realtime project-file document candidates in org: %w", err)
	}
	return repo.filterRealtimeDocumentRecordsByProvider(ctx, records, organizationCode, "project")
}

// List 按查询条件列出文档并返回总数。
func (repo *DocumentRepository) List(ctx context.Context, query *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	if query == nil {
		query = &docrepo.DocumentQuery{}
	}

	params, err := buildDocumentListFilterParams(query)
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

	organizationCode := strings.TrimSpace(query.OrganizationCode)
	knowledgeBaseCode := strings.TrimSpace(query.KnowledgeBaseCode)
	switch {
	case organizationCode != "" && knowledgeBaseCode != "":
		return repo.listDocumentsByOrganizationAndKnowledgeBase(ctx, organizationCode, knowledgeBaseCode, params, limit, offset)
	case organizationCode != "":
		return repo.listDocumentsByOrganization(ctx, organizationCode, params, limit, offset)
	case knowledgeBaseCode != "":
		return repo.listDocumentsByKnowledgeBase(ctx, knowledgeBaseCode, params, limit, offset)
	default:
		return nil, 0, errUnsupportedDocumentListQuery
	}
}

// ListByKnowledgeBase 按知识库分页列出文档。
func (repo *DocumentRepository) ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return repo.List(ctx, &docrepo.DocumentQuery{
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
	rows, err := repo.queries.ListDocumentFilesByKnowledgeBaseCodes(ctx, mysqlsqlc.ListDocumentFilesByKnowledgeBaseCodesParams{
		OrganizationCode:   strings.TrimSpace(organizationCode),
		KnowledgeBaseCodes: knowledgeBaseCodes,
	})
	if err != nil {
		return nil, fmt.Errorf("list document files by knowledge base codes: %w", err)
	}
	result := make(map[string]int64, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		result[code] = 0
	}
	for _, row := range rows {
		extension, err := extractDocumentFileExtension(row.DocumentFile)
		if err != nil {
			return nil, fmt.Errorf("extract document extension by knowledge base code %s: %w", row.KnowledgeBaseCode, err)
		}
		if extension == "" || docentity.IsSupportedKnowledgeBaseFileExtension(extension) {
			result[row.KnowledgeBaseCode]++
		}
	}
	return result, nil
}

func (repo *DocumentRepository) listDocumentsByOrganizationAndKnowledgeBase(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
	params documentListFilterParams,
	limit int32,
	offset int32,
) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	rows, err := repo.queries.ListDocumentsByOrganizationAndKnowledgeBase(ctx, mysqlsqlc.ListDocumentsByOrganizationAndKnowledgeBaseParams{
		OrganizationCode:  organizationCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		NameLike:          params.nameLike,
		DocTypeValues:     params.docTypeValues,
		EnabledValues:     params.enabledValues,
		SyncStatusValues:  params.syncStatusValues,
		Limit:             maxDocumentListQueryLimit,
		Offset:            0,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list documents by organization and knowledge base: %w", err)
	}
	records, err := mapDocumentRecords(rows, documentRecordFromListByOrganizationAndKnowledgeBaseRow)
	if err != nil {
		return nil, 0, fmt.Errorf("map documents by organization and knowledge base: %w", err)
	}
	return repo.buildVisibleDocumentPage(ctx, records, offset, limit)
}

func (repo *DocumentRepository) listDocumentsByOrganization(
	ctx context.Context,
	organizationCode string,
	params documentListFilterParams,
	limit int32,
	offset int32,
) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return repo.listDocumentsBySingleScope(
		ctx,
		documentSingleScopeOrganization,
		organizationCode,
		params,
		limit,
		offset,
	)
}

func (repo *DocumentRepository) listDocumentsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
	params documentListFilterParams,
	limit int32,
	offset int32,
) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	return repo.listDocumentsBySingleScope(
		ctx,
		documentSingleScopeKnowledgeBase,
		knowledgeBaseCode,
		params,
		limit,
		offset,
	)
}

func (repo *DocumentRepository) toDocumentWithRelations(ctx context.Context, record documentRecord) (*docentity.KnowledgeBaseDocument, error) {
	records := []documentRecord{record}
	if err := repo.enrichDocumentRecords(ctx, records); err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(records[0])
}

func (repo *DocumentRepository) recordsToDocuments(ctx context.Context, records []documentRecord) ([]*docentity.KnowledgeBaseDocument, error) {
	if err := repo.enrichDocumentRecords(ctx, records); err != nil {
		return nil, err
	}
	docs := make([]*docentity.KnowledgeBaseDocument, 0, len(records))
	for _, record := range records {
		doc, err := toKnowledgeBaseDocument(record)
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func mapDocumentRecords[T any](rows []T, mapper func(T) (documentRecord, error)) ([]documentRecord, error) {
	records := make([]documentRecord, 0, len(rows))
	for _, row := range rows {
		record, err := mapper(row)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, nil
}

func (repo *DocumentRepository) listDocumentsBySingleScope(
	ctx context.Context,
	mode documentSingleScopeMode,
	scopeValue string,
	params documentListFilterParams,
	limit int32,
	offset int32,
) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	switch mode {
	case documentSingleScopeOrganization:
		records, err := repo.listDocumentRecordsByOrganizationScope(ctx, scopeValue, params)
		if err != nil {
			return nil, 0, err
		}
		return repo.buildVisibleDocumentPage(ctx, records, offset, limit)
	case documentSingleScopeKnowledgeBase:
		records, err := repo.listDocumentRecordsByKnowledgeBaseScope(ctx, scopeValue, params)
		if err != nil {
			return nil, 0, err
		}
		return repo.buildVisibleDocumentPage(ctx, records, offset, limit)
	default:
		return nil, 0, fmt.Errorf("%w: single scope mode=%d", errUnsupportedDocumentListQuery, mode)
	}
}

func (repo *DocumentRepository) listDocumentRecordsByOrganizationScope(
	ctx context.Context,
	organizationCode string,
	params documentListFilterParams,
) ([]documentRecord, error) {
	rows, err := repo.queries.ListDocumentsByOrganization(ctx, mysqlsqlc.ListDocumentsByOrganizationParams{
		OrganizationCode: organizationCode,
		NameLike:         params.nameLike,
		DocTypeValues:    params.docTypeValues,
		EnabledValues:    params.enabledValues,
		SyncStatusValues: params.syncStatusValues,
		Limit:            maxDocumentListQueryLimit,
		Offset:           0,
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by organization: %w", err)
	}
	records, err := mapDocumentRecords(rows, documentRecordFromListByOrganizationRow)
	if err != nil {
		return nil, fmt.Errorf("map documents by organization: %w", err)
	}
	return records, nil
}

func (repo *DocumentRepository) listDocumentRecordsByKnowledgeBaseScope(
	ctx context.Context,
	knowledgeBaseCode string,
	params documentListFilterParams,
) ([]documentRecord, error) {
	rows, err := repo.queries.ListDocumentsByKnowledgeBase(ctx, mysqlsqlc.ListDocumentsByKnowledgeBaseParams{
		KnowledgeBaseCode: knowledgeBaseCode,
		NameLike:          params.nameLike,
		DocTypeValues:     params.docTypeValues,
		EnabledValues:     params.enabledValues,
		SyncStatusValues:  params.syncStatusValues,
		Limit:             maxDocumentListQueryLimit,
		Offset:            0,
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by knowledge base: %w", err)
	}
	records, err := mapDocumentRecords(rows, documentRecordFromListByKnowledgeBaseRow)
	if err != nil {
		return nil, fmt.Errorf("map documents by knowledge base: %w", err)
	}
	return records, nil
}

func (repo *DocumentRepository) enrichDocumentRecords(ctx context.Context, records []documentRecord) error {
	if len(records) == 0 {
		return nil
	}

	bindingLookups, err := repo.lookupSourceBindingsByIDs(ctx, collectDocumentRelationIDs(records, func(record documentRecord) int64 {
		return record.SourceBindingID
	}))
	if err != nil {
		return err
	}
	itemLookups, err := repo.lookupSourceItemsByIDs(ctx, collectDocumentRelationIDs(records, func(record documentRecord) int64 {
		return record.SourceItemID
	}))
	if err != nil {
		return err
	}

	for idx := range records {
		if binding, ok := bindingLookups[records[idx].SourceBindingID]; ok {
			records[idx].SourceProvider = binding.Provider
			records[idx].BindingRootRef = binding.RootRef
		}
		if item, ok := itemLookups[records[idx].SourceItemID]; ok {
			records[idx].SourceItemRef = item.ItemRef
		}
	}
	return nil
}

func (repo *DocumentRepository) lookupSourceBindingsByIDs(ctx context.Context, ids []int64) (map[int64]sourceBindingLookup, error) {
	if len(ids) == 0 {
		return map[int64]sourceBindingLookup{}, nil
	}
	rows, err := repo.queries.ListSourceBindingLookupsByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("query source binding lookups: %w", err)
	}
	result := make(map[int64]sourceBindingLookup, len(rows))
	for _, row := range rows {
		result[row.ID] = sourceBindingLookup{
			Provider: row.Provider,
			RootRef:  row.RootRef,
		}
	}
	return result, nil
}

func (repo *DocumentRepository) lookupSourceItemsByIDs(ctx context.Context, ids []int64) (map[int64]sourceItemLookup, error) {
	if len(ids) == 0 {
		return map[int64]sourceItemLookup{}, nil
	}
	rows, err := repo.queries.ListSourceItemLookupsByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("query source item lookups: %w", err)
	}
	result := make(map[int64]sourceItemLookup, len(rows))
	for _, row := range rows {
		result[row.ID] = sourceItemLookup{ItemRef: row.ItemRef}
	}
	return result, nil
}

type documentListFilterParams struct {
	nameLike         string
	docTypeValues    []uint32
	enabledValues    []int8
	syncStatusValues []int32
}

func buildDocumentListFilterParams(query *docrepo.DocumentQuery) (documentListFilterParams, error) {
	params := documentListFilterParams{
		nameLike:         "%",
		docTypeValues:    defaultDocumentListDocTypeValues(),
		enabledValues:    []int8{0, 1},
		syncStatusValues: []int32{0, 1, 2, 3, 4, 5, 6},
	}
	if name := strings.TrimSpace(query.Name); name != "" {
		params.nameLike = "%" + name + "%"
	}
	if query.DocType != nil {
		value, err := convert.SafeIntToUint32(*query.DocType, "doc_type")
		if err != nil {
			return documentListFilterParams{}, fmt.Errorf("invalid doc_type: %w", err)
		}
		params.docTypeValues = []uint32{value}
	}
	if query.Enabled != nil {
		if *query.Enabled {
			params.enabledValues = []int8{1}
		} else {
			params.enabledValues = []int8{0}
		}
	}
	if query.SyncStatus != nil {
		syncStatus, err := convert.SafeIntToInt32(int(*query.SyncStatus), "sync_status")
		if err != nil {
			return documentListFilterParams{}, fmt.Errorf("invalid sync_status: %w", err)
		}
		params.syncStatusValues = []int32{syncStatus}
	}
	return params, nil
}

func defaultDocumentListDocTypeValues() []uint32 {
	// 默认列表过滤必须覆盖“全部可落库文档类型”，不能按 source_type / 产品线裁剪。
	return docentity.DefaultDocumentListDocTypeValues()
}

func (repo *DocumentRepository) buildVisibleDocumentPage(
	ctx context.Context,
	records []documentRecord,
	offset int32,
	limit int32,
) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	visibleRecords, err := filterVisibleDocumentRecords(records)
	if err != nil {
		return nil, 0, err
	}
	total := int64(len(visibleRecords))
	pagedRecords := paginateDocumentRecords(visibleRecords, offset, limit)
	docs, err := repo.recordsToDocuments(ctx, pagedRecords)
	if err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}

func filterVisibleDocumentRecords(records []documentRecord) ([]documentRecord, error) {
	visibleRecords := make([]documentRecord, 0, len(records))
	for _, record := range records {
		visible, err := isVisibleDocumentFileJSON(record.DocumentFile)
		if err != nil {
			return nil, fmt.Errorf("decode document visibility for code %s: %w", record.Code, err)
		}
		if visible {
			visibleRecords = append(visibleRecords, record)
		}
	}
	return visibleRecords, nil
}

func paginateDocumentRecords(records []documentRecord, offset, limit int32) []documentRecord {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		return []documentRecord{}
	}
	start := int(offset)
	if start >= len(records) {
		return []documentRecord{}
	}
	end := min(start+int(limit), len(records))
	return records[start:end]
}

func isVisibleDocumentFileJSON(documentFileJSON []byte) (bool, error) {
	file, err := DecodeDocumentFile(documentFileJSON)
	if err != nil {
		return false, err
	}
	return isVisibleKnowledgeBaseDocumentFile(file), nil
}

func isVisibleKnowledgeBaseDocumentFile(file *docentity.File) bool {
	if file == nil {
		return true
	}
	if strings.TrimSpace(file.Extension) == "" {
		return true
	}
	return docentity.IsSupportedKnowledgeBaseFileExtension(file.Extension)
}

func (repo *DocumentRepository) findOrganizationCodeByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) (string, error) {
	organizationCode, err := repo.queries.FindDocumentOrganizationByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
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
	rows, err := repo.queries.ListProjectSourceBindingIDsByKnowledgeBaseAndProject(ctx, mysqlsqlc.ListProjectSourceBindingIDsByKnowledgeBaseAndProjectParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		RootRef:           strconv.FormatInt(projectID, 10),
	})
	if err != nil {
		return nil, fmt.Errorf("query project source binding ids: %w", err)
	}
	return rows, nil
}

func (repo *DocumentRepository) listProjectSourceBindingIDsByOrganization(
	ctx context.Context,
	organizationCode string,
) ([]int64, error) {
	rows, err := repo.queries.ListProjectSourceBindingIDsByOrganization(ctx, strings.TrimSpace(organizationCode))
	if err != nil {
		return nil, fmt.Errorf("query project source binding ids by organization: %w", err)
	}
	return rows, nil
}

func (repo *DocumentRepository) listSourceItemIDsByProviderAndItemRef(
	ctx context.Context,
	organizationCode string,
	provider string,
	itemRef string,
) ([]int64, error) {
	if organizationCode = strings.TrimSpace(organizationCode); organizationCode != "" {
		rows, err := repo.queries.ListSourceItemIDsByOrganizationAndProviderAndItemRef(ctx,
			mysqlsqlc.ListSourceItemIDsByOrganizationAndProviderAndItemRefParams{
				OrganizationCode: organizationCode,
				Provider:         strings.TrimSpace(provider),
				ItemRef:          strings.TrimSpace(itemRef),
			},
		)
		if err != nil {
			return nil, fmt.Errorf("query source item ids: %w", err)
		}
		return rows, nil
	}
	rows, err := repo.queries.ListSourceItemIDsByProviderAndItemRef(ctx, mysqlsqlc.ListSourceItemIDsByProviderAndItemRefParams{
		Provider: strings.TrimSpace(provider),
		ItemRef:  strings.TrimSpace(itemRef),
	})
	if err != nil {
		return nil, fmt.Errorf("query source item ids: %w", err)
	}
	return rows, nil
}

func collectDocumentRelationIDs(records []documentRecord, getter func(documentRecord) int64) []int64 {
	seen := make(map[int64]struct{}, len(records))
	result := make([]int64, 0, len(records))
	for _, record := range records {
		id := getter(record)
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}
