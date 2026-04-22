// Package rebuild 提供知识库向量重建的 MySQL 持久化实现。
package rebuild

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"

	"magic/internal/constants"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqljsoncompat "magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	rediscollectionmeta "magic/internal/infrastructure/persistence/redis/collectionmeta"
)

const (
	pendingSyncStatus        = 0
	listDocumentsBatchArgCap = 6
	scopeColumnNameCode      = "code"
)

var errInvalidRebuildScope = errors.New("invalid rebuild scope")

type scopeColumnQualifier uint8

const (
	scopeQualifierKnowledgeBaseRoot scopeColumnQualifier = iota
	scopeQualifierKnowledgeBaseAlias
	scopeQualifierDocumentRoot
	scopeQualifierDocumentAlias
)

type scopeColumn uint8

const (
	scopeColumnOrganizationCode scopeColumn = iota
	scopeColumnRootCode
	scopeColumnDocumentKnowledgeBaseCode
	scopeColumnDocumentCode
)

type collectionEmbeddingConfig struct {
	CollectionName         string `json:"collection_name"`
	PhysicalCollectionName string `json:"physical_collection_name"`
	VectorDimension        int64  `json:"vector_dimension"`
	SparseBackend          string `json:"sparse_backend"`
}

// MySQLStore 基于 MySQL 执行模型与文档批量更新。
type MySQLStore struct {
	db                  *sql.DB
	dbtx                mysqlsqlc.DBTX
	queries             *mysqlsqlc.Queries
	logger              *logging.SugaredLogger
	collectionMetaCache *rediscollectionmeta.Cache
}

// NewMySQLStore 创建基于 MySQL 的重建状态存储。
func NewMySQLStore(db *sql.DB) *MySQLStore {
	return NewMySQLStoreWithCollectionMetaCache(db, nil, nil)
}

