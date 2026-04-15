package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	texthelper "magic/internal/application/knowledge/helper/text"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

var errDocumentSyncInputRequired = errors.New("document sync input is required")

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
	if err := s.support.ensureKnowledgeBaseAccessibleInAgentScope(
		ctx,
		input.OrganizationCode,
		input.KnowledgeBaseCode,
	); err != nil {
		return nil, err
	}

	dto, err := s.support.createManagedDocument(ctx, createDocumentInputToManaged(input))
	if err != nil {
		return nil, err
	}
	if input.AutoSync && dto != nil {
		syncInput := s.support.buildCreateSyncInput(input.OrganizationCode, input.UserID, input.KnowledgeBaseCode, dto.Code)
		if !input.WaitForSyncResult {
			s.support.ScheduleSync(ctx, syncInput)
			return dto, nil
		}
		return s.support.syncDocumentInlineAndReload(ctx, syncInput)
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
	if err := validateDocumentKnowledgeBaseCode(input.KnowledgeBaseCode); err != nil {
		return nil, err
	}
	doc, err := s.support.domainService.ShowByCodeAndKnowledgeBase(ctx, input.Code, input.KnowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}

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

	var documentFile *documentdomain.File
	if input.DocumentFile != nil {
		documentFile = documentFileDTOToDomain(input.DocumentFile)
	}
	doc.ApplyUpdate(documentdomain.BuildUpdatePatch(&documentdomain.UpdateDocumentInput{
		Name:           input.Name,
		Description:    input.Description,
		Enabled:        input.Enabled,
		DocType:        input.DocType,
		DocMetadata:    normalizeUpdateDocumentMetadata(doc.DocMetadata, input.DocMetadata, input.StrategyConfig),
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
	if documentdomain.ShouldResyncAfterConfigUpdate(configStateBefore, doc) {
		if !input.WaitForSyncResult {
			s.support.scheduleDocumentUpdateResync(ctx, doc, input.UserID)
			return s.support.entityToDTOWithContext(ctx, doc), nil
		}
		syncInput := s.support.buildDocumentUpdateResyncRequest(ctx, doc, input.UserID)
		if syncInput != nil {
			syncInput.Async = false
			return s.support.syncDocumentInlineAndReload(ctx, syncInput)
		}
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
	code, knowledgeBaseCode, organizationCode string,
) error {
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
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
		BusinessParams:    texthelper.BuildCreateBusinessParams(organizationCode, userID, knowledgeBaseCode),
	}
}

func (s *DocumentAppService) syncDocumentInlineAndReload(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
) (*docdto.DocumentDTO, error) {
	if s == nil {
		return nil, errManagedDocumentAppRequired
	}
	if input == nil {
		return nil, errDocumentSyncInputRequired
	}

	syncErr := s.executeSync(ctx, input)
	if syncErr != nil && s.logger != nil {
		s.logger.WarnContext(
			ctx,
			"Document inline sync completed with error, returning latest document state",
			"knowledge_base_code", input.KnowledgeBaseCode,
			"document_code", input.Code,
			"mode", input.Mode,
			"error", syncErr,
		)
	}

	doc, err := s.reloadDocumentForSyncResult(ctx, input.KnowledgeBaseCode, input.Code)
	if err != nil {
		return nil, err
	}
	if syncErr != nil {
		if err := s.ensureInlineSyncFailureState(ctx, doc, syncErr); err != nil {
			return nil, err
		}
	}
	return s.entityToDTOWithContext(ctx, doc), nil
}

func (s *DocumentAppService) reloadDocumentForSyncResult(
	ctx context.Context,
	knowledgeBaseCode string,
	documentCode string,
) (*documentdomain.KnowledgeBaseDocument, error) {
	doc, err := s.domainService.ShowByCodeAndKnowledgeBase(ctx, documentCode, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("reload document after sync: %w", err)
	}
	return doc, nil
}

func validateDocumentKnowledgeBaseCode(knowledgeBaseCode string) error {
	if strings.TrimSpace(knowledgeBaseCode) == "" {
		return shared.ErrDocumentKnowledgeBaseRequired
	}
	return nil
}

func (s *DocumentAppService) ensureInlineSyncFailureState(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
	syncErr error,
) error {
	if doc == nil || syncErr == nil {
		return nil
	}
	if doc.SyncStatus == shared.SyncStatusSynced || doc.SyncStatus == shared.SyncStatusSyncFailed {
		return nil
	}

	reason, cause := unwrapDocumentSyncStageError(syncErr, "")
	message := strings.TrimSpace(syncErr.Error())
	if reason != "" {
		message = documentdomain.BuildSyncFailureMessage(reason, cause)
	}
	if message == "" {
		message = "document sync failed"
	}
	if err := s.domainService.MarkSyncFailed(ctx, doc, message); err != nil {
		return fmt.Errorf("mark inline sync failed: %w", err)
	}
	return nil
}
