package docapp

import (
	"context"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pagehelper "magic/internal/application/knowledge/helper/page"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
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
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, input.KnowledgeBaseCode, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	if err := s.validateManualDocumentCreateAllowed(ctx, kb, input); err != nil {
		return nil, err
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	effectiveModel := route.Model
	requestedEmbeddingModel := strings.TrimSpace(input.EmbeddingModel)
	if requestedEmbeddingModel != "" && requestedEmbeddingModel != effectiveModel && s.logger != nil {
		s.logger.WarnContext(
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
	code, knowledgeBaseCode, organizationCode string,
) (*docdto.DocumentDTO, error) {
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
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

	query := &documentdomain.Query{
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
	code, knowledgeBaseCode, organizationCode string,
) error {
	return NewDocumentDestroyAppService(s).Destroy(ctx, code, knowledgeBaseCode, organizationCode)
}

func (s *DocumentAppService) destroyDocument(ctx context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
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

// SetThirdFileRevectorizeScheduler 注入第三方文件重向量化调度器。
func (s *DocumentAppService) SetThirdFileRevectorizeScheduler(scheduler thirdFileRevectorizeScheduler) {
	if s == nil {
		return
	}
	s.thirdFileScheduler = scheduler
}

// SetThirdPlatformProviders 注入第三方平台 provider registry。
func (s *DocumentAppService) SetThirdPlatformProviders(registry *thirdplatformprovider.Registry) {
	if s == nil {
		return
	}
	s.thirdPlatformProviders = registry
}

// SetSourceBindingRepository 注入来源绑定仓储。
func (s *DocumentAppService) SetSourceBindingRepository(repo sourcebindingdomain.Repository) {
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
func (s *DocumentAppService) SetProjectFileResolver(port projectFileResolver) {
	if s == nil {
		return
	}
	s.projectFilePort = port
}

// SetProjectFileMetadataReader 注入项目文件轻量元数据读取器。
func (s *DocumentAppService) SetProjectFileMetadataReader(reader projectFileMetadataReader) {
	if s == nil {
		return
	}
	s.projectFileMetadataReader = reader
}

// SetProjectFileContentAccessor 注入项目文件内容访问端口。
func (s *DocumentAppService) SetProjectFileContentAccessor(accessor projectFileContentAccessor) {
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

func (s *DocumentAppService) inputToEntity(input *documentdomain.CreateManagedDocumentInput, kb *knowledgebasedomain.KnowledgeBase, effectiveModel string) *documentdomain.KnowledgeBaseDocument {
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
		DocMetadata:       confighelper.ApplyStrategyConfigToMetadata(input.DocMetadata, input.StrategyConfig),
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

func (s *DocumentAppService) entityToDTO(e *documentdomain.KnowledgeBaseDocument) *docdto.DocumentDTO {
	return EntityToDTO(e)
}

type knowledgeBaseRouteKey struct {
	organizationCode  string
	knowledgeBaseCode string
}

type knowledgeBaseDTOContext struct {
	effectiveModel    string
	knowledgeBaseType knowledgebasedomain.Type
}

func (s *DocumentAppService) entitiesToDTOsWithContext(
	ctx context.Context,
	docs []*documentdomain.KnowledgeBaseDocument,
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
	e *documentdomain.KnowledgeBaseDocument,
	dtoContext knowledgeBaseDTOContext,
) *docdto.DocumentDTO {
	dto := s.entityToDTO(e)
	if dto == nil {
		return dto
	}
	if strings.TrimSpace(dtoContext.effectiveModel) != "" {
		dto = ApplyEffectiveModel(dto, dtoContext.effectiveModel)
	}
	return ApplyKnowledgeBaseType(dto, dtoContext.knowledgeBaseType)
}

func (s *DocumentAppService) batchResolveKnowledgeBaseContexts(
	ctx context.Context,
	docs []*documentdomain.KnowledgeBaseDocument,
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
		kbs, _, err := s.kbService.List(ctx, &knowledgebasedomain.Query{
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
				knowledgeBaseType: knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType),
			}
		}
	}
	return contexts
}

func (s *DocumentAppService) entityToDTOWithContext(ctx context.Context, e *documentdomain.KnowledgeBaseDocument) *docdto.DocumentDTO {
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
	return ApplyKnowledgeBaseType(dto, kb.KnowledgeBaseType)
}

func documentFileDTOToDomain(documentFile *docfilehelper.DocumentFileDTO) *documentdomain.File {
	return docfilehelper.ToDomainFile(documentFile)
}

func normalizeUpdateDocumentMetadata(
	current map[string]any,
	incoming map[string]any,
	strategy *confighelper.StrategyConfigDTO,
) map[string]any {
	base := current
	if incoming != nil {
		base = incoming
	}

	if strategy != nil {
		return confighelper.ApplyStrategyConfigToMetadata(base, strategy)
	}

	if _, ok := current[documentdomain.ParseStrategyConfigKey]; ok {
		return confighelper.ApplyStrategyConfigToMetadata(base, confighelper.StrategyConfigDTOFromMetadata(current))
	}
	return confighelper.ApplyStrategyConfigToMetadata(base, nil)
}
