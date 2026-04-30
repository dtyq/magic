package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	texthelper "magic/internal/application/knowledge/helper/text"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

const knowledgeBaseManagedDocumentListLimit = 10_000

var (
	errManagedDocumentInputRequired          = errors.New("managed document input is required")
	errManagedDocumentDomainServiceRequired  = errors.New("managed document domain service is required")
	errManagedDocumentEntityBuildFailed      = errors.New("managed document entity build failed")
	errManagedDocumentFragmentServiceMissing = errors.New("managed document fragment service is required")
)

type knowledgeBaseManagedDocumentStore interface {
	CreateManagedDocument(ctx context.Context, input *CreateManagedDocumentInput) (*ManagedDocument, error)
	DestroyManagedDocument(ctx context.Context, code, knowledgeBaseCode string) error
	DestroyManagedDocumentsByCodes(ctx context.Context, knowledgeBaseCode, organizationCode string, codes []string) error
	DestroyKnowledgeBaseDocuments(ctx context.Context, knowledgeBaseCode, organizationCode string) error
	ScheduleManagedDocumentSync(ctx context.Context, input *SyncDocumentInput)
	ListManagedDocumentsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]*ManagedDocument, error)
	ListManagedDocumentsBySourceBindingIDs(
		ctx context.Context,
		knowledgeBaseCode string,
		sourceBindingIDs []int64,
	) ([]*ManagedDocument, error)
}

type knowledgeBaseDocumentSyncScheduler interface {
	ScheduleSync(ctx context.Context, input *documentdomain.SyncDocumentInput)
}

// KnowledgeBaseDocumentFlowApp 承接 knowledgebase 与 document 协作的单流程编排。
type KnowledgeBaseDocumentFlowApp struct {
	support          *KnowledgeBaseAppService
	managedDocuments knowledgeBaseManagedDocumentStore
}

// NewKnowledgeBaseDocumentFlowApp 创建知识库文档协作 flow app。
func NewKnowledgeBaseDocumentFlowApp(
	support *KnowledgeBaseAppService,
	documentService *documentdomain.DomainService,
	fragmentService *fragdomain.FragmentDomainService,
	syncScheduler knowledgeBaseDocumentSyncScheduler,
	parseService *documentdomain.ParseService,
) *KnowledgeBaseDocumentFlowApp {
	return &KnowledgeBaseDocumentFlowApp{
		support: support,
		managedDocuments: knowledgeBaseDomainManagedDocumentStore{
			support:         support,
			documentService: documentService,
			fragmentService: fragmentService,
			syncScheduler:   syncScheduler,
			parseService:    parseService,
		},
	}
}

// SetDocumentFlowApp 注入知识库文档协作 flow app。
func (s *KnowledgeBaseAppService) SetDocumentFlowApp(flow *KnowledgeBaseDocumentFlowApp) {
	if s == nil {
		return
	}
	s.documentFlow = flow
}

func (s *KnowledgeBaseAppService) requireDocumentFlow() (*KnowledgeBaseDocumentFlowApp, error) {
	if s == nil || s.documentFlow == nil {
		return nil, ErrKnowledgeBaseDocumentFlowRequired
	}
	return s.documentFlow, nil
}

// ListManagedDocumentsForKnowledgeBase 暴露知识库侧已 materialize 的 managed documents。
//
// knowledgebase app 只负责返回“这次知识库 prepare 完成后有哪些文档需要处理”，
// 不负责继续决定这些文档如何异步执行；知识库级批量重向量化用例由独立的 revectorize app 统一编排。
func (s *KnowledgeBaseAppService) ListManagedDocumentsForKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]*revectorizeshared.ManagedDocument, error) {
	flow, err := s.requireDocumentFlow()
	if err != nil {
		return nil, err
	}
	documents, err := flow.managedDocuments.ListManagedDocumentsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("list managed documents for knowledge base: %w", err)
	}
	result := make([]*revectorizeshared.ManagedDocument, 0, len(documents))
	for _, doc := range documents {
		if doc == nil {
			continue
		}
		result = append(result, &revectorizeshared.ManagedDocument{Code: doc.Code})
	}
	return result, nil
}

func (s *KnowledgeBaseDocumentFlowApp) logInfo(ctx context.Context, message string, fields ...any) {
	if s == nil {
		return
	}
	logKnowledgeBaseFlowInfo(ctx, s.support, message, fields...)
}

func logKnowledgeBaseFlowInfo(ctx context.Context, support *KnowledgeBaseAppService, message string, fields ...any) {
	if support == nil || support.logger == nil {
		return
	}
	support.logger.InfoContext(ctx, message, fields...)
}

