// Package knowledgebasebindingrepo 提供知识库绑定对象在 MySQL 上的仓储实现。
package knowledgebasebindingrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kshared "magic/internal/domain/knowledge/shared"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// Repository 实现知识库绑定对象仓储。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

var errNilKnowledgeBaseBindingRepository = errors.New("knowledge base binding repository is nil")

// ReplaceBindingsTxInput 描述事务内全量替换绑定对象的参数。
type ReplaceBindingsTxInput struct {
	KnowledgeBaseCode string
	BindType          kbentity.BindingType
	OrganizationCode  string
	UserID            string
	BindIDs           []string
}

// NewRepository 创建知识库绑定对象仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// ReplaceBindings 以全量替换方式保存知识库绑定对象。
func (r *Repository) ReplaceBindings(
	ctx context.Context,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
	organizationCode string,
	userID string,
	bindIDs []string,
) ([]string, error) {
	return r.ReplaceBindingsWithTx(ctx, nil, ReplaceBindingsTxInput{
		KnowledgeBaseCode: knowledgeBaseCode,
		BindType:          bindType,
		OrganizationCode:  organizationCode,
		UserID:            userID,
		BindIDs:           bindIDs,
	})
}

// ReplaceBindingsWithTx 在给定事务中以全量替换方式保存知识库绑定对象。
func (r *Repository) ReplaceBindingsWithTx(
	ctx context.Context,
	tx *sql.Tx,
	input ReplaceBindingsTxInput,
) ([]string, error) {
	if r == nil || r.client == nil {
		return nil, errNilKnowledgeBaseBindingRepository
	}

	managedTx := tx == nil
	var err error
	if managedTx {
		tx, err = r.client.DB().BeginTx(ctx, nil)
		if err != nil {
			return nil, fmt.Errorf("begin replace knowledge base bindings tx: %w", err)
		}
	}
	defer func() {
		if managedTx && err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = r.deleteBindingsByKnowledgeBaseAndType(ctx, tx, input.KnowledgeBaseCode, input.BindType); err != nil {
		return nil, err
	}

	now := time.Now()
	normalized := make([]string, 0, len(input.BindIDs))
	seen := make(map[string]struct{}, len(input.BindIDs))
	queries := r.queries.WithTx(tx)
	for _, bindID := range input.BindIDs {
		trimmed := kbentity.NormalizeBindID(bindID)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		if err = queries.InsertKnowledgeBaseBinding(ctx, mysqlsqlc.InsertKnowledgeBaseBindingParams{
			KnowledgeBaseCode: strings.TrimSpace(input.KnowledgeBaseCode),
			BindType:          string(input.BindType),
			BindID:            trimmed,
			OrganizationCode:  strings.TrimSpace(input.OrganizationCode),
			CreatedUid:        strings.TrimSpace(input.UserID),
			UpdatedUid:        strings.TrimSpace(input.UserID),
			CreatedAt:         now,
			UpdatedAt:         now,
		}); err != nil {
			return nil, fmt.Errorf("insert knowledge base binding: %w", err)
		}
		normalized = append(normalized, trimmed)
	}

	if managedTx {
		if err = tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit replace knowledge base bindings tx: %w", err)
		}
	}
	return normalized, nil
}

