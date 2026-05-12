package fragdomain

import (
	"context"
	"errors"
	"fmt"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

// FragmentDomainService 片段领域服务
type FragmentDomainService struct {
	repo                  fragmodel.KnowledgeBaseFragmentRepository
	embeddingSvc          EmbeddingService
	vectorMgmtRepo        fragmodel.VectorDBManagementRepository
	vectorDataRepo        fragmodel.VectorDBDataRepository[fragmodel.FragmentPayload]
	defaultEmbeddingModel string
	logger                *logging.SugaredLogger
	retrievalSvc          *fragretrieval.Service
}

// FragmentDomainInfra 聚合片段领域服务依赖的基础设施组件。
type FragmentDomainInfra struct {
	VectorMgmtRepo        fragmodel.VectorDBManagementRepository
	VectorDataRepo        fragmodel.VectorDBDataRepository[fragmodel.FragmentPayload]
	MetaReader            sharedroute.CollectionMetaReader
	DefaultEmbeddingModel string
	Logger                *logging.SugaredLogger
	SegmenterProvider     *fragretrieval.SegmenterProvider
}

type fragmentCountStatsRepository interface {
	CountStatsByKnowledgeBase(ctx context.Context, knowledgeCode string) (total, synced int64, err error)
}

type fragmentCountBatchStatsRepository interface {
	CountStatsByKnowledgeBases(ctx context.Context, knowledgeCodes []string) (map[string]int64, map[string]int64, error)
}

type fragmentSyncStatusBatchUpdater interface {
	UpdateSyncStatusBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error
}

type fragmentDocumentAfterIDReader interface {
	ListByDocumentAfterID(ctx context.Context, knowledgeCode, documentCode string, afterID int64, limit int) ([]*fragmodel.KnowledgeBaseFragment, error)
}

type vectorPointIDFilterScanner interface {
	ListPointIDsByFilter(ctx context.Context, collection string, filter *fragmodel.VectorFilter, limit int) ([]string, error)
}

type thirdFileRepairRepository interface {
	ListThirdFileRepairOrganizationCodes(ctx context.Context) ([]string, error)
	ListThirdFileRepairGroups(ctx context.Context, query thirdfilemappingpkg.RepairGroupQuery) ([]*thirdfilemappingpkg.RepairGroup, error)
	BackfillDocumentCodeByThirdFile(ctx context.Context, input thirdfilemappingpkg.BackfillByThirdFileInput) (int64, error)
}

var (
	errThirdFileRepairOrganizationsUnsupported   = errors.New("repository does not support repair organizations")
	errThirdFileRepairGroupsUnsupported          = errors.New("repository does not support repair groups")
	errThirdFileBackfillUnsupported              = errors.New("repository does not support third-file backfill")
	errFragmentPointFilterScanUnsupported        = errors.New("vector repository does not support filter scan")
	errFragmentDocumentSeekPaginationUnsupported = errors.New("repository does not support document seek pagination")
)

// NewFragmentDomainService 创建片段领域服务
func NewFragmentDomainService(
	repo fragmodel.KnowledgeBaseFragmentRepository,
	embeddingSvc EmbeddingService,
	infra FragmentDomainInfra,
) *FragmentDomainService {
	service := &FragmentDomainService{
		repo:                  repo,
		embeddingSvc:          embeddingSvc,
		vectorMgmtRepo:        infra.VectorMgmtRepo,
		vectorDataRepo:        infra.VectorDataRepo,
		defaultEmbeddingModel: infra.DefaultEmbeddingModel,
		logger:                infra.Logger,
	}
	service.retrievalSvc = fragretrieval.NewService(service.repo, service.embeddingSvc, fragretrieval.Infra{
		VectorDataRepo:        service.vectorDataRepo,
		MetaReader:            infra.MetaReader,
		DefaultEmbeddingModel: service.defaultEmbeddingModel,
		Logger:                service.logger,
		SegmenterProvider:     infra.SegmenterProvider,
	})
	return service
}

// Save 保存片段
func (s *FragmentDomainService) Save(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	if err := s.repo.Save(ctx, fragment); err != nil {
		return fmt.Errorf("failed to save fragment: %w", err)
	}
	return nil
}

// SaveBatch 批量保存片段
func (s *FragmentDomainService) SaveBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	if err := s.repo.SaveBatch(ctx, fragments); err != nil {
		return fmt.Errorf("failed to save fragments: %w", err)
	}
	return nil
}