type knowledgeBaseDomainManagedDocumentStore struct {
	support         *KnowledgeBaseAppService
	documentService *documentdomain.DomainService
	fragmentService *fragdomain.FragmentDomainService
	syncScheduler   knowledgeBaseDocumentSyncScheduler
	parseService    *documentdomain.ParseService
}

func (s knowledgeBaseDomainManagedDocumentStore) logInfo(ctx context.Context, message string, fields ...any) {
	logKnowledgeBaseFlowInfo(ctx, s.support, message, fields...)
}

func (s knowledgeBaseDomainManagedDocumentStore) CreateManagedDocument(
	ctx context.Context,
	input *CreateManagedDocumentInput,
) (*ManagedDocument, error) {
	if input == nil {
		return nil, errManagedDocumentInputRequired
	}
	if s.support == nil || s.support.domainService == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	if s.documentService == nil {
		return nil, errManagedDocumentDomainServiceRequired
	}

	kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, input.KnowledgeBaseCode, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("load knowledge base for managed document create: %w", err)
	}
	route := s.support.domainService.ResolveRuntimeRoute(ctx, kb)
	doc := documentdomain.BuildDocumentForCreate(
		knowledgeBaseRuntimeSnapshotFromDomain(kb),
		route.Model,
		&documentdomain.CreateManagedDocumentInput{
			OrganizationCode:  input.OrganizationCode,
			UserID:            input.UserID,
			KnowledgeBaseCode: input.KnowledgeBaseCode,
			Code:              input.Code,
			SourceBindingID:   input.SourceBindingID,
			SourceItemID:      input.SourceItemID,
			ProjectID:         input.ProjectID,
			ProjectFileID:     input.ProjectFileID,
			AutoAdded:         input.AutoAdded,
			Name:              input.Name,
			Description:       input.Description,
			DocType:           input.DocType,
			DocMetadata:       cloneMap(input.DocMetadata),
			DocumentFile:      cloneDocumentFile(input.DocumentFile),
			ThirdPlatformType: input.ThirdPlatformType,
			ThirdFileID:       input.ThirdFileID,
			EmbeddingModel:    input.EmbeddingModel,
			VectorDB:          input.VectorDB,
			RetrieveConfig:    input.RetrieveConfig,
			FragmentConfig:    input.FragmentConfig,
			EmbeddingConfig:   input.EmbeddingConfig,
			VectorDBConfig:    input.VectorDBConfig,
			AutoSync:          input.AutoSync,
		},
	)
	if doc == nil {
		return nil, errManagedDocumentEntityBuildFailed
	}
	if doc.DocumentFile != nil {
		doc.DocumentFile.Extension = s.resolveManagedDocumentFileExtension(ctx, doc.DocumentFile)
	}
	if err := s.documentService.Save(ctx, doc); err != nil {
		return nil, fmt.Errorf("save managed document: %w", err)
	}
	if input.AutoSync {
		s.ScheduleManagedDocumentSync(ctx, &SyncDocumentInput{
			OrganizationCode:  input.OrganizationCode,
			KnowledgeBaseCode: input.KnowledgeBaseCode,
			Code:              doc.Code,
			Mode:              knowledgeBaseSyncModeCreate,
			BusinessParams:    texthelper.BuildCreateBusinessParams(input.OrganizationCode, input.UserID, input.KnowledgeBaseCode),
		})
	}
	return managedDocumentFromDomain(doc), nil
}

func (s knowledgeBaseDomainManagedDocumentStore) DestroyManagedDocument(
	ctx context.Context,
	code string,
	knowledgeBaseCode string,
) error {
	s.logInfo(
		ctx,
		"Managed document destroy started",
		"knowledge_base_code", knowledgeBaseCode,
		"document_code", code,
	)
	if s.support == nil || s.support.domainService == nil {
		return ErrKnowledgeBaseNotFound
	}
	if s.documentService == nil {
		return errManagedDocumentDomainServiceRequired
	}
	if s.fragmentService == nil {
		return errManagedDocumentFragmentServiceMissing
	}

	doc, err := s.documentService.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return fmt.Errorf("load managed document: %w", err)
	}
	s.logInfo(
		ctx,
		"Managed document loaded for destroy",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"document_id", doc.ID,
	)
	if err := s.deleteManagedDocumentVectorPoints(ctx, doc); err != nil {
		return err
	}
	if err := s.deleteManagedDocumentRecords(ctx, doc); err != nil {
		return err
	}
	s.logInfo(ctx, "Managed document destroy finished", "document_code", doc.Code, "document_id", doc.ID)
	return nil
}

