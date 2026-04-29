package kbapp

import (
	"context"
	"fmt"
	"strings"

	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
)

type preparedCreateKnowledgeBase struct {
	kb             *kbentity.KnowledgeBase
	effectiveModel string
	agentCodes     []string
	sourceBindings []sourcebindingdomain.Binding
	organization   string
	userID         string
	hasBindings    bool
}

type normalizedCreateKnowledgeBaseCommand struct {
	knowledgeBaseType kbentity.Type
	sourceType        *int
	agentCodes        []string
	sourceBindings    []sourcebindingdomain.Binding
}

type preparedUpdateKnowledgeBase struct {
	kb                  *kbentity.KnowledgeBase
	previousKB          *kbentity.KnowledgeBase
	agentCodes          []string
	previousAgentCodes  []string
	sourceBindings      []sourcebindingdomain.Binding
	replaceSource       bool
	replaceAgentBinding bool
	organization        string
	userID              string
	userOperation       knowledgeBasePermissionOperation
}

type normalizedUpdateKnowledgeBaseCommand struct {
	currentKnowledgeBaseType kbentity.Type
	knowledgeBaseType        kbentity.Type
	currentAgentCodes        []string
	sourceType               *int
	validationSourceType     *int
	agentCodes               []string
	sourceBindings           []sourcebindingdomain.Binding
	replaceSource            bool
	replaceAgentBinding      bool
}

// Create 创建知识库。
func (s *KnowledgeBaseCreateApp) Create(ctx context.Context, input *kbdto.CreateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
	if input == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	if err := s.requireActiveUser(ctx, input.OrganizationCode, input.UserID, "create knowledge base"); err != nil {
		return nil, err
	}
	existing, found, err := s.findExistingByBusinessID(ctx, input)
	if err != nil {
		return nil, err
	}
	if found {
		return nil, fmt.Errorf(
			"%w: organization_code=%s business_id=%s knowledge_base_code=%s",
			ErrKnowledgeBaseBusinessIDAlreadyExists,
			input.OrganizationCode,
			input.BusinessID,
			existing.Code,
		)
	}

	prepared, err := s.prepareCreate(ctx, input)
	if err != nil {
		return nil, err
	}
	savedBindings, err := s.persistCreate(ctx, prepared)
	if err != nil {
		return nil, err
	}
	if err := s.grantKnowledgeBaseOwner(ctx, prepared.kb, input); err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return nil, err
	}
	if prepared.hasBindings {
		flow, err := s.requireDocumentFlow()
		if err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return nil, err
		}
		if err := flow.materializeKnowledgeBaseDocuments(
			ctx,
			prepared.kb,
			prepared.organization,
			prepared.userID,
			savedBindings,
		); err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return nil, err
		}
	}

	dto, err := s.attachKnowledgeBaseSourceBindings(
		ctx,
		applyKnowledgeBaseBindingInfo(
			s.entityToDTOWithResolvedModel(prepared.kb, prepared.effectiveModel),
			prepared.agentCodes,
			knowledgeBaseTypeFromAgentCodes(prepared.agentCodes),
		),
		prepared.kb.Code,
		prepared.userID,
	)
	if err != nil {
		return nil, err
	}
	return applyKnowledgeBaseUserOperation(
		dto,
		knowledgeBasePermissionOwner,
	), nil
}

func (s *KnowledgeBaseCreateApp) findExistingByBusinessID(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) (*kbentity.KnowledgeBase, bool, error) {
	if input == nil || strings.TrimSpace(input.BusinessID) == "" {
		return nil, false, nil
	}

	items, _, err := s.domainService.List(ctx, &kbrepository.Query{
		OrganizationCode: input.OrganizationCode,
		BusinessIDs:      []string{input.BusinessID},
		Offset:           0,
		Limit:            1,
	})
	if err != nil {
		return nil, false, fmt.Errorf("failed to query knowledge base by business id: %w", err)
	}
	if len(items) == 0 {
		return nil, false, nil
	}
	return items[0], true, nil
}