// Update 更新片段
func (s *FragmentDomainService) Update(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	if err := s.repo.Update(ctx, fragment); err != nil {
		return fmt.Errorf("failed to update fragment: %w", err)
	}
	return nil
}

// UpdateBatch 批量更新片段。
func (s *FragmentDomainService) UpdateBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment) error {
	if err := s.repo.UpdateBatch(ctx, fragments); err != nil {
		return fmt.Errorf("failed to batch update fragments: %w", err)
	}
	return nil
}

// Show 查询片段详情
func (s *FragmentDomainService) Show(ctx context.Context, id int64) (*fragmodel.KnowledgeBaseFragment, error) {
	fragment, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragment: %w", err)
	}
	return fragment, nil
}

// FindByIDs 根据 ID 批量查询片段。
func (s *FragmentDomainService) FindByIDs(ctx context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := s.repo.FindByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragments by ids: %w", err)
	}
	return fragments, nil
}

// FindByPointIDs 根据 point_id 批量查询片段。
func (s *FragmentDomainService) FindByPointIDs(ctx context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := s.repo.FindByPointIDs(ctx, pointIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to find fragments by point ids: %w", err)
	}
	return fragments, nil
}

// List 分页查询片段
func (s *FragmentDomainService) List(ctx context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	fragments, total, err := s.repo.List(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list fragments: %w", err)
	}
	return fragments, total, nil
}

// SetPayloadByPointIDs 按 point_id 局部更新向量 payload。
func (s *FragmentDomainService) SetPayloadByPointIDs(
	ctx context.Context,
	collection string,
	updates map[string]map[string]any,
) error {
	if len(updates) == 0 {
		return nil
	}
	if err := s.vectorDataRepo.SetPayloadByPointIDs(ctx, collection, updates); err != nil {
		return fmt.Errorf("failed to set payload by point ids: %w", err)
	}
	return nil
}

// ListMissingDocumentCode 查询 document_code 为空的历史片段。
func (s *FragmentDomainService) ListMissingDocumentCode(
	ctx context.Context,
	query fragmodel.MissingDocumentCodeQuery,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := s.repo.ListMissingDocumentCode(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments missing document code: %w", err)
	}
	return fragments, nil
}

// BackfillDocumentCode 批量回填片段 document_code。
func (s *FragmentDomainService) BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error) {
	rows, err := s.repo.BackfillDocumentCode(ctx, ids, documentCode)
	if err != nil {
		return 0, fmt.Errorf("failed to backfill fragment document code: %w", err)
	}
	return rows, nil
}

// ListThirdFileRepairGroups 查询历史第三方文件修复分组。
func (s *FragmentDomainService) ListThirdFileRepairGroups(
	ctx context.Context,
	query thirdfilemappingpkg.RepairGroupQuery,
) ([]*thirdfilemappingpkg.RepairGroup, error) {
	repo, ok := s.repo.(thirdFileRepairRepository)
	if !ok {
		return nil, fmt.Errorf("failed to list third file repair groups: %w", errThirdFileRepairGroupsUnsupported)
	}
	groups, err := repo.ListThirdFileRepairGroups(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair groups: %w", err)
	}
	return groups, nil
}

// ListThirdFileRepairOrganizationCodes 查询存在历史第三方文件修复候选的组织编码。
func (s *FragmentDomainService) ListThirdFileRepairOrganizationCodes(ctx context.Context) ([]string, error) {
	repo, ok := s.repo.(thirdFileRepairRepository)
	if !ok {
		return nil, fmt.Errorf("failed to list third file repair organization codes: %w", errThirdFileRepairOrganizationsUnsupported)
	}
	organizationCodes, err := repo.ListThirdFileRepairOrganizationCodes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list third file repair organization codes: %w", err)
	}
	return organizationCodes, nil
}

// BackfillDocumentCodeByThirdFile 按第三方文件回填 document_code。
func (s *FragmentDomainService) BackfillDocumentCodeByThirdFile(
	ctx context.Context,
	input thirdfilemappingpkg.BackfillByThirdFileInput,
) (int64, error) {
	repo, ok := s.repo.(thirdFileRepairRepository)
	if !ok {
		return 0, fmt.Errorf("failed to backfill fragment document code by third file: %w", errThirdFileBackfillUnsupported)
	}
	rows, err := repo.BackfillDocumentCodeByThirdFile(ctx, input)
	if err != nil {
		return 0, fmt.Errorf("failed to backfill fragment document code by third file: %w", err)
	}
	return rows, nil
}

