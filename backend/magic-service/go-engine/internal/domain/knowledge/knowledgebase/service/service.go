// Package knowledgebase 提供知识库领域服务。
package knowledgebase

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

var (
	// ErrResolverNotConfigured 表示维度解析器未配置。
	ErrResolverNotConfigured = errors.New("embedding dimension resolver is not configured")
	// ErrInvalidEmbeddingDimension 表示 embedding 维度无效。
	ErrInvalidEmbeddingDimension = errors.New("invalid embedding dimension")
	// ErrVectorSizeMismatch 表示向量维度与预期不匹配。
	ErrVectorSizeMismatch = errors.New("vector size mismatch")
	// ErrCollectionAliasTargetEmpty 表示共享 collection alias 未指向物理 collection。
	ErrCollectionAliasTargetEmpty = errors.New("collection alias target is empty")
)

// DomainService 知识库领域服务。
type DomainService struct {
	repo                  Repository
	vectorRepo            shared.VectorDBManagementRepository
	sparseBackendSelector shared.SparseBackendSelector
	dimensionResolver     DimensionResolver
	collectionMetaManager *sharedroute.CollectionMetaManager
	defaultEmbeddingModel string
	targetSparseBackend   string
	logger                *logging.SugaredLogger
}

// DimensionResolver 定义知识库领域依赖的 embedding 维度解析能力。
type DimensionResolver interface {
	ResolveDimension(ctx context.Context, model string) (int64, error)
}

// NewDomainService 创建知识库领域服务。
func NewDomainService(
	repo Repository,
	vectorRepo shared.VectorDBManagementRepository,
	dimensionResolver DimensionResolver,
	defaultEmbeddingModel string,
	targetSparseBackend string,
	logger *logging.SugaredLogger,
) *DomainService {
	metaReader, _ := any(repo).(CollectionMetaReader)
	metaWriter, _ := any(repo).(CollectionMetaWriter)
	sparseBackendSelector, _ := any(vectorRepo).(shared.SparseBackendSelector)
	targetSparseBackend = shared.NormalizeSparseBackend(targetSparseBackend)

	return &DomainService{
		repo:                  repo,
		vectorRepo:            vectorRepo,
		sparseBackendSelector: sparseBackendSelector,
		dimensionResolver:     dimensionResolver,
		collectionMetaManager: sharedroute.NewCollectionMetaManager(metaReader, metaWriter),
		defaultEmbeddingModel: defaultEmbeddingModel,
		targetSparseBackend:   targetSparseBackend,
		logger:                logger,
	}
}

func (s *DomainService) currentTargetSparseBackend() string {
	selection := shared.ResolveSparseBackendSelection(s.sparseBackendSelector, s.targetSparseBackend)
	if selection.Effective != "" {
		return selection.Effective
	}
	return shared.SparseBackendQdrantBM25ZHV1
}

// Save 保存知识库
func (s *DomainService) Save(ctx context.Context, kb *KnowledgeBase) error {
	NormalizeKnowledgeBaseConfigs(kb)
	if err := s.PrepareForSave(ctx, kb); err != nil {
		return err
	}

	// 1. 保存到数据库
	if err := s.repo.Save(ctx, kb); err != nil {
		return fmt.Errorf("failed to save knowledge base: %w", err)
	}

	s.logger.InfoContext(ctx, "Knowledge base saved", "code", kb.Code, "name", kb.Name)
	return nil
}

// PrepareForSave 在持久化前准备知识库运行时资源。
func (s *DomainService) PrepareForSave(ctx context.Context, kb *KnowledgeBase) error {
	NormalizeKnowledgeBaseConfigs(kb)
	// 知识库建库只依赖完整运行时路由，避免调用方在逻辑名、物理名和 override 之间各自做判断。
	route := s.resolveRuntimeRoute(ctx, kb)
	if kb != nil {
		kb.ApplyResolvedRoute(route)
	}
	if route.Model != "" {
		vectorSize, err := s.resolveRouteVectorDimension(ctx, route)
		if err != nil {
			return err
		}
		physicalCollectionName, err := s.ensureCollection(ctx, route.VectorCollectionName, vectorSize)
		if err != nil {
			return err
		}
		if err := s.ensureCollectionMetaInitialized(ctx, route.LogicalCollectionName, physicalCollectionName, route.Model, vectorSize); err != nil {
			return err
		}
	}
	return nil
}