func (s *KnowledgeBaseCreateApp) prepareCreate(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) (*preparedCreateKnowledgeBase, error) {
	requestedModel := strings.TrimSpace(input.Model)
	command, err := s.normalizeCreateCommand(ctx, input)
	if err != nil {
		return nil, err
	}

	kb := kbentity.BuildKnowledgeBaseForCreate(&kbentity.CreateInput{
		Code:              input.Code,
		Name:              input.Name,
		Description:       input.Description,
		Type:              input.Type,
		KnowledgeBaseType: command.knowledgeBaseType,
		Model:             input.Model,
		VectorDB:          input.VectorDB,
		BusinessID:        input.BusinessID,
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		Icon:              input.Icon,
		SourceType:        command.sourceType,
		RetrieveConfig:    confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		FragmentConfig:    confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		EmbeddingConfig:   confighelper.EmbeddingConfigDTOToEntity(input.EmbeddingConfig),
	})
	route := s.domainService.ResolveRuntimeRoute(ctx, kb)
	if route.Model == "" {
		return nil, ErrEmbeddingModelRequired
	}
	if requestedModel != "" && requestedModel != route.Model && s.logger != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"Embedding model from request is ignored, resolve using target model, collection meta model, or default embedding model",
			"requested_model", requestedModel,
			"effective_model", route.Model,
		)
	}
	kb.ApplyResolvedRoute(route)
	return &preparedCreateKnowledgeBase{
		kb:             kb,
		effectiveModel: route.Model,
		agentCodes:     command.agentCodes,
		sourceBindings: s.buildSourceBindings(kb, input.OrganizationCode, input.UserID, command.sourceBindings),
		organization:   input.OrganizationCode,
		userID:         input.UserID,
		hasBindings:    len(command.sourceBindings) > 0,
	}, nil
}

func (s *KnowledgeBaseCreateApp) normalizeCreateCommand(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) (*normalizedCreateKnowledgeBaseCommand, error) {
	// 创建链路的产品线边界固定为：
	// 1. 先按 agent_codes 判产品线
	// 2. 再归一化 source_bindings
	// 3. 再在该产品线下解析 / 推断 source_type
	// 4. 最后按统一语义校验 binding
	//
	// 这个顺序不能交换，否则会把 source_type 或 binding 误当成产品线判定条件。
	normalizedAgentCodes, err := normalizeAgentCodes(input.AgentCodes)
	if err != nil {
		return nil, err
	}
	if err := s.validateSuperMagicAgents(ctx, input.OrganizationCode, input.UserID, normalizedAgentCodes); err != nil {
		return nil, err
	}
	knowledgeBaseType := knowledgeBaseTypeFromAgentCodes(normalizedAgentCodes)
	bindingInputs, err := s.resolveCreateSourceBindingInputs(ctx, input)
	if err != nil {
		return nil, err
	}
	normalizedBindings := normalizeSourceBindingInputs(bindingInputs)
	normalizedSourceType, err := s.resolveCreateSourceType(knowledgeBaseType, input.SourceType, normalizedBindings)
	if err != nil {
		return nil, err
	}
	if err := validateSourceBindingsForSourceType(knowledgeBaseType, normalizedSourceType, normalizedBindings); err != nil {
		return nil, err
	}

	return &normalizedCreateKnowledgeBaseCommand{
		knowledgeBaseType: knowledgeBaseType,
		sourceType:        normalizedSourceType,
		agentCodes:        normalizedAgentCodes,
		sourceBindings:    normalizedBindings,
	}, nil
}

func (s *KnowledgeBaseCreateApp) persistCreate(
	ctx context.Context,
	prepared *preparedCreateKnowledgeBase,
) ([]sourcebindingdomain.Binding, error) {
	if prepared == nil || prepared.kb == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	if s.writeCoordinator == nil {
		return s.persistCreateWithoutCoordinator(ctx, prepared)
	}
	return s.persistCreateWithCoordinator(ctx, prepared)
}

func (s *KnowledgeBaseCreateApp) persistCreateWithCoordinator(
	ctx context.Context,
	prepared *preparedCreateKnowledgeBase,
) ([]sourcebindingdomain.Binding, error) {
	if err := s.domainService.PrepareForSave(ctx, prepared.kb); err != nil {
		return nil, fmt.Errorf("failed to prepare knowledge base: %w", err)
	}
	savedBindings, err := s.writeCoordinator.Create(ctx, prepared.kb, prepared.sourceBindings, prepared.agentCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to create knowledge base: %w", err)
	}
	return savedBindings, nil
}

