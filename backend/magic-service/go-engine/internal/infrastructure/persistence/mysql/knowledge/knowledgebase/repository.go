// Package knowledgebaserepo 提供知识库仓储的 MySQL 实现。
package knowledgebaserepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	rediscollectionmeta "magic/internal/infrastructure/persistence/redis/collectionmeta"
	"magic/pkg/convert"
)

// BaseRepository MySQL 知识库仓储实现
type BaseRepository struct {
	client              *mysqlclient.SQLCClient
	db                  mysqlsqlc.DBTX
	queries             *mysqlsqlc.Queries
	logger              *logging.SugaredLogger
	collectionMetaCache *rediscollectionmeta.Cache
}

// NewBaseRepository 创建知识库仓储
func NewBaseRepository(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *BaseRepository {
	return NewBaseRepositoryWithCollectionMetaCache(client, nil, logger)
}

// NewBaseRepositoryWithCollectionMetaCache 创建带 CollectionMeta 缓存的知识库仓储。
func NewBaseRepositoryWithCollectionMetaCache(
	client *mysqlclient.SQLCClient,
	redisClient *redis.Client,
	logger *logging.SugaredLogger,
) *BaseRepository {
	var dbtx mysqlsqlc.DBTX = client.DB()
	if logger != nil {
		dbtx = mysqlclient.NewDBLogger(client.DB(), logger)
	}
	return &BaseRepository{
		client:              client,
		db:                  dbtx,
		queries:             client.Q(),
		logger:              logger,
		collectionMetaCache: rediscollectionmeta.NewCache(redisClient, logger),
	}
}

func buildInsertKnowledgeBaseParams(knowledgeBase *knowledgebase.KnowledgeBase) (mysqlsqlc.InsertKnowledgeBaseParams, error) {
	retrieveConfigJSON, err := json.Marshal(knowledgeBase.RetrieveConfig)
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("failed to marshal retrieve config: %w", err)
	}
	fragmentConfigJSON, err := json.Marshal(knowledgeBase.FragmentConfig)
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("failed to marshal fragment config: %w", err)
	}
	embeddingConfigJSON, err := json.Marshal(knowledgeBase.EmbeddingConfig)
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("failed to marshal embedding config: %w", err)
	}

	version, err := convert.SafeIntToInt32(knowledgeBase.Version, "version")
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid version: %w", err)
	}
	kbType, err := convert.SafeIntToInt32(knowledgeBase.Type, "type")
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid type: %w", err)
	}
	expectedNum, err := convert.SafeIntToInt32(knowledgeBase.ExpectedNum, "expected_num")
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid expected_num: %w", err)
	}
	completedNum, err := convert.SafeIntToInt32(knowledgeBase.CompletedNum, "completed_num")
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid completed_num: %w", err)
	}
	syncStatus, err := knowledgeShared.SyncStatusToInt32(knowledgeBase.SyncStatus, "sync_status")
	if err != nil {
		return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid sync_status: %w", err)
	}

	sourceType := sql.NullInt32{}
	if knowledgeBase.SourceType != nil {
		sourceTypeInt32, convErr := convert.SafeIntToInt32(*knowledgeBase.SourceType, "source_type")
		if convErr != nil {
			return mysqlsqlc.InsertKnowledgeBaseParams{}, fmt.Errorf("invalid source_type: %w", convErr)
		}
		sourceType = sql.NullInt32{Int32: sourceTypeInt32, Valid: true}
	}
	knowledgeBaseType := string(knowledgebase.NormalizeKnowledgeBaseTypeOrDefault(knowledgeBase.KnowledgeBaseType))

	return mysqlsqlc.InsertKnowledgeBaseParams{
		Code:              knowledgeBase.Code,
		Version:           version,
		Name:              knowledgeBase.Name,
		Description:       knowledgeBase.Description,
		Type:              kbType,
		Enabled:           knowledgeBase.Enabled,
		BusinessID:        knowledgeBase.BusinessID,
		SyncStatus:        syncStatus,
		SyncStatusMessage: knowledgeBase.SyncStatusMessage,
		Model:             knowledgeBase.Model,
		VectorDb:          knowledgeBase.VectorDB,
		OrganizationCode:  knowledgeBase.OrganizationCode,
		CreatedUid:        knowledgeBase.CreatedUID,
		UpdatedUid:        knowledgeBase.UpdatedUID,
		ExpectedNum:       expectedNum,
		CompletedNum:      completedNum,
		RetrieveConfig:    retrieveConfigJSON,
		FragmentConfig:    fragmentConfigJSON,
		EmbeddingConfig:   embeddingConfigJSON,
		WordCount:         int64(knowledgeBase.WordCount),
		Icon:              knowledgeBase.Icon,
		SourceType:        sourceType,
		KnowledgeBaseType: knowledgeBaseType,
		CreatedAt:         knowledgeBase.CreatedAt,
		UpdatedAt:         knowledgeBase.UpdatedAt,
	}, nil
}