// Update 更新知识库
func (s *DomainService) Update(ctx context.Context, kb *KnowledgeBase) error {
	NormalizeKnowledgeBaseConfigs(kb)
	if err := s.repo.Update(ctx, kb); err != nil {
		return fmt.Errorf("failed to update knowledge base: %w", err)
	}

	s.logger.InfoContext(ctx, "Knowledge base updated", "code", kb.Code)
	return nil
}

// Show 查询知识库详情
func (s *DomainService) Show(ctx context.Context, code string) (*KnowledgeBase, error) {
	kb, err := s.repo.FindByCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	return NormalizeKnowledgeBaseConfigs(kb), nil
}

// ShowByCodeAndOrg 根据 Code 和组织查询知识库
func (s *DomainService) ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*KnowledgeBase, error) {
	kb, err := s.repo.FindByCodeAndOrg(ctx, code, orgCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	return NormalizeKnowledgeBaseConfigs(kb), nil
}

// List 分页查询知识库
func (s *DomainService) List(ctx context.Context, query *Query) ([]*KnowledgeBase, int64, error) {
	kbs, total, err := s.repo.List(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list knowledge bases: %w", err)
	}
	for _, kb := range kbs {
		NormalizeKnowledgeBaseConfigs(kb)
	}
	return kbs, total, nil
}

// Destroy 删除知识库
func (s *DomainService) Destroy(ctx context.Context, kb *KnowledgeBase) error {
	if err := s.DeleteVectorData(ctx, kb); err != nil {
		return err
	}
	// 删除数据库记录。
	if err := s.repo.Delete(ctx, kb.ID); err != nil {
		return fmt.Errorf("failed to delete knowledge base: %w", err)
	}

	s.logger.InfoContext(ctx, "Knowledge base destroyed", "code", kb.Code)
	return nil
}

// DeleteVectorData 删除知识库在向量库中的数据。
func (s *DomainService) DeleteVectorData(ctx context.Context, kb *KnowledgeBase) error {
	if kb == nil {
		return nil
	}

	// 1. 删除向量库中的知识库数据（共享集合不删除 collection），删除目标始终由统一路由决定。
	route := s.ResolveRuntimeRoute(ctx, kb)
	kbCode := kb.Code
	filter := &shared.VectorFilter{
		Must: []shared.FieldFilter{
			{
				Key: constants.KnowledgeCodeField,
				Match: shared.Match{
					EqString: &kbCode,
				},
			},
		},
	}
	if kb.OrganizationCode != "" {
		orgCode := kb.OrganizationCode
		filter.Must = append(filter.Must, shared.FieldFilter{
			Key: constants.OrganizationCodeField,
			Match: shared.Match{
				EqString: &orgCode,
			},
		})
	}
	if err := s.vectorRepo.DeletePointsByFilter(ctx, route.VectorCollectionName, filter); err != nil {
		return fmt.Errorf("failed to delete vector points: %w", err)
	}
	return nil
}

// EnsureCollectionExists 确保向量集合存在
func (s *DomainService) EnsureCollectionExists(ctx context.Context, kb *KnowledgeBase) error {
	// Ensure 只对运行时真正写入的向量集合生效，不能再由上层自行挑 collection 字段。
	route := s.resolveRuntimeRoute(ctx, kb)
	if route.Model == "" {
		return nil
	}
	vectorSize, err := s.resolveRouteVectorDimension(ctx, route)
	if err != nil {
		return err
	}
	_, err = s.ensureCollection(ctx, route.VectorCollectionName, vectorSize)
	return err
}

// ResolveRuntimeRoute 解析当前执行真正应该命中的完整运行时路由。
func (s *DomainService) ResolveRuntimeRoute(ctx context.Context, kb *KnowledgeBase) sharedroute.ResolvedRoute {
	return s.resolveRuntimeRoute(ctx, kb)
}

func (s *DomainService) resolveRuntimeRoute(ctx context.Context, kb *KnowledgeBase) sharedroute.ResolvedRoute {
	if route, ok := resolvedRouteFromKnowledgeBase(kb); ok {
		selection := shared.ResolveSparseBackendSelection(s.sparseBackendSelector, route.SparseBackend)
		if selection.Effective != "" {
			route.SparseBackend = selection.Effective
		}
		return route
	}

	fallbackCollection := constants.KnowledgeBaseCollectionName
	if kb != nil {
		fallbackCollection = kb.CollectionName()
	}
	route := sharedroute.ResolveRuntimeRoute(ctx, s.metaReader(), s.logger, fallbackCollection, s.defaultEmbeddingModel)
	selection := shared.ResolveSparseBackendSelection(s.sparseBackendSelector, route.SparseBackend)
	if selection.Effective != "" {
		route.SparseBackend = selection.Effective
	}
	meta, ok, err := s.loadCurrentActiveCollectionMeta(ctx, route)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(ctx, "Failed to load current active collection meta for runtime route", "error", err)
		}
		return route
	}
	if !ok {
		return route
	}

	if model := strings.TrimSpace(meta.Model); model != "" {
		route.Model = model
	}
	if physical := strings.TrimSpace(meta.PhysicalCollectionName); physical != "" {
		route.PhysicalCollectionName = physical
		route.VectorCollectionName = physical
		route.TermCollectionName = physical
	}
	return route
}

