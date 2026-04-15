package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	"magic/internal/constants"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/thirdplatform"
)

const (
	teamshareKnowledgeType            = 2
	teamshareSourceType               = constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki
	teamshareTempCodeTTL              = 7 * 24 * time.Hour
	teamshareVectorStatusPending      = 0
	teamshareVectorStatusProcessing   = 1
	teamshareVectorStatusCompleted    = 2
	teamshareTempCodeForwardKeyPrefix = "knowledge-code:generate:2:"
	teamshareTempCodeReverseKeyPrefix = "knowledge-code:teamshare-temp:2:"
	teamshareTempCodeWatchRetryTimes  = 8
)

// TeamshareTempCodeMapper 定义 Teamshare 临时 knowledge_code 双向映射能力。
type TeamshareTempCodeMapper interface {
	EnsureKnowledgeCode(ctx context.Context, businessID string) (string, error)
	LookupBusinessIDs(ctx context.Context, knowledgeCodes []string) (map[string]string, error)
}

// RedisTeamshareTempCodeMapper 使用 Redis 保存 Teamshare 临时 knowledge_code 双向映射。
type RedisTeamshareTempCodeMapper struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisTeamshareTempCodeMapper 创建 Redis Teamshare 临时 code 映射器。
func NewRedisTeamshareTempCodeMapper(client *redis.Client) TeamshareTempCodeMapper {
	if client == nil {
		return nil
	}
	return &RedisTeamshareTempCodeMapper{
		client: client,
		ttl:    teamshareTempCodeTTL,
	}
}

// EnsureKnowledgeCode 生成或复用 Teamshare 临时 knowledge_code。
func (m *RedisTeamshareTempCodeMapper) EnsureKnowledgeCode(ctx context.Context, businessID string) (string, error) {
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		return "", nil
	}
	if m == nil || m.client == nil {
		return "", ErrTeamshareTempCodeMapperRequired
	}

	for range teamshareTempCodeWatchRetryTimes {
		existing, err := m.client.Get(ctx, m.forwardKey(trimmedBusinessID)).Result()
		switch {
		case err == nil && strings.TrimSpace(existing) != "":
			return strings.TrimSpace(existing), nil
		case err != nil && !errors.Is(err, redis.Nil):
			return "", fmt.Errorf("get teamshare temp code: %w", err)
		}

		candidate := ensureKnowledgeBaseCode("")
		watchErr := m.client.Watch(ctx, func(tx *redis.Tx) error {
			current, err := tx.Get(ctx, m.forwardKey(trimmedBusinessID)).Result()
			switch {
			case err == nil && strings.TrimSpace(current) != "":
				candidate = strings.TrimSpace(current)
				return nil
			case err != nil && !errors.Is(err, redis.Nil):
				return fmt.Errorf("get watched teamshare temp code: %w", err)
			}

			_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Set(ctx, m.forwardKey(trimmedBusinessID), candidate, m.ttl)
				pipe.Set(ctx, m.reverseKey(candidate), trimmedBusinessID, m.ttl)
				return nil
			})
			if err != nil {
				return fmt.Errorf("persist teamshare temp code mappings: %w", err)
			}
			return nil
		}, m.forwardKey(trimmedBusinessID))
		if watchErr == nil {
			return candidate, nil
		}
		if errors.Is(watchErr, redis.TxFailedErr) {
			continue
		}
		return "", fmt.Errorf("watch teamshare temp code: %w", watchErr)
	}

	code, err := m.client.Get(ctx, m.forwardKey(trimmedBusinessID)).Result()
	if err != nil {
		return "", fmt.Errorf("read teamshare temp code after retry: %w", err)
	}
	return strings.TrimSpace(code), nil
}

