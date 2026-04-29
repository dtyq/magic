// Package transaction 提供知识库相关的事务协调实现。
package transaction

import (
	"context"
	"database/sql"
	"fmt"

	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// KnowledgeBaseDestroyCoordinator 在单事务内删除知识库的数据库记录。
type KnowledgeBaseDestroyCoordinator struct {
	client *mysqlclient.SQLCClient
}

// NewKnowledgeBaseDestroyCoordinator 创建知识库删除事务协调器。
func NewKnowledgeBaseDestroyCoordinator(client *mysqlclient.SQLCClient) *KnowledgeBaseDestroyCoordinator {
	return &KnowledgeBaseDestroyCoordinator{client: client}
}

// Destroy 在单事务中删除知识库绑定、文档、片段和知识库记录。
func (c *KnowledgeBaseDestroyCoordinator) Destroy(ctx context.Context, knowledgeBaseID int64, knowledgeBaseCode string) (err error) {
	if c == nil || c.client == nil {
		return nil
	}

	tx, err := c.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin knowledge base destroy tx: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()
	queries := c.client.WithTx(tx)
	if err = deleteKnowledgeBaseGraph(ctx, tx, queries, knowledgeBaseID, knowledgeBaseCode); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit knowledge base destroy tx: %w", err)
	}
	tx = nil
	return nil
}

func deleteKnowledgeBaseGraph(
	ctx context.Context,
	tx *sql.Tx,
	queries *mysqlsqlc.Queries,
	knowledgeBaseID int64,
	knowledgeBaseCode string,
) error {
	if queries == nil {
		return nil
	}

	steps := []struct {
		label string
		run   func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error
	}{
		{
			label: "delete source binding targets",
			run:   deleteSourceBindingTargetsStep(knowledgeBaseCode),
		},
		{
			label: "delete source binding items",
			run:   deleteSourceBindingItemsStep(knowledgeBaseCode),
		},
		{
			label: "delete source bindings",
			run:   deleteSourceBindingsStep(knowledgeBaseCode),
		},
		{
			label: "delete knowledge base bindings",
			run:   deleteKnowledgeBaseBindingsStep(knowledgeBaseCode),
		},
		{
			label: "delete knowledge base fragments",
			run:   deleteKnowledgeBaseFragmentsStep(knowledgeBaseCode),
		},
		{
			label: "delete knowledge base documents",
			run:   deleteKnowledgeBaseDocumentsStep(knowledgeBaseCode),
		},
		{
			label: "delete knowledge base row",
			run:   deleteKnowledgeBaseRowStep(knowledgeBaseID),
		},
	}

	for _, step := range steps {
		if err := step.run(ctx, tx, queries); err != nil {
			return fmt.Errorf("%s: %w", step.label, err)
		}
	}
	return nil
}

func deleteSourceBindingItemsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		if _, err := queries.DeleteSourceBindingItemsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
			return fmt.Errorf("delete source binding items by knowledge base: %w", err)
		}
		return nil
	}
}

func deleteSourceBindingTargetsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		if _, err := queries.DeleteSourceBindingTargetsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
			return fmt.Errorf("delete source binding targets by knowledge base: %w", err)
		}
		return nil
	}
}

func deleteSourceBindingsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		if _, err := queries.DeleteSourceBindingsByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
			return fmt.Errorf("delete source bindings by knowledge base: %w", err)
		}
		return nil
	}
}

func deleteKnowledgeBaseBindingsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		_, err := queries.DeleteKnowledgeBaseBindingsByCode(ctx, knowledgeBaseCode)
		if err != nil {
			return fmt.Errorf("delete knowledge base bindings by code: %w", err)
		}
		return nil
	}
}

func deleteKnowledgeBaseFragmentsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		_, err := queries.DeleteFragmentsByKnowledgeBase(ctx, knowledgeBaseCode)
		if err != nil {
			return fmt.Errorf("delete fragments by knowledge base: %w", err)
		}
		return nil
	}
}

func deleteKnowledgeBaseDocumentsStep(knowledgeBaseCode string) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		_, err := queries.DeleteDocumentsByKnowledgeBase(ctx, knowledgeBaseCode)
		if err != nil {
			return fmt.Errorf("delete documents by knowledge base: %w", err)
		}
		return nil
	}
}

func deleteKnowledgeBaseRowStep(knowledgeBaseID int64) func(context.Context, *sql.Tx, *mysqlsqlc.Queries) error {
	return func(ctx context.Context, _ *sql.Tx, queries *mysqlsqlc.Queries) error {
		_, err := queries.DeleteKnowledgeBaseByID(ctx, knowledgeBaseID)
		if err != nil {
			return fmt.Errorf("delete knowledge base by id: %w", err)
		}
		return nil
	}
}
