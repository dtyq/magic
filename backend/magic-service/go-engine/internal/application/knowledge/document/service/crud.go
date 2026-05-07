package docapp

import (
	"context"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pagehelper "magic/internal/application/knowledge/helper/page"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
)

// Create 创建文档
func (s *DocumentAppService) Create(ctx context.Context, input *docdto.CreateDocumentInput) (*docdto.DocumentDTO, error) {
	return NewDocumentCreateAppService(s).Create(ctx, input)
}

func (s *DocumentAppService) createManagedDocument(
	ctx context.Context,
	input *documentdomain.CreateManagedDocumentInput,
) (*docdto.DocumentDTO, error) {
	if input == nil {
		return nil, errManagedDocumentInputRequired
	}
	if err := s.requireActiveUser(ctx, input.OrganizationCode, input.UserID, "create managed document"); err != nil {
		return nil, err
	}
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, input.KnowledgeBaseCode, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, input.UserID, kb.Code, "edit"); err != nil {
		return nil, err
	}
	if err := s.validateManualDocumentCreateAllowed(ctx, kb, input); err != nil {
		return nil, err
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	effectiveModel := route.Model
	requestedEmbeddingModel := strings.TrimSpace(input.EmbeddingModel)
	if requestedEmbeddingModel != "" && requestedEmbeddingModel != effectiveModel && s.logger != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"Document embedding model from request is ignored, force using effective route model",
			"requested_model", requestedEmbeddingModel,
			"effective_model", effectiveModel,
			"knowledge_base_code", kb.Code,
		)
	}

	doc := s.inputToEntity(input, kb, effectiveModel)
	s.ensureDocumentFileExtensionForPersist(ctx, doc)

	if err := s.domainService.Save(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	return s.entityToDTOWithContext(ctx, doc), nil
}

// Update 更新文档
func (s *DocumentAppService) Update(ctx context.Context, input *docdto.UpdateDocumentInput) (*docdto.DocumentDTO, error) {
	return NewDocumentUpdateAppService(s).Update(ctx, input)
}

// Show 查询文档详情
func (s *DocumentAppService) Show(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) (*docdto.DocumentDTO, error) {
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
		return nil, err
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, organizationCode, userID, knowledgeBaseCode, "read"); err != nil {
		return nil, err
	}

	doc, err := s.domainService.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	if err := s.validateDocumentOrg(doc, organizationCode); err != nil {
		return nil, err
	}
	if err := s.ensureKnowledgeBaseAccessibleInAgentScope(ctx, doc.OrganizationCode, doc.KnowledgeBaseCode); err != nil {
		return nil, err
	}
	return s.entityToDTOWithContext(ctx, doc), nil
}

// List 查询文档列表
func (s *DocumentAppService) List(ctx context.Context, input *docdto.ListDocumentInput) (*pagehelper.Result, error) {
	if input != nil {
		if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, input.UserID, input.KnowledgeBaseCode, "read"); err != nil {
			return nil, err
		}
	}
	if input != nil {
		allowed, err := s.isKnowledgeBaseAccessibleInAgentScope(
			ctx,
			input.OrganizationCode,
			input.KnowledgeBaseCode,
		)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return &pagehelper.Result{Total: 0, List: []*docdto.DocumentDTO{}}, nil
		}
	}

	var syncStatus *shared.SyncStatus
	if input.SyncStatus != nil {
		st := shared.SyncStatus(*input.SyncStatus)
		syncStatus = &st
	}

	query := &docrepo.DocumentQuery{
		OrganizationCode:  input.OrganizationCode,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		Name:              input.Name,
		DocType:           input.DocType,
		Enabled:           input.Enabled,
		SyncStatus:        syncStatus,
		Offset:            input.Offset,
		Limit:             input.Limit,
	}

	docs, total, err := s.domainService.List(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}

	list := s.entitiesToDTOsWithContext(ctx, docs)

	return &pagehelper.Result{Total: total, List: list}, nil
}

// CountByKnowledgeBaseCodes 按知识库批量统计文档数量
func (s *DocumentAppService) CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error) {
	result, err := s.domainService.CountByKnowledgeBaseCodes(ctx, organizationCode, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to count documents by knowledge base codes: %w", err)
	}
	return result, nil
}

// Destroy 删除文档
func (s *DocumentAppService) Destroy(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) error {
	return NewDocumentDestroyAppService(s).Destroy(ctx, code, knowledgeBaseCode, organizationCode, userID)
}

func (s *DocumentAppService) destroyDocument(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if doc == nil {
		return nil
	}

	kb, err := s.kbService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return fmt.Errorf("failed to find knowledge base: %w", err)
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)

	if err := s.fragmentService.DeletePointsByDocument(
		ctx,
		route.VectorCollectionName,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
		doc.Code,
	); err != nil {
		return fmt.Errorf("failed to delete document vector points: %w", err)
	}
	if err := s.fragmentService.DeleteByDocument(ctx, doc.KnowledgeBaseCode, doc.Code); err != nil {
		return fmt.Errorf("failed to delete document fragments: %w", err)
	}
	if err := s.domainService.Delete(ctx, doc.ID); err != nil {
		return fmt.Errorf("failed to delete document record: %w", err)
	}
	return nil
}