// LinkAgentKnowledgeBases 幂等地新增数字员工与 flow 向量知识库的关联。
func (r *Repository) LinkAgentKnowledgeBases(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCode string,
	knowledgeBaseCodes []string,
) ([]string, error) {
	if r == nil || r.client == nil {
		return nil, errNilKnowledgeBaseBindingRepository
	}
	normalizedCodes := normalizeKnowledgeBaseBindingCodes(knowledgeBaseCodes)
	if len(normalizedCodes) == 0 {
		return []string{}, nil
	}

	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin link agent knowledge bases tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now()
	queries := r.queries.WithTx(tx)
	for _, code := range normalizedCodes {
		err = queries.UpsertKnowledgeBaseBinding(ctx, mysqlsqlc.UpsertKnowledgeBaseBindingParams{
			KnowledgeBaseCode: code,
			BindType:          string(kbentity.BindingTypeSuperMagicAgent),
			BindID:            kbentity.NormalizeBindID(agentCode),
			OrganizationCode:  strings.TrimSpace(organizationCode),
			CreatedUid:        strings.TrimSpace(userID),
			UpdatedUid:        strings.TrimSpace(userID),
			CreatedAt:         now,
			UpdatedAt:         now,
		})
		if err != nil {
			return nil, fmt.Errorf("upsert knowledge base binding: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit link agent knowledge bases tx: %w", err)
	}
	return normalizedCodes, nil
}

// UnlinkAgentKnowledgeBases 移除数字员工与指定 flow 向量知识库的关联。
func (r *Repository) UnlinkAgentKnowledgeBases(
	ctx context.Context,
	organizationCode string,
	_ string,
	agentCode string,
	knowledgeBaseCodes []string,
) ([]string, error) {
	if r == nil || r.queries == nil {
		return nil, errNilKnowledgeBaseBindingRepository
	}
	normalizedCodes := normalizeKnowledgeBaseBindingCodes(knowledgeBaseCodes)
	if len(normalizedCodes) == 0 {
		return []string{}, nil
	}
	if _, err := r.queries.DeleteFlowKnowledgeBaseBindingsByBindIDAndCodes(
		ctx,
		mysqlsqlc.DeleteFlowKnowledgeBaseBindingsByBindIDAndCodesParams{
			OrganizationCode:   strings.TrimSpace(organizationCode),
			BindType:           string(kbentity.BindingTypeSuperMagicAgent),
			BindID:             kbentity.NormalizeBindID(agentCode),
			KnowledgeBaseCodes: normalizedCodes,
			KnowledgeBaseType:  string(kbentity.KnowledgeBaseTypeFlowVector),
		},
	); err != nil {
		return nil, fmt.Errorf("delete flow knowledge base bindings by agent: %w", err)
	}
	return normalizedCodes, nil
}

// ListBindIDsByKnowledgeBase 查询单个知识库下指定类型的绑定对象。
func (r *Repository) ListBindIDsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
) ([]string, error) {
	rows, err := r.queries.ListKnowledgeBaseBindingIDs(ctx, mysqlsqlc.ListKnowledgeBaseBindingIDsParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		BindType:          string(bindType),
	})
	if err != nil {
		return nil, fmt.Errorf("query knowledge base bindings: %w", err)
	}

	result := make([]string, 0, len(rows))
	for _, bindID := range rows {
		trimmed := strings.TrimSpace(bindID)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result, nil
}