// NewMySQLStoreWithCollectionMetaCache 创建带 CollectionMeta 缓存的重建状态存储。
func NewMySQLStoreWithCollectionMetaCache(
	db *sql.DB,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *MySQLStore {
	dbtx := mysqlsqlc.DBTX(db)
	return &MySQLStore{
		db:                  db,
		dbtx:                dbtx,
		queries:             mysqlsqlc.New(dbtx),
		logger:              logger,
		collectionMetaCache: rediscollectionmeta.NewCache(redisClient, logger),
	}
}

// NewMySQLStoreWithLogger 创建带 SQL 日志的重建状态存储。
func NewMySQLStoreWithLogger(db *sql.DB, logger *logging.SugaredLogger) *MySQLStore {
	return NewMySQLStoreWithLoggerAndCollectionMetaCache(db, nil, logger)
}

// NewMySQLStoreWithLoggerAndCollectionMetaCache 创建带日志与 CollectionMeta 缓存的重建状态存储。
func NewMySQLStoreWithLoggerAndCollectionMetaCache(
	db *sql.DB,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *MySQLStore {
	store := NewMySQLStoreWithCollectionMetaCache(db, redisClient, logger)
	if logger != nil {
		store.dbtx = mysqlclient.NewDBLogger(db, logger)
		store.queries = mysqlsqlc.New(store.dbtx)
	}
	return store
}

// ResetSyncStatus 将知识库和文档同步状态重置为待同步。
func (s *MySQLStore) ResetSyncStatus(ctx context.Context, scope domainrebuild.Scope) (domainrebuild.MigrationStats, error) {
	return s.runScopedMigration(
		ctx,
		scope,
		scopedMigrationSpec{
			kbBaseQuery: `UPDATE magic_flow_knowledge
SET sync_status = ?, sync_status_message = '', updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> ?`,
			docBaseQuery: `UPDATE knowledge_base_documents
SET sync_status = ?, sync_status_message = '', updated_at = NOW()
WHERE deleted_at IS NULL
  AND knowledge_base_code <> ?`,
			kbErrPrefix:  "update magic_flow_knowledge",
			docErrPrefix: "update knowledge_base_documents",
		},
		[]any{pendingSyncStatus, constants.KnowledgeBaseCollectionMetaCode},
	)
}

// UpdateModel 批量更新知识库与文档的 embedding 模型镜像字段。
func (s *MySQLStore) UpdateModel(ctx context.Context, scope domainrebuild.Scope, model string) (domainrebuild.MigrationStats, error) {
	return s.runScopedMigration(
		ctx,
		scope,
		scopedMigrationSpec{
			kbBaseQuery: `UPDATE magic_flow_knowledge
SET model = ?,
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', ?),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> ?`,
			docBaseQuery: `UPDATE knowledge_base_documents
SET embedding_model = ?,
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', ?),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND knowledge_base_code <> ?`,
			kbErrPrefix:  "update magic_flow_knowledge model",
			docErrPrefix: "update knowledge_base_documents model",
		},
		[]any{model, model, constants.KnowledgeBaseCollectionMetaCode},
	)
}

// GetCollectionMeta 读取集合元数据保留记录。
func (s *MySQLStore) GetCollectionMeta(ctx context.Context) (domainrebuild.CollectionMeta, error) {
	if meta, hit := s.readCollectionMetaCache(ctx); hit {
		return meta, nil
	}
	return s.queryCollectionMeta(ctx)
}

func (s *MySQLStore) readCollectionMetaCache(ctx context.Context) (domainrebuild.CollectionMeta, bool) {
	if s.collectionMetaCache == nil {
		return domainrebuild.CollectionMeta{}, false
	}
	meta, hit, err := s.collectionMetaCache.Get(ctx)
	if err != nil {
		s.collectionMetaCache.Warn(ctx, "Read collection meta cache failed, fallback to MySQL", err)
		return domainrebuild.CollectionMeta{}, false
	}
	return meta, hit
}

func (s *MySQLStore) queryCollectionMeta(ctx context.Context) (domainrebuild.CollectionMeta, error) {
	row, err := s.queries.FindKnowledgeBaseCollectionMeta(ctx, constants.KnowledgeBaseCollectionMetaCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			meta := domainrebuild.CollectionMeta{}
			s.writeCollectionMetaCache(ctx, meta, "Write collection meta negative cache failed")
			return meta, nil
		}
		return domainrebuild.CollectionMeta{}, fmt.Errorf("query collection meta: %w", err)
	}

	config, err := mysqljsoncompat.DecodeObjectPtr[collectionEmbeddingConfig](row.EmbeddingConfig, "embedding_config")
	if err != nil {
		return domainrebuild.CollectionMeta{}, fmt.Errorf("decode collection meta embedding_config: %w", err)
	}
	if config == nil {
		config = &collectionEmbeddingConfig{}
	}

	meta := domainrebuild.CollectionMeta{
		CollectionName:         strings.TrimSpace(config.CollectionName),
		PhysicalCollectionName: strings.TrimSpace(config.PhysicalCollectionName),
		Model:                  strings.TrimSpace(row.Model),
		VectorDimension:        config.VectorDimension,
		SparseBackend:          strings.TrimSpace(config.SparseBackend),
		Exists:                 true,
	}
	s.writeCollectionMetaCache(ctx, meta, "Write collection meta cache failed")
	return meta, nil
}

func (s *MySQLStore) writeCollectionMetaCache(
	ctx context.Context,
	meta domainrebuild.CollectionMeta,
	message string,
) {
	if s.collectionMetaCache == nil {
		return
	}
	if err := s.collectionMetaCache.Set(ctx, toSharedCollectionMeta(meta)); err != nil {
		s.collectionMetaCache.Warn(ctx, message, err)
	}
}

// UpsertCollectionMeta 写入集合元数据保留记录。
func (s *MySQLStore) UpsertCollectionMeta(ctx context.Context, meta domainrebuild.CollectionMeta) error {
	configJSON, err := json.Marshal(collectionEmbeddingConfig{
		CollectionName:         strings.TrimSpace(meta.CollectionName),
		PhysicalCollectionName: strings.TrimSpace(meta.PhysicalCollectionName),
		VectorDimension:        meta.VectorDimension,
		SparseBackend:          strings.TrimSpace(meta.SparseBackend),
	})
	if err != nil {
		return fmt.Errorf("marshal collection meta embedding_config: %w", err)
	}

	err = s.queries.UpsertKnowledgeBaseCollectionMeta(ctx, mysqlsqlc.UpsertKnowledgeBaseCollectionMetaParams{
		Code:             constants.KnowledgeBaseCollectionMetaCode,
		Name:             constants.KnowledgeBaseCollectionMetaName,
		Description:      constants.KnowledgeBaseCollectionMetaDescription,
		Model:            strings.TrimSpace(meta.Model),
		VectorDb:         constants.KnowledgeBaseCollectionMetaVectorDB,
		OrganizationCode: constants.KnowledgeBaseCollectionMetaOrganizationCode,
		EmbeddingConfig:  configJSON,
	})
	if err != nil {
		return fmt.Errorf("upsert collection meta: %w", err)
	}
	s.writeCollectionMetaCache(ctx, meta, "Refresh collection meta cache failed")
	return nil
}

func toSharedCollectionMeta(meta domainrebuild.CollectionMeta) sharedroute.CollectionMeta {
	return meta
}

// ListDocumentsBatch 按主键顺序批量读取待重建文档。
func (s *MySQLStore) ListDocumentsBatch(ctx context.Context, scope domainrebuild.Scope, afterID int64, batchSize int) ([]domainrebuild.DocumentTask, error) {
	scope, err := s.normalizeScope(scope)
	if err != nil {
		return nil, err
	}

	query := `SELECT d.id,
       d.organization_code,
       d.knowledge_base_code,
       d.code,
       COALESCE(NULLIF(d.updated_uid, ''), d.created_uid, '') AS user_id
FROM knowledge_base_documents d
INNER JOIN magic_flow_knowledge k
  ON k.code = d.knowledge_base_code
 AND k.deleted_at IS NULL
WHERE d.deleted_at IS NULL
  AND d.id > ?
  AND d.knowledge_base_code <> ''
  AND d.code <> ''
  AND k.code <> ?
`
	args := make([]any, 0, listDocumentsBatchArgCap)
	args = append(args, afterID, constants.KnowledgeBaseCollectionMetaCode)
	query, args = appendKnowledgeBaseScopeFilter(query, scope, scopeQualifierKnowledgeBaseAlias, args)
	query, args = appendDocumentScopeFilter(query, scope, scopeQualifierDocumentAlias, args)
	query += `
ORDER BY d.id ASC
LIMIT ?`
	args = append(args, batchSize)

	rows, err := s.dbtx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query documents batch: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	tasks := make([]domainrebuild.DocumentTask, 0, batchSize)
	for rows.Next() {
		var task domainrebuild.DocumentTask
		if scanErr := rows.Scan(&task.ID, &task.OrganizationCode, &task.KnowledgeBaseCode, &task.DocumentCode, &task.UserID); scanErr != nil {
			return nil, fmt.Errorf("scan document batch row: %w", scanErr)
		}
		tasks = append(tasks, task)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate document batch rows: %w", rowsErr)
	}
	return tasks, nil
}

func (s *MySQLStore) normalizeScope(scope domainrebuild.Scope) (domainrebuild.Scope, error) {
	scope = domainrebuild.NormalizeScope(scope)
	switch scope.Mode {
	case domainrebuild.ScopeModeAll:
		return scope, nil
	case domainrebuild.ScopeModeOrganization:
		if scope.OrganizationCode == "" {
			return domainrebuild.Scope{}, fmt.Errorf(
				"%w: mode=%s organization_code=%q",
				errInvalidRebuildScope,
				scope.Mode,
				scope.OrganizationCode,
			)
		}
		return scope, nil
	case domainrebuild.ScopeModeKnowledgeBase:
		if scope.OrganizationCode == "" || scope.KnowledgeBaseCode == "" {
			return domainrebuild.Scope{}, fmt.Errorf(
				"%w: mode=%s organization_code=%q knowledge_base_code=%q",
				errInvalidRebuildScope,
				scope.Mode,
				scope.OrganizationCode,
				scope.KnowledgeBaseCode,
			)
		}
		return scope, nil
	case domainrebuild.ScopeModeDocument:
		if scope.OrganizationCode == "" || scope.KnowledgeBaseCode == "" || scope.DocumentCode == "" {
			return domainrebuild.Scope{}, fmt.Errorf(
				"%w: mode=%s organization_code=%q knowledge_base_code=%q document_code=%q",
				errInvalidRebuildScope,
				scope.Mode,
				scope.OrganizationCode,
				scope.KnowledgeBaseCode,
				scope.DocumentCode,
			)
		}
		return scope, nil
	default:
		return domainrebuild.Scope{}, fmt.Errorf("%w: mode=%s", errInvalidRebuildScope, scope.Mode)
	}
}

type scopedMigrationSpec struct {
	kbBaseQuery  string
	docBaseQuery string
	kbErrPrefix  string
	docErrPrefix string
}

func (s *MySQLStore) runScopedMigration(
	ctx context.Context,
	scope domainrebuild.Scope,
	spec scopedMigrationSpec,
	args []any,
) (domainrebuild.MigrationStats, error) {
	scope, err := s.normalizeScope(scope)
	if err != nil {
		return domainrebuild.MigrationStats{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var txdbtx mysqlsqlc.DBTX = tx
	if s.logger != nil {
		txdbtx = mysqlclient.NewDBLogger(tx, s.logger)
	}

	kbQuery, kbArgs := buildKnowledgeBaseScopeUpdateQuery(spec.kbBaseQuery, scope, cloneArgs(args))
	kbRes, err := txdbtx.ExecContext(ctx, kbQuery, kbArgs...)
	if err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("%s: %w", spec.kbErrPrefix, err)
	}

	docQuery, docArgs := buildDocumentScopeUpdateQuery(spec.docBaseQuery, scope, cloneArgs(args))
	docRes, err := txdbtx.ExecContext(ctx, docQuery, docArgs...)
	if err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("%s: %w", spec.docErrPrefix, err)
	}

	if err := tx.Commit(); err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("commit tx: %w", err)
	}
	return migrationStatsFromResults(kbRes, docRes)
}

