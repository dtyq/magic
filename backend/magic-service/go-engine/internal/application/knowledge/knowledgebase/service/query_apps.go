package kbapp

import (
	"context"
	"fmt"

	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
)

// KnowledgeBaseSaveProcessApp 承接知识库进度更新查询流。
type KnowledgeBaseSaveProcessApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseShowApp 承接知识库详情查询流。
type KnowledgeBaseShowApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseListApp 承接知识库列表查询流。
type KnowledgeBaseListApp struct {
	*KnowledgeBaseAppService
}

// SaveProcessQueryApp 返回知识库进度更新查询应用服务。
func (s *KnowledgeBaseAppService) SaveProcessQueryApp() *KnowledgeBaseSaveProcessApp {
	return &KnowledgeBaseSaveProcessApp{KnowledgeBaseAppService: s}
}

// ShowQueryApp 返回知识库详情查询应用服务。
func (s *KnowledgeBaseAppService) ShowQueryApp() *KnowledgeBaseShowApp {
	return &KnowledgeBaseShowApp{KnowledgeBaseAppService: s}
}

// ListQueryApp 返回知识库列表查询应用服务。
func (s *KnowledgeBaseAppService) ListQueryApp() *KnowledgeBaseListApp {
	return &KnowledgeBaseListApp{KnowledgeBaseAppService: s}
}

// SaveProcess 更新知识库向量化进度。
func (s *KnowledgeBaseSaveProcessApp) SaveProcess(
	ctx context.Context,
	input *kbdto.SaveProcessKnowledgeBaseInput,
) (*kbdto.KnowledgeBaseDTO, error) {
	operation, err := s.ensureKnowledgeBaseActionAllowed(ctx, input.OrganizationCode, input.UserID, input.Code, "edit")
	if err != nil {
		return nil, err
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, input.Code, input.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}

	kb.SetProgress(input.ExpectedNum, input.CompletedNum, input.UserID)
	if err := s.domainService.UpdateProgress(ctx, kb); err != nil {
		return nil, fmt.Errorf("failed to update knowledge base progress: %w", err)
	}

	dto, err := s.entityToDTOWithContext(ctx, kb, input.UserID)
	if err != nil {
		return nil, err
	}
	return applyKnowledgeBaseUserOperation(dto, operation), nil
}

// Show 查询知识库详情。
func (s *KnowledgeBaseShowApp) Show(
	ctx context.Context,
	code, orgCode, userID string,
) (*kbdto.KnowledgeBaseDTO, error) {
	operation, err := s.ensureKnowledgeBaseActionAllowed(ctx, orgCode, userID, code, "read")
	if err != nil {
		return nil, err
	}
	kb, err := s.domainService.ShowByCodeAndOrg(ctx, code, orgCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}

	dto, err := s.entityToDTOWithContext(ctx, kb, userID)
	if err != nil {
		return nil, err
	}
	s.populateFragmentCounts(ctx, dto)
	return applyKnowledgeBaseUserOperation(dto, operation), nil
}

