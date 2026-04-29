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
	"magic/pkg/convert"
)

const (
	pendingSyncStatus                 = 0
	documentBatchCandidateMultiplier  = 4
	documentBatchCandidateMaxPageSize = 1000
)

var errInvalidRebuildScope = errors.New("invalid rebuild scope")

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
	return s.runScopedMigration(ctx, scope, func(queries *mysqlsqlc.Queries, normalized domainrebuild.Scope) (int64, int64, error) {
		return s.resetSyncStatusByScope(ctx, queries, normalized)
	})
}

// UpdateModel 批量更新知识库与文档的 embedding 模型镜像字段。
func (s *MySQLStore) UpdateModel(ctx context.Context, scope domainrebuild.Scope, model string) (domainrebuild.MigrationStats, error) {
	return s.runScopedMigration(ctx, scope, func(queries *mysqlsqlc.Queries, normalized domainrebuild.Scope) (int64, int64, error) {
		return s.updateModelByScope(ctx, queries, normalized, model)
	})
}

func (s *MySQLStore) resetSyncStatusByScope(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
) (int64, int64, error) {
	switch scope.Mode {
	case domainrebuild.ScopeModeAll:
		return s.resetSyncStatusAll(ctx, queries)
	case domainrebuild.ScopeModeOrganization:
		return s.resetSyncStatusByOrganization(ctx, queries, scope.OrganizationCode)
	case domainrebuild.ScopeModeKnowledgeBase:
		return s.resetSyncStatusByKnowledgeBase(ctx, queries, scope)
	case domainrebuild.ScopeModeDocument:
		return s.resetSyncStatusByDocument(ctx, queries, scope)
	default:
		return 0, 0, fmt.Errorf("%w: mode=%s", errInvalidRebuildScope, scope.Mode)
	}
}