func cloneArgs(args []any) []any {
	return append([]any(nil), args...)
}

func migrationStatsFromResults(kbRes, docRes sql.Result) (domainrebuild.MigrationStats, error) {
	kbRows, err := kbRes.RowsAffected()
	if err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("knowledge base rows affected: %w", err)
	}
	docRows, err := docRes.RowsAffected()
	if err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("document rows affected: %w", err)
	}
	return domainrebuild.MigrationStats{
		KnowledgeBaseRows: kbRows,
		DocumentRows:      docRows,
	}, nil
}

func buildKnowledgeBaseScopeUpdateQuery(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return appendKnowledgeBaseScopeFilter(baseQuery, scope, scopeQualifierKnowledgeBaseRoot, args)
}

func buildDocumentScopeUpdateQuery(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return appendDocumentScopeFilter(baseQuery, scope, scopeQualifierDocumentRoot, args)
}

func appendKnowledgeBaseScopeFilter(
	baseQuery string,
	scope domainrebuild.Scope,
	qualifier scopeColumnQualifier,
	args []any,
) (string, []any) {
	if scope.Mode != domainrebuild.ScopeModeOrganization &&
		scope.Mode != domainrebuild.ScopeModeKnowledgeBase &&
		scope.Mode != domainrebuild.ScopeModeDocument {
		return baseQuery, args
	}

	var builder strings.Builder
	builder.WriteString(baseQuery)
	builder.WriteString("\n  AND ")
	builder.WriteString(qualifyScopeColumn(qualifier, scopeColumnOrganizationCode))
	builder.WriteString(" = ?")
	args = append(args, scope.OrganizationCode)
	if scope.Mode == domainrebuild.ScopeModeKnowledgeBase || scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(qualifyScopeColumn(qualifier, scopeColumnRootCode))
		builder.WriteString(" = ?")
		args = append(args, scope.KnowledgeBaseCode)
	}
	return builder.String(), args
}

