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

	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqljsoncompat "magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

var errSourceBindingRepositoryNil = errors.New("source binding repository is nil")

// Repository 实现来源绑定 MySQL 仓储。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

// NewRepository 创建来源绑定仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// ReplaceBindings 以全量替换方式保存知识库来源绑定。
func (r *Repository) ReplaceBindings(
	ctx context.Context,
	knowledgeBaseCode string,
	bindings []sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	return r.ReplaceBindingsWithTx(ctx, nil, knowledgeBaseCode, bindings)
}

// ReplaceBindingsWithTx 在给定事务中以全量替换方式保存知识库来源绑定。
func (r *Repository) ReplaceBindingsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	knowledgeBaseCode string,
	bindings []sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
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

	if err = r.deleteBindingsByKnowledgeBase(ctx, tx, knowledgeBaseCode); err != nil {
		return nil, err
	}

	now := time.Now()
	saved := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		savedBinding, saveErr := r.insertBinding(ctx, tx, binding, now)
		if saveErr != nil {
			err = saveErr
			return nil, err
		}
		saved = append(saved, savedBinding)
	}

	if managedTx {
		if err = tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit replace source bindings tx: %w", err)
		}
	}
	return saved, nil
}

// SaveBindings 以追加方式保存知识库来源绑定。
func (r *Repository) SaveBindings(
	ctx context.Context,
	knowledgeBaseCode string,
	bindings []sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	if r == nil || r.client == nil {
		return nil, errSourceBindingRepositoryNil
	}
	if len(bindings) == 0 {
		return []sourcebindingdomain.Binding{}, nil
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
	saved := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		binding.KnowledgeBaseCode = strings.TrimSpace(knowledgeBaseCode)
		savedBinding, saveErr := r.insertBinding(ctx, tx, binding, now)
		if saveErr != nil {
			err = saveErr
			return nil, err
		}
		saved = append(saved, savedBinding)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit save source bindings tx: %w", err)
	}
	return saved, nil
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

	if err = r.deleteBindingsByKnowledgeBase(ctx, tx, knowledgeBaseCode); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit delete source bindings tx: %w", err)
	}
	return nil
}

// ListBindingsByKnowledgeBase 查询知识库下的全部来源绑定。
func (r *Repository) ListBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingdomain.Binding, error) {
	rows, err := r.queries.ListKnowledgeSourceBindingsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge base: %w", err)
	}
	return foldSourceBindingRows(rows), nil
}

// ListRealtimeProjectBindingsByProject 查询项目下启用实时同步的来源绑定。
func (r *Repository) ListRealtimeProjectBindingsByProject(
	ctx context.Context,
	organizationCode string,
	projectID int64,
) ([]sourcebindingdomain.Binding, error) {
	rows, err := r.queries.ListRealtimeProjectSourceBindingsByProject(ctx, mysqlsqlc.ListRealtimeProjectSourceBindingsByProjectParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		RootRef:          strconv.FormatInt(projectID, 10),
	})
	if err != nil {
		return nil, fmt.Errorf("list realtime project source bindings: %w", err)
	}
	return foldRealtimeProjectSourceBindingRows(rows), nil
}

func foldSourceBindingRows(rows []mysqlsqlc.ListKnowledgeSourceBindingsByKnowledgeBaseRow) []sourcebindingdomain.Binding {
	bindings := make([]sourcebindingdomain.Binding, 0)
	indexByID := make(map[int64]int)
	for _, row := range rows {
		bindingRow := bindingRowFromKnowledgeBaseRow(row)
		idx, ok := indexByID[bindingRow.BindingID]
		if !ok {
			bindings = append(bindings, bindingRow.toBinding())
			idx = len(bindings) - 1
			indexByID[bindingRow.BindingID] = idx
		}
		if target := bindingRow.toTarget(); target != nil {
			bindings[idx].Targets = append(bindings[idx].Targets, *target)
		}
	}
	return bindings
}