// Save 保存知识库
func (repo *BaseRepository) Save(ctx context.Context, knowledgeBase *knowledgebase.KnowledgeBase) error {
	return repo.save(ctx, repo.queries, knowledgeBase)
}

// SaveWithTx 在给定事务中保存知识库。
func (repo *BaseRepository) SaveWithTx(ctx context.Context, tx *sql.Tx, knowledgeBase *knowledgebase.KnowledgeBase) error {
	if tx == nil || repo == nil || repo.client == nil {
		return repo.Save(ctx, knowledgeBase)
	}
	return repo.save(ctx, repo.client.WithTx(tx), knowledgeBase)
}

func (repo *BaseRepository) save(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	knowledgeBase *knowledgebase.KnowledgeBase,
) error {
	now := time.Now()
	knowledgeBase.CreatedAt = now
	knowledgeBase.UpdatedAt = now

	params, err := buildInsertKnowledgeBaseParams(knowledgeBase)
	if err != nil {
		return err
	}

	res, err := queries.InsertKnowledgeBase(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to insert knowledge base: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	knowledgeBase.ID = id
	return nil
}

// Update 更新知识库
func (repo *BaseRepository) Update(ctx context.Context, knowledgeBase *knowledgebase.KnowledgeBase) error {
	return repo.update(ctx, repo.queries, knowledgeBase)
}

// UpdateWithTx 在给定事务中更新知识库。
func (repo *BaseRepository) UpdateWithTx(ctx context.Context, tx *sql.Tx, knowledgeBase *knowledgebase.KnowledgeBase) error {
	if tx == nil || repo == nil || repo.client == nil {
		return repo.Update(ctx, knowledgeBase)
	}
	return repo.update(ctx, repo.client.WithTx(tx), knowledgeBase)
}

func (repo *BaseRepository) update(
	ctx context.Context,
	queries *mysqlsqlc.Queries,
	knowledgeBase *knowledgebase.KnowledgeBase,
) error {
	knowledgeBase.UpdatedAt = time.Now()

	retrieveConfigJSON, err := json.Marshal(knowledgeBase.RetrieveConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal retrieve config: %w", err)
	}
	fragmentConfigJSON, err := json.Marshal(knowledgeBase.FragmentConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal fragment config: %w", err)
	}
	embeddingConfigJSON, err := json.Marshal(knowledgeBase.EmbeddingConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal embedding config: %w", err)
	}
	sourceType := sql.NullInt32{}
	if knowledgeBase.SourceType != nil {
		sourceTypeInt32, convErr := convert.SafeIntToInt32(*knowledgeBase.SourceType, "source_type")
		if convErr != nil {
			return fmt.Errorf("invalid source_type: %w", convErr)
		}
		sourceType = sql.NullInt32{Int32: sourceTypeInt32, Valid: true}
	}
	knowledgeBaseType := string(knowledgebase.NormalizeKnowledgeBaseTypeOrDefault(knowledgeBase.KnowledgeBaseType))

	_, err = queries.UpdateKnowledgeBase(ctx, mysqlsqlc.UpdateKnowledgeBaseParams{
		Name:              knowledgeBase.Name,
		Description:       knowledgeBase.Description,
		Enabled:           knowledgeBase.Enabled,
		UpdatedUid:        knowledgeBase.UpdatedUID,
		SourceType:        sourceType,
		KnowledgeBaseType: knowledgeBaseType,
		RetrieveConfig:    retrieveConfigJSON,
		FragmentConfig:    fragmentConfigJSON,
		EmbeddingConfig:   embeddingConfigJSON,
		WordCount:         int64(knowledgeBase.WordCount),
		Icon:              knowledgeBase.Icon,
		UpdatedAt:         knowledgeBase.UpdatedAt,
		ID:                knowledgeBase.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to update knowledge base: %w", err)
	}

	return nil
}

// FindByID 根据 ID 查询知识库
func (repo *BaseRepository) FindByID(ctx context.Context, id int64) (*knowledgebase.KnowledgeBase, error) {
	row, err := repo.queries.FindKnowledgeBaseByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrKnowledgeBaseNotFound
		}
		return nil, fmt.Errorf("failed to find knowledge base by id: %w", err)
	}
	return toKnowledgeBaseFromFindByID(row)
}

