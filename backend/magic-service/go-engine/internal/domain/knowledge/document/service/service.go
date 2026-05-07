package document

import (
	"context"
	"fmt"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
)

// DomainService 文档领域服务
type DomainService struct {
	repo   docrepo.KnowledgeBaseDocumentRepository
	logger *logging.SugaredLogger
}

// NewDocumentDomainService 创建文档领域服务
func NewDocumentDomainService(
	repo docrepo.KnowledgeBaseDocumentRepository,
	logger *logging.SugaredLogger,
) *DomainService {
	return &DomainService{
		repo:   repo,
		logger: logger,
	}
}

// Save 保存文档
func (s *DomainService) Save(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if err := s.repo.Save(ctx, doc); err != nil {
		return fmt.Errorf("failed to save document: %w", err)
	}

	s.logger.InfoContext(ctx, "Document saved", "code", doc.Code, "name", doc.Name)
	return nil
}

// Update 更新文档
func (s *DomainService) Update(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if err := s.repo.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to update document: %w", err)
	}

	s.logger.InfoContext(ctx, "Document updated", "code", doc.Code)
	return nil
}

// MarkSyncing 标记文档进入同步中并持久化。
func (s *DomainService) MarkSyncing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if doc == nil {
		return nil
	}
	doc.MarkSyncing()
	if err := s.repo.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to mark document syncing: %w", err)
	}
	return nil
}

// MarkSynced 标记文档同步完成并持久化。
func (s *DomainService) MarkSynced(ctx context.Context, doc *docentity.KnowledgeBaseDocument, wordCount int) error {
	if doc == nil {
		return nil
	}
	doc.MarkSynced(wordCount)
	if err := s.repo.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to mark document synced: %w", err)
	}
	return nil
}

// MarkSyncedWithContent 基于标准化内容标记文档同步完成并持久化。
func (s *DomainService) MarkSyncedWithContent(ctx context.Context, doc *docentity.KnowledgeBaseDocument, content string) error {
	return s.MarkSynced(ctx, doc, len([]rune(strings.TrimSpace(content))))
}

// MarkSyncFailed 标记文档同步失败并持久化。
func (s *DomainService) MarkSyncFailed(ctx context.Context, doc *docentity.KnowledgeBaseDocument, message string) error {
	if doc == nil {
		return nil
	}
	doc.MarkSyncFailed(message)
	if err := s.repo.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to mark document sync failed: %w", err)
	}
	return nil
}

// MarkSyncFailedWithError 根据标准失败语义标记文档同步失败并持久化。
func (s *DomainService) MarkSyncFailedWithError(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	reason string,
	err error,
) error {
	return s.MarkSyncFailed(ctx, doc, BuildSyncFailureMessage(reason, err))
}

// Delete 物理删除文档记录。
func (s *DomainService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	return nil
}

// DeleteByKnowledgeBase 物理删除知识库下全部文档记录。
func (s *DomainService) DeleteByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) error {
	if err := s.repo.DeleteByKnowledgeBase(ctx, knowledgeBaseCode); err != nil {
		return fmt.Errorf("failed to delete documents by knowledge base: %w", err)
	}
	return nil
}

// DeleteByKnowledgeBaseAndCodes 根据知识库和文档编码批量物理删除文档记录。
func (s *DomainService) DeleteByKnowledgeBaseAndCodes(
	ctx context.Context,
	knowledgeBaseCode string,
	codes []string,
) error {
	if err := s.repo.DeleteByKnowledgeBaseAndCodes(ctx, knowledgeBaseCode, codes); err != nil {
		return fmt.Errorf("failed to delete documents by knowledge base and codes: %w", err)
	}
	return nil
}

// Show 查询文档详情
func (s *DomainService) Show(ctx context.Context, code string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := s.repo.FindByCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	return doc, nil
}

// ShowByCodeAndKnowledgeBase 根据 Code 和知识库查询文档
func (s *DomainService) ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := s.repo.FindByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	return doc, nil
}

