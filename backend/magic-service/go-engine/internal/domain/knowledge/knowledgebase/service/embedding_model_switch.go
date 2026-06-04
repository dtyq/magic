package knowledgebase

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

// SwitchEmbeddingModelMeta 直接切换共享知识库 collection 元数据，不触发 rebuild。
func (s *DomainService) SwitchEmbeddingModelMeta(
	ctx context.Context,
	targetModel string,
	targetDimension int64,
) (sharedroute.CollectionMeta, error) {
	targetModel = strings.TrimSpace(targetModel)
	if targetModel == "" {
		return sharedroute.CollectionMeta{}, sharedroute.ErrCollectionMetaModelRequired
	}
	if targetDimension <= 0 {
		return sharedroute.CollectionMeta{}, fmt.Errorf("%w: %d", ErrInvalidEmbeddingDimension, targetDimension)
	}

	previousAliasTarget, previousAliasExists, err := s.vectorRepo.GetAliasTarget(ctx, constants.KnowledgeBaseCollectionName)
	if err != nil {
		return sharedroute.CollectionMeta{}, fmt.Errorf("get current knowledge collection alias: %w", err)
	}

	physicalCollectionName := stableEmbeddingModelPhysicalCollectionName(targetModel, targetDimension)
	if err := s.prepareEmbeddingModelCollection(ctx, physicalCollectionName, targetDimension); err != nil {
		return sharedroute.CollectionMeta{}, err
	}
	aliasChanged, err := s.ensureEmbeddingModelAlias(
		ctx,
		constants.KnowledgeBaseCollectionName,
		physicalCollectionName,
		previousAliasTarget,
		previousAliasExists,
	)
	if err != nil {
		return sharedroute.CollectionMeta{}, fmt.Errorf("ensure knowledge collection alias: %w", err)
	}

	meta := sharedroute.CollectionMeta{
		CollectionName:         constants.KnowledgeBaseCollectionName,
		PhysicalCollectionName: physicalCollectionName,
		Model:                  targetModel,
		VectorDimension:        targetDimension,
		SparseBackend:          s.currentTargetSparseBackend(),
	}
	if s.collectionMetaManager == nil {
		return sharedroute.CollectionMeta{}, sharedroute.ErrCollectionMetaWriterNotConfigured
	}
	if err := s.collectionMetaManager.Upsert(ctx, meta); err != nil {
		if aliasChanged {
			s.rollbackEmbeddingModelAlias(ctx, previousAliasTarget, previousAliasExists, physicalCollectionName)
		}
		return sharedroute.CollectionMeta{}, fmt.Errorf("switch collection meta: %w", err)
	}
	meta.Exists = true
	return meta, nil
}

func stableEmbeddingModelPhysicalCollectionName(model string, dimension int64) string {
	hashInput := strings.TrimSpace(model) + "|" + strconv.FormatInt(dimension, 10)
	sum := sha256.Sum256([]byte(hashInput))
	return fmt.Sprintf("%s_model_%x", constants.KnowledgeBaseCollectionName, sum[:8])
}

func (s *DomainService) prepareEmbeddingModelCollection(ctx context.Context, collectionName string, dimension int64) error {
	exists, err := s.vectorRepo.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("check embedding model collection existence: %w", err)
	}
	if !exists {
		return s.createEmbeddingModelCollection(ctx, collectionName, dimension)
	}

	info, err := s.vectorRepo.GetCollectionInfo(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("get embedding model collection info: %w", err)
	}
	if !embeddingModelCollectionSchemaMatches(info, dimension) {
		if err := s.vectorRepo.DeleteCollection(ctx, collectionName); err != nil {
			return fmt.Errorf("delete mismatched embedding model collection: %w", err)
		}
		return s.createEmbeddingModelCollection(ctx, collectionName, dimension)
	}
	if err := s.vectorRepo.EnsurePayloadIndexes(ctx, collectionName, ExpectedPayloadIndexSpecs()); err != nil {
		return fmt.Errorf("ensure payload indexes for %s: %w", collectionName, err)
	}
	return nil
}

func (s *DomainService) ensureEmbeddingModelAlias(
	ctx context.Context,
	alias string,
	target string,
	currentTarget string,
	aliasExists bool,
) (bool, error) {
	alias = strings.TrimSpace(alias)
	target = strings.TrimSpace(target)
	currentTarget = strings.TrimSpace(currentTarget)
	if alias == "" || target == "" || alias == target {
		return false, nil
	}
	if aliasExists && currentTarget == target {
		return false, nil
	}

	if !aliasExists {
		legacyCollectionExists, err := s.vectorRepo.CollectionExists(ctx, alias)
		if err != nil {
			return false, fmt.Errorf("check legacy logical collection %s: %w", alias, err)
		}
		if legacyCollectionExists {
			if s.logger != nil {
				s.logger.KnowledgeWarnContext(
					ctx,
					"Skipped knowledge collection alias switch because a legacy collection occupies the alias name",
					"alias", alias,
					"target_collection", target,
				)
			}
			return false, nil
		}
	}

	if err := s.vectorRepo.EnsureAlias(ctx, alias, target); err != nil {
		return false, fmt.Errorf("switch alias %s to %s: %w", alias, target, err)
	}
	return true, nil
}

func (s *DomainService) createEmbeddingModelCollection(ctx context.Context, collectionName string, dimension int64) error {
	if err := s.vectorRepo.CreateCollection(ctx, collectionName, dimension); err != nil {
		return fmt.Errorf("create embedding model collection: %w", err)
	}
	if err := s.vectorRepo.EnsurePayloadIndexes(ctx, collectionName, ExpectedPayloadIndexSpecs()); err != nil {
		return fmt.Errorf("ensure payload indexes for %s: %w", collectionName, err)
	}
	if s.logger != nil {
		s.logger.InfoContext(ctx, "Created embedding model collection", "collection", collectionName, "dimension", dimension)
	}
	return nil
}

func (s *DomainService) rollbackEmbeddingModelAlias(
	ctx context.Context,
	previousTarget string,
	previousExists bool,
	switchedTarget string,
) {
	alias := constants.KnowledgeBaseCollectionName
	switchedTarget = strings.TrimSpace(switchedTarget)
	previousTarget = strings.TrimSpace(previousTarget)
	if switchedTarget == "" || (previousExists && previousTarget == switchedTarget) {
		return
	}

	var err error
	if previousExists && previousTarget != "" {
		err = s.vectorRepo.SwapAliasAtomically(ctx, alias, switchedTarget, previousTarget)
	} else {
		err = s.vectorRepo.DeleteAlias(ctx, alias)
	}
	if err != nil && s.logger != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"Failed to rollback embedding model collection alias after meta switch failure",
			"alias", alias,
			"previous_target", previousTarget,
			"switched_target", switchedTarget,
			"error", err,
		)
	}
}

func embeddingModelCollectionSchemaMatches(info *shared.VectorCollectionInfo, dimension int64) bool {
	return info != nil &&
		info.VectorSize == dimension &&
		info.HasNamedDenseVector &&
		info.HasSparseVector
}