// ListByDocument 根据知识库和文档查询片段。
func (s *FragmentDomainService) ListByDocument(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
	offset,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	fragments, total, err := s.repo.ListByDocument(ctx, knowledgeCode, documentCode, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list fragments by document: %w", err)
	}
	return fragments, total, nil
}

// ListByDocumentAfterID 根据知识库和文档按主键游标查询片段。
func (s *FragmentDomainService) ListByDocumentAfterID(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
	afterID int64,
	limit int,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	reader, ok := s.repo.(fragmentDocumentAfterIDReader)
	if !ok {
		return nil, fmt.Errorf("failed to list fragments by document after id: %w", errFragmentDocumentSeekPaginationUnsupported)
	}
	fragments, err := reader.ListByDocumentAfterID(ctx, knowledgeCode, documentCode, afterID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list fragments by document after id: %w", err)
	}
	return fragments, nil
}

// DeleteByDocument 根据知识库和文档删除所有片段。
func (s *FragmentDomainService) DeleteByDocument(ctx context.Context, knowledgeCode, documentCode string) error {
	if err := s.repo.DeleteByDocument(ctx, knowledgeCode, documentCode); err != nil {
		return fmt.Errorf("failed to delete fragments by document: %w", err)
	}
	return nil
}

// DeleteByDocumentCodes 根据知识库和文档编码批量删除所有片段。
func (s *FragmentDomainService) DeleteByDocumentCodes(
	ctx context.Context,
	knowledgeCode string,
	documentCodes []string,
) error {
	if err := s.repo.DeleteByDocumentCodes(ctx, knowledgeCode, documentCodes); err != nil {
		return fmt.Errorf("failed to delete fragments by document codes: %w", err)
	}
	return nil
}

// DeleteByKnowledgeBase 根据知识库删除所有片段。
func (s *FragmentDomainService) DeleteByKnowledgeBase(ctx context.Context, knowledgeCode string) error {
	if err := s.repo.DeleteByKnowledgeBase(ctx, knowledgeCode); err != nil {
		return fmt.Errorf("failed to delete fragments by knowledge base: %w", err)
	}
	return nil
}

// ListExistingPointIDs 批量查询目标集合中已存在的点 ID。
func (s *FragmentDomainService) ListExistingPointIDs(ctx context.Context, collectionName string, pointIDs []string) (map[string]struct{}, error) {
	existing, err := s.vectorDataRepo.ListExistingPointIDs(ctx, collectionName, pointIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to list existing vector points: %w", err)
	}
	return existing, nil
}

// ListPointIDsByFilter 根据过滤条件批量扫描 point_id。
func (s *FragmentDomainService) ListPointIDsByFilter(
	ctx context.Context,
	collectionName string,
	filter *fragmodel.VectorFilter,
	limit int,
) ([]string, error) {
	scanner, ok := any(s.vectorDataRepo).(vectorPointIDFilterScanner)
	if !ok {
		return nil, fmt.Errorf("failed to list point ids by filter: %w", errFragmentPointFilterScanUnsupported)
	}
	pointIDs, err := scanner.ListPointIDsByFilter(ctx, collectionName, filter, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list point ids by filter: %w", err)
	}
	return pointIDs, nil
}

// DeletePointsByFilter 根据过滤条件删除向量点
func (s *FragmentDomainService) DeletePointsByFilter(ctx context.Context, collectionName string, filter *fragmodel.VectorFilter) error {
	if err := s.vectorMgmtRepo.DeletePointsByFilter(ctx, collectionName, filter); err != nil {
		return fmt.Errorf("failed to delete vector points: %w", err)
	}
	return nil
}

// DeletePointsByDocument 根据文档信息删除向量点
func (s *FragmentDomainService) DeletePointsByDocument(ctx context.Context, collectionName, organizationCode, knowledgeCode, documentCode string) error {
	filter := buildDocumentFilter(organizationCode, knowledgeCode, documentCode)
	return s.DeletePointsByFilter(ctx, collectionName, filter)
}

// DeletePointsByDocuments 根据多篇文档批量删除向量点。
func (s *FragmentDomainService) DeletePointsByDocuments(
	ctx context.Context,
	collectionName string,
	organizationCode string,
	knowledgeCode string,
	documentCodes []string,
) error {
	filter := buildDocumentsFilter(organizationCode, knowledgeCode, documentCodes)
	if filter == nil {
		return nil
	}
	return s.DeletePointsByFilter(ctx, collectionName, filter)
}