// LookupBusinessIDs 反查一组 Teamshare 临时 knowledge_code 对应的 business_id。
func (m *RedisTeamshareTempCodeMapper) LookupBusinessIDs(
	ctx context.Context,
	knowledgeCodes []string,
) (map[string]string, error) {
	if m == nil || m.client == nil {
		return nil, ErrTeamshareTempCodeMapperRequired
	}
	if len(knowledgeCodes) == 0 {
		return map[string]string{}, nil
	}

	indexByKey := make(map[string]string, len(knowledgeCodes))
	keys := make([]string, 0, len(knowledgeCodes))
	for _, knowledgeCode := range knowledgeCodes {
		trimmedCode := strings.TrimSpace(knowledgeCode)
		if trimmedCode == "" {
			continue
		}
		key := m.reverseKey(trimmedCode)
		if _, exists := indexByKey[key]; exists {
			continue
		}
		indexByKey[key] = trimmedCode
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return map[string]string{}, nil
	}

	values, err := m.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("mget teamshare temp code reverse mapping: %w", err)
	}

	result := make(map[string]string, len(values))
	for idx, raw := range values {
		if idx >= len(keys) || raw == nil {
			continue
		}
		code := indexByKey[keys[idx]]
		businessID := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if code == "" || businessID == "" {
			continue
		}
		result[code] = businessID
	}
	return result, nil
}

func (m *RedisTeamshareTempCodeMapper) forwardKey(businessID string) string {
	return teamshareTempCodeForwardKeyPrefix + businessID
}

func (m *RedisTeamshareTempCodeMapper) reverseKey(knowledgeCode string) string {
	return teamshareTempCodeReverseKeyPrefix + knowledgeCode
}

// TeamshareStartVector 触发 Teamshare 知识库向量化接管。
func (s *KnowledgeBaseAppService) TeamshareStartVector(
	ctx context.Context,
	input *kbdto.TeamshareStartVectorInput,
) (*kbdto.TeamshareStartVectorResult, error) {
	if input == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	if s == nil || s.domainService == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	if s.thirdPlatformExpander == nil {
		return nil, ErrKnowledgeBaseThirdPlatformExpanderRequired
	}
	if s.sourceBindingRepo == nil {
		return nil, ErrKnowledgeBaseSourceBindingRepositoryRequired
	}

	knowledgeItem, err := s.requireManageableTeamshareKnowledge(ctx, input.OrganizationCode, input.UserID, input.KnowledgeID)
	if err != nil {
		return nil, err
	}

	knowledgeBase, created, err := s.upsertTeamshareKnowledge(ctx, input.OrganizationCode, input.UserID, knowledgeItem)
	if err != nil {
		return nil, err
	}
	if created {
		if err := s.grantKnowledgeBaseOwner(ctx, knowledgeBase, &kbdto.CreateKnowledgeBaseInput{
			OrganizationCode: input.OrganizationCode,
			UserID:           input.UserID,
		}); err != nil {
			_ = s.DestroyCommandApp().destroyKnowledgeBase(ctx, knowledgeBase)
			return nil, err
		}
	}

	if err := s.prepareTeamshareKnowledgeRebuild(ctx, knowledgeBase, input.UserID); err != nil {
		return nil, err
	}
	return &kbdto.TeamshareStartVectorResult{KnowledgeCode: knowledgeBase.Code}, nil
}

