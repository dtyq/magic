package kbapp

import (
	"context"
	"fmt"
	"strings"

	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
)

type preparedCreateKnowledgeBase struct {
	kb             *knowledgebasedomain.KnowledgeBase
	effectiveModel string
	agentCodes     []string
	sourceBindings []sourcebindingdomain.Binding
	organization   string
	userID         string
	hasBindings    bool
}

type normalizedCreateKnowledgeBaseCommand struct {
	knowledgeBaseType knowledgebasedomain.Type
	sourceType        *int
	agentCodes        []string
	sourceBindings    []sourcebindingdomain.Binding
}

type preparedUpdateKnowledgeBase struct {
	kb                  *knowledgebasedomain.KnowledgeBase
	agentCodes          []string
	sourceBindings      []sourcebindingdomain.Binding
	replaceSource       bool
	replaceAgentBinding bool
	organization        string
	userID              string
	userOperation       knowledgeBasePermissionOperation
}

type normalizedUpdateKnowledgeBaseCommand struct {
	currentKnowledgeBaseType knowledgebasedomain.Type
	knowledgeBaseType        knowledgebasedomain.Type
	sourceType               *int
	agentCodes               []string
	sourceBindings           []sourcebindingdomain.Binding
	replaceSource            bool
	replaceAgentBinding      bool
}

// Create 创建知识库。
func (s *KnowledgeBaseCreateApp) Create(ctx context.Context, input *kbdto.CreateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error) {
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
	if err := s.persistCreate(ctx, prepared); err != nil {
		return nil, err
	}
	if err := s.grantKnowledgeBaseOwner(ctx, prepared.kb, input); err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return nil, err
	}

	return applyKnowledgeBaseUserOperation(
		applyKnowledgeBaseBindingInfo(
			s.entityToDTOWithResolvedModel(prepared.kb, prepared.effectiveModel),
			prepared.agentCodes,
			knowledgeBaseTypeFromAgentCodes(prepared.agentCodes),
		),
		knowledgeBasePermissionOwner,
	), nil
}