// DeletePointData 删除单个 point 对应的向量数据，但保留片段记录。
func (s *FragmentDomainService) DeletePointData(ctx context.Context, collectionName, knowledgeCode, pointID string) error {
	return s.DeletePointDataBatch(ctx, collectionName, knowledgeCode, []string{pointID})
}

// DeletePointDataBatch 批量删除 points 对应的向量数据，但保留片段记录。
func (s *FragmentDomainService) DeletePointDataBatch(ctx context.Context, collectionName, knowledgeCode string, pointIDs []string) error {
	if len(pointIDs) == 0 {
		return nil
	}

	if err := s.vectorMgmtRepo.DeletePoints(ctx, collectionName, pointIDs); err != nil {
		return fmt.Errorf("failed to delete vector points: %w", err)
	}
	return nil
}

// Destroy 删除片段
func (s *FragmentDomainService) Destroy(ctx context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error {
	return s.DestroyBatch(ctx, []*fragmodel.KnowledgeBaseFragment{fragment}, collectionName)
}

// DestroyBatch 批量删除片段及其 point 数据。
func (s *FragmentDomainService) DestroyBatch(ctx context.Context, fragments []*fragmodel.KnowledgeBaseFragment, collectionName string) error {
	if len(fragments) == 0 {
		return nil
	}

	pointIDs := make([]string, 0, len(fragments))
	ids := make([]int64, 0, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		if fragment.PointID != "" {
			pointIDs = append(pointIDs, fragment.PointID)
		}
		if fragment.ID != 0 {
			ids = append(ids, fragment.ID)
		}
	}

	if len(pointIDs) > 0 {
		if err := s.vectorMgmtRepo.DeletePoints(ctx, collectionName, pointIDs); err != nil {
			return fmt.Errorf("failed to batch delete vector points: %w", err)
		}
	}
	if err := s.repo.DeleteByIDs(ctx, ids); err != nil {
		return fmt.Errorf("failed to batch delete fragments: %w", err)
	}

	return nil
}

// CountByKnowledgeBase 统计知识库下片段总数
func (s *FragmentDomainService) CountByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error) {
	count, err := s.repo.CountByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, fmt.Errorf("failed to count fragments by knowledge base: %w", err)
	}
	return count, nil
}

// CountSyncedByKnowledgeBase 统计知识库下已同步片段数
func (s *FragmentDomainService) CountSyncedByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, error) {
	count, err := s.repo.CountSyncedByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, fmt.Errorf("failed to count synced fragments by knowledge base: %w", err)
	}
	return count, nil
}

// CountStatsByKnowledgeBase 统计知识库下片段总数与已同步片段数（兼容旧状态口径）
func (s *FragmentDomainService) CountStatsByKnowledgeBase(ctx context.Context, knowledgeCode string) (int64, int64, error) {
	if statsRepo, ok := s.repo.(fragmentCountStatsRepository); ok {
		total, synced, err := statsRepo.CountStatsByKnowledgeBase(ctx, knowledgeCode)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to count fragment stats by knowledge base: %w", err)
		}
		return total, synced, nil
	}

	total, err := s.repo.CountByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to count fragments by knowledge base: %w", err)
	}
	synced, err := s.repo.CountSyncedByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to count synced fragments by knowledge base: %w", err)
	}
	return total, synced, nil
}

// CountStatsByKnowledgeBases 批量统计知识库下片段总数与已同步片段数。
func (s *FragmentDomainService) CountStatsByKnowledgeBases(
	ctx context.Context,
	knowledgeCodes []string,
) (map[string]int64, map[string]int64, error) {
	if statsRepo, ok := s.repo.(fragmentCountBatchStatsRepository); ok {
		totals, synced, err := statsRepo.CountStatsByKnowledgeBases(ctx, knowledgeCodes)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to count fragment stats by knowledge bases: %w", err)
		}
		return totals, synced, nil
	}

	totals := make(map[string]int64, len(knowledgeCodes))
	synced := make(map[string]int64, len(knowledgeCodes))
	for _, knowledgeCode := range knowledgeCodes {
		total, syncedCount, err := s.CountStatsByKnowledgeBase(ctx, knowledgeCode)
		if err != nil {
			return nil, nil, err
		}
		totals[knowledgeCode] = total
		synced[knowledgeCode] = syncedCount
	}
	return totals, synced, nil
}