func (s knowledgeBaseDomainManagedDocumentStore) DestroyManagedDocumentsByCodes(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
	codes []string,
) error {
	if len(codes) == 0 {
		return nil
	}
	if s.support == nil || s.support.domainService == nil {
		return ErrKnowledgeBaseNotFound
	}
	if s.documentService == nil {
		return errManagedDocumentDomainServiceRequired
	}
	if s.fragmentService == nil {
		return errManagedDocumentFragmentServiceMissing
	}
	kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return fmt.Errorf("load knowledge base for managed documents destroy: %w", err)
	}
	route := s.support.domainService.ResolveRuntimeRoute(ctx, kb)
	if err := s.fragmentService.DeletePointsByDocuments(
		ctx,
		route.VectorCollectionName,
		firstNonEmpty(kb.OrganizationCode, organizationCode),
		knowledgeBaseCode,
		codes,
	); err != nil {
		return fmt.Errorf("delete managed document vector points: %w", err)
	}
	if err := s.fragmentService.DeleteByDocumentCodes(ctx, knowledgeBaseCode, codes); err != nil {
		return fmt.Errorf("delete managed document fragments: %w", err)
	}
	if err := s.documentService.DeleteByKnowledgeBaseAndCodes(ctx, knowledgeBaseCode, codes); err != nil {
		return fmt.Errorf("delete managed documents: %w", err)
	}
	return nil
}

func (s knowledgeBaseDomainManagedDocumentStore) deleteManagedDocumentVectorPoints(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) error {
	kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return fmt.Errorf("load knowledge base for managed document destroy: %w", err)
	}
	route := s.support.domainService.ResolveRuntimeRoute(ctx, kb)
	s.logInfo(
		ctx,
		"Managed document destroy route resolved",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"vector_collection", route.VectorCollectionName,
		"physical_collection", route.PhysicalCollectionName,
		"model", route.Model,
	)
	s.logInfo(
		ctx,
		"Delete managed document vector points started",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"vector_collection", route.VectorCollectionName,
	)
	if err := s.fragmentService.DeletePointsByDocument(
		ctx,
		route.VectorCollectionName,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
		doc.Code,
	); err != nil {
		return fmt.Errorf("delete managed document vector points: %w", err)
	}
	s.logInfo(
		ctx,
		"Delete managed document vector points finished",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"vector_collection", route.VectorCollectionName,
	)
	return nil
}

func (s knowledgeBaseDomainManagedDocumentStore) deleteManagedDocumentRecords(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) error {
	s.logInfo(ctx, "Delete managed document fragments started", "document_code", doc.Code)
	if err := s.fragmentService.DeleteByDocument(ctx, doc.KnowledgeBaseCode, doc.Code); err != nil {
		return fmt.Errorf("delete managed document fragments: %w", err)
	}
	s.logInfo(ctx, "Delete managed document fragments finished", "document_code", doc.Code)
	s.logInfo(ctx, "Delete managed document row started", "document_code", doc.Code, "document_id", doc.ID)
	if err := s.documentService.Delete(ctx, doc.ID); err != nil {
		return fmt.Errorf("delete managed document: %w", err)
	}
	return nil
}

func (s knowledgeBaseDomainManagedDocumentStore) DestroyKnowledgeBaseDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	s.logInfo(
		ctx,
		"Managed documents batch destroy started",
		"organization_code", organizationCode,
		"knowledge_base_code", knowledgeBaseCode,
	)
	if s.support == nil || s.support.domainService == nil {
		return ErrKnowledgeBaseNotFound
	}
	if s.documentService == nil {
		return errManagedDocumentDomainServiceRequired
	}
	if s.fragmentService == nil {
		return errManagedDocumentFragmentServiceMissing
	}

	kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return fmt.Errorf("load knowledge base for managed documents batch destroy: %w", err)
	}
	s.logInfo(
		ctx,
		"Delete knowledge base vector data started",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
	)
	if err := s.support.domainService.DeleteVectorData(ctx, kb); err != nil {
		return fmt.Errorf("delete knowledge base vector data: %w", err)
	}
	s.logInfo(
		ctx,
		"Delete knowledge base vector data finished",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
	)

	s.logInfo(ctx, "Delete knowledge base fragments started", "knowledge_base_code", kb.Code)
	if err := s.fragmentService.DeleteByKnowledgeBase(ctx, kb.Code); err != nil {
		return fmt.Errorf("delete knowledge base fragments: %w", err)
	}
	s.logInfo(ctx, "Delete knowledge base fragments finished", "knowledge_base_code", kb.Code)

	s.logInfo(ctx, "Delete knowledge base documents started", "knowledge_base_code", kb.Code)
	if err := s.documentService.DeleteByKnowledgeBase(ctx, kb.Code); err != nil {
		return fmt.Errorf("delete knowledge base documents: %w", err)
	}
	s.logInfo(ctx, "Delete knowledge base documents finished", "knowledge_base_code", kb.Code)
	s.logInfo(
		ctx,
		"Managed documents batch destroy finished",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
	)
	return nil
}