func foldRealtimeProjectSourceBindingRows(rows []mysqlsqlc.ListRealtimeProjectSourceBindingsByProjectRow) []sourcebindingdomain.Binding {
	bindings := make([]sourcebindingdomain.Binding, 0)
	indexByID := make(map[int64]int)
	for _, row := range rows {
		bindingRow := bindingRowFromRealtimeProjectRow(row)
		idx, ok := indexByID[bindingRow.BindingID]
		if !ok {
			bindings = append(bindings, bindingRow.toBinding())
			idx = len(bindings) - 1
			indexByID[bindingRow.BindingID] = idx
		}
		if target := bindingRow.toTarget(); target != nil {
			bindings[idx].Targets = append(bindings[idx].Targets, *target)
		}
	}
	return bindings
}

// UpsertSourceItem 新增或更新来源项。
func (r *Repository) UpsertSourceItem(ctx context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error) {
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

// ReplaceBindingItems 全量替换绑定项物化结果。
func (r *Repository) ReplaceBindingItems(ctx context.Context, bindingID int64, items []sourcebindingdomain.BindingItem) error {
	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin replace source binding items tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = r.queries.WithTx(tx).DeleteSourceBindingItemsByBinding(ctx, bindingID); err != nil {
		return fmt.Errorf("delete source binding items: %w", err)
	}
	now := time.Now()
	for _, item := range items {
		err = r.queries.WithTx(tx).InsertKnowledgeSourceBindingItem(ctx, mysqlsqlc.InsertKnowledgeSourceBindingItemParams{
			BindingID:      bindingID,
			SourceItemID:   item.SourceItemID,
			ResolveReason:  item.ResolveReason,
			LastResolvedAt: nullTimeValueParam(item.LastResolvedAt),
			CreatedAt:      now,
			UpdatedAt:      now,
		})
		if err != nil {
			return fmt.Errorf("insert source binding item: %w", err)
		}
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit replace source binding items tx: %w", err)
	}
	return nil
}

// ListBindingItemsByKnowledgeBase 查询知识库下全部绑定项。
func (r *Repository) ListBindingItemsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingdomain.BindingItem, error) {
	rows, err := r.queries.ListKnowledgeSourceBindingItemsByKnowledgeBase(ctx, strings.TrimSpace(knowledgeBaseCode))
	if err != nil {
		return nil, fmt.Errorf("list source binding items by knowledge base: %w", err)
	}
	items := make([]sourcebindingdomain.BindingItem, 0, len(rows))
	for _, row := range rows {
		item := sourcebindingdomain.BindingItem{
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

func mustNullJSON(raw []byte) json.RawMessage {
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

func nullTimeValue(value sql.NullTime) time.Time {
	if value.Valid {
		return value.Time
	}
	return time.Time{}
}

func (r *Repository) deleteBindingsByKnowledgeBase(ctx context.Context, tx *sql.Tx, knowledgeBaseCode string) error {
	queries := r.queries.WithTx(tx)
	if _, err := queries.DeleteSourceBindingTargetsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
		return fmt.Errorf("delete source binding targets: %w", err)
	}
	if _, err := queries.DeleteSourceBindingItemsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
		return fmt.Errorf("delete source binding items: %w", err)
	}
	if _, err := queries.DeleteSourceBindingsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
		return fmt.Errorf("delete source bindings: %w", err)
	}
	return nil
}

func (r *Repository) insertBinding(
	ctx context.Context,
	tx *sql.Tx,
	binding sourcebindingdomain.Binding,
	now time.Time,
) (sourcebindingdomain.Binding, error) {
	binding = sourcebindingdomain.NormalizeBinding(binding)
	syncConfigJSON, err := json.Marshal(binding.SyncConfig)
	if err != nil {
		return sourcebindingdomain.Binding{}, fmt.Errorf("marshal source binding sync config: %w", err)
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
		return sourcebindingdomain.Binding{}, fmt.Errorf("insert source binding: %w", err)
	}
	bindingID, err := res.LastInsertId()
	if err != nil {
		return sourcebindingdomain.Binding{}, fmt.Errorf("get source binding id: %w", err)
	}
	binding.ID = bindingID
	binding.CreatedAt = now
	binding.UpdatedAt = now
	for idx := range binding.Targets {
		if err := r.insertBindingTarget(ctx, tx, bindingID, &binding.Targets[idx], now); err != nil {
			return sourcebindingdomain.Binding{}, err
		}
	}
	return binding, nil
}

func (r *Repository) insertBindingTarget(
	ctx context.Context,
	tx *sql.Tx,
	bindingID int64,
	target *sourcebindingdomain.BindingTarget,
	now time.Time,
) error {
	if target == nil {
		return nil
	}
	if err := r.queries.WithTx(tx).InsertKnowledgeSourceBindingTarget(ctx, mysqlsqlc.InsertKnowledgeSourceBindingTargetParams{
		BindingID:  bindingID,
		TargetType: target.TargetType,
		TargetRef:  target.TargetRef,
		CreatedAt:  now,
		UpdatedAt:  now,
	}); err != nil {
		return fmt.Errorf("insert source binding target: %w", err)
	}
	target.BindingID = bindingID
	target.CreatedAt = now
	target.UpdatedAt = now
	return nil
}

type bindingRow struct {
	BindingID     int64
	OrgCode       string
	KnowledgeCode string
	Provider      string
	RootType      string
	RootRef       string
	SyncMode      string
	SyncConfigRaw []byte
	Enabled       bool
	CreatedUID    string
	UpdatedUID    string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	TargetID      sql.NullInt64
	TargetType    sql.NullString
	TargetRef     sql.NullString
	TargetCreated sql.NullTime
	TargetUpdated sql.NullTime
}

func bindingRowFromKnowledgeBaseRow(row mysqlsqlc.ListKnowledgeSourceBindingsByKnowledgeBaseRow) bindingRow {
	return bindingRow{
		BindingID:     row.ID,
		OrgCode:       row.OrganizationCode,
		KnowledgeCode: row.KnowledgeBaseCode,
		Provider:      row.Provider,
		RootType:      row.RootType,
		RootRef:       row.RootRef,
		SyncMode:      row.SyncMode,
		SyncConfigRaw: row.SyncConfig,
		Enabled:       row.Enabled,
		CreatedUID:    row.CreatedUid,
		UpdatedUID:    row.UpdatedUid,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
		TargetID:      row.ID_2,
		TargetType:    sql.NullString{String: row.TargetType, Valid: row.ID_2.Valid},
		TargetRef:     sql.NullString{String: row.TargetRef, Valid: row.ID_2.Valid},
		TargetCreated: row.CreatedAt_2,
		TargetUpdated: row.UpdatedAt_2,
	}
}

func bindingRowFromRealtimeProjectRow(row mysqlsqlc.ListRealtimeProjectSourceBindingsByProjectRow) bindingRow {
	return bindingRow{
		BindingID:     row.ID,
		OrgCode:       row.OrganizationCode,
		KnowledgeCode: row.KnowledgeBaseCode,
		Provider:      row.Provider,
		RootType:      row.RootType,
		RootRef:       row.RootRef,
		SyncMode:      row.SyncMode,
		SyncConfigRaw: row.SyncConfig,
		Enabled:       row.Enabled,
		CreatedUID:    row.CreatedUid,
		UpdatedUID:    row.UpdatedUid,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
		TargetID:      row.ID_2,
		TargetType:    sql.NullString{String: row.TargetType, Valid: row.ID_2.Valid},
		TargetRef:     sql.NullString{String: row.TargetRef, Valid: row.ID_2.Valid},
		TargetCreated: row.CreatedAt_2,
		TargetUpdated: row.UpdatedAt_2,
	}
}

func (r bindingRow) toBinding() sourcebindingdomain.Binding {
	return sourcebindingdomain.Binding{
		ID:                r.BindingID,
		OrganizationCode:  r.OrgCode,
		KnowledgeBaseCode: r.KnowledgeCode,
		Provider:          r.Provider,
		RootType:          r.RootType,
		RootRef:           r.RootRef,
		SyncMode:          r.SyncMode,
		SyncConfig:        decodeObjectMap(r.SyncConfigRaw),
		Enabled:           r.Enabled,
		CreatedUID:        r.CreatedUID,
		UpdatedUID:        r.UpdatedUID,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
	}
}

func (r bindingRow) toTarget() *sourcebindingdomain.BindingTarget {
	if !r.TargetID.Valid {
		return nil
	}
	return &sourcebindingdomain.BindingTarget{
		ID:         r.TargetID.Int64,
		BindingID:  r.BindingID,
		TargetType: r.TargetType.String,
		TargetRef:  r.TargetRef.String,
		CreatedAt:  nullTimeValue(r.TargetCreated),
		UpdatedAt:  nullTimeValue(r.TargetUpdated),
	}
}