// FindByKnowledgeBaseAndThirdFile 根据知识库和第三方文件查询文档映射。
func (s *DomainService) FindByKnowledgeBaseAndThirdFile(
	ctx context.Context,
	knowledgeBaseCode string,
	thirdPlatformType string,
	thirdFileID string,
) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := s.repo.FindByKnowledgeBaseAndThirdFile(ctx, knowledgeBaseCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to find document by knowledge base and third file: %w", err)
	}
	return doc, nil
}

// FindByKnowledgeBaseAndProjectFile 根据知识库和项目文件查询文档映射。
func (s *DomainService) FindByKnowledgeBaseAndProjectFile(
	ctx context.Context,
	knowledgeBaseCode string,
	projectFileID int64,
) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := s.repo.FindByKnowledgeBaseAndProjectFile(ctx, knowledgeBaseCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to find document by knowledge base and project file: %w", err)
	}
	return doc, nil
}

// FindByThirdFile 根据第三方文件信息查询文档
func (s *DomainService) FindByThirdFile(ctx context.Context, thirdPlatformType, thirdFileID string) (*docentity.KnowledgeBaseDocument, error) {
	doc, err := s.repo.FindByThirdFile(ctx, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to find document by third file: %w", err)
	}
	return doc, nil
}

// ListByThirdFileInOrg 按组织和第三方文件列出文档映射。
func (s *DomainService) ListByThirdFileInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents by third file in org: %w", err)
	}
	return docs, nil
}

// ListRealtimeByThirdFileInOrg 按组织和第三方文件列出 enabled + realtime 绑定下的文档映射。
func (s *DomainService) ListRealtimeByThirdFileInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListRealtimeByThirdFileInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list realtime documents by third file in org: %w", err)
	}
	return docs, nil
}

// HasRealtimeThirdFileDocumentInOrg 判断组织内第三方文件是否已有 enabled + realtime 绑定下的文档。
func (s *DomainService) HasRealtimeThirdFileDocumentInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) (bool, error) {
	hasDocument, err := s.repo.HasRealtimeThirdFileDocumentInOrg(ctx, organizationCode, thirdPlatformType, thirdFileID)
	if err != nil {
		return false, fmt.Errorf("failed to check realtime third-file document in org: %w", err)
	}
	return hasDocument, nil
}

// ListByProjectFileInOrg 按组织和项目文件列出文档映射。
func (s *DomainService) ListByProjectFileInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents by project file in org: %w", err)
	}
	return docs, nil
}

// ListRealtimeByProjectFileInOrg 按组织和项目文件列出 enabled + realtime 绑定下的文档映射。
func (s *DomainService) ListRealtimeByProjectFileInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListRealtimeByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list realtime documents by project file in org: %w", err)
	}
	return docs, nil
}

// HasRealtimeProjectFileDocumentInOrg 判断组织内项目文件是否已有 enabled + realtime 绑定下的文档。
func (s *DomainService) HasRealtimeProjectFileDocumentInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) (bool, error) {
	hasDocument, err := s.repo.HasRealtimeProjectFileDocumentInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return false, fmt.Errorf("failed to check realtime project-file document in org: %w", err)
	}
	return hasDocument, nil
}

// ListByKnowledgeBaseAndSourceBindingIDs 根据知识库与来源绑定批量列出文档。
func (s *DomainService) ListByKnowledgeBaseAndSourceBindingIDs(
	ctx context.Context,
	knowledgeBaseCode string,
	sourceBindingIDs []int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListByKnowledgeBaseAndSourceBindingIDs(ctx, knowledgeBaseCode, sourceBindingIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents by knowledge base and source binding ids: %w", err)
	}
	return docs, nil
}

// ResolveThirdFileDocumentPlan 解析第三方文件重向量化所需的文档集合与 seed。
func (s *DomainService) ResolveThirdFileDocumentPlan(
	ctx context.Context,
	input ThirdFileDocumentPlanInput,
) (ThirdFileDocumentPlan, error) {
	docs, err := s.resolveThirdFileDocuments(ctx, input, false)
	if err != nil {
		return ThirdFileDocumentPlan{}, err
	}
	return s.buildThirdFileDocumentPlan(input, docs)
}

