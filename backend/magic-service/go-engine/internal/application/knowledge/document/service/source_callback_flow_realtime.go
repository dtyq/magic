package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/thirdplatform"
)

type sourceBindingFlowRealtimeRepairRepository interface {
	sourcebindingrepository.SyncModeRepairWriter
	sourcebindingrepository.TeamshareBindingReader
}

type sourceCallbackOrganizationInvalidator interface {
	InvalidateOrganization(ctx context.Context, organizationCode string) error
}

// repairFlowTeamshareRealtimeForCallback 在 third-file 回调进入原 realtime 查询前修复历史 flow 数据。
//
// 背景：flow 向量知识库没有实时同步开关，但历史 Teamshare binding 可能落成 sync_mode=manual。
// 原回调链路只查 sync_mode=realtime，于是会误判为 no_realtime_document 并跳过重分片。
// 这里先定位“本次回调关联的 flow Teamshare binding”，只把这些历史脏数据改成 realtime；
// 数字员工知识库也能绑定 Teamshare，但它有开关，所以 manual 不能在这里被修改。
func (s *ThirdFileRevectorizeAppService) repairFlowTeamshareRealtimeForCallback(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) error {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil || task == nil {
		return nil
	}
	repairRepo, ok := s.support.sourceBindingRepo.(sourceBindingFlowRealtimeRepairRepository)
	if !ok {
		return nil
	}

	candidates, err := s.collectFlowTeamshareRealtimeRepairCandidates(ctx, task, repairRepo)
	if err != nil {
		return err
	}
	if len(candidates) == 0 {
		return nil
	}
	typesByCode, err := s.loadKnowledgeBaseTypesByCode(ctx, task.OrganizationCode, collectBindingKnowledgeBaseCodes(candidates))
	if err != nil {
		return err
	}
	bindingIDs := sourcebindingservice.FlowTeamshareBindingIDsNeedingRealtime(typesByCode, candidates)
	if len(bindingIDs) == 0 {
		return nil
	}

	affected, err := repairRepo.MarkSourceBindingsRealtimeByIDs(ctx, bindingIDs)
	if err != nil {
		return fmt.Errorf("mark flow teamshare source bindings realtime: %w", err)
	}
	s.invalidateSourceCallbackCandidateCache(ctx, task.OrganizationCode)
	if affected > 0 && s.support.logger != nil {
		s.support.logger.InfoContext(
			ctx,
			"Repaired flow teamshare source bindings sync mode before callback",
			"organization_code", task.OrganizationCode,
			"third_platform_type", task.ThirdPlatformType,
			"third_file_id", task.ThirdFileID,
			"binding_count", affected,
		)
	}
	return nil
}

func (s *ThirdFileRevectorizeAppService) collectFlowTeamshareRealtimeRepairCandidates(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	repairRepo sourceBindingFlowRealtimeRepairRepository,
) ([]sourcebindingdomain.Binding, error) {
	// 候选来源一：已经物化出来的文档。这个路径能修复“文档存在但 binding 是 manual”的历史数据。
	docs, err := s.support.domainService.ListByThirdFileInOrg(
		ctx,
		task.OrganizationCode,
		task.ThirdPlatformType,
		task.ThirdFileID,
	)
	if err != nil {
		return nil, fmt.Errorf("list third-file documents before source binding repair: %w", err)
	}

	candidates := make([]sourcebindingdomain.Binding, 0)
	docBindings, err := s.loadDocumentSourceBindings(ctx, docs)
	if err != nil {
		return nil, err
	}
	candidates = append(candidates, docBindings...)

	// 候选来源二：当前 third-file 所属 Teamshare 知识库 root 下的 enabled binding。
	// 这个路径覆盖“文件刚进入绑定范围，还没物化文档”的 flow fan-out 场景。
	rootBindings, err := s.loadThirdFileRootBindingsForRepair(ctx, task, repairRepo)
	if err != nil {
		return nil, err
	}
	candidates = append(candidates, rootBindings...)
	return dedupeBindingsByID(candidates), nil
}