// TeamshareManageable 返回当前用户可管理的 Teamshare 知识库列表。
func (s *KnowledgeBaseAppService) TeamshareManageable(
	ctx context.Context,
	input *kbdto.TeamshareManageableInput,
) ([]*kbdto.TeamshareKnowledgeProgressDTO, error) {
	if input == nil {
		return []*kbdto.TeamshareKnowledgeProgressDTO{}, nil
	}
	if s == nil || s.thirdPlatformExpander == nil {
		return nil, ErrKnowledgeBaseThirdPlatformExpanderRequired
	}

	knowledgeItems, err := s.thirdPlatformExpander.ListKnowledgeBases(ctx, input.OrganizationCode, input.UserID)
	if err != nil {
		return nil, fmt.Errorf("list teamshare manageable knowledge bases: %w", err)
	}
	if len(knowledgeItems) == 0 {
		return []*kbdto.TeamshareKnowledgeProgressDTO{}, nil
	}

	knowledgeIDs := make([]string, 0, len(knowledgeItems))
	for _, item := range knowledgeItems {
		knowledgeID := strings.TrimSpace(item.KnowledgeBaseID)
		if knowledgeID == "" {
			continue
		}
		knowledgeIDs = append(knowledgeIDs, knowledgeID)
	}

	localKnowledge, err := s.listTeamshareKnowledgeByBusinessIDs(ctx, input.OrganizationCode, knowledgeIDs)
	if err != nil {
		return nil, err
	}

	list := make([]*kbdto.TeamshareKnowledgeProgressDTO, 0, len(knowledgeItems))
	for _, item := range knowledgeItems {
		knowledgeID := strings.TrimSpace(item.KnowledgeBaseID)
		if knowledgeID == "" {
			continue
		}
		if knowledgeBase := localKnowledge[knowledgeID]; knowledgeBase != nil {
			list = append(list, teamshareProgressDTO(knowledgeBase.Code, knowledgeBase.Code, knowledgeBase))
			continue
		}
		if s.teamshareTempCodes == nil {
			return nil, ErrTeamshareTempCodeMapperRequired
		}
		tempCode, err := s.teamshareTempCodes.EnsureKnowledgeCode(ctx, knowledgeID)
		if err != nil {
			return nil, fmt.Errorf("ensure teamshare temp code: %w", err)
		}
		list = append(list, &kbdto.TeamshareKnowledgeProgressDTO{
			KnowledgeCode: tempCode,
			KnowledgeType: teamshareKnowledgeType,
			BusinessID:    knowledgeID,
			Name:          strings.TrimSpace(item.Name),
			Description:   strings.TrimSpace(item.Description),
			VectorStatus:  teamshareVectorStatusPending,
			ExpectedNum:   0,
			CompletedNum:  0,
		})
	}
	return list, nil
}

// TeamshareManageableProgress 按请求顺序返回 Teamshare 知识库向量化进度。
func (s *KnowledgeBaseAppService) TeamshareManageableProgress(
	ctx context.Context,
	input *kbdto.TeamshareManageableProgressInput,
) ([]*kbdto.TeamshareKnowledgeProgressDTO, error) {
	if input == nil {
		return []*kbdto.TeamshareKnowledgeProgressDTO{}, nil
	}
	knowledgeByCode, err := s.listTeamshareKnowledgeByCodes(ctx, input.OrganizationCode, input.KnowledgeCodes)
	if err != nil {
		return nil, err
	}

	missingCodes := make([]string, 0, len(input.KnowledgeCodes))
	for _, knowledgeCode := range input.KnowledgeCodes {
		trimmedCode := strings.TrimSpace(knowledgeCode)
		if trimmedCode == "" {
			continue
		}
		if _, exists := knowledgeByCode[trimmedCode]; exists {
			continue
		}
		missingCodes = append(missingCodes, trimmedCode)
	}

	reverseBusinessIDs := map[string]string{}
	if len(missingCodes) > 0 {
		if s.teamshareTempCodes == nil {
			return nil, ErrTeamshareTempCodeMapperRequired
		}
		reverseBusinessIDs, err = s.teamshareTempCodes.LookupBusinessIDs(ctx, missingCodes)
		if err != nil {
			return nil, fmt.Errorf("lookup teamshare temp code reverse mapping: %w", err)
		}
	}

	businessIDs := make([]string, 0, len(reverseBusinessIDs))
	for _, businessID := range reverseBusinessIDs {
		if businessID == "" {
			continue
		}
		businessIDs = append(businessIDs, businessID)
	}

	knowledgeByBusinessID := map[string]*knowledgebasedomain.KnowledgeBase{}
	if len(businessIDs) > 0 {
		knowledgeByBusinessID, err = s.listTeamshareKnowledgeByBusinessIDs(ctx, input.OrganizationCode, businessIDs)
		if err != nil {
			return nil, err
		}
	}

	list := make([]*kbdto.TeamshareKnowledgeProgressDTO, 0, len(input.KnowledgeCodes))
	for _, knowledgeCode := range input.KnowledgeCodes {
		trimmedCode := strings.TrimSpace(knowledgeCode)
		if knowledgeBase := knowledgeByCode[trimmedCode]; knowledgeBase != nil {
			list = append(list, teamshareProgressDTO(trimmedCode, knowledgeBase.Code, knowledgeBase))
			continue
		}

		businessID := reverseBusinessIDs[trimmedCode]
		if knowledgeBase := knowledgeByBusinessID[businessID]; knowledgeBase != nil {
			list = append(list, teamshareProgressDTO(trimmedCode, knowledgeBase.Code, knowledgeBase))
			continue
		}

		list = append(list, &kbdto.TeamshareKnowledgeProgressDTO{
			KnowledgeCode: trimmedCode,
			KnowledgeType: teamshareKnowledgeType,
			BusinessID:    businessID,
			Name:          "",
			Description:   "",
			VectorStatus:  teamshareVectorStatusPending,
			ExpectedNum:   0,
			CompletedNum:  0,
		})
	}
	return list, nil
}