func appendDocumentScopeFilter(
	baseQuery string,
	scope domainrebuild.Scope,
	qualifier scopeColumnQualifier,
	args []any,
) (string, []any) {
	if scope.Mode != domainrebuild.ScopeModeOrganization &&
		scope.Mode != domainrebuild.ScopeModeKnowledgeBase &&
		scope.Mode != domainrebuild.ScopeModeDocument {
		return baseQuery, args
	}

	var builder strings.Builder
	builder.WriteString(baseQuery)
	builder.WriteString("\n  AND ")
	builder.WriteString(qualifyScopeColumn(qualifier, scopeColumnOrganizationCode))
	builder.WriteString(" = ?")
	args = append(args, scope.OrganizationCode)
	if scope.Mode == domainrebuild.ScopeModeKnowledgeBase || scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(qualifyScopeColumn(qualifier, scopeColumnDocumentKnowledgeBaseCode))
		builder.WriteString(" = ?")
		args = append(args, scope.KnowledgeBaseCode)
	}
	if scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(qualifyScopeColumn(qualifier, scopeColumnDocumentCode))
		builder.WriteString(" = ?")
		args = append(args, scope.DocumentCode)
	}
	return builder.String(), args
}

func qualifyScopeColumn(qualifier scopeColumnQualifier, column scopeColumn) string {
	columnName := scopeColumnName(column)
	switch qualifier {
	case scopeQualifierKnowledgeBaseAlias:
		return "k." + columnName
	case scopeQualifierDocumentAlias:
		return "d." + columnName
	case scopeQualifierKnowledgeBaseRoot:
		return "magic_flow_knowledge." + columnName
	case scopeQualifierDocumentRoot:
		return columnName
	default:
		return columnName
	}
}

func scopeColumnName(column scopeColumn) string {
	switch column {
	case scopeColumnOrganizationCode:
		return "organization_code"
	case scopeColumnRootCode:
		return scopeColumnNameCode
	case scopeColumnDocumentKnowledgeBaseCode:
		return "knowledge_base_code"
	case scopeColumnDocumentCode:
		return scopeColumnNameCode
	default:
		return scopeColumnNameCode
	}
}