// FindByCode 根据 Code 查询知识库
func (repo *BaseRepository) FindByCode(ctx context.Context, code string) (*knowledgebase.KnowledgeBase, error) {
	row, err := repo.queries.FindKnowledgeBaseByCode(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrKnowledgeBaseNotFound
		}
		return nil, fmt.Errorf("failed to find knowledge base by code: %w", err)
	}
	return toKnowledgeBaseFromFindByCode(row)
}

// FindByCodeAndOrg 根据 Code 和组织查询知识库
func (repo *BaseRepository) FindByCodeAndOrg(ctx context.Context, code, orgCode string) (*knowledgebase.KnowledgeBase, error) {
	row, err := repo.queries.FindKnowledgeBaseByCodeAndOrg(ctx, mysqlsqlc.FindKnowledgeBaseByCodeAndOrgParams{
		Code:             code,
		OrganizationCode: orgCode,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, shared.ErrKnowledgeBaseNotFound
		}
		return nil, fmt.Errorf("failed to find knowledge base by code and org: %w", err)
	}
	return toKnowledgeBaseFromFindByCodeAndOrg(row)
}

// Delete 删除知识库
func (repo *BaseRepository) Delete(ctx context.Context, id int64) error {
	_, err := repo.queries.DeleteKnowledgeBaseByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete knowledge base: %w", err)
	}
	return nil
}

// UpdateSyncStatus 更新同步状态
func (repo *BaseRepository) UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error {
	syncStatus, err := knowledgeShared.SyncStatusToInt32(status, "sync_status")
	if err != nil {
		return fmt.Errorf("invalid sync_status: %w", err)
	}
	_, err = repo.queries.UpdateKnowledgeBaseSyncStatus(ctx, mysqlsqlc.UpdateKnowledgeBaseSyncStatusParams{
		SyncStatus:        syncStatus,
		SyncStatusMessage: message,
		UpdatedAt:         time.Now(),
		ID:                id,
	})
	if err != nil {
		return fmt.Errorf("failed to update sync status: %w", err)
	}
	return nil
}

// UpdateProgress 更新同步进度
func (repo *BaseRepository) UpdateProgress(ctx context.Context, id int64, expectedNum, completedNum int) error {
	expectedNum32, err := convert.SafeIntToInt32(expectedNum, "expected_num")
	if err != nil {
		return fmt.Errorf("invalid expected_num: %w", err)
	}
	completedNum32, err := convert.SafeIntToInt32(completedNum, "completed_num")
	if err != nil {
		return fmt.Errorf("invalid completed_num: %w", err)
	}

	_, err = repo.queries.UpdateKnowledgeBaseProgress(ctx, mysqlsqlc.UpdateKnowledgeBaseProgressParams{
		ExpectedNum:  expectedNum32,
		CompletedNum: completedNum32,
		UpdatedAt:    time.Now(),
		ID:           id,
	})
	if err != nil {
		return fmt.Errorf("failed to update progress: %w", err)
	}
	return nil
}
