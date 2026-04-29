// Package transaction 提供知识库相关的事务协调实现。
package transaction

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlknowledgebase "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebase"
	mysqlknowledgebasebinding "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebasebinding"
	mysqlsourcebinding "magic/internal/infrastructure/persistence/mysql/knowledge/sourcebinding"
)

var errNilKnowledgeBaseWriteCoordinator = errors.New("knowledge base write coordinator is nil")

var (
	errKnowledgeBaseWriteSourceBindingRepoRequired = errors.New("knowledge base write coordinator source binding repository is required")
	errKnowledgeBaseWriteBindingRepoRequired       = errors.New("knowledge base write coordinator knowledge base binding repository is required")
)

// KnowledgeBaseWriteCoordinator 在单事务中提交知识库主表、来源绑定和绑定对象。
type KnowledgeBaseWriteCoordinator struct {
	client               *mysqlclient.SQLCClient
	knowledgeBaseRepo    *mysqlknowledgebase.BaseRepository
	sourceBindingRepo    *mysqlsourcebinding.Repository
	knowledgeBindingRepo *mysqlknowledgebasebinding.Repository
}

// NewKnowledgeBaseWriteCoordinator 创建知识库写入事务协调器。
func NewKnowledgeBaseWriteCoordinator(
	client *mysqlclient.SQLCClient,
	knowledgeBaseRepo *mysqlknowledgebase.BaseRepository,
	sourceBindingRepo *mysqlsourcebinding.Repository,
	knowledgeBindingRepo *mysqlknowledgebasebinding.Repository,
) *KnowledgeBaseWriteCoordinator {
	return &KnowledgeBaseWriteCoordinator{
		client:               client,
		knowledgeBaseRepo:    knowledgeBaseRepo,
		sourceBindingRepo:    sourceBindingRepo,
		knowledgeBindingRepo: knowledgeBindingRepo,
	}
}

// Create 在单事务中创建知识库及其数据库侧附属关系。
func (c *KnowledgeBaseWriteCoordinator) Create(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	sourceBindings []sourcebindingentity.Binding,
	agentIDs []string,
) ([]sourcebindingentity.Binding, error) {
	return c.runCreate(ctx, kb, sourceBindings, agentIDs)
}

// Update 在单事务中更新知识库及其数据库侧附属关系。
func (c *KnowledgeBaseWriteCoordinator) Update(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	replaceSourceBindings bool,
	sourceBindings []sourcebindingentity.Binding,
	replaceAgentBindings bool,
	agentIDs []string,
) ([]sourcebindingentity.Binding, error) {
	return c.runUpdate(ctx, kb, replaceSourceBindings, sourceBindings, replaceAgentBindings, agentIDs)
}

type knowledgeBaseMutation struct {
	replaceSource       bool
	sourceBindings      []sourcebindingentity.Binding
	replaceAgentBinding bool
	agentIDs            []string
}

func createKnowledgeBaseMutation(
	sourceBindings []sourcebindingentity.Binding,
	agentIDs []string,
) knowledgeBaseMutation {
	return knowledgeBaseMutation{
		replaceSource:       true,
		sourceBindings:      sourceBindings,
		replaceAgentBinding: true,
		agentIDs:            agentIDs,
	}
}

func updateKnowledgeBaseMutation(
	replaceSourceBindings bool,
	sourceBindings []sourcebindingentity.Binding,
	replaceAgentBindings bool,
	agentIDs []string,
) knowledgeBaseMutation {
	return knowledgeBaseMutation{
		replaceSource:       replaceSourceBindings,
		sourceBindings:      sourceBindings,
		replaceAgentBinding: replaceAgentBindings,
		agentIDs:            agentIDs,
	}
}

func (c *KnowledgeBaseWriteCoordinator) runCreate(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	sourceBindings []sourcebindingentity.Binding,
	agentIDs []string,
) ([]sourcebindingentity.Binding, error) {
	return c.run(ctx, kb, createKnowledgeBaseMutation(sourceBindings, agentIDs), c.knowledgeBaseRepo.SaveWithTx)
}

func (c *KnowledgeBaseWriteCoordinator) runUpdate(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	replaceSourceBindings bool,
	sourceBindings []sourcebindingentity.Binding,
	replaceAgentBindings bool,
	agentIDs []string,
) ([]sourcebindingentity.Binding, error) {
	return c.run(
		ctx,
		kb,
		updateKnowledgeBaseMutation(replaceSourceBindings, sourceBindings, replaceAgentBindings, agentIDs),
		c.knowledgeBaseRepo.UpdateWithTx,
	)
}

