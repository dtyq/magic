package documentrepo

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// FindByKnowledgeBaseAndThirdFile 按知识库和第三方文件标识查询文档。
func (repo *DocumentRepository) FindByKnowledgeBaseAndThirdFile(
	ctx context.Context,
	knowledgeBaseCode string,
	thirdPlatformType string,
	thirdFileID string,
) (*docentity.KnowledgeBaseDocument, error) {
	row, err := repo.queries.FindDocumentByKnowledgeBaseAndThirdFile(ctx, mysqlsqlc.FindDocumentByKnowledgeBaseAndThirdFileParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		ThirdPlatformType: sql.NullString{String: strings.TrimSpace(thirdPlatformType), Valid: strings.TrimSpace(thirdPlatformType) != ""},
		ThirdFileID:       sql.NullString{String: strings.TrimSpace(thirdFileID), Valid: strings.TrimSpace(thirdFileID) != ""},
	})
	if err == nil {
		record, mapErr := documentRecordFromFindByKnowledgeBaseAndThirdFileRow(row)
		if mapErr != nil {
			return nil, fmt.Errorf("map document by knowledge base and third file: %w", mapErr)
		}
		return repo.toDocumentWithRelations(ctx, record)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("find document by knowledge base and third file: %w", err)
	}

	organizationCode, err := repo.findOrganizationCodeByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, err
	}
	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("find document by knowledge base and third file via source item: %w", err)
	}
	if len(itemIDs) == 0 {
		return nil, shared.ErrDocumentNotFound
	}

	fallbackRow, err := repo.queries.FindLatestDocumentByKnowledgeBaseAndSourceItemIDs(ctx,
		mysqlsqlc.FindLatestDocumentByKnowledgeBaseAndSourceItemIDsParams{
			KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
			SourceItemIds:     itemIDs,
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find document by knowledge base and third file via source item: %w", err)
	}
	record, err := documentRecordFromFindLatestBySourceItemsRow(fallbackRow)
	if err != nil {
		return nil, fmt.Errorf("map document by knowledge base and third file via source item: %w", err)
	}
	return repo.toDocumentWithRelations(ctx, record)
}

// ListByThirdFileInOrg 列出组织内关联到指定第三方文件的文档。
func (repo *DocumentRepository) ListByThirdFileInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]*docentity.KnowledgeBaseDocument, error) {
	directRecords, err := repo.listThirdFileDirectDocumentRecordsInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, err
	}
	directDocs, err := repo.recordsToDocuments(ctx, directRecords)
	if err != nil {
		return nil, err
	}

	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("list documents by third file in org via source item ids: %w", err)
	}
	fallbackDocs := []*docentity.KnowledgeBaseDocument{}
	if len(itemIDs) > 0 {
		fallbackRecords, err := repo.listDocumentRecordsByOrganizationAndSourceItems(ctx, organizationCode, itemIDs)
		if err != nil {
			return nil, fmt.Errorf("list documents by third file in org via source item: %w", err)
		}
		fallbackDocs, err = repo.recordsToDocuments(ctx, fallbackRecords)
		if err != nil {
			return nil, err
		}
	}
	return mergeThirdFileDocumentLists(directDocs, fallbackDocs), nil
}

// HasRealtimeThirdFileDocumentInOrg 判断组织内第三方文件是否存在 enabled + realtime 绑定下的文档。
func (repo *DocumentRepository) HasRealtimeThirdFileDocumentInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) (bool, error) {
	organizationCode = strings.TrimSpace(organizationCode)
	thirdPlatformType = strings.TrimSpace(thirdPlatformType)
	thirdFileID = strings.TrimSpace(thirdFileID)
	if organizationCode == "" || thirdPlatformType == "" || thirdFileID == "" {
		return false, nil
	}

	records, err := repo.listRealtimeThirdFileDocumentRecordsInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return false, err
	}
	return len(records) > 0, nil
}

// ListRealtimeByThirdFileInOrg 列出组织内第三方文件在 enabled + realtime 绑定下的文档。
func (repo *DocumentRepository) ListRealtimeByThirdFileInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]*docentity.KnowledgeBaseDocument, error) {
	organizationCode = strings.TrimSpace(organizationCode)
	thirdPlatformType = strings.TrimSpace(thirdPlatformType)
	thirdFileID = strings.TrimSpace(thirdFileID)
	if organizationCode == "" || thirdPlatformType == "" || thirdFileID == "" {
		return []*docentity.KnowledgeBaseDocument{}, nil
	}

	records, err := repo.listRealtimeThirdFileDocumentRecordsInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, err
	}
	return repo.recordsToDocuments(ctx, records)
}