// SetSyncScheduler 注入文档同步调度器。
func (s *DocumentAppService) SetSyncScheduler(scheduler documentSyncScheduler) {
	if s == nil {
		return
	}
	s.syncScheduler = scheduler
}

// SetKnowledgeRevectorizeProgressStore 注入知识库重向量化 session 进度存储。
//
// document app 只负责在单文档任务到达终态时推进所属知识库 session 的 completed_num，
// 不负责决定“本轮知识库级重向量化”包含哪些文档，这个集合由 revectorize app 决定。
func (s *DocumentAppService) SetKnowledgeRevectorizeProgressStore(store revectorizeshared.ProgressStore) {
	if s == nil {
		return
	}
	s.revectorizeProgressStore = store
}

// SetThirdPlatformProviders 注入第三方平台 provider registry。
func (s *DocumentAppService) SetThirdPlatformProviders(registry *thirdplatformprovider.Registry) {
	if s == nil {
		return
	}
	s.thirdPlatformProviders = registry
}

// SetSourceBindingRepository 注入来源绑定仓储。
func (s *DocumentAppService) SetSourceBindingRepository(repo sourceBindingRepository) {
	if s == nil {
		return
	}
	s.sourceBindingRepo = repo
}

// SetKnowledgeBaseBindingRepository 注入知识库绑定仓储。
func (s *DocumentAppService) SetKnowledgeBaseBindingRepository(repo knowledgeBaseBindingRepository) {
	if s == nil {
		return
	}
	s.knowledgeBaseBindingRepo = repo
}

// SetProjectFileResolver 注入项目文件解析端口。
func (s *DocumentAppService) SetProjectFileResolver(port documentdomain.ProjectFileResolver) {
	if s == nil {
		return
	}
	s.projectFilePort = port
}

// SetProjectFileMetadataReader 注入项目文件轻量元数据读取器。
func (s *DocumentAppService) SetProjectFileMetadataReader(reader documentdomain.ProjectFileMetadataReader) {
	if s == nil {
		return
	}
	s.projectFileMetadataReader = reader
}

// SetProjectFileContentAccessor 注入项目文件内容访问端口。
func (s *DocumentAppService) SetProjectFileContentAccessor(accessor documentdomain.ProjectFileContentAccessor) {
	if s == nil {
		return
	}
	s.projectFileContentPort = accessor
}

// SetOriginalFileLinkProvider 注入原始文件链接提供器。
func (s *DocumentAppService) SetOriginalFileLinkProvider(provider originalFileLinkProvider) {
	if s == nil {
		return
	}
	s.fileLinkProvider = provider
}

func (s *DocumentAppService) inputToEntity(input *documentdomain.CreateManagedDocumentInput, kb *kbentity.KnowledgeBase, effectiveModel string) *docentity.KnowledgeBaseDocument {
	return documentdomain.BuildDocumentForCreate(knowledgeBaseSnapshotFromDomain(kb), effectiveModel, input)
}

func createDocumentInputToManaged(input *docdto.CreateDocumentInput) *documentdomain.CreateManagedDocumentInput {
	if input == nil {
		return nil
	}
	return &documentdomain.CreateManagedDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		SourceBindingID:   input.SourceBindingID,
		SourceItemID:      input.SourceItemID,
		ProjectID:         input.ProjectID,
		ProjectFileID:     input.ProjectFileID,
		AutoAdded:         input.AutoAdded,
		Name:              input.Name,
		Description:       input.Description,
		DocType:           input.DocType,
		DocMetadata: confighelper.ApplyStrategyConfigToMetadataForKnowledgeBaseType(
			input.DocMetadata,
			input.KnowledgeBaseType,
			input.StrategyConfig,
		),
		DocumentFile:      documentFileDTOToDomain(input.DocumentFile),
		ThirdPlatformType: input.ThirdPlatformType,
		ThirdFileID:       input.ThirdFileID,
		EmbeddingModel:    input.EmbeddingModel,
		VectorDB:          input.VectorDB,
		RetrieveConfig:    confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		FragmentConfig:    confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		EmbeddingConfig:   confighelper.EmbeddingConfigDTOToEntity(input.EmbeddingConfig),
		VectorDBConfig:    confighelper.VectorDBConfigDTOToEntity(input.VectorDBConfig),
		AutoSync:          input.AutoSync,
	}
}

func (s *DocumentAppService) entityToDTO(e *docentity.KnowledgeBaseDocument) *docdto.DocumentDTO {
	return EntityToDTO(e)
}

type knowledgeBaseRouteKey struct {
	organizationCode  string
	knowledgeBaseCode string
}

type knowledgeBaseDTOContext struct {
	effectiveModel    string
	knowledgeBaseType kbentity.Type
	sourceType        *int
}

