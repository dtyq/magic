package documentrepo

import (
	"context"
	"fmt"
	"strings"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

func (repo *DocumentRepository) filterRealtimeDocumentRecordsByProvider(
	ctx context.Context,
	records []documentRecord,
	organizationCode string,
	provider string,
) ([]documentRecord, error) {
	if len(records) == 0 {
		return []documentRecord{}, nil
	}
	organizationCode = strings.TrimSpace(organizationCode)
	provider = strings.TrimSpace(provider)
	bindings, err := repo.listSourceBindingCoresByDocumentRecords(ctx, records, organizationCode, provider)
	if err != nil {
		return nil, err
	}

	filtered := make([]documentRecord, 0, len(records))
	for _, record := range records {
		binding, exists := bindings[record.SourceBindingID]
		if !exists || !isRealtimeSourceBindingForDocumentFilter(binding, organizationCode, provider) {
			continue
		}
		filtered = append(filtered, record)
	}
	return filtered, nil
}

func (repo *DocumentRepository) listSourceBindingCoresByDocumentRecords(
	ctx context.Context,
	records []documentRecord,
	organizationCode string,
	provider string,
) (map[int64]mysqlsqlc.KnowledgeSourceBinding, error) {
	sourceBindingIDs := collectDocumentRelationIDs(records, func(record documentRecord) int64 {
		return record.SourceBindingID
	})
	if len(sourceBindingIDs) == 0 {
		return map[int64]mysqlsqlc.KnowledgeSourceBinding{}, nil
	}
	rows, err := repo.queries.ListRealtimeKnowledgeSourceBindingsCoreByIDsAndProvider(
		ctx,
		mysqlsqlc.ListRealtimeKnowledgeSourceBindingsCoreByIDsAndProviderParams{
			Ids:              sourceBindingIDs,
			OrganizationCode: strings.TrimSpace(organizationCode),
			Provider:         strings.TrimSpace(provider),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list realtime source binding cores by ids and provider: %w", err)
	}
	bindings := make(map[int64]mysqlsqlc.KnowledgeSourceBinding, len(rows))
	for _, row := range rows {
		bindings[row.ID] = row
	}
	return bindings, nil
}

func isRealtimeSourceBindingForDocumentFilter(
	binding mysqlsqlc.KnowledgeSourceBinding,
	organizationCode string,
	provider string,
) bool {
	return binding.Enabled &&
		strings.TrimSpace(binding.OrganizationCode) == organizationCode &&
		strings.EqualFold(strings.TrimSpace(binding.Provider), provider) &&
		strings.EqualFold(strings.TrimSpace(binding.SyncMode), sourcebindingentity.SyncModeRealtime)
}
