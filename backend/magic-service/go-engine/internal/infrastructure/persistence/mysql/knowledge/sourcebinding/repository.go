// Package sourcebindingrepo 提供来源绑定在 MySQL 上的仓储实现。
package sourcebindingrepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqljsoncompat "magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

var errSourceBindingRepositoryNil = errors.New("source binding repository is nil")

var errSourceBindingTxRequired = errors.New("source binding transaction is required")

var errSourceItemBatchUpsertMissingResult = errors.New("source item missing after batch upsert")

var errSourceBindingBatchUpsertMissingResult = errors.New("source binding missing after batch upsert")

var errUnsupportedSourceItemBatchSize = errors.New("unsupported source item batch size")

var errUnsupportedSourceBindingBatchSize = errors.New("unsupported source binding batch size")

var errUnsupportedSourceBindingTargetBatchSize = errors.New("unsupported source binding target batch size")

var errUnsupportedSourceBindingItemBatchSize = errors.New("unsupported source binding item batch size")

const sourceBindingBatchWriteSize = 4

// Repository 实现来源绑定 MySQL 仓储。
type Repository struct {
	client      *mysqlclient.SQLCClient
	queries     *mysqlsqlc.Queries
	invalidator sourceCallbackEligibilityInvalidator
}

// NewRepository 创建来源绑定仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

type sourceCallbackEligibilityInvalidator interface {
	InvalidateOrganization(ctx context.Context, organizationCode string) error
}

// SetSourceCallbackEligibilityInvalidator 注入 source callback 资格缓存失效器。
func (r *Repository) SetSourceCallbackEligibilityInvalidator(invalidator sourceCallbackEligibilityInvalidator) {
	if r == nil {
		return
	}
	r.invalidator = invalidator
}

// ReplaceBindings 以全量替换方式保存知识库来源绑定。
func (r *Repository) ReplaceBindings(
	ctx context.Context,
	knowledgeBaseCode string,
	bindings []sourcebindingentity.Binding,
) ([]sourcebindingentity.Binding, error) {
	return r.ReplaceBindingsWithTx(ctx, nil, knowledgeBaseCode, bindings)
}

// ReplaceBindingsWithTx 在给定事务中以全量替换方式保存知识库来源绑定。
func (r *Repository) ReplaceBindingsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	knowledgeBaseCode string,
	bindings []sourcebindingentity.Binding,
) ([]sourcebindingentity.Binding, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}

	managedTx := tx == nil
	var err error
	if managedTx {
		tx, err = r.client.DB().BeginTx(ctx, nil)
		if err != nil {
			return nil, fmt.Errorf("begin replace source bindings tx: %w", err)
		}
	}
	defer func() {
		if managedTx && err != nil {
			_ = tx.Rollback()
		}
	}()

	replacedOrgs := r.listSourceCallbackEligibilityOrganizationsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err = r.deleteBindingsByKnowledgeBase(ctx, tx, knowledgeBaseCode); err != nil {
		return nil, err
	}

	now := time.Now()
	saved := make([]sourcebindingentity.Binding, 0, len(bindings))
	targets := make([]bindingTargetBatchRow, 0)
	for _, binding := range bindings {
		savedBinding, saveErr := r.insertBinding(ctx, tx, binding, now)
		if saveErr != nil {
			err = saveErr
			return nil, err
		}
		saved = append(saved, savedBinding)
		targets = append(targets, buildBindingTargetBatchRows(savedBinding.ID, savedBinding.Targets, now)...)
	}
	if err = r.insertBindingTargetsBatchWithTx(ctx, tx, targets); err != nil {
		return nil, err
	}

	if managedTx {
		if err = tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit replace source bindings tx: %w", err)
		}
	}
	r.invalidateSourceCallbackEligibilityOrganizations(ctx, replacedOrgs)
	r.invalidateSourceCallbackEligibilityByBindings(ctx, saved)
	return saved, nil
}

// SaveBindings 以追加方式保存知识库来源绑定。
func (r *Repository) SaveBindings(
	ctx context.Context,
	knowledgeBaseCode string,
	bindings []sourcebindingentity.Binding,
) ([]sourcebindingentity.Binding, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}
	if len(bindings) == 0 {
		return []sourcebindingentity.Binding{}, nil
	}

	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin save source bindings tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now()
	saved := make([]sourcebindingentity.Binding, 0, len(bindings))
	targets := make([]bindingTargetBatchRow, 0)
	for _, binding := range bindings {
		binding.KnowledgeBaseCode = strings.TrimSpace(knowledgeBaseCode)
		savedBinding, saveErr := r.insertBinding(ctx, tx, binding, now)
		if saveErr != nil {
			err = saveErr
			return nil, err
		}
		saved = append(saved, savedBinding)
		targets = append(targets, buildBindingTargetBatchRows(savedBinding.ID, savedBinding.Targets, now)...)
	}
	if err = r.insertBindingTargetsBatchWithTx(ctx, tx, targets); err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit save source bindings tx: %w", err)
	}
	r.invalidateSourceCallbackEligibilityByBindings(ctx, saved)
	return saved, nil
}

// ApplyKnowledgeBaseBindings 以增量方式更新知识库来源绑定与 binding items。
func (r *Repository) ApplyKnowledgeBaseBindings(
	ctx context.Context,
	input sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingentity.Binding, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}

	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin apply source bindings tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	deletedOrgs := r.listSourceCallbackEligibilityOrganizationsByBindingIDs(ctx, input.DeleteBindingIDs)
	savedBindings, err := r.applyKnowledgeBaseBindingsWithTx(ctx, tx, input)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit apply source bindings tx: %w", err)
	}
	r.invalidateSourceCallbackEligibilityOrganizations(ctx, deletedOrgs)
	r.invalidateSourceCallbackEligibilityByBindings(ctx, savedBindings)
	return savedBindings, nil
}

// ApplyKnowledgeBaseBindingsWithTx 在给定事务中以增量方式更新知识库来源绑定与 binding items。
func (r *Repository) ApplyKnowledgeBaseBindingsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	input sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingentity.Binding, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}
	if tx == nil {
		return nil, errSourceBindingTxRequired
	}
	return r.applyKnowledgeBaseBindingsWithTx(ctx, tx, input)
}

// DeleteBindingsByKnowledgeBase 删除知识库下的来源绑定关系数据。
func (r *Repository) DeleteBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error {
	if r == nil || r.client == nil {
		return errSourceBindingRepositoryNil
	}

	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delete source bindings tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	deletedOrgs := r.listSourceCallbackEligibilityOrganizationsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err = r.deleteBindingsByKnowledgeBase(ctx, tx, knowledgeBaseCode); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit delete source bindings tx: %w", err)
	}
	r.invalidateSourceCallbackEligibilityOrganizations(ctx, deletedOrgs)
	return nil
}

// ListBindingsByKnowledgeBase 查询知识库下的全部来源绑定。
func (r *Repository) ListBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingentity.Binding, error) {
	rows, err := r.queries.ListKnowledgeSourceBindingsCoreByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge base: %w", err)
	}
	targets, err := r.listBindingTargetsByBindingIDs(ctx, bindingIDsFromRows(rows))
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge base targets: %w", err)
	}
	return foldBindingRows(rows, targets), nil
}

// ListBindingsByKnowledgeBases 批量查询知识库下的全部来源绑定。
func (r *Repository) ListBindingsByKnowledgeBases(
	ctx context.Context,
	knowledgeBaseCodes []string,
) (map[string][]sourcebindingentity.Binding, error) {
	normalizedCodes := normalizeKnowledgeBaseCodes(knowledgeBaseCodes)
	if len(normalizedCodes) == 0 {
		return map[string][]sourcebindingentity.Binding{}, nil
	}

	rows, err := r.queries.ListKnowledgeSourceBindingsCoreByKnowledgeBases(ctx, normalizedCodes)
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge bases: %w", err)
	}
	targets, err := r.listBindingTargetsByBindingIDs(ctx, bindingIDsFromRows(rows))
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge bases targets: %w", err)
	}

	result := make(map[string][]sourcebindingentity.Binding, len(normalizedCodes))
	for _, binding := range foldBindingRows(rows, targets) {
		code := strings.TrimSpace(binding.KnowledgeBaseCode)
		result[code] = append(result[code], binding)
	}
	return result, nil
}