// ResolveRealtimeThirdFileDocumentPlan 只解析 enabled + realtime 绑定下的第三方文件文档。
func (s *DomainService) ResolveRealtimeThirdFileDocumentPlan(
	ctx context.Context,
	input ThirdFileDocumentPlanInput,
) (ThirdFileDocumentPlan, error) {
	docs, err := s.resolveThirdFileDocuments(ctx, input, true)
	if err != nil {
		return ThirdFileDocumentPlan{}, err
	}
	return s.buildThirdFileDocumentPlan(input, docs)
}

func (s *DomainService) buildThirdFileDocumentPlan(
	input ThirdFileDocumentPlanInput,
	docs []*docentity.KnowledgeBaseDocument,
) (ThirdFileDocumentPlan, error) {
	seed, err := BuildThirdFileRevectorizeSeed(&ThirdFileRevectorizeInput{
		OrganizationCode:  input.OrganizationCode,
		ThirdPlatformType: input.ThirdPlatformType,
		ThirdFileID:       input.ThirdFileID,
	}, docs)
	if err != nil {
		return ThirdFileDocumentPlan{}, err
	}
	return ThirdFileDocumentPlan{
		Documents: docs,
		Seed:      seed,
	}, nil
}

func (s *DomainService) resolveThirdFileDocuments(
	ctx context.Context,
	input ThirdFileDocumentPlanInput,
	realtimeOnly bool,
) ([]*docentity.KnowledgeBaseDocument, error) {
	var (
		docs []*docentity.KnowledgeBaseDocument
		err  error
	)
	if realtimeOnly {
		docs, err = s.ListRealtimeByThirdFileInOrg(ctx, input.OrganizationCode, input.ThirdPlatformType, input.ThirdFileID)
	} else {
		docs, err = s.ListByThirdFileInOrg(ctx, input.OrganizationCode, input.ThirdPlatformType, input.ThirdFileID)
	}
	if err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return nil, shared.ErrDocumentNotFound
	}
	return docs, nil
}

// ListByKnowledgeBaseAndProject 按知识库和项目列出文档。
func (s *DomainService) ListByKnowledgeBaseAndProject(
	ctx context.Context,
	knowledgeBaseCode string,
	projectID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	docs, err := s.repo.ListByKnowledgeBaseAndProject(ctx, knowledgeBaseCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents by knowledge base and project: %w", err)
	}
	return docs, nil
}

// List 分页查询文档
func (s *DomainService) List(ctx context.Context, query *docrepo.DocumentQuery) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	docs, total, err := s.repo.List(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list documents: %w", err)
	}
	return docs, total, nil
}

// ListByKnowledgeBase 根据知识库查询文档
func (s *DomainService) ListByKnowledgeBase(ctx context.Context, knowledgeBaseCode string, offset, limit int) ([]*docentity.KnowledgeBaseDocument, int64, error) {
	docs, total, err := s.repo.ListByKnowledgeBase(ctx, knowledgeBaseCode, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list documents by knowledge base: %w", err)
	}
	return docs, total, nil
}

// CountByKnowledgeBaseCodes 按知识库批量统计文档数量
func (s *DomainService) CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error) {
	counts, err := s.repo.CountByKnowledgeBaseCodes(ctx, organizationCode, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to count documents by knowledge base codes: %w", err)
	}
	return counts, nil
}

// UpdateSyncStatus 更新同步状态
func (s *DomainService) UpdateSyncStatus(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if err := s.repo.UpdateSyncStatus(ctx, doc.ID, doc.SyncStatus, doc.SyncStatusMessage); err != nil {
		return fmt.Errorf("failed to update sync status: %w", err)
	}
	return nil
}

// EnsureDefaultDocument 获取或创建知识库默认文档。
func (s *DomainService) EnsureDefaultDocument(ctx context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) (*docentity.KnowledgeBaseDocument, bool, error) {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	doc, created, err := s.repo.EnsureDefaultDocument(ctx, knowledgeBaseRuntimeSnapshotFromShared(kb))
	if err != nil {
		return nil, false, fmt.Errorf("failed to ensure default document: %w", err)
	}
	return doc, created, nil
}

func knowledgeBaseRuntimeSnapshotFromShared(kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot) *docrepo.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return &docrepo.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   kb.RetrieveConfig,
		FragmentConfig:   kb.FragmentConfig,
		EmbeddingConfig:  kb.EmbeddingConfig,
	}
}