func resolvedRouteFromKnowledgeBase(kb *KnowledgeBase) (sharedroute.ResolvedRoute, bool) {
	if kb == nil || kb.ResolvedRoute == nil {
		return sharedroute.ResolvedRoute{}, false
	}
	route := *kb.ResolvedRoute
	if route.VectorCollectionName == "" || route.Model == "" {
		return sharedroute.ResolvedRoute{}, false
	}
	return route, true
}

func (s *DomainService) metaReader() CollectionMetaReader {
	reader, ok := any(s.repo).(CollectionMetaReader)
	if !ok {
		return nil
	}
	return reader
}

func (s *DomainService) resolveVectorDimension(ctx context.Context, model string) (int64, error) {
	if s.dimensionResolver == nil {
		return 0, ErrResolverNotConfigured
	}
	dim, err := s.dimensionResolver.ResolveDimension(ctx, model)
	if err != nil {
		return 0, fmt.Errorf("failed to resolve embedding dimension: %w", err)
	}
	if dim <= 0 {
		return 0, fmt.Errorf("%w: %d", ErrInvalidEmbeddingDimension, dim)
	}
	return dim, nil
}

func (s *DomainService) resolveRouteVectorDimension(
	ctx context.Context,
	route sharedroute.ResolvedRoute,
) (int64, error) {
	meta, ok, err := s.loadCurrentActiveCollectionMeta(ctx, route)
	if err != nil {
		return 0, err
	}
	if ok && strings.TrimSpace(meta.Model) == strings.TrimSpace(route.Model) && meta.VectorDimension > 0 {
		return meta.VectorDimension, nil
	}
	return s.resolveVectorDimension(ctx, route.Model)
}