// ListRealtimeProjectBindingsByProject 查询项目下启用实时同步的来源绑定。
func (r *Repository) ListRealtimeProjectBindingsByProject(
	ctx context.Context,
	organizationCode string,
	projectID int64,
) ([]sourcebindingentity.Binding, error) {
	rows, err := r.queries.ListRealtimeProjectSourceBindingsCoreByProject(ctx, mysqlsqlc.ListRealtimeProjectSourceBindingsCoreByProjectParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		RootRef:          strconv.FormatInt(projectID, 10),
	})
	if err != nil {
		return nil, fmt.Errorf("list realtime project source bindings: %w", err)
	}
	targets, err := r.listBindingTargetsByBindingIDs(ctx, bindingIDsFromRows(rows))
	if err != nil {
		return nil, fmt.Errorf("list realtime project source binding targets: %w", err)
	}
	return foldBindingRows(rows, targets), nil
}

// ListRealtimeTeamshareBindingsByKnowledgeBase 查询 Teamshare 知识库下启用实时同步的来源绑定。
func (r *Repository) ListRealtimeTeamshareBindingsByKnowledgeBase(
	ctx context.Context,
	organizationCode string,
	platform string,
	knowledgeBaseID string,
) ([]sourcebindingentity.Binding, error) {
	platform = sourcebindingentity.NormalizeProvider(platform)
	knowledgeBaseID = strings.TrimSpace(knowledgeBaseID)
	if r == nil || r.queries == nil || strings.TrimSpace(organizationCode) == "" || platform == "" || knowledgeBaseID == "" {
		return []sourcebindingentity.Binding{}, nil
	}
	rows, err := r.queries.ListRealtimeTeamshareSourceBindingsCoreByKnowledgeBase(ctx, mysqlsqlc.ListRealtimeTeamshareSourceBindingsCoreByKnowledgeBaseParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Provider:         platform,
		RootRef:          knowledgeBaseID,
	})
	if err != nil {
		return nil, fmt.Errorf("list realtime teamshare source bindings: %w", err)
	}
	targets, err := r.listBindingTargetsByBindingIDs(ctx, bindingIDsFromRows(rows))
	if err != nil {
		return nil, fmt.Errorf("list realtime teamshare source binding targets: %w", err)
	}
	return foldBindingRows(rows, targets), nil
}

// HasRealtimeProjectBindingForFile 判断项目文件是否命中启用的实时项目来源绑定。
func (r *Repository) HasRealtimeProjectBindingForFile(
	ctx context.Context,
	organizationCode string,
	projectID int64,
	projectFileID int64,
) (bool, error) {
	if r == nil || projectID <= 0 || projectFileID <= 0 {
		return false, nil
	}
	bindings, err := r.ListRealtimeProjectBindingsByProject(ctx, organizationCode, projectID)
	if err != nil {
		return false, fmt.Errorf("list realtime project source bindings for file gate: %w", err)
	}
	projectFileRef := strconv.FormatInt(projectFileID, 10)
	for _, binding := range bindings {
		if !isRealtimeProjectBindingForGate(binding, organizationCode, projectID) {
			continue
		}
		if len(binding.Targets) == 0 {
			return true, nil
		}
		for _, target := range binding.Targets {
			if strings.EqualFold(strings.TrimSpace(target.TargetType), sourcebindingentity.TargetTypeFile) &&
				strings.TrimSpace(target.TargetRef) == projectFileRef {
				return true, nil
			}
		}
	}
	return false, nil
}

func isRealtimeProjectBindingForGate(
	binding sourcebindingentity.Binding,
	organizationCode string,
	projectID int64,
) bool {
	return binding.Enabled &&
		strings.TrimSpace(binding.OrganizationCode) == strings.TrimSpace(organizationCode) &&
		strings.EqualFold(strings.TrimSpace(binding.Provider), sourcebindingentity.ProviderProject) &&
		strings.EqualFold(strings.TrimSpace(binding.RootType), sourcebindingentity.RootTypeProject) &&
		strings.TrimSpace(binding.RootRef) == strconv.FormatInt(projectID, 10) &&
		strings.EqualFold(strings.TrimSpace(binding.SyncMode), sourcebindingentity.SyncModeRealtime)
}

// UpsertSourceItem 新增或更新来源项。
func (r *Repository) UpsertSourceItem(ctx context.Context, item sourcebindingentity.SourceItem) (*sourcebindingentity.SourceItem, error) {
	now := time.Now()
	item.OrganizationCode = strings.TrimSpace(item.OrganizationCode)
	item.Provider = strings.TrimSpace(item.Provider)
	item.ItemRef = strings.TrimSpace(item.ItemRef)
	snapshotJSON, err := json.Marshal(item.SnapshotMeta)
	if err != nil {
		return nil, fmt.Errorf("marshal source item snapshot meta: %w", err)
	}

	resolvedAt := sql.NullTime{}
	if item.LastResolvedAt != nil {
		resolvedAt = sql.NullTime{Time: *item.LastResolvedAt, Valid: true}
	}

	result, err := r.queries.UpsertKnowledgeSourceItem(ctx, mysqlsqlc.UpsertKnowledgeSourceItemParams{
		OrganizationCode: item.OrganizationCode,
		Provider:         item.Provider,
		RootType:         item.RootType,
		RootRef:          item.RootRef,
		GroupRef:         item.GroupRef,
		ItemType:         item.ItemType,
		ItemRef:          item.ItemRef,
		DisplayName:      item.DisplayName,
		Extension:        item.Extension,
		ContentHash:      item.ContentHash,
		SnapshotMeta:     mustNullJSON(snapshotJSON),
		LastResolvedAt:   resolvedAt,
		CreatedAt:        now,
		UpdatedAt:        now,
	})
	if err != nil {
		return nil, fmt.Errorf("upsert source item: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get source item id: %w", err)
	}
	item.ID = id
	item.CreatedAt = now
	item.UpdatedAt = now
	return &item, nil
}

// UpsertSourceItems 批量新增或更新来源项。
func (r *Repository) UpsertSourceItems(
	ctx context.Context,
	items []sourcebindingentity.SourceItem,
) ([]*sourcebindingentity.SourceItem, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}
	if len(items) == 0 {
		return []*sourcebindingentity.SourceItem{}, nil
	}

	now := time.Now()
	payload, err := buildSourceItemBatchUpsertPayload(items, now)
	if err != nil {
		return nil, err
	}
	for start := 0; start < len(payload.rows); start += sourceBindingBatchWriteSize {
		end := min(start+sourceBindingBatchWriteSize, len(payload.rows))
		if err := r.upsertSourceItemRows(ctx, payload.rows[start:end]); err != nil {
			return nil, err
		}
	}
	return r.loadUpsertedSourceItems(ctx, payload.orderedKeys, payload.groupedRefs, payload.itemKeys)
}

// ReplaceBindingItems 全量替换绑定项物化结果。
func (r *Repository) ReplaceBindingItems(ctx context.Context, bindingID int64, items []sourcebindingentity.BindingItem) error {
	if r == nil || r.client == nil {
		return errSourceBindingRepositoryNil
	}
	invalidatedOrgs := r.listSourceCallbackEligibilityOrganizationsByBindingIDs(ctx, []int64{bindingID})
	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin replace source binding items tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now()
	if err = r.replaceBindingItemsWithTx(ctx, tx, bindingID, items, now); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit replace source binding items tx: %w", err)
	}
	r.invalidateSourceCallbackEligibilityOrganizations(ctx, invalidatedOrgs)
	return nil
}

// ListBindingItemsByKnowledgeBase 查询知识库下全部绑定项。
func (r *Repository) ListBindingItemsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingentity.BindingItem, error) {
	bindingIDs, err := r.listBindingIDsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("list source binding items by knowledge base binding ids: %w", err)
	}
	if len(bindingIDs) == 0 {
		return []sourcebindingentity.BindingItem{}, nil
	}
	rows, err := r.queries.ListKnowledgeSourceBindingItemsByBindingIDs(ctx, bindingIDs)
	if err != nil {
		return nil, fmt.Errorf("list source binding items by knowledge base: %w", err)
	}
	items := make([]sourcebindingentity.BindingItem, 0, len(bindingIDs))
	for _, row := range rows {
		item := sourcebindingentity.BindingItem{
			ID:            row.ID,
			BindingID:     row.BindingID,
			SourceItemID:  row.SourceItemID,
			ResolveReason: row.ResolveReason,
			CreatedAt:     row.CreatedAt,
			UpdatedAt:     row.UpdatedAt,
		}
		if row.LastResolvedAt.Valid {
			item.LastResolvedAt = &row.LastResolvedAt.Time
		}
		items = append(items, item)
	}
	return items, nil
}