func (s *KnowledgeBaseCreateApp) persistCreateWithoutCoordinator(
	ctx context.Context,
	prepared *preparedCreateKnowledgeBase,
) ([]sourcebindingdomain.Binding, error) {
	if err := s.domainService.Save(ctx, prepared.kb); err != nil {
		return nil, fmt.Errorf("failed to create knowledge base: %w", err)
	}
	var savedBindings []sourcebindingdomain.Binding
	if prepared.hasBindings {
		if s.sourceBindingRepo == nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return nil, ErrKnowledgeBaseSourceBindingRepositoryRequired
		}
		var err error
		savedBindings, err = s.sourceBindingRepo.ReplaceBindings(ctx, prepared.kb.Code, prepared.sourceBindings)
		if err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return nil, fmt.Errorf("failed to replace knowledge base source bindings: %w", err)
		}
	}
	if err := s.replaceKnowledgeBaseAgentBindings(ctx, prepared.kb.Code, prepared.kb.OrganizationCode, prepared.userID, prepared.agentCodes); err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return nil, err
	}
	return savedBindings, nil
}

// Update 更新知识库。
func (s *KnowledgeBaseUpdateApp) Update(ctx context.Context, input *kbdto.UpdateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
	return s.update(ctx, input, false)
}

func (s *KnowledgeBaseUpdateApp) update(
	ctx context.Context,
	input *kbdto.UpdateKnowledgeBaseInput,
	bypassPermission bool,
) (*kbdto.KnowledgeBaseDTO, error) {
	if input == nil {
		return nil, ErrKnowledgeBaseNotFound
	}
	if err := s.requireActiveUser(ctx, input.OrganizationCode, input.UserID, "update knowledge base"); err != nil {
		return nil, err
	}
	prepared, err := s.prepareUpdate(ctx, input, bypassPermission)
	if err != nil {
		return nil, err
	}
	if err := s.persistUpdate(ctx, prepared); err != nil {
		return nil, err
	}

	dto, err := s.entityToDTOWithKnownBindings(ctx, prepared.kb, prepared.userID, prepared.agentCodes)
	if err != nil {
		return nil, err
	}
	return applyKnowledgeBaseUserOperation(
		dto,
		prepared.userOperation,
	), nil
}

