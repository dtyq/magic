package knowledgebaserepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"magic/internal/constants"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	mysqljsoncompat "magic/internal/infrastructure/persistence/mysql/jsoncompat"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
)

type collectionEmbeddingConfig struct {
	CollectionName         string `json:"collection_name"`
	PhysicalCollectionName string `json:"physical_collection_name"`
	VectorDimension        int64  `json:"vector_dimension"`
	SparseBackend          string `json:"sparse_backend"`
}

var errKnowledgeBaseRepositoryDBNil = errors.New("knowledge base repository db is nil")

// GetCollectionMeta 读取集合级元数据保留记录。
func (repo *BaseRepository) GetCollectionMeta(ctx context.Context) (sharedroute.CollectionMeta, error) {
	if repo.db == nil {
		return sharedroute.CollectionMeta{}, errKnowledgeBaseRepositoryDBNil
	}
	if meta, hit := repo.readCollectionMetaCache(ctx); hit {
		return meta, nil
	}
	return repo.queryCollectionMeta(ctx)
}

func (repo *BaseRepository) readCollectionMetaCache(ctx context.Context) (sharedroute.CollectionMeta, bool) {
	if repo.collectionMetaCache == nil {
		return sharedroute.CollectionMeta{}, false
	}
	meta, hit, err := repo.collectionMetaCache.Get(ctx)
	if err != nil {
		repo.collectionMetaCache.Warn(ctx, "Read collection meta cache failed, fallback to MySQL", err)
		return sharedroute.CollectionMeta{}, false
	}
	return meta, hit
}

func (repo *BaseRepository) queryCollectionMeta(ctx context.Context) (sharedroute.CollectionMeta, error) {
	row, err := repo.queries.FindKnowledgeBaseCollectionMeta(ctx, constants.KnowledgeBaseCollectionMetaCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			meta := sharedroute.CollectionMeta{}
			repo.writeCollectionMetaCache(ctx, meta, "Write collection meta negative cache failed")
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
	repo.writeCollectionMetaCache(ctx, meta, "Write collection meta cache failed")
	return meta, nil
}

func (repo *BaseRepository) writeCollectionMetaCache(
	ctx context.Context,
	meta sharedroute.CollectionMeta,
	message string,
) {
	if repo.collectionMetaCache == nil {
		return
	}
	if err := repo.collectionMetaCache.Set(ctx, meta); err != nil {
		repo.collectionMetaCache.Warn(ctx, message, err)
	}
}

// UpsertCollectionMeta 写入集合级元数据保留记录。
func (repo *BaseRepository) UpsertCollectionMeta(ctx context.Context, meta sharedroute.CollectionMeta) error {
	if repo.db == nil {
		return errKnowledgeBaseRepositoryDBNil
	}

	configJSON, err := json.Marshal(collectionEmbeddingConfig{
		CollectionName:         strings.TrimSpace(meta.CollectionName),
		PhysicalCollectionName: strings.TrimSpace(meta.PhysicalCollectionName),
		VectorDimension:        meta.VectorDimension,
		SparseBackend:          strings.TrimSpace(meta.SparseBackend),
	})
	if err != nil {
		return fmt.Errorf("marshal collection meta embedding_config: %w", err)
	}

	err = repo.queries.UpsertKnowledgeBaseCollectionMeta(ctx, mysqlsqlc.UpsertKnowledgeBaseCollectionMetaParams{
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
	repo.writeCollectionMetaCache(ctx, meta, "Refresh collection meta cache failed")
	return nil
}