func (s *DomainService) ensureCollection(ctx context.Context, collectionName string, vectorSize int64) (string, error) {
	resolvedCollectionName, exists, err := s.resolveCollectionForEnsure(ctx, collectionName)
	if err != nil {
		return "", err
	}

	if !exists {
		if err := s.vectorRepo.CreateCollection(ctx, collectionName, vectorSize); err != nil {
			return "", fmt.Errorf("failed to create collection: %w", err)
		}
		s.logger.InfoContext(ctx, "Created vector collection", "collection", collectionName, "vectorSize", vectorSize)
		return collectionName, nil
	}

	info, err := s.vectorRepo.GetCollectionInfo(ctx, resolvedCollectionName)
	if err != nil {
		return "", fmt.Errorf("failed to get collection info for %s: %w", resolvedCollectionName, err)
	}
	if info != nil && info.VectorSize != vectorSize {
		return "", fmt.Errorf(
			"shared collection %s resolved to %s %w: expected %d, actual %d",
			collectionName,
			resolvedCollectionName,
			ErrVectorSizeMismatch,
			vectorSize,
			info.VectorSize,
		)
	}
	return resolvedCollectionName, nil
}

func (s *DomainService) ensureCollectionMetaInitialized(
	ctx context.Context,
	collectionName string,
	physicalCollectionName string,
	model string,
	vectorSize int64,
) error {
	if s.collectionMetaManager == nil {
		return sharedroute.ErrCollectionMetaReaderNotConfigured
	}
	if err := s.collectionMetaManager.EnsureInitialized(ctx, sharedroute.CollectionMeta{
		CollectionName:         collectionName,
		PhysicalCollectionName: physicalCollectionName,
		Model:                  model,
		VectorDimension:        vectorSize,
		SparseBackend:          s.currentTargetSparseBackend(),
	}); err != nil {
		return fmt.Errorf("ensure collection meta initialized: %w", err)
	}
	return nil
}

func (s *DomainService) resolveCollectionForEnsure(ctx context.Context, collectionName string) (string, bool, error) {
	exists, err := s.vectorRepo.CollectionExists(ctx, collectionName)
	if err != nil {
		return "", false, fmt.Errorf("failed to check collection existence: %w", err)
	}
	if exists {
		return collectionName, true, nil
	}

	target, aliasExists, err := s.vectorRepo.GetAliasTarget(ctx, collectionName)
	if err != nil {
		return "", false, fmt.Errorf("failed to resolve collection alias target: %w", err)
	}
	if !aliasExists {
		return "", false, nil
	}

	target = strings.TrimSpace(target)
	if target == "" {
		return "", false, fmt.Errorf("collection alias %s %w", collectionName, ErrCollectionAliasTargetEmpty)
	}
	return target, true, nil
}

func (s *DomainService) loadCurrentActiveCollectionMeta(
	ctx context.Context,
	route sharedroute.ResolvedRoute,
) (CollectionMeta, bool, error) {
	if route.HasRebuildOverride || strings.TrimSpace(route.LogicalCollectionName) != constants.KnowledgeBaseCollectionName {
		return CollectionMeta{}, false, nil
	}

	reader := s.metaReader()
	if reader == nil {
		return CollectionMeta{}, false, nil
	}

	meta, err := reader.GetCollectionMeta(ctx)
	if err != nil {
		return CollectionMeta{}, false, fmt.Errorf("read current active collection meta: %w", err)
	}
	if !meta.Exists || strings.TrimSpace(meta.CollectionName) != constants.KnowledgeBaseCollectionName {
		return CollectionMeta{}, false, nil
	}
	return meta, true, nil
}

// UpdateSyncStatus 更新同步状态
func (s *DomainService) UpdateSyncStatus(ctx context.Context, kb *KnowledgeBase) error {
	if err := s.repo.UpdateSyncStatus(ctx, kb.ID, kb.SyncStatus, kb.SyncStatusMessage); err != nil {
		return fmt.Errorf("failed to update sync status: %w", err)
	}
	return nil
}

// UpdateProgress 更新同步进度
func (s *DomainService) UpdateProgress(ctx context.Context, kb *KnowledgeBase) error {
	if err := s.repo.UpdateProgress(ctx, kb.ID, kb.ExpectedNum, kb.CompletedNum); err != nil {
		return fmt.Errorf("failed to update progress: %w", err)
	}
	return nil
}