func (s knowledgeBaseDomainManagedDocumentStore) ScheduleManagedDocumentSync(ctx context.Context, input *SyncDocumentInput) {
	if s.syncScheduler == nil || input == nil {
		return
	}
	s.syncScheduler.ScheduleSync(ctx, &documentdomain.SyncDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		Code:              input.Code,
		Mode:              input.Mode,
		Async:             true,
		BusinessParams:    input.BusinessParams,
	})
}

func (s knowledgeBaseDomainManagedDocumentStore) ListManagedDocumentsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]*ManagedDocument, error) {
	if s.documentService == nil {
		return nil, errManagedDocumentDomainServiceRequired
	}
	docs, _, err := s.documentService.ListByKnowledgeBase(ctx, knowledgeBaseCode, 0, knowledgeBaseManagedDocumentListLimit)
	if err != nil {
		return nil, fmt.Errorf("list managed documents by knowledge base: %w", err)
	}
	results := make([]*ManagedDocument, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		results = append(results, managedDocumentFromDomain(doc))
	}
	return results, nil
}

func (s knowledgeBaseDomainManagedDocumentStore) ListManagedDocumentsBySourceBindingIDs(
	ctx context.Context,
	knowledgeBaseCode string,
	sourceBindingIDs []int64,
) ([]*ManagedDocument, error) {
	if s.documentService == nil {
		return nil, errManagedDocumentDomainServiceRequired
	}
	docs, err := s.documentService.ListByKnowledgeBaseAndSourceBindingIDs(ctx, knowledgeBaseCode, sourceBindingIDs)
	if err != nil {
		return nil, fmt.Errorf("list managed documents by source binding ids: %w", err)
	}
	results := make([]*ManagedDocument, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		results = append(results, managedDocumentFromDomain(doc))
	}
	return results, nil
}

func (s knowledgeBaseDomainManagedDocumentStore) resolveManagedDocumentFileExtension(
	ctx context.Context,
	file *docentity.File,
) string {
	if file == nil {
		return ""
	}
	if resolved := documentdomain.ResolveDocumentFileExtension(file, ""); resolved != "" {
		return resolved
	}
	target := strings.TrimSpace(file.URL)
	if target == "" {
		target = strings.TrimSpace(file.FileKey)
	}
	if target == "" || s.parseService == nil {
		return documentdomain.ResolveDocumentFileExtension(file, "")
	}
	ext, err := s.parseService.ResolveFileType(ctx, target)
	if err != nil {
		if s.support != nil && s.support.logger != nil {
			s.support.logger.KnowledgeWarnContext(
				ctx,
				"Failed to resolve managed document extension",
				"url", file.URL,
				"file_key", file.FileKey,
				"name", file.Name,
				"error", err,
			)
		}
		return documentdomain.ResolveDocumentFileExtension(file, "")
	}
	return documentdomain.ResolveDocumentFileExtension(file, ext)
}

func managedDocumentFromDomain(doc *docentity.KnowledgeBaseDocument) *ManagedDocument {
	if doc == nil {
		return nil
	}
	return &ManagedDocument{
		Code:              doc.Code,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		SourceBindingID:   doc.SourceBindingID,
		SourceItemID:      doc.SourceItemID,
		ProjectID:         doc.ProjectID,
		ProjectFileID:     doc.ProjectFileID,
		SyncStatus:        doc.SyncStatus,
		DocumentFile:      cloneDocumentFile(doc.DocumentFile),
	}
}

func knowledgeBaseRuntimeSnapshotFromDomain(kb *kbentity.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		Name:             kb.Name,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   cloneRetrieveConfigCompat(kb.RetrieveConfig),
		FragmentConfig:   cloneFragmentConfigCompat(kb.FragmentConfig),
		EmbeddingConfig:  cloneEmbeddingConfigCompat(kb.EmbeddingConfig),
		ResolvedRoute:    kb.ResolvedRoute,
	})
}

func cloneRetrieveConfigCompat(cfg *shared.RetrieveConfig) *shared.RetrieveConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}

func cloneFragmentConfigCompat(cfg *shared.FragmentConfig) *shared.FragmentConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}

func cloneEmbeddingConfigCompat(cfg *shared.EmbeddingConfig) *shared.EmbeddingConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}