// List 查询知识库列表。
func (s *KnowledgeBaseListApp) List(
	ctx context.Context,
	input *kbdto.ListKnowledgeBaseInput,
) (*pagehelper.Result, error) {
	normalizedAgentCodes, err := normalizeAgentCodes(input.AgentCodes)
	if err != nil {
		return nil, err
	}
	accessibleCodes, operations, err := s.resolveKnowledgeBaseListScope(ctx, input, normalizedAgentCodes)
	if err != nil {
		return nil, err
	}
	if len(accessibleCodes) == 0 {
		return &pagehelper.Result{Total: 0, List: []*kbdto.KnowledgeBaseDTO{}}, nil
	}
	agentScoped := len(normalizedAgentCodes) > 0

	kbs, total, err := s.domainService.List(
		ctx,
		buildKnowledgeBaseListQuery(input, normalizedAgentCodes, accessibleCodes, agentScoped),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list knowledge bases: %w", err)
	}
	kbs, total = applyAgentScopedKnowledgeBasePage(kbs, total, agentScoped, operations, input.Offset, input.Limit)
	if len(kbs) == 0 {
		return &pagehelper.Result{Total: total, List: []*kbdto.KnowledgeBaseDTO{}}, nil
	}
	listedCodes := knowledgeBaseCodesFromEntities(kbs)
	accessibleSnapshot, err := s.resolveKnowledgeBaseBindingSnapshot(ctx, listedCodes)
	if err != nil {
		return nil, err
	}

	effectiveModel := ""
	if s != nil && s.domainService != nil {
		effectiveModel = s.domainService.ResolveRuntimeRoute(ctx, nil).Model
	}
	sourceBindingsByKnowledgeBase, err := s.listKnowledgeBaseSourceBindingDTOs(
		ctx,
		input.OrganizationCode,
		input.UserID,
		listedCodes,
	)
	if err != nil {
		return nil, err
	}
	agentBindingMetadataByKnowledgeBase, err := s.listAgentBindingMetadataByKnowledgeBase(
		ctx,
		input.OrganizationCode,
		normalizedAgentCodes,
	)
	if err != nil {
		return nil, err
	}
	list := s.buildKnowledgeBaseDTOList(
		kbs,
		effectiveModel,
		accessibleSnapshot,
		operations,
		sourceBindingsByKnowledgeBase,
		agentBindingMetadataByKnowledgeBase,
	)
	s.populateFragmentCountsBatch(ctx, list)

	return &pagehelper.Result{Total: total, List: list}, nil
}

func buildKnowledgeBaseListQuery(
	input *kbdto.ListKnowledgeBaseInput,
	agentCodes []string,
	accessibleCodes []string,
	agentScoped bool,
) *kbrepository.Query {
	offset := input.Offset
	limit := input.Limit
	if agentScoped {
		offset = 0
		limit = len(accessibleCodes)
	}
	return &kbrepository.Query{
		OrganizationCode:  input.OrganizationCode,
		Name:              input.Name,
		Type:              input.Type,
		KnowledgeBaseType: listKnowledgeBaseTypeFilter(agentCodes),
		Enabled:           input.Enabled,
		Codes:             accessibleCodes,
		BusinessIDs:       input.BusinessIDs,
		Offset:            offset,
		Limit:             limit,
	}
}

func applyAgentScopedKnowledgeBasePage(
	kbs []*kbentity.KnowledgeBase,
	total int64,
	agentScoped bool,
	operations map[string]kbaccess.Operation,
	offset int,
	limit int,
) ([]*kbentity.KnowledgeBase, int64) {
	if !agentScoped {
		return kbs, total
	}
	kbs = filterAgentScopedKnowledgeBasesByRead(kbs, operations)
	return paginateKnowledgeBases(kbs, offset, limit), int64(len(kbs))
}

func (s *KnowledgeBaseListApp) resolveKnowledgeBaseListScope(
	ctx context.Context,
	input *kbdto.ListKnowledgeBaseInput,
	agentCodes []string,
) ([]string, map[string]kbaccess.Operation, error) {
	if len(agentCodes) > 0 {
		return s.resolveAgentScopedKnowledgeBaseList(
			ctx,
			input.OrganizationCode,
			input.UserID,
			agentCodes,
			input.Codes,
		)
	}
	return s.filterReadableKnowledgeBaseCodes(ctx, input.OrganizationCode, input.UserID, input.Codes)
}