// ListBindIDsByKnowledgeBaseInOrg 查询组织内单个知识库下指定类型的绑定对象。
func (r *Repository) ListBindIDsByKnowledgeBaseInOrg(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
) ([]string, error) {
	rows, err := r.queries.ListKnowledgeBaseBindingIDsByOrgAndCode(
		ctx,
		mysqlsqlc.ListKnowledgeBaseBindingIDsByOrgAndCodeParams{
			OrganizationCode:  strings.TrimSpace(organizationCode),
			KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
			BindType:          string(bindType),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("query organization knowledge base bindings: %w", err)
	}

	result := make([]string, 0, len(rows))
	for _, bindID := range rows {
		trimmed := strings.TrimSpace(bindID)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result, nil
}

// ListBindIDsByKnowledgeBases 批量查询知识库绑定对象，避免 N+1。
func (r *Repository) ListBindIDsByKnowledgeBases(
	ctx context.Context,
	knowledgeBaseCodes []string,
	bindType kbentity.BindingType,
) (map[string][]string, error) {
	result := make(map[string][]string, len(knowledgeBaseCodes))
	normalizedCodes := make([]string, 0, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := result[trimmed]; !exists {
			result[trimmed] = []string{}
			normalizedCodes = append(normalizedCodes, trimmed)
		}
	}
	if len(normalizedCodes) == 0 {
		return result, nil
	}

	rows, err := r.queries.ListKnowledgeBaseBindingPairsByCodes(ctx, mysqlsqlc.ListKnowledgeBaseBindingPairsByCodesParams{
		BindType:           string(bindType),
		KnowledgeBaseCodes: normalizedCodes,
	})
	if err != nil {
		return nil, fmt.Errorf("batch query knowledge base bindings: %w", err)
	}

	for _, row := range rows {
		knowledgeCode := strings.TrimSpace(row.KnowledgeBaseCode)
		if knowledgeCode == "" {
			continue
		}
		result[knowledgeCode] = append(result[knowledgeCode], strings.TrimSpace(row.BindID))
	}
	return result, nil
}

// ListKnowledgeBaseCodesByBindID 反向查询指定绑定对象下的知识库编码列表。
func (r *Repository) ListKnowledgeBaseCodesByBindID(
	ctx context.Context,
	bindType kbentity.BindingType,
	bindID string,
	organizationCode string,
) ([]string, error) {
	rows, err := r.queries.ListKnowledgeBaseCodesByBindID(ctx, mysqlsqlc.ListKnowledgeBaseCodesByBindIDParams{
		BindType:         string(bindType),
		BindID:           kbentity.NormalizeBindID(bindID),
		OrganizationCode: strings.TrimSpace(organizationCode),
	})
	if err != nil {
		return nil, fmt.Errorf("query knowledge bases by bind id: %w", err)
	}

	result := make([]string, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, knowledgeBaseCode := range rows {
		trimmed := strings.TrimSpace(knowledgeBaseCode)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result, nil
}

// ListKnowledgeBaseBindingsByBindID 反向查询指定绑定对象下的知识库绑定列表。
func (r *Repository) ListKnowledgeBaseBindingsByBindID(
	ctx context.Context,
	bindType kbentity.BindingType,
	bindID string,
	organizationCode string,
) ([]kbentity.AgentKnowledgeBaseBinding, error) {
	rows, err := r.queries.ListKnowledgeBaseBindingsByBindID(ctx, mysqlsqlc.ListKnowledgeBaseBindingsByBindIDParams{
		BindType:         string(bindType),
		BindID:           kbentity.NormalizeBindID(bindID),
		OrganizationCode: strings.TrimSpace(organizationCode),
	})
	if err != nil {
		return nil, fmt.Errorf("query knowledge base bindings by bind id: %w", err)
	}

	result := make([]kbentity.AgentKnowledgeBaseBinding, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		code := strings.TrimSpace(row.KnowledgeBaseCode)
		if code == "" {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		result = append(result, kbentity.AgentKnowledgeBaseBinding{
			KnowledgeBaseCode: code,
			Metadata:          kbentity.DecodeAgentKnowledgeBaseBindingMetadata(row.Metadata),
		})
	}
	return result, nil
}

// ListKnowledgeBaseBindingsByBindIDs 批量反向查询指定绑定对象下的知识库绑定列表。
func (r *Repository) ListKnowledgeBaseBindingsByBindIDs(
	ctx context.Context,
	bindType kbentity.BindingType,
	bindIDs []string,
	organizationCode string,
) ([]kbentity.AgentKnowledgeBaseBinding, error) {
	normalizedBindIDs := normalizeKnowledgeBaseBindingBindIDs(bindIDs)
	if len(normalizedBindIDs) == 0 {
		return []kbentity.AgentKnowledgeBaseBinding{}, nil
	}
	rows, err := r.queries.ListKnowledgeBaseBindingsByBindIDs(ctx, mysqlsqlc.ListKnowledgeBaseBindingsByBindIDsParams{
		BindType:         string(bindType),
		BindIds:          normalizedBindIDs,
		OrganizationCode: strings.TrimSpace(organizationCode),
	})
	if err != nil {
		return nil, fmt.Errorf("batch query knowledge base bindings by bind ids: %w", err)
	}

	result := make([]kbentity.AgentKnowledgeBaseBinding, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		code := strings.TrimSpace(row.KnowledgeBaseCode)
		if code == "" {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		result = append(result, kbentity.AgentKnowledgeBaseBinding{
			KnowledgeBaseCode: code,
			Metadata:          kbentity.DecodeAgentKnowledgeBaseBindingMetadata(row.Metadata),
		})
	}
	return result, nil
}

// UpdateAgentKnowledgeBaseBindingMetadata 更新数字员工下某个 flow 知识库绑定的关联级配置。
func (r *Repository) UpdateAgentKnowledgeBaseBindingMetadata(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCode string,
	knowledgeBaseCode string,
	patch kbentity.AgentKnowledgeBaseBindingMetadataPatch,
) (*kbentity.AgentKnowledgeBaseBinding, error) {
	if r == nil || r.client == nil {
		return nil, errNilKnowledgeBaseBindingRepository
	}
	normalizedOrg := strings.TrimSpace(organizationCode)
	normalizedAgentCode := kbentity.NormalizeBindID(agentCode)
	normalizedKnowledgeBaseCode := strings.TrimSpace(knowledgeBaseCode)

	tx, err := r.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin update knowledge base binding metadata tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	queries := r.queries.WithTx(tx)
	row, err := queries.GetFlowKnowledgeBaseBindingByBindIDAndCodeForUpdate(
		ctx,
		mysqlsqlc.GetFlowKnowledgeBaseBindingByBindIDAndCodeForUpdateParams{
			OrganizationCode:  normalizedOrg,
			BindType:          string(kbentity.BindingTypeSuperMagicAgent),
			BindID:            normalizedAgentCode,
			KnowledgeBaseCode: normalizedKnowledgeBaseCode,
			KnowledgeBaseType: string(kbentity.KnowledgeBaseTypeFlowVector),
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", kshared.ErrKnowledgeBaseNotFound, normalizedKnowledgeBaseCode)
		}
		return nil, fmt.Errorf("query flow knowledge base binding: %w", err)
	}

	metadata := kbentity.DecodeAgentKnowledgeBaseBindingMetadata(row.Metadata).ApplyPatch(patch)
	affected, err := queries.UpdateKnowledgeBaseBindingMetadataByBindIDAndCode(
		ctx,
		mysqlsqlc.UpdateKnowledgeBaseBindingMetadataByBindIDAndCodeParams{
			Metadata:          metadata.JSONBytes(),
			UpdatedUid:        strings.TrimSpace(userID),
			UpdatedAt:         time.Now(),
			OrganizationCode:  normalizedOrg,
			BindType:          string(kbentity.BindingTypeSuperMagicAgent),
			BindID:            normalizedAgentCode,
			KnowledgeBaseCode: normalizedKnowledgeBaseCode,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("update knowledge base binding metadata: %w", err)
	}
	if affected == 0 {
		return nil, fmt.Errorf("%w: %s", kshared.ErrKnowledgeBaseNotFound, normalizedKnowledgeBaseCode)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update knowledge base binding metadata tx: %w", err)
	}
	return &kbentity.AgentKnowledgeBaseBinding{
		KnowledgeBaseCode: strings.TrimSpace(row.KnowledgeBaseCode),
		Metadata:          metadata,
	}, nil
}

func normalizeKnowledgeBaseBindingBindIDs(bindIDs []string) []string {
	normalized := make([]string, 0, len(bindIDs))
	seen := make(map[string]struct{}, len(bindIDs))
	for _, bindID := range bindIDs {
		trimmed := kbentity.NormalizeBindID(bindID)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func (r *Repository) deleteBindingsByKnowledgeBaseAndType(
	ctx context.Context,
	tx *sql.Tx,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
) error {
	if _, err := r.queries.WithTx(tx).DeleteKnowledgeBaseBindingsByCodeAndType(ctx, mysqlsqlc.DeleteKnowledgeBaseBindingsByCodeAndTypeParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		BindType:          string(bindType),
	}); err != nil {
		return fmt.Errorf("delete knowledge base bindings: %w", err)
	}
	return nil
}

func normalizeKnowledgeBaseBindingCodes(codes []string) []string {
	result := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