// UpdateWithAppliedSourceBindings 在单事务中更新知识库主表、agent 绑定与来源 binding 增量变更。
func (c *KnowledgeBaseWriteCoordinator) UpdateWithAppliedSourceBindings(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	sourceBindingInput sourcebindingrepository.ApplyKnowledgeBaseBindingsInput,
	replaceAgentBindings bool,
	agentIDs []string,
) ([]sourcebindingentity.Binding, error) {
	if c == nil || c.client == nil || c.knowledgeBaseRepo == nil {
		return nil, errNilKnowledgeBaseWriteCoordinator
	}
	if kb == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	if c.sourceBindingRepo == nil {
		return nil, errKnowledgeBaseWriteSourceBindingRepoRequired
	}
	kbentity.NormalizeKnowledgeBaseConfigs(kb)

	tx, err := c.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin knowledge base write tx: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	if err := c.knowledgeBaseRepo.UpdateWithTx(ctx, tx, kb); err != nil {
		return nil, fmt.Errorf("persist knowledge base: %w", err)
	}
	savedBindings, err := c.sourceBindingRepo.ApplyKnowledgeBaseBindingsWithTx(ctx, tx, sourceBindingInput)
	if err != nil {
		return nil, fmt.Errorf("apply source bindings: %w", err)
	}
	if replaceAgentBindings {
		if c.knowledgeBindingRepo == nil {
			return nil, errKnowledgeBaseWriteBindingRepoRequired
		}
		if _, err := c.knowledgeBindingRepo.ReplaceBindingsWithTx(
			ctx,
			tx,
			mysqlknowledgebasebinding.ReplaceBindingsTxInput{
				KnowledgeBaseCode: kb.Code,
				BindType:          kbentity.BindingTypeSuperMagicAgent,
				OrganizationCode:  kb.OrganizationCode,
				UserID:            kb.UpdatedUID,
				BindIDs:           agentIDs,
			},
		); err != nil {
			return nil, fmt.Errorf("replace knowledge base agent bindings: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit knowledge base write tx: %w", err)
	}
	tx = nil
	return savedBindings, nil
}

func (c *KnowledgeBaseWriteCoordinator) run(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	mutation knowledgeBaseMutation,
	saveKB func(context.Context, *sql.Tx, *kbentity.KnowledgeBase) error,
) ([]sourcebindingentity.Binding, error) {
	if c == nil || c.client == nil || c.knowledgeBaseRepo == nil {
		return nil, errNilKnowledgeBaseWriteCoordinator
	}
	if kb == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	kbentity.NormalizeKnowledgeBaseConfigs(kb)
	if saveKB == nil {
		return nil, errNilKnowledgeBaseWriteCoordinator
	}

	tx, err := c.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin knowledge base write tx: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	if err := saveKB(ctx, tx, kb); err != nil {
		return nil, fmt.Errorf("persist knowledge base: %w", err)
	}

	savedBindings := []sourcebindingentity.Binding(nil)
	if mutation.replaceSource {
		if c.sourceBindingRepo == nil {
			return nil, errKnowledgeBaseWriteSourceBindingRepoRequired
		}
		savedBindings, err = c.sourceBindingRepo.ReplaceBindingsWithTx(ctx, tx, kb.Code, mutation.sourceBindings)
		if err != nil {
			return nil, fmt.Errorf("replace source bindings: %w", err)
		}
	}

	if mutation.replaceAgentBinding {
		if c.knowledgeBindingRepo == nil {
			return nil, errKnowledgeBaseWriteBindingRepoRequired
		}
		if _, err := c.knowledgeBindingRepo.ReplaceBindingsWithTx(
			ctx,
			tx,
			mysqlknowledgebasebinding.ReplaceBindingsTxInput{
				KnowledgeBaseCode: kb.Code,
				BindType:          kbentity.BindingTypeSuperMagicAgent,
				OrganizationCode:  kb.OrganizationCode,
				UserID:            kb.UpdatedUID,
				BindIDs:           mutation.agentIDs,
			},
		); err != nil {
			return nil, fmt.Errorf("replace knowledge base agent bindings: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit knowledge base write tx: %w", err)
	}
	tx = nil
	return savedBindings, nil
}
