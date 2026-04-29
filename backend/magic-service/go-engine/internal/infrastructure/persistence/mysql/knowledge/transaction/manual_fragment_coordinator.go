// Package transaction 提供知识库相关的事务协调实现。
package transaction

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	documentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
	fragmentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/fragment"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

// ManualFragmentCoordinator 在单事务内确保文档存在并保存手工片段。
type ManualFragmentCoordinator struct {
	client *mysqlclient.SQLCClient
	logger *logging.SugaredLogger
}

// NewManualFragmentCoordinator 创建手工片段创建协调器。
func NewManualFragmentCoordinator(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *ManualFragmentCoordinator {
	return &ManualFragmentCoordinator{
		client: client,
		logger: logger,
	}
}

// EnsureDocumentAndSaveFragment 在单事务中确保文档存在并保存片段。
func (c *ManualFragmentCoordinator) EnsureDocumentAndSaveFragment(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	fragment *fragmodel.KnowledgeBaseFragment,
) (*docentity.KnowledgeBaseDocument, error) {
	if doc == nil {
		return nil, shared.ErrDocumentNotFound
	}
	if fragment == nil {
		return nil, shared.ErrFragmentNotFound
	}

	tx, err := c.client.DB().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	queries := c.client.WithTx(tx)
	resolvedDoc, err := c.ensureDocument(ctx, queries, doc)
	if err != nil {
		return nil, err
	}

	applyDocumentToFragment(fragment, resolvedDoc)
	if err := c.insertFragment(ctx, queries, fragment); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	tx = nil
	return resolvedDoc, nil
}

func (c *ManualFragmentCoordinator) ensureDocument(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	doc *docentity.KnowledgeBaseDocument,
) (*docentity.KnowledgeBaseDocument, error) {
	found, err := queries.FindDocumentByCodeAndKnowledgeBase(ctx, mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseParams{
		Code:              doc.Code,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
	})
	switch {
	case err == nil:
		mappedDoc, mapErr := documentrepo.ToKnowledgeBaseDocumentByCodeAndKnowledgeBase(found)
		if mapErr != nil {
			return nil, fmt.Errorf("map existing document: %w", mapErr)
		}
		return mappedDoc, nil
	case !errors.Is(err, sql.ErrNoRows):
		return nil, fmt.Errorf("find document by code and knowledge base: %w", err)
	}

	params, err := documentrepo.BuildInsertDocumentParams(doc)
	if err != nil {
		return nil, fmt.Errorf("build insert document params: %w", err)
	}
	res, err := queries.InsertDocument(ctx, params)
	if err != nil {
		if documentrepo.IsDuplicateDocumentInsert(err) {
			return c.findDuplicateDocument(ctx, queries, doc)
		}
		return nil, fmt.Errorf("failed to insert document: %w", err)
	}

	insertedID, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get inserted document id: %w", err)
	}
	doc.ID = insertedID
	return doc, nil
}

func (c *ManualFragmentCoordinator) findDuplicateDocument(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	doc *docentity.KnowledgeBaseDocument,
) (*docentity.KnowledgeBaseDocument, error) {
	duplicateDoc, err := queries.FindDocumentByCodeAndKnowledgeBase(ctx, mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseParams{
		Code:              doc.Code,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrDocumentNotFound
		}
		return nil, fmt.Errorf("find duplicated document by code and knowledge base: %w", err)
	}

	mappedDoc, err := documentrepo.ToKnowledgeBaseDocumentByCodeAndKnowledgeBase(duplicateDoc)
	if err != nil {
		return nil, fmt.Errorf("map duplicated document: %w", err)
	}
	return mappedDoc, nil
}

func (c *ManualFragmentCoordinator) insertFragment(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	fragment *fragmodel.KnowledgeBaseFragment,
) error {
	if err := fragmentrepo.ValidateDocumentCode(fragment); err != nil {
		return fmt.Errorf("validate fragment document code: %w", err)
	}

	params, err := fragmentrepo.BuildInsertParams(fragment, time.Now())
	if err != nil {
		return fmt.Errorf("build insert fragment params: %w", err)
	}

	params.SyncStatus, err = knowledgeShared.SyncStatusToInt32(fragment.SyncStatus, "sync_status")
	if err != nil {
		return fmt.Errorf("invalid sync_status: %w", err)
	}

	res, err := queries.InsertFragment(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to insert fragment: %w", err)
	}

	insertedID, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get inserted fragment id: %w", err)
	}
	fragment.ID = insertedID
	return nil
}

func applyDocumentToFragment(fragment *fragmodel.KnowledgeBaseFragment, doc *docentity.KnowledgeBaseDocument) {
	if fragment == nil || doc == nil {
		return
	}

	fragment.DocumentCode = doc.Code
	fragment.DocumentName = doc.Name
	fragment.DocumentType = doc.DocType
	fragment.OrganizationCode = doc.OrganizationCode
	fragment.Metadata = fragmetadata.BuildFragmentSemanticMetadata(fragment.Metadata, fragmetadata.FragmentSemanticMetadataDefaults{
		ChunkIndex:   fragment.ChunkIndex,
		ContentHash:  fragment.ContentHash,
		SplitVersion: fragment.SplitVersion,
		SectionPath:  fragment.SectionPath,
		SectionTitle: fragment.SectionTitle,
		SectionLevel: fragment.SectionLevel,
		CreatedAtTS:  fragment.CreatedAt.Unix(),
		DocumentCode: doc.Code,
		DocumentType: doc.DocType,
	}, map[string]any{
		"organization_code": doc.OrganizationCode,
		"document_name":     doc.Name,
	})
}