func (s *KnowledgeBaseCreateApp) findExistingByBusinessID(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) (*knowledgebasedomain.KnowledgeBase, bool, error) {
	if input == nil || strings.TrimSpace(input.BusinessID) == "" {
		return nil, false, nil
	}

	items, _, err := s.domainService.List(ctx, &knowledgebasedomain.Query{
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

	kb := knowledgebasedomain.BuildKnowledgeBaseForCreate(&knowledgebasedomain.CreateInput{
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
		s.logger.WarnContext(
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
	normalizedBindings := normalizeSourceBindingInputs(input.SourceBindings)
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

func (s *KnowledgeBaseCreateApp) persistCreate(ctx context.Context, prepared *preparedCreateKnowledgeBase) error {
	if prepared == nil || prepared.kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	if s.writeCoordinator == nil {
		return s.persistCreateWithoutCoordinator(ctx, prepared)
	}
	return s.persistCreateWithCoordinator(ctx, prepared)
}

func (s *KnowledgeBaseCreateApp) persistCreateWithCoordinator(ctx context.Context, prepared *preparedCreateKnowledgeBase) error {
	if err := s.domainService.PrepareForSave(ctx, prepared.kb); err != nil {
		return fmt.Errorf("failed to prepare knowledge base: %w", err)
	}
	savedBindings, err := s.writeCoordinator.Create(ctx, prepared.kb, prepared.sourceBindings, prepared.agentCodes)
	if err != nil {
		return fmt.Errorf("failed to create knowledge base: %w", err)
	}
	if !prepared.hasBindings {
		return nil
	}
	flow, err := s.requireDocumentFlow()
	if err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return err
	}
	if err := flow.materializeKnowledgeBaseDocuments(ctx, prepared.kb, prepared.organization, prepared.userID, savedBindings); err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return err
	}
	return nil
}

func (s *KnowledgeBaseCreateApp) persistCreateWithoutCoordinator(ctx context.Context, prepared *preparedCreateKnowledgeBase) error {
	if err := s.domainService.Save(ctx, prepared.kb); err != nil {
		return fmt.Errorf("failed to create knowledge base: %w", err)
	}
	if prepared.hasBindings {
		flow, err := s.requireDocumentFlow()
		if err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return err
		}
		if err := flow.replaceSourceBindingsAndMaterializeDocumentsWithBindings(ctx, prepared.kb, prepared.organization, prepared.userID, prepared.sourceBindings); err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
			return err
		}
	}
	if err := s.replaceKnowledgeBaseAgentBindings(ctx, prepared.kb.Code, prepared.kb.OrganizationCode, prepared.userID, prepared.agentCodes); err != nil {
		_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, prepared.kb)
		return err
	}
	return nil
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
	prepared, err := s.prepareUpdate(ctx, input, bypassPermission)
	if err != nil {
		return nil, err
	}
	if err := s.persistUpdate(ctx, prepared); err != nil {
		return nil, err
	}

	return applyKnowledgeBaseUserOperation(
		s.entityToDTOWithKnownBindings(ctx, prepared.kb, prepared.agentCodes),
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
	kb.ApplyUpdate(knowledgebasedomain.BuildKnowledgeBaseUpdatePatch(&knowledgebasedomain.UpdateInput{
		Name:              input.Name,
		Description:       input.Description,
		Enabled:           input.Enabled,
		Icon:              input.Icon,
		SourceType:        command.sourceType,
		KnowledgeBaseType: &command.knowledgeBaseType,
		RetrieveConfig:    confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		EmbeddingConfig:   confighelper.EmbeddingConfigDTOToEntity(input.EmbeddingConfig),
		FragmentConfig:    confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		UpdatedUID:        input.UserID,
	}))

	prepared := &preparedUpdateKnowledgeBase{
		kb:                  kb,
		agentCodes:          command.agentCodes,
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
	kb *knowledgebasedomain.KnowledgeBase,
) (*normalizedUpdateKnowledgeBaseCommand, error) {
	currentAgentCodes, err := s.listKnowledgeBaseAgentCodes(ctx, kb.Code)
	if err != nil {
		return nil, err
	}
	// 更新链路不允许按本次请求重新判产品线，统一以存量 knowledge_base_type 为准。
	currentKnowledgeBaseType := knowledgeBaseTypeFromKnowledgeBase(kb)
	replaceSource := input.SourceBindings != nil
	var normalizedBindings []sourcebindingdomain.Binding
	if replaceSource {
		normalizedBindings = normalizeSourceBindingInputs(*input.SourceBindings)
	}
	normalizedSourceType, err := s.resolveUpdateSourceType(
		ctx,
		currentKnowledgeBaseType,
		updateSourceTypeInput{
			inputSourceType:   input.SourceType,
			currentSourceType: kb.SourceType,
			knowledgeBaseCode: kb.Code,
			replaceSource:     replaceSource,
			bindings:          normalizedBindings,
		},
	)
	if err != nil {
		return nil, err
	}
	command := &normalizedUpdateKnowledgeBaseCommand{
		currentKnowledgeBaseType: currentKnowledgeBaseType,
		knowledgeBaseType:        currentKnowledgeBaseType,
		sourceType:               normalizedSourceType,
		agentCodes:               currentAgentCodes,
		replaceSource:            replaceSource,
	}
	if !replaceSource {
		return command, nil
	}
	if err := validateSourceBindingsForSourceType(currentKnowledgeBaseType, normalizedSourceType, normalizedBindings); err != nil {
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
		savedBindings, err := s.writeCoordinator.Update(
			ctx,
			prepared.kb,
			prepared.replaceSource,
			prepared.sourceBindings,
			prepared.replaceAgentBinding,
			prepared.agentCodes,
		)
		if err != nil {
			return fmt.Errorf("failed to update knowledge base: %w", err)
		}
		if prepared.replaceSource {
			if err := flow.rebuildKnowledgeBaseDocumentsFromBindings(ctx, prepared.kb, prepared.organization, prepared.userID, savedBindings); err != nil {
				return err
			}
		}
		return nil
	}

	if err := s.domainService.Update(ctx, prepared.kb); err != nil {
		return fmt.Errorf("failed to update knowledge base: %w", err)
	}
	if prepared.replaceSource {
		if err := flow.syncSourceBindingsAndRebuildDocuments(ctx, prepared.kb, prepared.organization, prepared.userID, prepared.sourceBindings); err != nil {
			return err
		}
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
	kb *knowledgebasedomain.KnowledgeBase,
	input *kbdto.CreateKnowledgeBaseInput,
) error {
	if s == nil || s.ownerGrantPort == nil || kb == nil || input == nil {
		return nil
	}

	if err := s.ownerGrantPort.GrantKnowledgeBaseOwner(
		ctx,
		input.OrganizationCode,
		input.UserID,
		kb.Code,
		input.UserID,
	); err != nil {
		return fmt.Errorf("grant knowledge base owner: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseDestroyApp) destroyKnowledgeBase(ctx context.Context, kb *knowledgebasedomain.KnowledgeBase) error {
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
			knowledgebasedomain.BindingTypeSuperMagicAgent,
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

func (s *KnowledgeBaseAppService) cleanupKnowledgeBasePermissions(ctx context.Context, kb *knowledgebasedomain.KnowledgeBase) {
	if s == nil || s.ownerGrantPort == nil || kb == nil {
		return
	}

	if err := s.ownerGrantPort.DeleteKnowledgeBasePermissions(
		ctx,
		kb.OrganizationCode,
		kb.CreatedUID,
		kb.Code,
	); err != nil && s.logger != nil {
		s.logger.WarnContext(ctx, "cleanup knowledge base permissions failed", "knowledge_base_code", kb.Code, "error", err)
	}
}