func mergeThirdFileDocumentLists(
	directDocs []*docentity.KnowledgeBaseDocument,
	fallbackDocs []*docentity.KnowledgeBaseDocument,
) []*docentity.KnowledgeBaseDocument {
	merged := make([]*docentity.KnowledgeBaseDocument, 0, len(directDocs)+len(fallbackDocs))
	seen := make(map[string]struct{}, len(directDocs)+len(fallbackDocs))

	appendUnique := func(docs []*docentity.KnowledgeBaseDocument) {
		for _, doc := range docs {
			if doc == nil {
				continue
			}
			key := fmt.Sprintf("%d:%s:%s", doc.ID, doc.KnowledgeBaseCode, doc.Code)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, doc)
		}
	}

	appendUnique(directDocs)
	appendUnique(fallbackDocs)
	return merged
}

func (repo *DocumentRepository) listRealtimeThirdFileDocumentRecordsInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]documentRecord, error) {
	directRecords, err := repo.listThirdFileDirectDocumentRecordsInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, err
	}
	itemIDs, err := repo.listSourceItemIDsByProviderAndItemRef(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("list realtime documents by third file in org via source item ids: %w", err)
	}
	fallbackRecords := []documentRecord{}
	if len(itemIDs) > 0 {
		fallbackRecords, err = repo.listDocumentRecordsByOrganizationAndSourceItems(ctx, organizationCode, itemIDs)
		if err != nil {
			return nil, fmt.Errorf("list realtime documents by third file in org via source item: %w", err)
		}
	}
	records := mergeThirdFileDocumentRecords(directRecords, fallbackRecords)
	return repo.filterRealtimeDocumentRecordsByProvider(ctx, records, organizationCode, thirdPlatformType)
}

func (repo *DocumentRepository) listThirdFileDirectDocumentRecordsInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]documentRecord, error) {
	directRows, err := repo.queries.ListDocumentsByOrganizationAndThirdFile(ctx, mysqlsqlc.ListDocumentsByOrganizationAndThirdFileParams{
		OrganizationCode:  strings.TrimSpace(organizationCode),
		ThirdPlatformType: sql.NullString{String: strings.TrimSpace(thirdPlatformType), Valid: strings.TrimSpace(thirdPlatformType) != ""},
		ThirdFileID:       sql.NullString{String: strings.TrimSpace(thirdFileID), Valid: strings.TrimSpace(thirdFileID) != ""},
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by third file in org: %w", err)
	}
	directRecords := make([]documentRecord, 0, len(directRows))
	for _, row := range directRows {
		record, err := documentRecordFromListByOrganizationAndThirdFileRow(row)
		if err != nil {
			return nil, fmt.Errorf("map direct documents by third file in org: %w", err)
		}
		directRecords = append(directRecords, record)
	}
	slices.SortFunc(directRecords, func(a, b documentRecord) int {
		return cmp.Compare(b.ID, a.ID)
	})
	return directRecords, nil
}

func (repo *DocumentRepository) listDocumentRecordsByOrganizationAndSourceItems(
	ctx context.Context,
	organizationCode string,
	sourceItemIDs []int64,
) ([]documentRecord, error) {
	if len(sourceItemIDs) == 0 {
		return []documentRecord{}, nil
	}
	rows, err := repo.queries.ListDocumentsByOrganizationAndSourceItemIDs(ctx, mysqlsqlc.ListDocumentsByOrganizationAndSourceItemIDsParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		SourceItemIds:    sourceItemIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("list documents by org and source item ids: %w", err)
	}
	records := make([]documentRecord, 0, len(rows))
	for _, row := range rows {
		record, err := documentRecordFromListByOrganizationAndSourceItemIDsRow(row)
		if err != nil {
			return nil, fmt.Errorf("map documents by org and source item ids: %w", err)
		}
		records = append(records, record)
	}
	return records, nil
}

func mergeThirdFileDocumentRecords(
	directRecords []documentRecord,
	fallbackRecords []documentRecord,
) []documentRecord {
	merged := make([]documentRecord, 0, len(directRecords)+len(fallbackRecords))
	seen := make(map[string]struct{}, len(directRecords)+len(fallbackRecords))

	appendUnique := func(records []documentRecord) {
		for _, record := range records {
			key := fmt.Sprintf("%d:%s:%s", record.ID, record.KnowledgeBaseCode, record.Code)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, record)
		}
	}

	appendUnique(directRecords)
	appendUnique(fallbackRecords)
	return merged
}