func decodeObjectMap(raw []byte) map[string]any {
	result, err := mysqljsoncompat.DecodeObjectMap(raw, "source_binding_object")
	if err != nil {
		return map[string]any{}
	}
	return result
}

func mustNullJSON(raw []byte) []byte {
	if len(raw) == 0 || string(raw) == "null" || string(raw) == "{}" {
		return nil
	}
	return raw
}

func nullTimeValueParam(value *time.Time) sql.NullTime {
	if value == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *value, Valid: true}
}

type sourceItemBatchRow struct {
	OrganizationCode string     `json:"organization_code"`
	Provider         string     `json:"provider"`
	RootType         string     `json:"root_type"`
	RootRef          string     `json:"root_ref"`
	GroupRef         string     `json:"group_ref"`
	ItemType         string     `json:"item_type"`
	ItemRef          string     `json:"item_ref"`
	DisplayName      string     `json:"display_name"`
	Extension        string     `json:"extension"`
	ContentHash      string     `json:"content_hash"`
	SnapshotMeta     []byte     `json:"snapshot_meta,omitempty"`
	LastResolvedAt   *time.Time `json:"last_resolved_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type sourceItemBatchLookupKey struct {
	OrganizationCode string
	Provider         string
}

type sourceItemBatchNaturalKey struct {
	OrganizationCode string
	Provider         string
	ItemRef          string
}

type sourceItemBatchUpsertPayload struct {
	rows        []sourceItemBatchRow
	orderedKeys []sourceItemBatchLookupKey
	groupedRefs map[sourceItemBatchLookupKey][]string
	itemKeys    []sourceItemBatchNaturalKey
}

type bindingBatchRow struct {
	OrganizationCode  string    `json:"organization_code"`
	KnowledgeBaseCode string    `json:"knowledge_base_code"`
	Provider          string    `json:"provider"`
	RootType          string    `json:"root_type"`
	RootRef           string    `json:"root_ref"`
	SyncMode          string    `json:"sync_mode"`
	SyncConfig        []byte    `json:"sync_config,omitempty"`
	Enabled           bool      `json:"enabled"`
	CreatedUID        string    `json:"created_uid"`
	UpdatedUID        string    `json:"updated_uid"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type bindingBatchNaturalKey struct {
	KnowledgeBaseCode string
	Provider          string
	RootType          string
	RootRef           string
}

type bindingTargetBatchRow struct {
	BindingID  int64     `json:"binding_id"`
	TargetType string    `json:"target_type"`
	TargetRef  string    `json:"target_ref"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type bindingItemBatchRow struct {
	BindingID      int64      `json:"binding_id"`
	SourceItemID   int64      `json:"source_item_id"`
	ResolveReason  string     `json:"resolve_reason"`
	LastResolvedAt *time.Time `json:"last_resolved_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func buildSourceItemBatchRow(item sourcebindingentity.SourceItem, now time.Time) (sourceItemBatchRow, error) {
	snapshotJSON, err := json.Marshal(item.SnapshotMeta)
	if err != nil {
		return sourceItemBatchRow{}, fmt.Errorf("marshal source item snapshot meta: %w", err)
	}
	return sourceItemBatchRow{
		OrganizationCode: item.OrganizationCode,
		Provider:         item.Provider,
		RootType:         item.RootType,
		RootRef:          item.RootRef,
		GroupRef:         item.GroupRef,
		ItemType:         item.ItemType,
		ItemRef:          item.ItemRef,
		DisplayName:      item.DisplayName,
		Extension:        item.Extension,
		ContentHash:      item.ContentHash,
		SnapshotMeta:     mustNullJSON(snapshotJSON),
		LastResolvedAt:   item.LastResolvedAt,
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

func buildBindingBatchRow(binding sourcebindingentity.Binding, now time.Time) (bindingBatchRow, error) {
	binding = sourcebindingentity.NormalizeBinding(binding)
	syncConfigJSON, err := json.Marshal(binding.SyncConfig)
	if err != nil {
		return bindingBatchRow{}, fmt.Errorf("marshal source binding sync config: %w", err)
	}
	return bindingBatchRow{
		OrganizationCode:  binding.OrganizationCode,
		KnowledgeBaseCode: binding.KnowledgeBaseCode,
		Provider:          binding.Provider,
		RootType:          binding.RootType,
		RootRef:           binding.RootRef,
		SyncMode:          binding.SyncMode,
		SyncConfig:        mustNullJSON(syncConfigJSON),
		Enabled:           binding.Enabled,
		CreatedUID:        binding.CreatedUID,
		UpdatedUID:        binding.UpdatedUID,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func buildBindingTargetBatchRows(
	bindingID int64,
	targets []sourcebindingentity.BindingTarget,
	now time.Time,
) []bindingTargetBatchRow {
	if len(targets) == 0 {
		return nil
	}
	rows := make([]bindingTargetBatchRow, 0, len(targets))
	for _, target := range targets {
		rows = append(rows, bindingTargetBatchRow{
			BindingID:  bindingID,
			TargetType: target.TargetType,
			TargetRef:  target.TargetRef,
			CreatedAt:  now,
			UpdatedAt:  now,
		})
	}
	return rows
}

func sourceItemFromRow(row mysqlsqlc.KnowledgeSourceItem) *sourcebindingentity.SourceItem {
	item := &sourcebindingentity.SourceItem{
		ID:               row.ID,
		OrganizationCode: row.OrganizationCode,
		Provider:         row.Provider,
		RootType:         row.RootType,
		RootRef:          row.RootRef,
		GroupRef:         row.GroupRef,
		ItemType:         row.ItemType,
		ItemRef:          row.ItemRef,
		DisplayName:      row.DisplayName,
		Extension:        row.Extension,
		ContentHash:      row.ContentHash,
		SnapshotMeta:     decodeObjectMap(row.SnapshotMeta),
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}
	if row.LastResolvedAt.Valid {
		item.LastResolvedAt = &row.LastResolvedAt.Time
	}
	return item
}

func buildSourceItemBatchUpsertPayload(
	items []sourcebindingentity.SourceItem,
	now time.Time,
) (sourceItemBatchUpsertPayload, error) {
	payload := make([]sourceItemBatchRow, 0, len(items))
	groupedRefs := make(map[sourceItemBatchLookupKey][]string)
	groupedRefSeen := make(map[sourceItemBatchLookupKey]map[string]struct{})
	orderedKeys := make([]sourceItemBatchLookupKey, 0)
	itemKeys := make([]sourceItemBatchNaturalKey, 0, len(items))
	for _, rawItem := range items {
		item := rawItem
		item.OrganizationCode = strings.TrimSpace(item.OrganizationCode)
		item.Provider = strings.TrimSpace(item.Provider)
		item.ItemRef = strings.TrimSpace(item.ItemRef)
		row, err := buildSourceItemBatchRow(item, now)
		if err != nil {
			return sourceItemBatchUpsertPayload{}, err
		}
		payload = append(payload, row)
		lookupKey := sourceItemBatchLookupKey{
			OrganizationCode: item.OrganizationCode,
			Provider:         item.Provider,
		}
		if _, exists := groupedRefSeen[lookupKey]; !exists {
			groupedRefSeen[lookupKey] = make(map[string]struct{})
			orderedKeys = append(orderedKeys, lookupKey)
		}
		if _, exists := groupedRefSeen[lookupKey][item.ItemRef]; !exists {
			groupedRefSeen[lookupKey][item.ItemRef] = struct{}{}
			groupedRefs[lookupKey] = append(groupedRefs[lookupKey], item.ItemRef)
		}
		itemKeys = append(itemKeys, sourceItemBatchNaturalKey{
			OrganizationCode: item.OrganizationCode,
			Provider:         item.Provider,
			ItemRef:          item.ItemRef,
		})
	}
	return sourceItemBatchUpsertPayload{
		rows:        payload,
		orderedKeys: orderedKeys,
		groupedRefs: groupedRefs,
		itemKeys:    itemKeys,
	}, nil
}

func (r *Repository) loadUpsertedSourceItems(
	ctx context.Context,
	orderedKeys []sourceItemBatchLookupKey,
	groupedRefs map[sourceItemBatchLookupKey][]string,
	itemKeys []sourceItemBatchNaturalKey,
) ([]*sourcebindingentity.SourceItem, error) {
	itemsByKey := make(map[sourceItemBatchNaturalKey]*sourcebindingentity.SourceItem, len(itemKeys))
	for _, lookupKey := range orderedKeys {
		rows, err := r.queries.ListKnowledgeSourceItemsByOrganizationAndProviderAndItemRefs(
			ctx,
			mysqlsqlc.ListKnowledgeSourceItemsByOrganizationAndProviderAndItemRefsParams{
				OrganizationCode: lookupKey.OrganizationCode,
				Provider:         lookupKey.Provider,
				ItemRefs:         groupedRefs[lookupKey],
			},
		)
		if err != nil {
			return nil, fmt.Errorf("list source items by refs: %w", err)
		}
		for _, row := range rows {
			item := sourceItemFromRow(row)
			itemsByKey[sourceItemBatchNaturalKey{
				OrganizationCode: item.OrganizationCode,
				Provider:         item.Provider,
				ItemRef:          item.ItemRef,
			}] = item
		}
	}

	result := make([]*sourcebindingentity.SourceItem, 0, len(itemKeys))
	for _, itemKey := range itemKeys {
		item, exists := itemsByKey[itemKey]
		if !exists {
			return nil, fmt.Errorf(
				"%w: organization_code=%s provider=%s item_ref=%s",
				errSourceItemBatchUpsertMissingResult,
				itemKey.OrganizationCode,
				itemKey.Provider,
				itemKey.ItemRef,
			)
		}
		result = append(result, item)
	}
	return result, nil
}

func (r *Repository) upsertSourceItemRows(ctx context.Context, rows []sourceItemBatchRow) error {
	switch len(rows) {
	case 0:
		return nil
	case 1:
		return r.upsertSingleSourceItemRow(ctx, rows[0])
	case 2:
		_, err := r.queries.UpsertKnowledgeSourceItemsBatch2(ctx, sourceItemBatch2Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source items batch2: %w", err)
		}
		return nil
	case 3:
		_, err := r.queries.UpsertKnowledgeSourceItemsBatch3(ctx, sourceItemBatch3Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source items batch3: %w", err)
		}
		return nil
	case sourceBindingBatchWriteSize:
		_, err := r.queries.UpsertKnowledgeSourceItemsBatch4(ctx, sourceItemBatch4Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source items batch4: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("%w: %d", errUnsupportedSourceItemBatchSize, len(rows))
	}
}

func (r *Repository) upsertSingleSourceItemRow(ctx context.Context, row sourceItemBatchRow) error {
	_, err := r.queries.UpsertKnowledgeSourceItem(ctx, mysqlsqlc.UpsertKnowledgeSourceItemParams{
		OrganizationCode: row.OrganizationCode,
		Provider:         row.Provider,
		RootType:         row.RootType,
		RootRef:          row.RootRef,
		GroupRef:         row.GroupRef,
		ItemType:         row.ItemType,
		ItemRef:          row.ItemRef,
		DisplayName:      row.DisplayName,
		Extension:        row.Extension,
		ContentHash:      row.ContentHash,
		SnapshotMeta:     row.SnapshotMeta,
		LastResolvedAt:   nullTimeValueParam(row.LastResolvedAt),
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	})
	if err != nil {
		return fmt.Errorf("upsert source item: %w", err)
	}
	return nil
}

func (r *Repository) upsertBindingRowsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	rows []bindingBatchRow,
) error {
	switch len(rows) {
	case 0:
		return nil
	case 1:
		_, err := r.queries.WithTx(tx).UpsertKnowledgeSourceBinding(ctx, bindingBatchParams(rows[0]))
		if err != nil {
			return fmt.Errorf("upsert source binding: %w", err)
		}
		return nil
	case 2:
		_, err := r.queries.WithTx(tx).UpsertKnowledgeSourceBindingsBatch2(ctx, bindingBatch2Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source bindings batch2: %w", err)
		}
		return nil
	case 3:
		_, err := r.queries.WithTx(tx).UpsertKnowledgeSourceBindingsBatch3(ctx, bindingBatch3Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source bindings batch3: %w", err)
		}
		return nil
	case sourceBindingBatchWriteSize:
		_, err := r.queries.WithTx(tx).UpsertKnowledgeSourceBindingsBatch4(ctx, bindingBatch4Params(rows))
		if err != nil {
			return fmt.Errorf("upsert source bindings batch4: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("%w: %d", errUnsupportedSourceBindingBatchSize, len(rows))
	}
}

func (r *Repository) upsertBindingHeadersWithTx(
	ctx context.Context,
	tx *sql.Tx,
	rows []bindingBatchRow,
) error {
	for start := 0; start < len(rows); start += sourceBindingBatchWriteSize {
		end := min(start+sourceBindingBatchWriteSize, len(rows))
		if err := r.upsertBindingRowsWithTx(ctx, tx, rows[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) insertBindingTargetRowsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	rows []bindingTargetBatchRow,
) error {
	switch len(rows) {
	case 0:
		return nil
	case 1:
		return r.insertBindingTarget(ctx, tx, rows[0])
	case 2:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingTargetsBatch2(ctx, bindingTargetBatch2Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding targets batch2: %w", err)
		}
		return nil
	case 3:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingTargetsBatch3(ctx, bindingTargetBatch3Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding targets batch3: %w", err)
		}
		return nil
	case sourceBindingBatchWriteSize:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingTargetsBatch4(ctx, bindingTargetBatch4Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding targets batch4: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("%w: %d", errUnsupportedSourceBindingTargetBatchSize, len(rows))
	}
}

func (r *Repository) insertBindingItemRowsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	rows []bindingItemBatchRow,
) error {
	switch len(rows) {
	case 0:
		return nil
	case 1:
		err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingItem(ctx, mysqlsqlc.InsertKnowledgeSourceBindingItemParams{
			BindingID:      rows[0].BindingID,
			SourceItemID:   rows[0].SourceItemID,
			ResolveReason:  rows[0].ResolveReason,
			LastResolvedAt: nullTimeValueParam(rows[0].LastResolvedAt),
			CreatedAt:      rows[0].CreatedAt,
			UpdatedAt:      rows[0].UpdatedAt,
		})
		if err != nil {
			return fmt.Errorf("insert source binding item: %w", err)
		}
		return nil
	case 2:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingItemsBatch2(ctx, bindingItemBatch2Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding items batch2: %w", err)
		}
		return nil
	case 3:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingItemsBatch3(ctx, bindingItemBatch3Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding items batch3: %w", err)
		}
		return nil
	case sourceBindingBatchWriteSize:
		_, err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingItemsBatch4(ctx, bindingItemBatch4Params(rows))
		if err != nil {
			return fmt.Errorf("insert source binding items batch4: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("%w: %d", errUnsupportedSourceBindingItemBatchSize, len(rows))
	}
}

func bindingBatchParams(row bindingBatchRow) mysqlsqlc.UpsertKnowledgeSourceBindingParams {
	return mysqlsqlc.UpsertKnowledgeSourceBindingParams{
		OrganizationCode:  row.OrganizationCode,
		KnowledgeBaseCode: row.KnowledgeBaseCode,
		Provider:          row.Provider,
		RootType:          row.RootType,
		RootRef:           row.RootRef,
		SyncMode:          row.SyncMode,
		SyncConfig:        row.SyncConfig,
		Enabled:           row.Enabled,
		CreatedUid:        row.CreatedUID,
		UpdatedUid:        row.UpdatedUID,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
}

func bindingBatch2Params(rows []bindingBatchRow) mysqlsqlc.UpsertKnowledgeSourceBindingsBatch2Params {
	return mysqlsqlc.UpsertKnowledgeSourceBindingsBatch2Params{
		OrganizationCode:    rows[0].OrganizationCode,
		KnowledgeBaseCode:   rows[0].KnowledgeBaseCode,
		Provider:            rows[0].Provider,
		RootType:            rows[0].RootType,
		RootRef:             rows[0].RootRef,
		SyncMode:            rows[0].SyncMode,
		SyncConfig:          rows[0].SyncConfig,
		Enabled:             rows[0].Enabled,
		CreatedUid:          rows[0].CreatedUID,
		UpdatedUid:          rows[0].UpdatedUID,
		CreatedAt:           rows[0].CreatedAt,
		UpdatedAt:           rows[0].UpdatedAt,
		OrganizationCode_2:  rows[1].OrganizationCode,
		KnowledgeBaseCode_2: rows[1].KnowledgeBaseCode,
		Provider_2:          rows[1].Provider,
		RootType_2:          rows[1].RootType,
		RootRef_2:           rows[1].RootRef,
		SyncMode_2:          rows[1].SyncMode,
		SyncConfig_2:        rows[1].SyncConfig,
		Enabled_2:           rows[1].Enabled,
		CreatedUid_2:        rows[1].CreatedUID,
		UpdatedUid_2:        rows[1].UpdatedUID,
		CreatedAt_2:         rows[1].CreatedAt,
		UpdatedAt_2:         rows[1].UpdatedAt,
	}
}

func bindingBatch3Params(rows []bindingBatchRow) mysqlsqlc.UpsertKnowledgeSourceBindingsBatch3Params {
	return mysqlsqlc.UpsertKnowledgeSourceBindingsBatch3Params{
		OrganizationCode:    rows[0].OrganizationCode,
		KnowledgeBaseCode:   rows[0].KnowledgeBaseCode,
		Provider:            rows[0].Provider,
		RootType:            rows[0].RootType,
		RootRef:             rows[0].RootRef,
		SyncMode:            rows[0].SyncMode,
		SyncConfig:          rows[0].SyncConfig,
		Enabled:             rows[0].Enabled,
		CreatedUid:          rows[0].CreatedUID,
		UpdatedUid:          rows[0].UpdatedUID,
		CreatedAt:           rows[0].CreatedAt,
		UpdatedAt:           rows[0].UpdatedAt,
		OrganizationCode_2:  rows[1].OrganizationCode,
		KnowledgeBaseCode_2: rows[1].KnowledgeBaseCode,
		Provider_2:          rows[1].Provider,
		RootType_2:          rows[1].RootType,
		RootRef_2:           rows[1].RootRef,
		SyncMode_2:          rows[1].SyncMode,
		SyncConfig_2:        rows[1].SyncConfig,
		Enabled_2:           rows[1].Enabled,
		CreatedUid_2:        rows[1].CreatedUID,
		UpdatedUid_2:        rows[1].UpdatedUID,
		CreatedAt_2:         rows[1].CreatedAt,
		UpdatedAt_2:         rows[1].UpdatedAt,
		OrganizationCode_3:  rows[2].OrganizationCode,
		KnowledgeBaseCode_3: rows[2].KnowledgeBaseCode,
		Provider_3:          rows[2].Provider,
		RootType_3:          rows[2].RootType,
		RootRef_3:           rows[2].RootRef,
		SyncMode_3:          rows[2].SyncMode,
		SyncConfig_3:        rows[2].SyncConfig,
		Enabled_3:           rows[2].Enabled,
		CreatedUid_3:        rows[2].CreatedUID,
		UpdatedUid_3:        rows[2].UpdatedUID,
		CreatedAt_3:         rows[2].CreatedAt,
		UpdatedAt_3:         rows[2].UpdatedAt,
	}
}

func bindingBatch4Params(rows []bindingBatchRow) mysqlsqlc.UpsertKnowledgeSourceBindingsBatch4Params {
	return mysqlsqlc.UpsertKnowledgeSourceBindingsBatch4Params{
		OrganizationCode:    rows[0].OrganizationCode,
		KnowledgeBaseCode:   rows[0].KnowledgeBaseCode,
		Provider:            rows[0].Provider,
		RootType:            rows[0].RootType,
		RootRef:             rows[0].RootRef,
		SyncMode:            rows[0].SyncMode,
		SyncConfig:          rows[0].SyncConfig,
		Enabled:             rows[0].Enabled,
		CreatedUid:          rows[0].CreatedUID,
		UpdatedUid:          rows[0].UpdatedUID,
		CreatedAt:           rows[0].CreatedAt,
		UpdatedAt:           rows[0].UpdatedAt,
		OrganizationCode_2:  rows[1].OrganizationCode,
		KnowledgeBaseCode_2: rows[1].KnowledgeBaseCode,
		Provider_2:          rows[1].Provider,
		RootType_2:          rows[1].RootType,
		RootRef_2:           rows[1].RootRef,
		SyncMode_2:          rows[1].SyncMode,
		SyncConfig_2:        rows[1].SyncConfig,
		Enabled_2:           rows[1].Enabled,
		CreatedUid_2:        rows[1].CreatedUID,
		UpdatedUid_2:        rows[1].UpdatedUID,
		CreatedAt_2:         rows[1].CreatedAt,
		UpdatedAt_2:         rows[1].UpdatedAt,
		OrganizationCode_3:  rows[2].OrganizationCode,
		KnowledgeBaseCode_3: rows[2].KnowledgeBaseCode,
		Provider_3:          rows[2].Provider,
		RootType_3:          rows[2].RootType,
		RootRef_3:           rows[2].RootRef,
		SyncMode_3:          rows[2].SyncMode,
		SyncConfig_3:        rows[2].SyncConfig,
		Enabled_3:           rows[2].Enabled,
		CreatedUid_3:        rows[2].CreatedUID,
		UpdatedUid_3:        rows[2].UpdatedUID,
		CreatedAt_3:         rows[2].CreatedAt,
		UpdatedAt_3:         rows[2].UpdatedAt,
		OrganizationCode_4:  rows[3].OrganizationCode,
		KnowledgeBaseCode_4: rows[3].KnowledgeBaseCode,
		Provider_4:          rows[3].Provider,
		RootType_4:          rows[3].RootType,
		RootRef_4:           rows[3].RootRef,
		SyncMode_4:          rows[3].SyncMode,
		SyncConfig_4:        rows[3].SyncConfig,
		Enabled_4:           rows[3].Enabled,
		CreatedUid_4:        rows[3].CreatedUID,
		UpdatedUid_4:        rows[3].UpdatedUID,
		CreatedAt_4:         rows[3].CreatedAt,
		UpdatedAt_4:         rows[3].UpdatedAt,
	}
}

func sourceItemBatch2Params(rows []sourceItemBatchRow) mysqlsqlc.UpsertKnowledgeSourceItemsBatch2Params {
	return mysqlsqlc.UpsertKnowledgeSourceItemsBatch2Params{
		OrganizationCode:   rows[0].OrganizationCode,
		Provider:           rows[0].Provider,
		RootType:           rows[0].RootType,
		RootRef:            rows[0].RootRef,
		GroupRef:           rows[0].GroupRef,
		ItemType:           rows[0].ItemType,
		ItemRef:            rows[0].ItemRef,
		DisplayName:        rows[0].DisplayName,
		Extension:          rows[0].Extension,
		ContentHash:        rows[0].ContentHash,
		SnapshotMeta:       rows[0].SnapshotMeta,
		LastResolvedAt:     nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:          rows[0].CreatedAt,
		UpdatedAt:          rows[0].UpdatedAt,
		OrganizationCode_2: rows[1].OrganizationCode,
		Provider_2:         rows[1].Provider,
		RootType_2:         rows[1].RootType,
		RootRef_2:          rows[1].RootRef,
		GroupRef_2:         rows[1].GroupRef,
		ItemType_2:         rows[1].ItemType,
		ItemRef_2:          rows[1].ItemRef,
		DisplayName_2:      rows[1].DisplayName,
		Extension_2:        rows[1].Extension,
		ContentHash_2:      rows[1].ContentHash,
		SnapshotMeta_2:     rows[1].SnapshotMeta,
		LastResolvedAt_2:   nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:        rows[1].CreatedAt,
		UpdatedAt_2:        rows[1].UpdatedAt,
	}
}

func sourceItemBatch3Params(rows []sourceItemBatchRow) mysqlsqlc.UpsertKnowledgeSourceItemsBatch3Params {
	return mysqlsqlc.UpsertKnowledgeSourceItemsBatch3Params{
		OrganizationCode:   rows[0].OrganizationCode,
		Provider:           rows[0].Provider,
		RootType:           rows[0].RootType,
		RootRef:            rows[0].RootRef,
		GroupRef:           rows[0].GroupRef,
		ItemType:           rows[0].ItemType,
		ItemRef:            rows[0].ItemRef,
		DisplayName:        rows[0].DisplayName,
		Extension:          rows[0].Extension,
		ContentHash:        rows[0].ContentHash,
		SnapshotMeta:       rows[0].SnapshotMeta,
		LastResolvedAt:     nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:          rows[0].CreatedAt,
		UpdatedAt:          rows[0].UpdatedAt,
		OrganizationCode_2: rows[1].OrganizationCode,
		Provider_2:         rows[1].Provider,
		RootType_2:         rows[1].RootType,
		RootRef_2:          rows[1].RootRef,
		GroupRef_2:         rows[1].GroupRef,
		ItemType_2:         rows[1].ItemType,
		ItemRef_2:          rows[1].ItemRef,
		DisplayName_2:      rows[1].DisplayName,
		Extension_2:        rows[1].Extension,
		ContentHash_2:      rows[1].ContentHash,
		SnapshotMeta_2:     rows[1].SnapshotMeta,
		LastResolvedAt_2:   nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:        rows[1].CreatedAt,
		UpdatedAt_2:        rows[1].UpdatedAt,
		OrganizationCode_3: rows[2].OrganizationCode,
		Provider_3:         rows[2].Provider,
		RootType_3:         rows[2].RootType,
		RootRef_3:          rows[2].RootRef,
		GroupRef_3:         rows[2].GroupRef,
		ItemType_3:         rows[2].ItemType,
		ItemRef_3:          rows[2].ItemRef,
		DisplayName_3:      rows[2].DisplayName,
		Extension_3:        rows[2].Extension,
		ContentHash_3:      rows[2].ContentHash,
		SnapshotMeta_3:     rows[2].SnapshotMeta,
		LastResolvedAt_3:   nullTimeValueParam(rows[2].LastResolvedAt),
		CreatedAt_3:        rows[2].CreatedAt,
		UpdatedAt_3:        rows[2].UpdatedAt,
	}
}

func sourceItemBatch4Params(rows []sourceItemBatchRow) mysqlsqlc.UpsertKnowledgeSourceItemsBatch4Params {
	return mysqlsqlc.UpsertKnowledgeSourceItemsBatch4Params{
		OrganizationCode:   rows[0].OrganizationCode,
		Provider:           rows[0].Provider,
		RootType:           rows[0].RootType,
		RootRef:            rows[0].RootRef,
		GroupRef:           rows[0].GroupRef,
		ItemType:           rows[0].ItemType,
		ItemRef:            rows[0].ItemRef,
		DisplayName:        rows[0].DisplayName,
		Extension:          rows[0].Extension,
		ContentHash:        rows[0].ContentHash,
		SnapshotMeta:       rows[0].SnapshotMeta,
		LastResolvedAt:     nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:          rows[0].CreatedAt,
		UpdatedAt:          rows[0].UpdatedAt,
		OrganizationCode_2: rows[1].OrganizationCode,
		Provider_2:         rows[1].Provider,
		RootType_2:         rows[1].RootType,
		RootRef_2:          rows[1].RootRef,
		GroupRef_2:         rows[1].GroupRef,
		ItemType_2:         rows[1].ItemType,
		ItemRef_2:          rows[1].ItemRef,
		DisplayName_2:      rows[1].DisplayName,
		Extension_2:        rows[1].Extension,
		ContentHash_2:      rows[1].ContentHash,
		SnapshotMeta_2:     rows[1].SnapshotMeta,
		LastResolvedAt_2:   nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:        rows[1].CreatedAt,
		UpdatedAt_2:        rows[1].UpdatedAt,
		OrganizationCode_3: rows[2].OrganizationCode,
		Provider_3:         rows[2].Provider,
		RootType_3:         rows[2].RootType,
		RootRef_3:          rows[2].RootRef,
		GroupRef_3:         rows[2].GroupRef,
		ItemType_3:         rows[2].ItemType,
		ItemRef_3:          rows[2].ItemRef,
		DisplayName_3:      rows[2].DisplayName,
		Extension_3:        rows[2].Extension,
		ContentHash_3:      rows[2].ContentHash,
		SnapshotMeta_3:     rows[2].SnapshotMeta,
		LastResolvedAt_3:   nullTimeValueParam(rows[2].LastResolvedAt),
		CreatedAt_3:        rows[2].CreatedAt,
		UpdatedAt_3:        rows[2].UpdatedAt,
		OrganizationCode_4: rows[3].OrganizationCode,
		Provider_4:         rows[3].Provider,
		RootType_4:         rows[3].RootType,
		RootRef_4:          rows[3].RootRef,
		GroupRef_4:         rows[3].GroupRef,
		ItemType_4:         rows[3].ItemType,
		ItemRef_4:          rows[3].ItemRef,
		DisplayName_4:      rows[3].DisplayName,
		Extension_4:        rows[3].Extension,
		ContentHash_4:      rows[3].ContentHash,
		SnapshotMeta_4:     rows[3].SnapshotMeta,
		LastResolvedAt_4:   nullTimeValueParam(rows[3].LastResolvedAt),
		CreatedAt_4:        rows[3].CreatedAt,
		UpdatedAt_4:        rows[3].UpdatedAt,
	}
}

func bindingTargetBatch2Params(rows []bindingTargetBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch2Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch2Params{
		BindingID:    rows[0].BindingID,
		TargetType:   rows[0].TargetType,
		TargetRef:    rows[0].TargetRef,
		CreatedAt:    rows[0].CreatedAt,
		UpdatedAt:    rows[0].UpdatedAt,
		BindingID_2:  rows[1].BindingID,
		TargetType_2: rows[1].TargetType,
		TargetRef_2:  rows[1].TargetRef,
		CreatedAt_2:  rows[1].CreatedAt,
		UpdatedAt_2:  rows[1].UpdatedAt,
	}
}

func bindingTargetBatch3Params(rows []bindingTargetBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch3Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch3Params{
		BindingID:    rows[0].BindingID,
		TargetType:   rows[0].TargetType,
		TargetRef:    rows[0].TargetRef,
		CreatedAt:    rows[0].CreatedAt,
		UpdatedAt:    rows[0].UpdatedAt,
		BindingID_2:  rows[1].BindingID,
		TargetType_2: rows[1].TargetType,
		TargetRef_2:  rows[1].TargetRef,
		CreatedAt_2:  rows[1].CreatedAt,
		UpdatedAt_2:  rows[1].UpdatedAt,
		BindingID_3:  rows[2].BindingID,
		TargetType_3: rows[2].TargetType,
		TargetRef_3:  rows[2].TargetRef,
		CreatedAt_3:  rows[2].CreatedAt,
		UpdatedAt_3:  rows[2].UpdatedAt,
	}
}

func bindingTargetBatch4Params(rows []bindingTargetBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch4Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingTargetsBatch4Params{
		BindingID:    rows[0].BindingID,
		TargetType:   rows[0].TargetType,
		TargetRef:    rows[0].TargetRef,
		CreatedAt:    rows[0].CreatedAt,
		UpdatedAt:    rows[0].UpdatedAt,
		BindingID_2:  rows[1].BindingID,
		TargetType_2: rows[1].TargetType,
		TargetRef_2:  rows[1].TargetRef,
		CreatedAt_2:  rows[1].CreatedAt,
		UpdatedAt_2:  rows[1].UpdatedAt,
		BindingID_3:  rows[2].BindingID,
		TargetType_3: rows[2].TargetType,
		TargetRef_3:  rows[2].TargetRef,
		CreatedAt_3:  rows[2].CreatedAt,
		UpdatedAt_3:  rows[2].UpdatedAt,
		BindingID_4:  rows[3].BindingID,
		TargetType_4: rows[3].TargetType,
		TargetRef_4:  rows[3].TargetRef,
		CreatedAt_4:  rows[3].CreatedAt,
		UpdatedAt_4:  rows[3].UpdatedAt,
	}
}

func bindingItemBatch2Params(rows []bindingItemBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch2Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch2Params{
		BindingID:        rows[0].BindingID,
		SourceItemID:     rows[0].SourceItemID,
		ResolveReason:    rows[0].ResolveReason,
		LastResolvedAt:   nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:        rows[0].CreatedAt,
		UpdatedAt:        rows[0].UpdatedAt,
		BindingID_2:      rows[1].BindingID,
		SourceItemID_2:   rows[1].SourceItemID,
		ResolveReason_2:  rows[1].ResolveReason,
		LastResolvedAt_2: nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:      rows[1].CreatedAt,
		UpdatedAt_2:      rows[1].UpdatedAt,
	}
}

func bindingItemBatch3Params(rows []bindingItemBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch3Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch3Params{
		BindingID:        rows[0].BindingID,
		SourceItemID:     rows[0].SourceItemID,
		ResolveReason:    rows[0].ResolveReason,
		LastResolvedAt:   nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:        rows[0].CreatedAt,
		UpdatedAt:        rows[0].UpdatedAt,
		BindingID_2:      rows[1].BindingID,
		SourceItemID_2:   rows[1].SourceItemID,
		ResolveReason_2:  rows[1].ResolveReason,
		LastResolvedAt_2: nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:      rows[1].CreatedAt,
		UpdatedAt_2:      rows[1].UpdatedAt,
		BindingID_3:      rows[2].BindingID,
		SourceItemID_3:   rows[2].SourceItemID,
		ResolveReason_3:  rows[2].ResolveReason,
		LastResolvedAt_3: nullTimeValueParam(rows[2].LastResolvedAt),
		CreatedAt_3:      rows[2].CreatedAt,
		UpdatedAt_3:      rows[2].UpdatedAt,
	}
}

func bindingItemBatch4Params(rows []bindingItemBatchRow) mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch4Params {
	return mysqlsqlc.InsertKnowledgeSourceBindingItemsBatch4Params{
		BindingID:        rows[0].BindingID,
		SourceItemID:     rows[0].SourceItemID,
		ResolveReason:    rows[0].ResolveReason,
		LastResolvedAt:   nullTimeValueParam(rows[0].LastResolvedAt),
		CreatedAt:        rows[0].CreatedAt,
		UpdatedAt:        rows[0].UpdatedAt,
		BindingID_2:      rows[1].BindingID,
		SourceItemID_2:   rows[1].SourceItemID,
		ResolveReason_2:  rows[1].ResolveReason,
		LastResolvedAt_2: nullTimeValueParam(rows[1].LastResolvedAt),
		CreatedAt_2:      rows[1].CreatedAt,
		UpdatedAt_2:      rows[1].UpdatedAt,
		BindingID_3:      rows[2].BindingID,
		SourceItemID_3:   rows[2].SourceItemID,
		ResolveReason_3:  rows[2].ResolveReason,
		LastResolvedAt_3: nullTimeValueParam(rows[2].LastResolvedAt),
		CreatedAt_3:      rows[2].CreatedAt,
		UpdatedAt_3:      rows[2].UpdatedAt,
		BindingID_4:      rows[3].BindingID,
		SourceItemID_4:   rows[3].SourceItemID,
		ResolveReason_4:  rows[3].ResolveReason,
		LastResolvedAt_4: nullTimeValueParam(rows[3].LastResolvedAt),
		CreatedAt_4:      rows[3].CreatedAt,
		UpdatedAt_4:      rows[3].UpdatedAt,
	}
}

func (r *Repository) applyKnowledgeBaseBindingsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	input sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
) ([]sourcebindingentity.Binding, error) {
	if len(input.DeleteBindingIDs) > 0 {
		if err := r.deleteBindingsByIDs(ctx, tx, input.DeleteBindingIDs); err != nil {
			return nil, err
		}
	}

	now := time.Now()
	saved := make([]sourcebindingentity.Binding, 0, len(input.UpsertBindings))
	savedBindingIDs := make([]int64, 0, len(input.UpsertBindings))
	targets := make([]bindingTargetBatchRow, 0)
	items := make([]bindingItemBatchRow, 0)
	bindingRows := make([]bindingBatchRow, 0, len(input.UpsertBindings))
	bindingKeys := make([]bindingBatchNaturalKey, 0, len(input.UpsertBindings))
	for _, bindingInput := range input.UpsertBindings {
		binding := bindingInput.Binding
		binding.KnowledgeBaseCode = strings.TrimSpace(input.KnowledgeBaseCode)
		binding = sourcebindingentity.NormalizeBinding(binding)
		row, err := buildBindingBatchRow(binding, now)
		if err != nil {
			return nil, err
		}
		bindingRows = append(bindingRows, row)
		bindingKeys = append(bindingKeys, bindingBatchNaturalKey{
			KnowledgeBaseCode: binding.KnowledgeBaseCode,
			Provider:          binding.Provider,
			RootType:          binding.RootType,
			RootRef:           binding.RootRef,
		})
	}
	if err := r.upsertBindingHeadersWithTx(ctx, tx, bindingRows); err != nil {
		return nil, err
	}
	savedByKey, err := r.listBindingCoresByNaturalKeyWithTx(ctx, tx, strings.TrimSpace(input.KnowledgeBaseCode))
	if err != nil {
		return nil, err
	}
	for idx, bindingInput := range input.UpsertBindings {
		savedBinding, exists := savedByKey[bindingKeys[idx]]
		if !exists {
			return nil, fmt.Errorf(
				"%w: knowledge_base_code=%s provider=%s root_type=%s root_ref=%s",
				errSourceBindingBatchUpsertMissingResult,
				bindingKeys[idx].KnowledgeBaseCode,
				bindingKeys[idx].Provider,
				bindingKeys[idx].RootType,
				bindingKeys[idx].RootRef,
			)
		}
		savedBinding.Targets = append([]sourcebindingentity.BindingTarget(nil), bindingInput.Binding.Targets...)
		savedBindingIDs = append(savedBindingIDs, savedBinding.ID)
		targets = append(targets, buildBindingTargetBatchRows(savedBinding.ID, savedBinding.Targets, now)...)
		for _, item := range bindingInput.Items {
			items = append(items, bindingItemBatchRow{
				BindingID:      savedBinding.ID,
				SourceItemID:   item.SourceItemID,
				ResolveReason:  item.ResolveReason,
				LastResolvedAt: item.LastResolvedAt,
				CreatedAt:      now,
				UpdatedAt:      now,
			})
		}
		saved = append(saved, savedBinding)
	}
	if err := r.replaceBindingRelationsWithTx(ctx, tx, savedBindingIDs, targets, items); err != nil {
		return nil, err
	}
	return saved, nil
}

func (r *Repository) replaceBindingItemsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	bindingID int64,
	items []sourcebindingentity.BindingItem,
	now time.Time,
) error {
	if _, err := r.queries.WithTx(tx).DeleteSourceBindingItemsByBinding(ctx, bindingID); err != nil {
		return fmt.Errorf("delete source binding items: %w", err)
	}
	rows := make([]bindingItemBatchRow, 0, len(items))
	for _, item := range items {
		rows = append(rows, bindingItemBatchRow{
			BindingID:      bindingID,
			SourceItemID:   item.SourceItemID,
			ResolveReason:  item.ResolveReason,
			LastResolvedAt: item.LastResolvedAt,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}
	return r.insertBindingItemsBatchWithTx(ctx, tx, rows)
}

func (r *Repository) replaceBindingRelationsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	bindingIDs []int64,
	targets []bindingTargetBatchRow,
	items []bindingItemBatchRow,
) error {
	if len(bindingIDs) == 0 {
		return nil
	}
	txQueries := r.queries.WithTx(tx)
	if _, err := txQueries.DeleteSourceBindingTargetsByBindingIDs(ctx, bindingIDs); err != nil {
		return fmt.Errorf("delete source binding targets by ids: %w", err)
	}
	if _, err := txQueries.DeleteSourceBindingItemsByBindingIDs(ctx, bindingIDs); err != nil {
		return fmt.Errorf("delete source binding items by ids: %w", err)
	}
	if err := r.insertBindingTargetsBatchWithTx(ctx, tx, targets); err != nil {
		return err
	}
	return r.insertBindingItemsBatchWithTx(ctx, tx, items)
}

func (r *Repository) insertBindingTargetsBatchWithTx(
	ctx context.Context,
	tx *sql.Tx,
	targets []bindingTargetBatchRow,
) error {
	for start := 0; start < len(targets); start += sourceBindingBatchWriteSize {
		end := min(start+sourceBindingBatchWriteSize, len(targets))
		if err := r.insertBindingTargetRowsWithTx(ctx, tx, targets[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) insertBindingItemsBatchWithTx(
	ctx context.Context,
	tx *sql.Tx,
	items []bindingItemBatchRow,
) error {
	for start := 0; start < len(items); start += sourceBindingBatchWriteSize {
		end := min(start+sourceBindingBatchWriteSize, len(items))
		if err := r.insertBindingItemRowsWithTx(ctx, tx, items[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) deleteBindingsByKnowledgeBase(ctx context.Context, tx *sql.Tx, knowledgeBaseCode string) error {
	txQueries := r.queries.WithTx(tx)
	// Use the sqlc-managed join-delete queries here so replacement/deletion does
	// not regress back to "list IDs then delete", which is racy under concurrent
	// source-binding writes for the same knowledge base.
	if _, err := txQueries.DeleteSourceBindingTargetsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode)); err != nil {
		return fmt.Errorf("delete source binding targets: %w", err)
	}
	if _, err := txQueries.DeleteSourceBindingItemsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode)); err != nil {
		return fmt.Errorf("delete source binding items: %w", err)
	}
	if _, err := txQueries.DeleteSourceBindingsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode)); err != nil {
		return fmt.Errorf("delete source bindings: %w", err)
	}
	return nil
}

func (r *Repository) deleteBindingsByIDs(ctx context.Context, tx *sql.Tx, bindingIDs []int64) error {
	if len(bindingIDs) == 0 {
		return nil
	}
	txQueries := r.queries.WithTx(tx)
	if _, err := txQueries.DeleteSourceBindingTargetsByBindingIDs(ctx, bindingIDs); err != nil {
		return fmt.Errorf("delete source binding targets by ids: %w", err)
	}
	if _, err := txQueries.DeleteSourceBindingItemsByBindingIDs(ctx, bindingIDs); err != nil {
		return fmt.Errorf("delete source binding items by ids: %w", err)
	}
	if _, err := txQueries.DeleteSourceBindingsByBindingIDs(ctx, bindingIDs); err != nil {
		return fmt.Errorf("delete source bindings by ids: %w", err)
	}
	return nil
}

func (r *Repository) insertBinding(
	ctx context.Context,
	tx *sql.Tx,
	binding sourcebindingentity.Binding,
	now time.Time,
) (sourcebindingentity.Binding, error) {
	binding = sourcebindingentity.NormalizeBinding(binding)
	syncConfigJSON, err := json.Marshal(binding.SyncConfig)
	if err != nil {
		return sourcebindingentity.Binding{}, fmt.Errorf("marshal source binding sync config: %w", err)
	}
	res, err := r.queries.WithTx(tx).InsertKnowledgeSourceBinding(ctx, mysqlsqlc.InsertKnowledgeSourceBindingParams{
		OrganizationCode:  binding.OrganizationCode,
		KnowledgeBaseCode: binding.KnowledgeBaseCode,
		Provider:          binding.Provider,
		RootType:          binding.RootType,
		RootRef:           binding.RootRef,
		SyncMode:          binding.SyncMode,
		SyncConfig:        mustNullJSON(syncConfigJSON),
		Enabled:           binding.Enabled,
		CreatedUid:        binding.CreatedUID,
		UpdatedUid:        binding.UpdatedUID,
		CreatedAt:         now,
		UpdatedAt:         now,
	})
	if err != nil {
		return sourcebindingentity.Binding{}, fmt.Errorf("insert source binding: %w", err)
	}
	bindingID, err := res.LastInsertId()
	if err != nil {
		return sourcebindingentity.Binding{}, fmt.Errorf("get source binding id: %w", err)
	}
	binding.ID = bindingID
	binding.CreatedAt = now
	binding.UpdatedAt = now
	return binding, nil
}

func (r *Repository) insertBindingTarget(
	ctx context.Context,
	tx *sql.Tx,
	row bindingTargetBatchRow,
) error {
	if err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingTarget(ctx, mysqlsqlc.InsertKnowledgeSourceBindingTargetParams{
		BindingID:  row.BindingID,
		TargetType: row.TargetType,
		TargetRef:  row.TargetRef,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
	}); err != nil {
		return fmt.Errorf("insert source binding target: %w", err)
	}
	return nil
}

func bindingIDsFromRows(rows []mysqlsqlc.KnowledgeSourceBinding) []int64 {
	result := make([]int64, 0, len(rows))
	for _, row := range rows {
		result = append(result, row.ID)
	}
	return result
}

func normalizeKnowledgeBaseCodes(codes []string) []string {
	if len(codes) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(codes))
	result := make([]string, 0, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func foldBindingRows(
	rows []mysqlsqlc.KnowledgeSourceBinding,
	targets map[int64][]sourcebindingentity.BindingTarget,
) []sourcebindingentity.Binding {
	bindings := make([]sourcebindingentity.Binding, 0, len(rows))
	for _, row := range rows {
		binding := toBinding(row)
		if matchedTargets, ok := targets[row.ID]; ok {
			binding.Targets = append(binding.Targets, matchedTargets...)
		}
		bindings = append(bindings, binding)
	}
	return bindings
}

func (r *Repository) listBindingCoresByNaturalKeyWithTx(
	ctx context.Context,
	tx *sql.Tx,
	knowledgeBaseCode string,
) (map[bindingBatchNaturalKey]sourcebindingentity.Binding, error) {
	rows, err := r.queries.WithTx(tx).ListKnowledgeSourceBindingsCoreByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("list source binding cores by knowledge base: %w", err)
	}
	result := make(map[bindingBatchNaturalKey]sourcebindingentity.Binding, len(rows))
	for _, row := range rows {
		key := bindingBatchNaturalKey{
			KnowledgeBaseCode: row.KnowledgeBaseCode,
			Provider:          row.Provider,
			RootType:          row.RootType,
			RootRef:           row.RootRef,
		}
		result[key] = toBinding(row)
	}
	return result, nil
}

func (r *Repository) listBindingTargetsByBindingIDs(
	ctx context.Context,
	bindingIDs []int64,
) (map[int64][]sourcebindingentity.BindingTarget, error) {
	if len(bindingIDs) == 0 {
		return map[int64][]sourcebindingentity.BindingTarget{}, nil
	}
	rows, err := r.queries.ListKnowledgeSourceBindingTargetsByBindingIDs(ctx, bindingIDs)
	if err != nil {
		return nil, fmt.Errorf("query source binding targets: %w", err)
	}

	result := make(map[int64][]sourcebindingentity.BindingTarget, len(bindingIDs))
	for _, row := range rows {
		target := sourcebindingentity.BindingTarget{
			ID:         row.ID,
			BindingID:  row.BindingID,
			TargetType: row.TargetType,
			TargetRef:  row.TargetRef,
			CreatedAt:  row.CreatedAt,
			UpdatedAt:  row.UpdatedAt,
		}
		result[target.BindingID] = append(result[target.BindingID], target)
	}
	return result, nil
}

func (r *Repository) listBindingIDsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]int64, error) {
	return r.listBindingIDsByKnowledgeBaseWithTx(ctx, nil, knowledgeBaseCode)
}

func (r *Repository) listBindingIDsByKnowledgeBaseWithTx(ctx context.Context, tx *sql.Tx, knowledgeBaseCode string) ([]int64, error) {
	queries := r.queries
	if tx != nil {
		queries = queries.WithTx(tx)
	}
	ids, err := queries.ListSourceBindingIDsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("query source binding ids: %w", err)
	}
	return ids, nil
}

func (r *Repository) invalidateSourceCallbackEligibilityByBindings(
	ctx context.Context,
	bindings []sourcebindingentity.Binding,
) {
	orgs := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		orgs = append(orgs, binding.OrganizationCode)
	}
	r.invalidateSourceCallbackEligibilityOrganizations(ctx, orgs)
}

func (r *Repository) listSourceCallbackEligibilityOrganizationsByBindingIDs(
	ctx context.Context,
	bindingIDs []int64,
) []string {
	if r == nil || r.queries == nil || len(bindingIDs) == 0 {
		return nil
	}
	orgs, err := r.queries.ListSourceBindingOrganizationsByIDs(ctx, bindingIDs)
	if err != nil {
		return nil
	}
	return orgs
}

func (r *Repository) listSourceCallbackEligibilityOrganizationsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) []string {
	if r == nil || r.queries == nil || strings.TrimSpace(knowledgeBaseCode) == "" {
		return nil
	}
	rows, err := r.queries.ListKnowledgeSourceBindingsCoreByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil
	}
	orgs := make([]string, 0, len(rows))
	for _, row := range rows {
		orgs = append(orgs, row.OrganizationCode)
	}
	return orgs
}

func (r *Repository) invalidateSourceCallbackEligibilityOrganizations(
	ctx context.Context,
	organizationCodes []string,
) {
	if r == nil || r.invalidator == nil || len(organizationCodes) == 0 {
		return
	}
	seen := make(map[string]struct{}, len(organizationCodes))
	for _, organizationCode := range organizationCodes {
		organizationCode = strings.TrimSpace(organizationCode)
		if organizationCode == "" {
			continue
		}
		if _, exists := seen[organizationCode]; exists {
			continue
		}
		seen[organizationCode] = struct{}{}
		_ = r.invalidator.InvalidateOrganization(ctx, organizationCode)
	}
}

func toBinding(row mysqlsqlc.KnowledgeSourceBinding) sourcebindingentity.Binding {
	return sourcebindingentity.Binding{
		ID:                row.ID,
		OrganizationCode:  row.OrganizationCode,
		KnowledgeBaseCode: row.KnowledgeBaseCode,
		Provider:          row.Provider,
		RootType:          row.RootType,
		RootRef:           row.RootRef,
		SyncMode:          row.SyncMode,
		SyncConfig:        decodeObjectMap(row.SyncConfig),
		Enabled:           row.Enabled,
		CreatedUID:        row.CreatedUid,
		UpdatedUID:        row.UpdatedUid,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
}
