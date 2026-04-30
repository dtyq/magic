package docapp

import (
	"context"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

// DocumentCreateAppService 负责文档创建命令流。
type DocumentCreateAppService struct {
	support *DocumentAppService
}

// NewDocumentCreateAppService 创建文档创建命令流应用服务。
func NewDocumentCreateAppService(support *DocumentAppService) *DocumentCreateAppService {
	return &DocumentCreateAppService{support: support}
}

// Create 创建文档。
func (s *DocumentCreateAppService) Create(
	ctx context.Context,
	input *docdto.CreateDocumentInput,
) (*docdto.DocumentDTO, error) {
	if input == nil {
		return nil, errManagedDocumentInputRequired
	}
	if err := s.support.requireActiveUser(ctx, input.OrganizationCode, input.UserID, "create document"); err != nil {
		return nil, err
	}
	if err := s.support.ensureKnowledgeBaseAccessibleInAgentScope(
		ctx,
		input.OrganizationCode,
		input.KnowledgeBaseCode,
	); err != nil {
		return nil, err
	}
	kb, err := s.support.kbService.ShowByCodeAndOrg(ctx, input.KnowledgeBaseCode, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	input.KnowledgeBaseType = string(kb.KnowledgeBaseType)

	dto, err := s.support.createManagedDocument(ctx, createDocumentInputToManaged(input))
	if err != nil {
		return nil, err
	}
	if input.AutoSync && dto != nil {
		syncInput := s.support.buildCreateSyncInput(input.OrganizationCode, input.UserID, input.KnowledgeBaseCode, dto.Code)
		s.support.ScheduleSync(ctx, syncInput)
		return dto, nil
	}
	return dto, nil
}

// DocumentUpdateAppService 负责文档更新命令流。
type DocumentUpdateAppService struct {
	support *DocumentAppService
}

// NewDocumentUpdateAppService 创建文档更新命令流应用服务。
func NewDocumentUpdateAppService(support *DocumentAppService) *DocumentUpdateAppService {
	return &DocumentUpdateAppService{support: support}
}

// Update 更新文档。
func (s *DocumentUpdateAppService) Update(
	ctx context.Context,
	input *docdto.UpdateDocumentInput,
) (*docdto.DocumentDTO, error) {
	if input == nil {
		return nil, errManagedDocumentInputRequired
	}
	if err := validateDocumentKnowledgeBaseCode(input.KnowledgeBaseCode); err != nil {
		return nil, err
	}
	if err := s.support.requireActiveUser(ctx, input.OrganizationCode, input.UserID, "update document"); err != nil {
		return nil, err
	}
	if err := s.support.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, input.UserID, input.KnowledgeBaseCode, "edit"); err != nil {
		return nil, err
	}
	doc, err := s.support.domainService.ShowByCodeAndKnowledgeBase(ctx, input.Code, input.KnowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	kb, err := s.support.kbService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	input.KnowledgeBaseType = string(kb.KnowledgeBaseType)

	if doc.OrganizationCode != input.OrganizationCode {
		return nil, ErrDocumentOrgMismatch
	}
	if err := s.support.ensureKnowledgeBaseAccessibleInAgentScope(
		ctx,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
	); err != nil {
		return nil, err
	}
	configStateBefore := documentdomain.CaptureEffectiveConfigState(doc)

	var documentFile *docentity.File
	if input.DocumentFile != nil {
		documentFile = documentFileDTOToDomain(input.DocumentFile)
	}
	doc.ApplyUpdate(documentdomain.BuildUpdatePatch(&documentdomain.UpdateDocumentInput{
		Name:        input.Name,
		Description: input.Description,
		Enabled:     input.Enabled,
		DocType:     input.DocType,
		DocMetadata: normalizeUpdateDocumentMetadata(
			input.KnowledgeBaseType,
			doc.DocMetadata,
			input.DocMetadata,
			input.StrategyConfig,
		),
		DocumentFile:   documentFile,
		RetrieveConfig: confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		FragmentConfig: confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		WordCount:      input.WordCount,
		UpdatedUID:     input.UserID,
	}))
	s.support.ensureDocumentFileExtensionForPersist(ctx, doc)

	if err := s.support.domainService.Update(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to update document: %w", err)
	}
	configChanged := documentdomain.ShouldResyncAfterConfigUpdate(configStateBefore, doc)
	configRefreshRequested := input.StrategyConfig != nil || input.FragmentConfig != nil
	needsRecoveryResync := documentdomain.ShouldRecoveryResyncForNonSyncedDocument(doc)
	if configChanged || (configRefreshRequested && needsRecoveryResync) {
		s.support.scheduleDocumentUpdateResync(ctx, doc, input.UserID)
		return s.support.entityToDTOWithContext(ctx, doc), nil
	}

	return s.support.entityToDTOWithContext(ctx, doc), nil
}

// DocumentDestroyAppService 负责文档删除命令流。
type DocumentDestroyAppService struct {
	support *DocumentAppService
}

// NewDocumentDestroyAppService 创建文档删除命令流应用服务。
func NewDocumentDestroyAppService(support *DocumentAppService) *DocumentDestroyAppService {
	return &DocumentDestroyAppService{support: support}
}

// Destroy 删除文档。
func (s *DocumentDestroyAppService) Destroy(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) error {
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
		return err
	}
	if err := s.support.authorizeKnowledgeBaseAction(ctx, organizationCode, userID, knowledgeBaseCode, "delete"); err != nil {
		return err
	}
	doc, err := s.support.domainService.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return fmt.Errorf("failed to find document: %w", err)
	}
	if err := s.support.validateDocumentOrg(doc, organizationCode); err != nil {
		return err
	}
	if err := s.support.ensureKnowledgeBaseAccessibleInAgentScope(
		ctx,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
	); err != nil {
		return err
	}
	if err := s.support.validateSingleDocumentDeleteAllowed(ctx, doc); err != nil {
		return err
	}
	return s.support.destroyDocument(ctx, doc)
}

// DestroyManagedDocument 实现跨子域文档删除协作。
func (s *DocumentDestroyAppService) DestroyManagedDocument(
	ctx context.Context,
	code, knowledgeBaseCode string,
) error {
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
		return err
	}
	doc, err := s.support.domainService.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return fmt.Errorf("failed to find document: %w", err)
	}
	return s.support.destroyDocument(ctx, doc)
}

func (s *DocumentAppService) scheduleCreateSync(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	documentCode string,
) {
	request := s.buildCreateSyncInput(organizationCode, userID, knowledgeBaseCode, documentCode)
	if request == nil {
		return
	}
	s.ScheduleSync(ctx, request)
}

func (s *DocumentAppService) buildCreateSyncInput(
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	documentCode string,
) *documentdomain.SyncDocumentInput {
	if s == nil || documentCode == "" {
		return nil
	}
	return &documentdomain.SyncDocumentInput{
		OrganizationCode:  organizationCode,
		KnowledgeBaseCode: knowledgeBaseCode,
		Code:              documentCode,
		Mode:              documentdomain.SyncModeCreate,
		Async:             true,
		BusinessParams:    texthelper.BuildCreateBusinessParams(organizationCode, userID, knowledgeBaseCode),
	}
}

func validateDocumentKnowledgeBaseCode(knowledgeBaseCode string) error {
	if strings.TrimSpace(knowledgeBaseCode) == "" {
		return shared.ErrDocumentKnowledgeBaseRequired
	}
	return nil
}