func (s *KnowledgeBaseAppService) requireManageableTeamshareKnowledge(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeID string,
) (*thirdplatform.KnowledgeBaseItem, error) {
	knowledgeItems, err := s.thirdPlatformExpander.ListKnowledgeBases(ctx, organizationCode, userID)
	if err != nil {
		return nil, fmt.Errorf("list teamshare manageable knowledge bases: %w", err)
	}
	targetKnowledgeID := strings.TrimSpace(knowledgeID)
	for _, item := range knowledgeItems {
		if strings.TrimSpace(item.KnowledgeBaseID) != targetKnowledgeID {
			continue
		}
		itemCopy := item
		return &itemCopy, nil
	}
	return nil, fmt.Errorf("%w: knowledge_id=%s", ErrKnowledgeBasePermissionDenied, targetKnowledgeID)
}

func (s *KnowledgeBaseAppService) upsertTeamshareKnowledge(
	ctx context.Context,
	organizationCode string,
	userID string,
	item *thirdplatform.KnowledgeBaseItem,
) (*knowledgebasedomain.KnowledgeBase, bool, error) {
	if item == nil {
		return nil, false, shared.ErrKnowledgeBaseNotFound
	}

	name := strings.TrimSpace(item.Name)
	description := strings.TrimSpace(item.Description)
	knowledgeID := strings.TrimSpace(item.KnowledgeBaseID)
	sourceType := teamshareSourceType
	bindingInputs := []sourcebindingdomain.Binding{{
		Provider: sourcebindingdomain.ProviderTeamshare,
		RootType: sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:  knowledgeID,
		SyncMode: sourcebindingdomain.SyncModeManual,
		Enabled:  true,
	}}

	currentKnowledge, err := s.findTeamshareKnowledgeByBusinessID(ctx, organizationCode, knowledgeID)
	if err != nil {
		return nil, false, err
	}
	if currentKnowledge == nil {
		knowledgeBase := knowledgebasedomain.BuildKnowledgeBaseForCreate(&knowledgebasedomain.CreateInput{
			Name:              name,
			Description:       description,
			Type:              teamshareKnowledgeType,
			KnowledgeBaseType: knowledgebasedomain.KnowledgeBaseTypeFlowVector,
			BusinessID:        knowledgeID,
			OrganizationCode:  organizationCode,
			UserID:            userID,
			SourceType:        &sourceType,
		})
		route := s.domainService.ResolveRuntimeRoute(ctx, knowledgeBase)
		knowledgeBase.ApplyResolvedRoute(route)

		bindings := s.buildSourceBindings(knowledgeBase, organizationCode, userID, bindingInputs)
		if err := s.persistTeamshareKnowledgeCreate(ctx, knowledgeBase, bindings); err != nil {
			return nil, false, err
		}
		return knowledgeBase, true, nil
	}

	currentKnowledge.Name = name
	currentKnowledge.Description = description
	currentKnowledge.SourceType = &sourceType
	currentKnowledge.KnowledgeBaseType = knowledgebasedomain.KnowledgeBaseTypeFlowVector
	currentKnowledge.UpdatedUID = strings.TrimSpace(userID)
	knowledgebasedomain.NormalizeKnowledgeBaseConfigs(currentKnowledge)
	currentKnowledge.ApplyResolvedRoute(s.domainService.ResolveRuntimeRoute(ctx, currentKnowledge))

	bindings := s.buildSourceBindings(currentKnowledge, organizationCode, userID, bindingInputs)
	if err := s.persistTeamshareKnowledgeUpdate(ctx, currentKnowledge, bindings); err != nil {
		return nil, false, err
	}
	return currentKnowledge, false, nil
}