func (s *KnowledgeBaseListApp) resolveAgentScopedKnowledgeBaseList(
	ctx context.Context,
	organizationCode string,
	userID string,
	agentCodes []string,
	requestedCodes []string,
) ([]string, map[string]kbaccess.Operation, error) {
	if err := s.validateAccessibleSuperMagicAgents(ctx, organizationCode, userID, agentCodes); err != nil {
		return nil, nil, err
	}
	if s == nil || s.knowledgeBaseBindings == nil {
		return nil, nil, ErrKnowledgeBaseBindingRepositoryRequired
	}
	bindings, err := s.knowledgeBaseBindings.ListKnowledgeBaseBindingsByBindIDs(
		ctx,
		kbentity.BindingTypeSuperMagicAgent,
		agentCodes,
		organizationCode,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("list agent knowledge base bindings: %w", err)
	}
	codes := knowledgeBaseCodesFromAgentBindings(bindings)
	if len(requestedCodes) > 0 {
		codes = intersectKnowledgeBaseCodes(codes, requestedCodes)
	}
	if len(codes) == 0 {
		return []string{}, map[string]kbaccess.Operation{}, nil
	}
	accessService, err := s.knowledgeAccessService()
	if err != nil {
		s.warnAgentScopedKnowledgeBasePermissionFallback(
			ctx,
			"Build agent-scoped knowledge base access service failed",
			err,
			organizationCode,
			userID,
			codes,
		)
		return agentScopedKnowledgeBaseListScopeWithoutOperations(codes)
	}
	operations, err := accessService.BatchOperations(
		ctx,
		resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID),
		codes,
	)
	if err != nil {
		s.warnAgentScopedKnowledgeBasePermissionFallback(
			ctx,
			"Resolve agent-scoped knowledge base operations failed",
			err,
			organizationCode,
			userID,
			codes,
		)
		return agentScopedKnowledgeBaseListScopeWithoutOperations(codes)
	}
	return codes, operations, nil
}

func (s *KnowledgeBaseListApp) warnAgentScopedKnowledgeBasePermissionFallback(
	ctx context.Context,
	message string,
	err error,
	organizationCode string,
	userID string,
	codes []string,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		message,
		"organization_code",
		organizationCode,
		"user_id",
		userID,
		"knowledge_base_codes",
		append([]string(nil), codes...),
		"error",
		err,
	)
}

func agentScopedKnowledgeBaseListScopeWithoutOperations(codes []string) ([]string, map[string]kbaccess.Operation, error) {
	return codes, map[string]kbaccess.Operation{}, nil
}

func filterAgentScopedKnowledgeBasesByRead(
	kbs []*kbentity.KnowledgeBase,
	operations map[string]kbaccess.Operation,
) []*kbentity.KnowledgeBase {
	if len(kbs) == 0 {
		return nil
	}
	filtered := make([]*kbentity.KnowledgeBase, 0, len(kbs))
	for _, kb := range kbs {
		if kb == nil {
			continue
		}
		// Linked flow_vector KBs keep their original KB permission boundary:
		// agent visibility only allows entering the agent, not reading linked flow KB data.
		// digital_employee KBs still use agent visibility as their access boundary.
		if kb.KnowledgeBaseType == kbentity.KnowledgeBaseTypeFlowVector && !operations[kb.Code].CanRead() {
			continue
		}
		filtered = append(filtered, kb)
	}
	return filtered
}

func paginateKnowledgeBases(kbs []*kbentity.KnowledgeBase, offset, limit int) []*kbentity.KnowledgeBase {
	if len(kbs) == 0 {
		return nil
	}
	if offset < 0 {
		offset = 0
	}
	if offset >= len(kbs) {
		return []*kbentity.KnowledgeBase{}
	}
	if limit <= 0 {
		return kbs[offset:]
	}
	end := min(len(kbs), offset+limit)
	return kbs[offset:end]
}

func knowledgeBaseCodesFromAgentBindings(bindings []kbentity.AgentKnowledgeBaseBinding) []string {
	codes := make([]string, 0, len(bindings))
	seen := make(map[string]struct{}, len(bindings))
	for _, binding := range bindings {
		code := binding.KnowledgeBaseCode
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		codes = append(codes, code)
	}
	return codes
}

func intersectKnowledgeBaseCodes(codes, requestedCodes []string) []string {
	requested := normalizeKnowledgeBaseCodesForAgentBinding(requestedCodes)
	if len(requested) == 0 {
		return []string{}
	}
	requestedSet := make(map[string]struct{}, len(requested))
	for _, code := range requested {
		requestedSet[code] = struct{}{}
	}
	filtered := make([]string, 0, len(codes))
	for _, code := range codes {
		if _, ok := requestedSet[code]; ok {
			filtered = append(filtered, code)
		}
	}
	return filtered
}