func (s *MySQLStore) resetSyncStatusAll(ctx context.Context, queries *mysqlsqlc.Queries) (int64, int64, error) {
	kbRows, err := queries.ResetKnowledgeBaseSyncStatusAll(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge: %w", err)
	}
	docRows, err := queries.ResetDocumentSyncStatusAll(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) resetSyncStatusByOrganization(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	organizationCode string,
) (int64, int64, error) {
	kbRows, err := queries.ResetKnowledgeBaseSyncStatusByOrganization(ctx, organizationCode)
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge: %w", err)
	}
	docRows, err := queries.ResetDocumentSyncStatusByOrganization(ctx, organizationCode)
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) resetSyncStatusByKnowledgeBase(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
) (int64, int64, error) {
	kbRows, err := queries.ResetKnowledgeBaseSyncStatusByKnowledgeBase(ctx, mysqlsqlc.ResetKnowledgeBaseSyncStatusByKnowledgeBaseParams{
		OrganizationCode: scope.OrganizationCode,
		Code:             scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge: %w", err)
	}
	docRows, err := queries.ResetDocumentSyncStatusByKnowledgeBase(ctx, mysqlsqlc.ResetDocumentSyncStatusByKnowledgeBaseParams{
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) resetSyncStatusByDocument(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
) (int64, int64, error) {
	kbRows, err := queries.ResetKnowledgeBaseSyncStatusByKnowledgeBase(ctx, mysqlsqlc.ResetKnowledgeBaseSyncStatusByKnowledgeBaseParams{
		OrganizationCode: scope.OrganizationCode,
		Code:             scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge: %w", err)
	}
	docRows, err := queries.ResetDocumentSyncStatusByDocument(ctx, mysqlsqlc.ResetDocumentSyncStatusByDocumentParams{
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
		Code:              scope.DocumentCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) updateModelByScope(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
	model string,
) (int64, int64, error) {
	switch scope.Mode {
	case domainrebuild.ScopeModeAll:
		return s.updateModelAll(ctx, queries, model)
	case domainrebuild.ScopeModeOrganization:
		return s.updateModelByOrganization(ctx, queries, scope.OrganizationCode, model)
	case domainrebuild.ScopeModeKnowledgeBase:
		return s.updateModelByKnowledgeBase(ctx, queries, scope, model)
	case domainrebuild.ScopeModeDocument:
		return s.updateModelByDocument(ctx, queries, scope, model)
	default:
		return 0, 0, fmt.Errorf("%w: mode=%s", errInvalidRebuildScope, scope.Mode)
	}
}

func (s *MySQLStore) updateModelAll(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	model string,
) (int64, int64, error) {
	kbRows, err := queries.UpdateKnowledgeBaseModelAll(ctx, mysqlsqlc.UpdateKnowledgeBaseModelAllParams{
		Model: model,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge model: %w", err)
	}
	docRows, err := queries.UpdateDocumentModelAll(ctx, mysqlsqlc.UpdateDocumentModelAllParams{
		Model: model,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents model: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) updateModelByOrganization(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	organizationCode string,
	model string,
) (int64, int64, error) {
	kbRows, err := queries.UpdateKnowledgeBaseModelByOrganization(ctx, mysqlsqlc.UpdateKnowledgeBaseModelByOrganizationParams{
		Model:            model,
		OrganizationCode: organizationCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge model: %w", err)
	}
	docRows, err := queries.UpdateDocumentModelByOrganization(ctx, mysqlsqlc.UpdateDocumentModelByOrganizationParams{
		Model:            model,
		OrganizationCode: organizationCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents model: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) updateModelByKnowledgeBase(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
	model string,
) (int64, int64, error) {
	kbRows, err := queries.UpdateKnowledgeBaseModelByKnowledgeBase(ctx, mysqlsqlc.UpdateKnowledgeBaseModelByKnowledgeBaseParams{
		Model:            model,
		OrganizationCode: scope.OrganizationCode,
		Code:             scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge model: %w", err)
	}
	docRows, err := queries.UpdateDocumentModelByKnowledgeBase(ctx, mysqlsqlc.UpdateDocumentModelByKnowledgeBaseParams{
		Model:             model,
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents model: %w", err)
	}
	return kbRows, docRows, nil
}

func (s *MySQLStore) updateModelByDocument(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	scope domainrebuild.Scope,
	model string,
) (int64, int64, error) {
	kbRows, err := queries.UpdateKnowledgeBaseModelByKnowledgeBase(ctx, mysqlsqlc.UpdateKnowledgeBaseModelByKnowledgeBaseParams{
		Model:            model,
		OrganizationCode: scope.OrganizationCode,
		Code:             scope.KnowledgeBaseCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update magic_flow_knowledge model: %w", err)
	}
	docRows, err := queries.UpdateDocumentModelByDocument(ctx, mysqlsqlc.UpdateDocumentModelByDocumentParams{
		Model:             model,
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
		Code:              scope.DocumentCode,
	})
	if err != nil {
		return 0, 0, fmt.Errorf("update knowledge_base_documents model: %w", err)
	}
	return kbRows, docRows, nil
}

// GetCollectionMeta 读取集合元数据保留记录。
func (s *MySQLStore) GetCollectionMeta(ctx context.Context) (sharedroute.CollectionMeta, error) {
	if meta, hit := s.readCollectionMetaCache(ctx); hit {
		return meta, nil
	}
	return s.queryCollectionMeta(ctx)
}

func (s *MySQLStore) readCollectionMetaCache(ctx context.Context) (sharedroute.CollectionMeta, bool) {
	if s.collectionMetaCache == nil {
		return sharedroute.CollectionMeta{}, false
	}
	meta, hit, err := s.collectionMetaCache.Get(ctx)
	if err != nil {
		s.collectionMetaCache.Warn(ctx, "Read collection meta cache failed, fallback to MySQL", err)
		return sharedroute.CollectionMeta{}, false
	}
	return meta, hit
}

func (s *MySQLStore) queryCollectionMeta(ctx context.Context) (sharedroute.CollectionMeta, error) {
	row, err := s.queries.FindKnowledgeBaseCollectionMeta(ctx, constants.KnowledgeBaseCollectionMetaCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			meta := sharedroute.CollectionMeta{}
			s.writeCollectionMetaCache(ctx, meta, "Write collection meta negative cache failed")
			return meta, nil
		}
		return sharedroute.CollectionMeta{}, fmt.Errorf("query collection meta: %w", err)
	}

	config, err := mysqljsoncompat.DecodeObjectPtr[collectionEmbeddingConfig](row.EmbeddingConfig, "embedding_config")
	if err != nil {
		return sharedroute.CollectionMeta{}, fmt.Errorf("decode collection meta embedding_config: %w", err)
	}
	if config == nil {
		config = &collectionEmbeddingConfig{}
	}

	meta := sharedroute.CollectionMeta{
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
	meta sharedroute.CollectionMeta,
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
func (s *MySQLStore) UpsertCollectionMeta(ctx context.Context, meta sharedroute.CollectionMeta) error {
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

func toSharedCollectionMeta(meta sharedroute.CollectionMeta) sharedroute.CollectionMeta {
	return meta
}

// ListDocumentsBatch 按主键顺序批量读取待重建文档。
func (s *MySQLStore) ListDocumentsBatch(ctx context.Context, scope domainrebuild.Scope, afterID int64, batchSize int) ([]domainrebuild.DocumentTask, error) {
	scope, err := s.normalizeScope(scope)
	if err != nil {
		return nil, err
	}
	if batchSize <= 0 {
		return []domainrebuild.DocumentTask{}, nil
	}

	candidateLimit := min(
		max(batchSize*documentBatchCandidateMultiplier, batchSize),
		documentBatchCandidateMaxPageSize,
	)

	tasks := make([]domainrebuild.DocumentTask, 0, batchSize)
	nextAfterID := afterID
	for len(tasks) < batchSize {
		candidates, err := s.listDocumentBatchCandidates(ctx, scope, nextAfterID, candidateLimit)
		if err != nil {
			return nil, err
		}
		if len(candidates) == 0 {
			break
		}

		activeKnowledgeCodes, err := s.listActiveKnowledgeBaseCodes(ctx, scope, candidates)
		if err != nil {
			return nil, err
		}
		for _, candidate := range candidates {
			nextAfterID = candidate.ID
			if _, ok := activeKnowledgeCodes[candidate.KnowledgeBaseCode]; !ok {
				continue
			}
			tasks = append(tasks, candidate)
			if len(tasks) >= batchSize {
				break
			}
		}
		if len(candidates) < candidateLimit {
			break
		}
	}
	return tasks, nil
}

func (s *MySQLStore) listDocumentBatchCandidates(
	ctx context.Context,
	scope domainrebuild.Scope,
	afterID int64,
	limit int,
) ([]domainrebuild.DocumentTask, error) {
	limit32, err := convert.SafeIntToInt32(limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("invalid limit: %w", err)
	}

	switch scope.Mode {
	case domainrebuild.ScopeModeAll:
		rows, err := s.queries.ListRebuildDocumentsBatchAll(ctx, mysqlsqlc.ListRebuildDocumentsBatchAllParams{
			AfterID: afterID,
			Limit:   limit32,
		})
		if err != nil {
			return nil, fmt.Errorf("query document batch candidates: %w", err)
		}
		return mapRebuildDocumentTasksFromAllRows(rows), nil
	case domainrebuild.ScopeModeOrganization:
		rows, err := s.queries.ListRebuildDocumentsBatchByOrganization(ctx, mysqlsqlc.ListRebuildDocumentsBatchByOrganizationParams{
			AfterID:          afterID,
			OrganizationCode: scope.OrganizationCode,
			Limit:            limit32,
		})
		if err != nil {
			return nil, fmt.Errorf("query document batch candidates: %w", err)
		}
		return mapRebuildDocumentTasksFromOrganizationRows(rows), nil
	case domainrebuild.ScopeModeKnowledgeBase:
		rows, err := s.queries.ListRebuildDocumentsBatchByKnowledgeBase(ctx, mysqlsqlc.ListRebuildDocumentsBatchByKnowledgeBaseParams{
			AfterID:           afterID,
			OrganizationCode:  scope.OrganizationCode,
			KnowledgeBaseCode: scope.KnowledgeBaseCode,
			Limit:             limit32,
		})
		if err != nil {
			return nil, fmt.Errorf("query document batch candidates: %w", err)
		}
		return mapRebuildDocumentTasksFromKnowledgeBaseRows(rows), nil
	case domainrebuild.ScopeModeDocument:
		rows, err := s.queries.ListRebuildDocumentsBatchByDocument(ctx, mysqlsqlc.ListRebuildDocumentsBatchByDocumentParams{
			AfterID:           afterID,
			OrganizationCode:  scope.OrganizationCode,
			KnowledgeBaseCode: scope.KnowledgeBaseCode,
			Code:              scope.DocumentCode,
			Limit:             limit32,
		})
		if err != nil {
			return nil, fmt.Errorf("query document batch candidates: %w", err)
		}
		return mapRebuildDocumentTasksFromDocumentRows(rows), nil
	default:
		return nil, fmt.Errorf("%w: mode=%s", errInvalidRebuildScope, scope.Mode)
	}
}

func (s *MySQLStore) listActiveKnowledgeBaseCodes(
	ctx context.Context,
	scope domainrebuild.Scope,
	candidates []domainrebuild.DocumentTask,
) (map[string]struct{}, error) {
	knowledgeCodes := uniqueKnowledgeBaseCodes(candidates)
	if len(knowledgeCodes) == 0 {
		return map[string]struct{}{}, nil
	}

	var (
		rows []string
		err  error
	)
	switch scope.Mode {
	case domainrebuild.ScopeModeAll:
		rows, err = s.queries.ListActiveKnowledgeBaseCodesByCodes(ctx, knowledgeCodes)
	case domainrebuild.ScopeModeOrganization:
		rows, err = s.queries.ListActiveKnowledgeBaseCodesByOrganizationAndCodes(ctx, mysqlsqlc.ListActiveKnowledgeBaseCodesByOrganizationAndCodesParams{
			OrganizationCode: scope.OrganizationCode,
			Codes:            knowledgeCodes,
		})
	case domainrebuild.ScopeModeKnowledgeBase, domainrebuild.ScopeModeDocument:
		_, err = s.queries.FindKnowledgeBaseByCodeAndOrg(ctx, mysqlsqlc.FindKnowledgeBaseByCodeAndOrgParams{
			Code:             scope.KnowledgeBaseCode,
			OrganizationCode: scope.OrganizationCode,
		})
		if err == nil {
			rows = []string{scope.KnowledgeBaseCode}
		}
	default:
		return nil, fmt.Errorf("%w: mode=%s", errInvalidRebuildScope, scope.Mode)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]struct{}{}, nil
		}
		return nil, fmt.Errorf("query active knowledge base codes: %w", err)
	}

	result := make(map[string]struct{}, len(rows))
	for _, code := range rows {
		result[strings.TrimSpace(code)] = struct{}{}
	}
	return result, nil
}

func uniqueKnowledgeBaseCodes(candidates []domainrebuild.DocumentTask) []string {
	seen := make(map[string]struct{}, len(candidates))
	result := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		knowledgeCode := strings.TrimSpace(candidate.KnowledgeBaseCode)
		if knowledgeCode == "" {
			continue
		}
		if _, ok := seen[knowledgeCode]; ok {
			continue
		}
		seen[knowledgeCode] = struct{}{}
		result = append(result, knowledgeCode)
	}
	return result
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

func (s *MySQLStore) runScopedMigration(
	ctx context.Context,
	scope domainrebuild.Scope,
	run func(*mysqlsqlc.Queries, domainrebuild.Scope) (int64, int64, error),
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
	kbRows, docRows, err := run(mysqlsqlc.New(txdbtx), scope)
	if err != nil {
		return domainrebuild.MigrationStats{}, err
	}

	if err := tx.Commit(); err != nil {
		return domainrebuild.MigrationStats{}, fmt.Errorf("commit tx: %w", err)
	}
	return domainrebuild.MigrationStats{
		KnowledgeBaseRows: kbRows,
		DocumentRows:      docRows,
	}, nil
}

func buildKnowledgeBaseScopeUpdateQuery(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return appendKnowledgeBaseScopeFilter(baseQuery, scope, "magic_flow_knowledge.organization_code", "magic_flow_knowledge.code", args)
}

func buildDocumentScopeUpdateQuery(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return appendDocumentScopeFilter(baseQuery, scope, "organization_code", "knowledge_base_code", "code", args)
}

func appendKnowledgeBaseScopeFilter(
	baseQuery string,
	scope domainrebuild.Scope,
	orgColumn string,
	kbCodeColumn string,
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
	builder.WriteString(orgColumn)
	builder.WriteString(" = ?")
	args = append(args, scope.OrganizationCode)
	if scope.Mode == domainrebuild.ScopeModeKnowledgeBase || scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(kbCodeColumn)
		builder.WriteString(" = ?")
		args = append(args, scope.KnowledgeBaseCode)
	}
	return builder.String(), args
}

func appendDocumentScopeFilter(
	baseQuery string,
	scope domainrebuild.Scope,
	orgColumn string,
	kbCodeColumn string,
	docCodeColumn string,
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
	builder.WriteString(orgColumn)
	builder.WriteString(" = ?")
	args = append(args, scope.OrganizationCode)
	if scope.Mode == domainrebuild.ScopeModeKnowledgeBase || scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(kbCodeColumn)
		builder.WriteString(" = ?")
		args = append(args, scope.KnowledgeBaseCode)
	}
	if scope.Mode == domainrebuild.ScopeModeDocument {
		builder.WriteString("\n  AND ")
		builder.WriteString(docCodeColumn)
		builder.WriteString(" = ?")
		args = append(args, scope.DocumentCode)
	}
	return builder.String(), args
}

func mapRebuildDocumentTask(
	id int64,
	organizationCode string,
	knowledgeBaseCode string,
	documentCode string,
	updatedUID string,
	createdUID string,
) domainrebuild.DocumentTask {
	return domainrebuild.DocumentTask{
		ID:                id,
		OrganizationCode:  organizationCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		DocumentCode:      documentCode,
		UserID:            resolveRebuildDocumentTaskUserID(updatedUID, createdUID),
	}
}

func mapRebuildDocumentTasksFromAllRows(rows []mysqlsqlc.ListRebuildDocumentsBatchAllRow) []domainrebuild.DocumentTask {
	tasks := make([]domainrebuild.DocumentTask, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapRebuildDocumentTask(
			row.ID,
			row.OrganizationCode,
			row.KnowledgeBaseCode,
			row.Code,
			row.UpdatedUid,
			row.CreatedUid,
		))
	}
	return tasks
}

func mapRebuildDocumentTasksFromOrganizationRows(
	rows []mysqlsqlc.ListRebuildDocumentsBatchByOrganizationRow,
) []domainrebuild.DocumentTask {
	tasks := make([]domainrebuild.DocumentTask, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapRebuildDocumentTask(
			row.ID,
			row.OrganizationCode,
			row.KnowledgeBaseCode,
			row.Code,
			row.UpdatedUid,
			row.CreatedUid,
		))
	}
	return tasks
}

func mapRebuildDocumentTasksFromKnowledgeBaseRows(
	rows []mysqlsqlc.ListRebuildDocumentsBatchByKnowledgeBaseRow,
) []domainrebuild.DocumentTask {
	tasks := make([]domainrebuild.DocumentTask, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapRebuildDocumentTask(
			row.ID,
			row.OrganizationCode,
			row.KnowledgeBaseCode,
			row.Code,
			row.UpdatedUid,
			row.CreatedUid,
		))
	}
	return tasks
}

func mapRebuildDocumentTasksFromDocumentRows(
	rows []mysqlsqlc.ListRebuildDocumentsBatchByDocumentRow,
) []domainrebuild.DocumentTask {
	tasks := make([]domainrebuild.DocumentTask, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapRebuildDocumentTask(
			row.ID,
			row.OrganizationCode,
			row.KnowledgeBaseCode,
			row.Code,
			row.UpdatedUid,
			row.CreatedUid,
		))
	}
	return tasks
}

func resolveRebuildDocumentTaskUserID(updatedUID, createdUID string) string {
	if strings.TrimSpace(updatedUID) != "" {
		return updatedUID
	}
	return createdUID
}