func (s *KnowledgeBaseAppService) persistTeamshareKnowledgeCreate(
	ctx context.Context,
	knowledgeBase *knowledgebasedomain.KnowledgeBase,
	bindings []sourcebindingdomain.Binding,
) error {
	if knowledgeBase == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	if s.writeCoordinator != nil {
		if err := s.domainService.PrepareForSave(ctx, knowledgeBase); err != nil {
			return fmt.Errorf("prepare teamshare knowledge base: %w", err)
		}
		if _, err := s.writeCoordinator.Create(ctx, knowledgeBase, bindings, nil); err != nil {
			return fmt.Errorf("create teamshare knowledge base: %w", err)
		}
		return nil
	}
	if err := s.domainService.Save(ctx, knowledgeBase); err != nil {
		return fmt.Errorf("create teamshare knowledge base: %w", err)
	}
	if _, err := s.sourceBindingRepo.ReplaceBindings(ctx, knowledgeBase.Code, bindings); err != nil {
		return fmt.Errorf("replace teamshare source bindings: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseAppService) persistTeamshareKnowledgeUpdate(
	ctx context.Context,
	knowledgeBase *knowledgebasedomain.KnowledgeBase,
	bindings []sourcebindingdomain.Binding,
) error {
	if knowledgeBase == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	if s.writeCoordinator != nil {
		if _, err := s.writeCoordinator.Update(ctx, knowledgeBase, true, bindings, false, nil); err != nil {
			return fmt.Errorf("update teamshare knowledge base: %w", err)
		}
		return nil
	}
	if err := s.domainService.Update(ctx, knowledgeBase); err != nil {
		return fmt.Errorf("update teamshare knowledge base: %w", err)
	}
	if _, err := s.sourceBindingRepo.ReplaceBindings(ctx, knowledgeBase.Code, bindings); err != nil {
		return fmt.Errorf("replace teamshare source bindings: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseAppService) prepareTeamshareKnowledgeRebuild(
	ctx context.Context,
	knowledgeBase *knowledgebasedomain.KnowledgeBase,
	userID string,
) error {
	flow, err := s.requireDocumentFlow()
	if err != nil {
		return err
	}
	if err := flow.prepareRebuildKnowledgeBase(ctx, knowledgeBase, RebuildScope{
		Mode:              RebuildScopeModeKnowledgeBase,
		OrganizationCode:  knowledgeBase.OrganizationCode,
		KnowledgeBaseCode: knowledgeBase.Code,
		UserID:            strings.TrimSpace(userID),
	}); err != nil {
		return fmt.Errorf("prepare teamshare knowledge rebuild: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseAppService) listTeamshareKnowledgeByBusinessIDs(
	ctx context.Context,
	organizationCode string,
	businessIDs []string,
) (map[string]*knowledgebasedomain.KnowledgeBase, error) {
	normalizedBusinessIDs := dedupeNonEmptyStrings(businessIDs)
	return s.listTeamshareKnowledge(ctx, organizationCode, &knowledgebasedomain.Query{
		BusinessIDs: normalizedBusinessIDs,
	}, "business ids", func(item *knowledgebasedomain.KnowledgeBase) string {
		return strings.TrimSpace(item.BusinessID)
	})
}

func (s *KnowledgeBaseAppService) listTeamshareKnowledgeByCodes(
	ctx context.Context,
	organizationCode string,
	codes []string,
) (map[string]*knowledgebasedomain.KnowledgeBase, error) {
	normalizedCodes := dedupeNonEmptyStrings(codes)
	return s.listTeamshareKnowledge(ctx, organizationCode, &knowledgebasedomain.Query{
		Codes: normalizedCodes,
	}, "codes", func(item *knowledgebasedomain.KnowledgeBase) string {
		return strings.TrimSpace(item.Code)
	})
}

func (s *KnowledgeBaseAppService) listTeamshareKnowledge(
	ctx context.Context,
	organizationCode string,
	query *knowledgebasedomain.Query,
	filterName string,
	keyFunc func(*knowledgebasedomain.KnowledgeBase) string,
) (map[string]*knowledgebasedomain.KnowledgeBase, error) {
	if keyFunc == nil {
		return map[string]*knowledgebasedomain.KnowledgeBase{}, nil
	}
	typeValue := teamshareKnowledgeType
	listQuery := &knowledgebasedomain.Query{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Type:             &typeValue,
		Offset:           0,
	}
	if query != nil {
		listQuery.Codes = append(listQuery.Codes, query.Codes...)
		listQuery.BusinessIDs = append(listQuery.BusinessIDs, query.BusinessIDs...)
	}
	listQuery.Limit = max(len(listQuery.Codes), len(listQuery.BusinessIDs))
	if listQuery.Limit == 0 {
		return map[string]*knowledgebasedomain.KnowledgeBase{}, nil
	}
	items, _, err := s.domainService.List(ctx, listQuery)
	if err != nil {
		return nil, fmt.Errorf("list teamshare knowledge bases by %s: %w", filterName, err)
	}

	result := make(map[string]*knowledgebasedomain.KnowledgeBase, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		key := keyFunc(item)
		if key == "" {
			continue
		}
		result[key] = item
	}
	return result, nil
}

func (s *KnowledgeBaseAppService) findTeamshareKnowledgeByBusinessID(
	ctx context.Context,
	organizationCode string,
	businessID string,
) (*knowledgebasedomain.KnowledgeBase, error) {
	knowledgeByBusinessID, err := s.listTeamshareKnowledgeByBusinessIDs(ctx, organizationCode, []string{businessID})
	if err != nil {
		return nil, err
	}
	return knowledgeByBusinessID[strings.TrimSpace(businessID)], nil
}

func teamshareProgressDTO(
	requestKnowledgeCode string,
	defaultKnowledgeCode string,
	knowledgeBase *knowledgebasedomain.KnowledgeBase,
) *kbdto.TeamshareKnowledgeProgressDTO {
	knowledgeCode := strings.TrimSpace(requestKnowledgeCode)
	if knowledgeCode == "" {
		knowledgeCode = strings.TrimSpace(defaultKnowledgeCode)
	}
	if knowledgeBase == nil {
		return &kbdto.TeamshareKnowledgeProgressDTO{
			KnowledgeCode: knowledgeCode,
			KnowledgeType: teamshareKnowledgeType,
			VectorStatus:  teamshareVectorStatusPending,
		}
	}
	return &kbdto.TeamshareKnowledgeProgressDTO{
		KnowledgeCode: knowledgeCode,
		KnowledgeType: teamshareKnowledgeType,
		BusinessID:    strings.TrimSpace(knowledgeBase.BusinessID),
		Name:          strings.TrimSpace(knowledgeBase.Name),
		Description:   strings.TrimSpace(knowledgeBase.Description),
		VectorStatus:  teamshareVectorStatusFromKnowledge(knowledgeBase),
		ExpectedNum:   knowledgeBase.ExpectedNum,
		CompletedNum:  knowledgeBase.CompletedNum,
	}
}

func teamshareVectorStatusFromKnowledge(knowledgeBase *knowledgebasedomain.KnowledgeBase) int {
	if knowledgeBase == nil {
		return teamshareVectorStatusPending
	}
	if knowledgeBase.ExpectedNum == knowledgeBase.CompletedNum {
		return teamshareVectorStatusCompleted
	}
	return teamshareVectorStatusProcessing
}

func dedupeNonEmptyStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