func (s *DocumentAppService) entitiesToDTOsWithContext(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) []*docdto.DocumentDTO {
	list := make([]*docdto.DocumentDTO, len(docs))
	if len(docs) == 0 {
		return list
	}

	contexts := s.batchResolveKnowledgeBaseContexts(ctx, docs)
	for i, doc := range docs {
		if doc == nil {
			continue
		}
		key := knowledgeBaseRouteKey{
			organizationCode:  strings.TrimSpace(doc.OrganizationCode),
			knowledgeBaseCode: strings.TrimSpace(doc.KnowledgeBaseCode),
		}
		if dtoContext, ok := contexts[key]; ok {
			list[i] = s.entityToDTOWithKnowledgeBaseContext(doc, dtoContext)
			continue
		}
		list[i] = s.entityToDTOWithContext(ctx, doc)
	}
	return list
}

func (s *DocumentAppService) entityToDTOWithKnowledgeBaseContext(
	e *docentity.KnowledgeBaseDocument,
	dtoContext knowledgeBaseDTOContext,
) *docdto.DocumentDTO {
	dto := s.entityToDTO(e)
	if dto == nil {
		return dto
	}
	if strings.TrimSpace(dtoContext.effectiveModel) != "" {
		dto = ApplyEffectiveModel(dto, dtoContext.effectiveModel)
	}
	return ApplyKnowledgeBaseContext(dto, dtoContext.knowledgeBaseType, dtoContext.sourceType)
}

func (s *DocumentAppService) batchResolveKnowledgeBaseContexts(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) map[knowledgeBaseRouteKey]knowledgeBaseDTOContext {
	contexts := make(map[knowledgeBaseRouteKey]knowledgeBaseDTOContext, len(docs))
	if s == nil || s.kbService == nil || len(docs) == 0 {
		return contexts
	}

	codesByOrg := make(map[string][]string)
	seen := make(map[knowledgeBaseRouteKey]struct{}, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		key := knowledgeBaseRouteKey{
			organizationCode:  strings.TrimSpace(doc.OrganizationCode),
			knowledgeBaseCode: strings.TrimSpace(doc.KnowledgeBaseCode),
		}
		if key.organizationCode == "" || key.knowledgeBaseCode == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		codesByOrg[key.organizationCode] = append(codesByOrg[key.organizationCode], key.knowledgeBaseCode)
	}

	for organizationCode, knowledgeBaseCodes := range codesByOrg {
		kbs, _, err := s.kbService.List(ctx, &kbrepository.Query{
			OrganizationCode: organizationCode,
			Codes:            knowledgeBaseCodes,
			Offset:           0,
			Limit:            len(knowledgeBaseCodes),
		})
		if err != nil {
			continue
		}
		for _, kb := range kbs {
			if kb == nil {
				continue
			}
			key := knowledgeBaseRouteKey{
				organizationCode:  strings.TrimSpace(kb.OrganizationCode),
				knowledgeBaseCode: strings.TrimSpace(kb.Code),
			}
			contexts[key] = knowledgeBaseDTOContext{
				effectiveModel:    s.kbService.ResolveRuntimeRoute(ctx, kb).Model,
				knowledgeBaseType: kbentity.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType),
				sourceType:        cloneKnowledgeBaseSourceType(kb.SourceType),
			}
		}
	}
	return contexts
}

func (s *DocumentAppService) entityToDTOWithContext(ctx context.Context, e *docentity.KnowledgeBaseDocument) *docdto.DocumentDTO {
	dto := s.entityToDTO(e)
	if dto == nil {
		return nil
	}
	if s == nil || s.kbService == nil {
		return dto
	}

	kb, err := s.kbService.ShowByCodeAndOrg(ctx, e.KnowledgeBaseCode, e.OrganizationCode)
	if err != nil {
		return dto
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	if strings.TrimSpace(route.Model) != "" {
		dto = ApplyEffectiveModel(dto, route.Model)
	}
	return ApplyKnowledgeBaseContext(dto, kb.KnowledgeBaseType, kb.SourceType)
}

func cloneKnowledgeBaseSourceType(sourceType *int) *int {
	if sourceType == nil {
		return nil
	}
	cloned := *sourceType
	return &cloned
}

func documentFileDTOToDomain(documentFile *docfilehelper.DocumentFileDTO) *docentity.File {
	return docfilehelper.ToDomainFile(documentFile)
}

func normalizeUpdateDocumentMetadata(
	knowledgeBaseType string,
	current map[string]any,
	incoming map[string]any,
	strategy *confighelper.StrategyConfigDTO,
) map[string]any {
	base := current
	if incoming != nil {
		base = incoming
	}

	if strategy != nil {
		return confighelper.ApplyStrategyConfigToMetadataForKnowledgeBaseType(base, knowledgeBaseType, strategy)
	}

	if _, ok := current[documentdomain.ParseStrategyConfigKey]; ok {
		return confighelper.ApplyStrategyConfigToMetadataForKnowledgeBaseType(
			base,
			knowledgeBaseType,
			confighelper.StrategyConfigDTOFromMetadataForKnowledgeBaseType(knowledgeBaseType, current),
		)
	}
	return confighelper.ApplyStrategyConfigToMetadataForKnowledgeBaseType(base, knowledgeBaseType, nil)
}