func (s *KnowledgeBaseUpdateApp) prepareUpdate(
	ctx context.Context,
	input *kbdto.UpdateKnowledgeBaseInput,
	bypassPermission bool,
) (*preparedUpdateKnowledgeBase, error) {
	operation := knowledgeBasePermissionNone
	if !bypassPermission {
		var err error
		operation, err = s.ensureKnowledgeBaseActionAllowed(ctx, input.OrganizationCode, input.UserID, input.Code, "edit")
		if err != nil {
			return nil, err
		}
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, input.Code, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	command, err := s.normalizeUpdateCommand(ctx, input, kb)
	if err != nil {
		return nil, err
	}
	previousKB := cloneKnowledgeBaseForUpdate(kb)
	kb.ApplyUpdate(kbentity.BuildKnowledgeBaseUpdatePatch(&kbentity.UpdateInput{
		Name:              input.Name,
		Description:       input.Description,
		Enabled:           input.Enabled,
		Icon:              input.Icon,
		SourceType:        nil,
		KnowledgeBaseType: &command.knowledgeBaseType,
		RetrieveConfig:    confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		EmbeddingConfig:   confighelper.EmbeddingConfigDTOToEntity(input.EmbeddingConfig),
		FragmentConfig:    confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		UpdatedUID:        input.UserID,
	}))

	prepared := &preparedUpdateKnowledgeBase{
		kb:                  kb,
		previousKB:          previousKB,
		agentCodes:          command.agentCodes,
		previousAgentCodes:  append([]string(nil), command.currentAgentCodes...),
		replaceSource:       command.replaceSource,
		replaceAgentBinding: command.replaceAgentBinding,
		organization:        input.OrganizationCode,
		userID:              input.UserID,
		userOperation:       operation,
	}
	if command.replaceSource {
		prepared.sourceBindings = s.buildSourceBindings(kb, input.OrganizationCode, input.UserID, command.sourceBindings)
	}
	return prepared, nil
}

func (s *KnowledgeBaseUpdateApp) normalizeUpdateCommand(
	ctx context.Context,
	input *kbdto.UpdateKnowledgeBaseInput,
	kb *kbentity.KnowledgeBase,
) (*normalizedUpdateKnowledgeBaseCommand, error) {
	currentAgentCodes, err := s.listKnowledgeBaseAgentCodes(ctx, kb.Code)
	if err != nil {
		return nil, err
	}
	// 更新链路不允许按本次请求重新判产品线，统一以存量 knowledge_base_type 为准。
	currentKnowledgeBaseType := knowledgeBaseTypeFromKnowledgeBase(kb)
	replaceSource := input.SourceBindings != nil || input.LegacyDocumentFiles != nil
	var normalizedBindings []sourcebindingdomain.Binding
	if replaceSource {
		bindingInputs, resolveErr := s.resolveUpdateSourceBindingInputs(ctx, input)
		if resolveErr != nil {
			return nil, resolveErr
		}
		normalizedBindings = normalizeSourceBindingInputs(bindingInputs)
	}
	command := &normalizedUpdateKnowledgeBaseCommand{
		currentKnowledgeBaseType: currentKnowledgeBaseType,
		knowledgeBaseType:        currentKnowledgeBaseType,
		currentAgentCodes:        append([]string(nil), currentAgentCodes...),
		sourceType:               nil,
		agentCodes:               currentAgentCodes,
		replaceSource:            replaceSource,
	}
	if !replaceSource {
		return command, nil
	}
	normalizedSourceType, err := s.resolveUpdateSourceType(
		currentKnowledgeBaseType,
		updateSourceTypeInput{
			currentSourceType: kb.SourceType,
		},
	)
	if err != nil {
		return nil, err
	}
	command.validationSourceType = normalizedSourceType
	if err := validateSourceBindingsForSourceType(currentKnowledgeBaseType, command.validationSourceType, normalizedBindings); err != nil {
		return nil, err
	}
	command.sourceBindings = normalizedBindings
	return command, nil
}

func (s *KnowledgeBaseUpdateApp) persistUpdate(
	ctx context.Context,
	prepared *preparedUpdateKnowledgeBase,
) error {
	if prepared == nil || prepared.kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	var flow *KnowledgeBaseDocumentFlowApp
	if prepared.replaceSource {
		var err error
		flow, err = s.requireDocumentFlow()
		if err != nil {
			return err
		}
	}
	if s.writeCoordinator != nil {
		if prepared.replaceSource {
			return flow.incrementallySyncSourceBindings(
				ctx,
				prepared.kb,
				prepared.organization,
				prepared.userID,
				prepared.sourceBindings,
				incrementalSyncOptions{
					ReplaceAgentBinding: prepared.replaceAgentBinding,
					AgentCodes:          prepared.agentCodes,
					PreviousKB:          prepared.previousKB,
					PreviousAgentCodes:  prepared.previousAgentCodes,
				},
			)
		}
		if _, err := s.writeCoordinator.Update(
			ctx,
			prepared.kb,
			false,
			nil,
			prepared.replaceAgentBinding,
			prepared.agentCodes,
		); err != nil {
			return fmt.Errorf("failed to update knowledge base: %w", err)
		}
		return nil
	}

	if prepared.replaceSource {
		return flow.incrementallySyncSourceBindings(
			ctx,
			prepared.kb,
			prepared.organization,
			prepared.userID,
			prepared.sourceBindings,
			incrementalSyncOptions{
				ReplaceAgentBinding: prepared.replaceAgentBinding,
				AgentCodes:          prepared.agentCodes,
				PreviousKB:          prepared.previousKB,
				PreviousAgentCodes:  prepared.previousAgentCodes,
			},
		)
	}
	if err := s.domainService.Update(ctx, prepared.kb); err != nil {
		return fmt.Errorf("failed to update knowledge base: %w", err)
	}
	if prepared.replaceAgentBinding {
		if err := s.replaceKnowledgeBaseAgentBindings(ctx, prepared.kb.Code, prepared.kb.OrganizationCode, prepared.userID, prepared.agentCodes); err != nil {
			return err
		}
	}
	return nil
}

// Destroy 删除知识库。
func (s *KnowledgeBaseDestroyApp) Destroy(ctx context.Context, code, orgCode, userID string) error {
	if _, err := s.ensureKnowledgeBaseActionAllowed(ctx, orgCode, userID, code, "delete"); err != nil {
		return err
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, code, orgCode)
	if err != nil {
		return fmt.Errorf("failed to find knowledge base: %w", err)
	}

	return s.destroyKnowledgeBase(ctx, kb)
}

func (s *KnowledgeBaseAppService) grantKnowledgeBaseOwner(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	input *kbdto.CreateKnowledgeBaseInput,
) error {
	if s == nil || kb == nil || input == nil {
		return nil
	}
	accessService, err := s.knowledgeAccessService()
	if err != nil {
		return err
	}
	if err := accessService.Initialize(ctx, kbaccess.Actor{
		OrganizationCode: input.OrganizationCode,
		UserID:           input.UserID,
	}, kbaccess.InitializeInput{
		KnowledgeBaseCode: kb.Code,
		OwnerUserID:       input.UserID,
		KnowledgeType:     kb.Type,
		BusinessID:        kb.BusinessID,
	}); err != nil {
		return fmt.Errorf("initialize knowledge base permission: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseDestroyApp) destroyKnowledgeBase(ctx context.Context, kb *kbentity.KnowledgeBase) error {
	if kb == nil {
		return nil
	}

	if s.destroyCoordinator != nil {
		if err := s.domainService.DeleteVectorData(ctx, kb); err != nil {
			return fmt.Errorf("failed to delete knowledge base vector data: %w", err)
		}
		if err := s.destroyCoordinator.Destroy(ctx, kb.ID, kb.Code); err != nil {
			return fmt.Errorf("failed to delete knowledge base records: %w", err)
		}
		s.cleanupKnowledgeBasePermissions(ctx, kb)
		return nil
	}

	if s.sourceBindingRepo != nil {
		if err := s.sourceBindingRepo.DeleteBindingsByKnowledgeBase(ctx, kb.Code); err != nil {
			return fmt.Errorf("failed to delete knowledge base source bindings: %w", err)
		}
	}
	if s.knowledgeBaseBindings != nil {
		if _, err := s.knowledgeBaseBindings.ReplaceBindings(
			ctx,
			kb.Code,
			kbentity.BindingTypeSuperMagicAgent,
			kb.OrganizationCode,
			kb.CreatedUID,
			[]string{},
		); err != nil {
			return fmt.Errorf("failed to delete knowledge base bindings: %w", err)
		}
	}
	if err := s.domainService.Destroy(ctx, kb); err != nil {
		return fmt.Errorf("failed to destroy knowledge base: %w", err)
	}
	s.cleanupKnowledgeBasePermissions(ctx, kb)
	return nil
}

func cloneKnowledgeBaseForUpdate(kb *kbentity.KnowledgeBase) *kbentity.KnowledgeBase {
	if kb == nil {
		return nil
	}
	cloned := *kb
	cloned.SourceType = cloneIntPtr(kb.SourceType)
	cloned.RetrieveConfig = shared.CloneRetrieveConfig(kb.RetrieveConfig)
	cloned.FragmentConfig = shared.CloneFragmentConfig(kb.FragmentConfig)
	cloned.EmbeddingConfig = shared.CloneEmbeddingConfig(kb.EmbeddingConfig)
	cloned.ResolvedRoute = sharedroute.CloneResolvedRoute(kb.ResolvedRoute)
	return &cloned
}

func (s *KnowledgeBaseAppService) cleanupKnowledgeBasePermissions(ctx context.Context, kb *kbentity.KnowledgeBase) {
	if s == nil || kb == nil {
		return
	}
	accessService, err := s.knowledgeAccessService()
	if err != nil {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(ctx, "build knowledge access service failed", "knowledge_base_code", kb.Code, "error", err)
		}
		return
	}

	if err := accessService.Cleanup(ctx, kbaccess.Actor{
		OrganizationCode: kb.OrganizationCode,
		UserID:           kb.CreatedUID,
	}, kb.Code); err != nil && s.logger != nil {
		s.logger.KnowledgeWarnContext(ctx, "cleanup knowledge base permissions failed", "knowledge_base_code", kb.Code, "error", err)
	}
}