func knowledgeBaseCodesFromEntities(kbs []*kbentity.KnowledgeBase) []string {
	codes := make([]string, 0, len(kbs))
	for _, kb := range kbs {
		if kb != nil {
			codes = append(codes, kb.Code)
		}
	}
	return codes
}

func (s *KnowledgeBaseListApp) buildKnowledgeBaseDTOList(
	kbs []*kbentity.KnowledgeBase,
	effectiveModel string,
	accessibleSnapshot *knowledgebasedomain.ProductLineSnapshot,
	operations map[string]kbaccess.Operation,
	sourceBindingsByKnowledgeBase map[string][]kbdto.SourceBindingDTO,
	agentBindingMetadataByKnowledgeBase map[string]kbentity.AgentKnowledgeBaseBindingMetadata,
) []*kbdto.KnowledgeBaseDTO {
	list := make([]*kbdto.KnowledgeBaseDTO, len(kbs))
	for i, kb := range kbs {
		dto := s.entityToDTOWithResolvedModel(kb, effectiveModel)
		dto = applyKnowledgeBaseBindingInfo(
			dto,
			accessibleSnapshot.AgentCodesByKnowledgeBase[kb.Code],
			knowledgeBaseTypeFromKnowledgeBase(kb),
		)
		dto = applyKnowledgeBaseUserOperation(dto, operations[kb.Code])
		dto.SourceBindings = sourceBindingsByKnowledgeBase[kb.Code]
		applyAgentBindingMetadata(dto, kb, agentBindingMetadataByKnowledgeBase[kb.Code])
		list[i] = dto
	}
	return list
}

func (s *KnowledgeBaseListApp) listAgentBindingMetadataByKnowledgeBase(
	ctx context.Context,
	organizationCode string,
	agentCodes []string,
) (map[string]kbentity.AgentKnowledgeBaseBindingMetadata, error) {
	result := make(map[string]kbentity.AgentKnowledgeBaseBindingMetadata)
	if len(agentCodes) != 1 {
		return result, nil
	}
	if s == nil || s.knowledgeBaseBindings == nil {
		return nil, ErrKnowledgeBaseBindingRepositoryRequired
	}
	bindings, err := s.knowledgeBaseBindings.ListKnowledgeBaseBindingsByBindID(
		ctx,
		kbentity.BindingTypeSuperMagicAgent,
		agentCodes[0],
		organizationCode,
	)
	if err != nil {
		return nil, fmt.Errorf("list agent knowledge base bindings: %w", err)
	}
	for _, binding := range bindings {
		if binding.KnowledgeBaseCode == "" {
			continue
		}
		result[binding.KnowledgeBaseCode] = binding.Metadata
	}
	return result, nil
}

func applyAgentBindingMetadata(
	dto *kbdto.KnowledgeBaseDTO,
	kb *kbentity.KnowledgeBase,
	metadata kbentity.AgentKnowledgeBaseBindingMetadata,
) {
	if dto == nil || kb == nil || kb.KnowledgeBaseType != kbentity.KnowledgeBaseTypeFlowVector {
		return
	}
	originEnabled := kb.Enabled
	bindingEnabled := metadata.IsEnabled()
	dto.OriginEnabled = &originEnabled
	dto.BindingEnabled = &bindingEnabled
	dto.Enabled = originEnabled && bindingEnabled
	if metadata.DisplayName != "" {
		dto.Name = metadata.DisplayName
	}
	if metadata.DisplayDescription != "" {
		dto.Description = metadata.DisplayDescription
	}
	if metadata.DisplayIcon != "" {
		dto.Icon = metadata.DisplayIcon
	}
}

func listKnowledgeBaseTypeFilter(agentCodes []string) *kbentity.Type {
	if len(agentCodes) > 0 {
		return nil
	}
	flowType := kbentity.KnowledgeBaseTypeFlowVector
	return &flowType
}
