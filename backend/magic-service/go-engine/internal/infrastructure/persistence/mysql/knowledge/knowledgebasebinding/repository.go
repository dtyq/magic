// Package knowledgebasebindingrepo 提供知识库绑定对象在 MySQL 上的仓储实现。
package knowledgebasebindingrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
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
	BindType          knowledgebasedomain.BindingType
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
	bindType knowledgebasedomain.BindingType,
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
		trimmed := knowledgebasedomain.NormalizeBindID(bindID)
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

// ListBindIDsByKnowledgeBase 查询单个知识库下指定类型的绑定对象。
func (r *Repository) ListBindIDsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
	bindType knowledgebasedomain.BindingType,
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

// ListBindIDsByKnowledgeBases 批量查询知识库绑定对象，避免 N+1。
func (r *Repository) ListBindIDsByKnowledgeBases(
	ctx context.Context,
	knowledgeBaseCodes []string,
	bindType knowledgebasedomain.BindingType,
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
	bindType knowledgebasedomain.BindingType,
	bindID string,
	organizationCode string,
) ([]string, error) {
	rows, err := r.queries.ListKnowledgeBaseCodesByBindID(ctx, mysqlsqlc.ListKnowledgeBaseCodesByBindIDParams{
		BindType:         string(bindType),
		BindID:           knowledgebasedomain.NormalizeBindID(bindID),
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

func (r *Repository) deleteBindingsByKnowledgeBaseAndType(
	ctx context.Context,
	tx *sql.Tx,
	knowledgeBaseCode string,
	bindType knowledgebasedomain.BindingType,
) error {
	if _, err := r.queries.WithTx(tx).DeleteKnowledgeBaseBindingsByCodeAndType(ctx, mysqlsqlc.DeleteKnowledgeBaseBindingsByCodeAndTypeParams{
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		BindType:          string(bindType),
	}); err != nil {
		return fmt.Errorf("delete knowledge base bindings: %w", err)
	}
	return nil
}