func (s *ThirdFileRevectorizeAppService) loadDocumentSourceBindings(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) ([]sourcebindingdomain.Binding, error) {
	sourceBindingIDs := make(map[int64]struct{}, len(docs))
	knowledgeBaseCodes := make([]string, 0, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.SourceBindingID <= 0 {
			continue
		}
		sourceBindingIDs[doc.SourceBindingID] = struct{}{}
		knowledgeBaseCodes = append(knowledgeBaseCodes, doc.KnowledgeBaseCode)
	}
	if len(sourceBindingIDs) == 0 {
		return nil, nil
	}
	bindingsByKnowledgeBase, err := s.support.sourceBindingRepo.ListBindingsByKnowledgeBases(ctx, compactStrings(knowledgeBaseCodes))
	if err != nil {
		return nil, fmt.Errorf("list source bindings by document knowledge bases: %w", err)
	}

	result := make([]sourcebindingdomain.Binding, 0, len(sourceBindingIDs))
	for _, bindings := range bindingsByKnowledgeBase {
		for _, binding := range bindings {
			if _, exists := sourceBindingIDs[binding.ID]; !exists {
				continue
			}
			result = append(result, binding)
		}
	}
	return result, nil
}

func (s *ThirdFileRevectorizeAppService) loadThirdFileRootBindingsForRepair(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	repairRepo sourceBindingFlowRealtimeRepairRepository,
) ([]sourcebindingdomain.Binding, error) {
	node, err := s.resolveThirdFileNode(ctx, task, nil)
	if err != nil {
		if errors.Is(err, thirdplatform.ErrDocumentUnavailable) ||
			errors.Is(err, thirdplatform.ErrIdentityMissing) ||
			errors.Is(err, errThirdFileNodeResolverUnavailable) ||
			errors.Is(err, errDocumentUserNotFound) {
			return nil, nil
		}
		if s.support.logger != nil {
			s.support.logger.WarnContext(
				ctx,
				"Resolve third-file node meta failed before flow source binding repair",
				"organization_code", task.OrganizationCode,
				"third_platform_type", task.ThirdPlatformType,
				"third_file_id", task.ThirdFileID,
				"third_knowledge_id", task.ThirdKnowledgeID,
				"error", err,
			)
		}
		return nil, nil
	}
	current := buildThirdFileCurrentSource(task, node)
	if current.KnowledgeBaseID == "" {
		return nil, nil
	}
	bindings, err := repairRepo.ListTeamshareBindingsByKnowledgeBase(
		ctx,
		task.OrganizationCode,
		sourcebindingdomain.ProviderTeamshare,
		current.KnowledgeBaseID,
	)
	if err != nil {
		return nil, fmt.Errorf("list teamshare source bindings before flow repair: %w", err)
	}
	return bindings, nil
}

func (s *ThirdFileRevectorizeAppService) loadKnowledgeBaseTypesByCode(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCodes []string,
) (map[string]string, error) {
	knowledgeBaseCodes = compactStrings(knowledgeBaseCodes)
	result := make(map[string]string, len(knowledgeBaseCodes))
	if s == nil || s.support == nil || s.support.kbService == nil || len(knowledgeBaseCodes) == 0 {
		return result, nil
	}
	kbs, _, err := s.support.kbService.List(ctx, &kbrepository.Query{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Codes:            knowledgeBaseCodes,
		Offset:           0,
		Limit:            len(knowledgeBaseCodes),
	})
	if err != nil {
		return nil, fmt.Errorf("list knowledge base types for source binding repair: %w", err)
	}
	for _, kb := range kbs {
		if kb == nil {
			continue
		}
		result[strings.TrimSpace(kb.Code)] = string(kb.KnowledgeBaseType)
	}
	return result, nil
}

func (s *ThirdFileRevectorizeAppService) invalidateSourceCallbackCandidateCache(
	ctx context.Context,
	organizationCode string,
) {
	if s == nil || s.support == nil || s.support.sourceBindingCache == nil {
		return
	}
	invalidator, ok := s.support.sourceBindingCache.(sourceCallbackOrganizationInvalidator)
	if !ok {
		return
	}
	if err := invalidator.InvalidateOrganization(ctx, organizationCode); err != nil && s.support.logger != nil {
		s.support.logger.WarnContext(ctx, "Invalidate source callback candidate cache failed", "organization_code", organizationCode, "error", err)
	}
}

func collectBindingKnowledgeBaseCodes(bindings []sourcebindingdomain.Binding) []string {
	codes := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		codes = append(codes, binding.KnowledgeBaseCode)
	}
	return compactStrings(codes)
}

func dedupeBindingsByID(bindings []sourcebindingdomain.Binding) []sourcebindingdomain.Binding {
	seen := make(map[int64]struct{}, len(bindings))
	result := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		if binding.ID <= 0 {
			continue
		}
		if _, exists := seen[binding.ID]; exists {
			continue
		}
		seen[binding.ID] = struct{}{}
		result = append(result, binding)
	}
	return result
}

func compactStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
