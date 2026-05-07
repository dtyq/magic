package kbapp

import (
	"context"
	"fmt"
	"slices"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

const (
	defaultRepairSourceBindingBatchSize = 500
	maxRepairFailureSamples             = 20
)

// RepairSourceBindings 修复历史 teamshare 来源绑定并回填 fragment 文档映射。
func (s *SourceBindingRepairApp) RepairSourceBindings(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
) (*kbdto.RepairSourceBindingsResult, error) {
	flow, err := s.requireDocumentFlow()
	if err != nil {
		return nil, err
	}
	return flow.repairSourceBindings(ctx, input)
}

func (s *KnowledgeBaseDocumentFlowApp) repairSourceBindings(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
) (*kbdto.RepairSourceBindingsResult, error) {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return nil, ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return nil, ErrKnowledgeBaseDocumentFlowRequired
	}
	if s.support.fragmentRepair == nil {
		return nil, ErrKnowledgeBaseFragmentRepairRequired
	}

	organizationCodes, err := s.resolveRepairSourceBindingsOrganizationCodes(ctx, input)
	if err != nil {
		return nil, err
	}

	result, batchSize, err := buildRepairSourceBindingsAggregate(input, organizationCodes)
	if err != nil {
		return nil, err
	}
	if len(organizationCodes) == 0 {
		return result, nil
	}

	userID := ""
	if input != nil {
		userID = input.UserID
	}
	for _, organizationCode := range organizationCodes {
		orgInput := &kbdto.RepairSourceBindingsInput{
			OrganizationCode:  organizationCode,
			UserID:            userID,
			ThirdPlatformType: result.ThirdPlatformType,
			BatchSize:         batchSize,
		}
		orgResult, repairErr := s.repairSourceBindingsForOrganization(ctx, orgInput)
		if repairErr != nil {
			return nil, repairErr
		}
		mergeRepairSourceBindingsResult(result, orgResult)
	}

	return result, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveRepairSourceBindingsOrganizationCodes(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
) ([]string, error) {
	if input != nil {
		if explicit := normalizeRepairOrganizationCodes(input.OrganizationCodes); len(explicit) > 0 {
			return explicit, nil
		}
	}
	organizationCodes, err := s.support.fragmentRepair.ListThirdFileRepairOrganizationCodes(ctx)
	if err != nil {
		return nil, fmt.Errorf("list third file repair organization codes: %w", err)
	}
	return normalizeRepairOrganizationCodes(organizationCodes), nil
}

func (s *KnowledgeBaseDocumentFlowApp) repairSourceBindingsForOrganization(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
) (*kbdto.RepairSourceBindingsResult, error) {
	result, batchSize, err := buildRepairSourceBindingsContext(input)
	if err != nil {
		return nil, err
	}

	scannedKnowledge := make(map[string]struct{})
	for offset := 0; ; offset += batchSize {
		groups, listErr := s.support.fragmentRepair.ListThirdFileRepairGroups(ctx, thirdfilemappingpkg.RepairGroupQuery{
			OrganizationCode: result.OrganizationCode,
			Offset:           offset,
			Limit:            batchSize,
		})
		if listErr != nil {
			return nil, fmt.Errorf("list third file repair groups: %w", listErr)
		}
		if len(groups) == 0 {
			return result, nil
		}

		s.repairSourceBindingsBatch(ctx, input.UserID, groups, scannedKnowledge, result)
		if len(groups) < batchSize {
			return result, nil
		}
	}
}

func buildRepairSourceBindingsContext(
	input *kbdto.RepairSourceBindingsInput,
) (*kbdto.RepairSourceBindingsResult, int, error) {
	if input == nil || strings.TrimSpace(input.OrganizationCode) == "" {
		return nil, 0, ErrRepairSourceBindingsOrganizationRequired
	}

	thirdPlatformType := normalizeRepairThirdPlatformType(input.ThirdPlatformType)
	if thirdPlatformType != sourcebindingdomain.ProviderTeamshare {
		return nil, 0, fmt.Errorf("%w: %s", ErrUnsupportedRepairThirdPlatform, thirdPlatformType)
	}

	batchSize := input.BatchSize
	if batchSize <= 0 {
		batchSize = defaultRepairSourceBindingBatchSize
	}

	return &kbdto.RepairSourceBindingsResult{
		OrganizationCode:     strings.TrimSpace(input.OrganizationCode),
		OrganizationCodes:    []string{strings.TrimSpace(input.OrganizationCode)},
		ThirdPlatformType:    thirdPlatformType,
		ScannedOrganizations: 1,
		Failures:             make([]kbdto.RepairSourceBindingsFailure, 0, maxRepairFailureSamples),
	}, batchSize, nil
}

func buildRepairSourceBindingsAggregate(
	input *kbdto.RepairSourceBindingsInput,
	organizationCodes []string,
) (*kbdto.RepairSourceBindingsResult, int, error) {
	thirdPlatformType := normalizeRepairThirdPlatformType("")
	if input != nil {
		thirdPlatformType = normalizeRepairThirdPlatformType(input.ThirdPlatformType)
	}
	if thirdPlatformType != sourcebindingdomain.ProviderTeamshare {
		return nil, 0, fmt.Errorf("%w: %s", ErrUnsupportedRepairThirdPlatform, thirdPlatformType)
	}

	batchSize := defaultRepairSourceBindingBatchSize
	if input != nil && input.BatchSize > 0 {
		batchSize = input.BatchSize
	}

	normalizedOrganizationCodes := normalizeRepairOrganizationCodes(organizationCodes)
	result := &kbdto.RepairSourceBindingsResult{
		OrganizationCodes:    append([]string(nil), normalizedOrganizationCodes...),
		ThirdPlatformType:    thirdPlatformType,
		ScannedOrganizations: len(normalizedOrganizationCodes),
		Organizations:        make([]kbdto.RepairSourceBindingsOrganizationResult, 0, len(normalizedOrganizationCodes)),
		Failures:             make([]kbdto.RepairSourceBindingsFailure, 0, maxRepairFailureSamples),
	}
	if len(normalizedOrganizationCodes) == 1 {
		result.OrganizationCode = normalizedOrganizationCodes[0]
	}
	return result, batchSize, nil
}

func normalizeRepairOrganizationCodes(codes []string) []string {
	if len(codes) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(codes))
	normalized := make([]string, 0, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func mergeRepairSourceBindingsResult(
	aggregate *kbdto.RepairSourceBindingsResult,
	current *kbdto.RepairSourceBindingsResult,
) {
	if aggregate == nil || current == nil {
		return
	}
	aggregate.Organizations = append(aggregate.Organizations, kbdto.RepairSourceBindingsOrganizationResult{
		OrganizationCode:  current.OrganizationCode,
		ScannedKnowledge:  current.ScannedKnowledge,
		CandidateBindings: current.CandidateBindings,
		AddedBindings:     current.AddedBindings,
		MaterializedDocs:  current.MaterializedDocs,
		ReusedDocuments:   current.ReusedDocuments,
		BackfilledRows:    current.BackfilledRows,
		FailedGroups:      current.FailedGroups,
	})
	aggregate.ScannedKnowledge += current.ScannedKnowledge
	aggregate.CandidateBindings += current.CandidateBindings
	aggregate.AddedBindings += current.AddedBindings
	aggregate.MaterializedDocs += current.MaterializedDocs
	aggregate.ReusedDocuments += current.ReusedDocuments
	aggregate.BackfilledRows += current.BackfilledRows
	aggregate.FailedGroups += current.FailedGroups
	for _, failure := range current.Failures {
		if len(aggregate.Failures) >= maxRepairFailureSamples {
			break
		}
		aggregate.Failures = append(aggregate.Failures, failure)
	}
}

func (s *KnowledgeBaseDocumentFlowApp) repairSourceBindingsBatch(
	ctx context.Context,
	userID string,
	groups []*thirdfilemappingpkg.RepairGroup,
	scannedKnowledge map[string]struct{},
	result *kbdto.RepairSourceBindingsResult,
) {
	grouped, knowledgeCodes := groupRepairSourceBindings(groups, scannedKnowledge, result)
	for _, knowledgeCode := range knowledgeCodes {
		if err := s.repairKnowledgeSourceBindings(ctx, knowledgeCode, userID, grouped[knowledgeCode], result); err != nil {
			s.recordRepairSourceBindingFailure(result, result.OrganizationCode, knowledgeCode, "", err)
		}
	}
}

func groupRepairSourceBindings(
	groups []*thirdfilemappingpkg.RepairGroup,
	scannedKnowledge map[string]struct{},
	result *kbdto.RepairSourceBindingsResult,
) (map[string][]thirdfilemappingpkg.RepairGroup, []string) {
	grouped := make(map[string][]thirdfilemappingpkg.RepairGroup)
	for _, group := range groups {
		if group == nil {
			continue
		}
		group.KnowledgeCode = strings.TrimSpace(group.KnowledgeCode)
		group.ThirdFileID = strings.TrimSpace(group.ThirdFileID)
		if group.KnowledgeCode == "" || group.ThirdFileID == "" {
			continue
		}

		grouped[group.KnowledgeCode] = append(grouped[group.KnowledgeCode], *group)
		if _, exists := scannedKnowledge[group.KnowledgeCode]; exists {
			continue
		}

		scannedKnowledge[group.KnowledgeCode] = struct{}{}
		result.ScannedKnowledge++
	}

	knowledgeCodes := make([]string, 0, len(grouped))
	for knowledgeCode := range grouped {
		knowledgeCodes = append(knowledgeCodes, knowledgeCode)
	}
	slices.Sort(knowledgeCodes)

	return grouped, knowledgeCodes
}

func (s *KnowledgeBaseDocumentFlowApp) repairKnowledgeSourceBindings(
	ctx context.Context,
	knowledgeCode string,
	userID string,
	groups []thirdfilemappingpkg.RepairGroup,
	result *kbdto.RepairSourceBindingsResult,
) error {
	repairResult, err := s.newSourceBindingRepairService().RepairKnowledge(ctx, sourcebindingservice.RepairKnowledgeInput{
		OrganizationCode:  result.OrganizationCode,
		KnowledgeBaseCode: knowledgeCode,
		UserID:            userID,
		ThirdPlatformType: result.ThirdPlatformType,
		Groups:            append([]thirdfilemappingpkg.RepairGroup(nil), groups...),
	})
	if err != nil {
		return fmt.Errorf("repair source bindings for knowledge base %s: %w", knowledgeCode, err)
	}

	result.CandidateBindings += repairResult.CandidateBindings
	result.AddedBindings += repairResult.AddedBindings
	result.MaterializedDocs += repairResult.MaterializedDocs
	result.BackfilledRows += repairResult.BackfilledRows
	result.ReusedDocuments += repairResult.ReusedDocuments
	for _, failure := range repairResult.Failures {
		s.recordRepairSourceBindingFailure(result, result.OrganizationCode, knowledgeCode, failure.ThirdFileID, failure.Err)
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) newSourceBindingRepairService() *sourcebindingservice.RepairService {
	return sourcebindingservice.NewRepairService(
		sourceBindingRepairKnowledgeLoader{app: s},
		sourceBindingRepairRepository{repo: s.support.sourceBindingRepo},
		sourceBindingRepairDocumentStore{app: s},
		s.newSourceBindingMaterializationService(),
		sourceBindingRepairBackfiller{repair: s.support.fragmentRepair},
	)
}

type sourceBindingRepairKnowledgeLoader struct {
	app *KnowledgeBaseDocumentFlowApp
}

func (l sourceBindingRepairKnowledgeLoader) LoadRepairKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) (*sourcebindingservice.RepairKnowledgeBase, error) {
	kb, err := l.app.support.domainService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return nil, fmt.Errorf("show knowledge base by org: %w", err)
	}
	return &sourcebindingservice.RepairKnowledgeBase{
		Code:             kb.Code,
		OrganizationCode: kb.OrganizationCode,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
	}, nil
}

type sourceBindingRepairRepository struct {
	repo sourceBindingRepository
}

func (r sourceBindingRepairRepository) ListBindingsByKnowledgeBase(
	ctx context.Context,
	knowledgeCode string,
) ([]sourcebindingdomain.Binding, error) {
	bindings, err := r.repo.ListBindingsByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge base: %w", err)
	}
	return bindings, nil
}

func (r sourceBindingRepairRepository) ReplaceBindings(
	ctx context.Context,
	knowledgeCode string,
	newBindings []sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	savedBindings, err := r.repo.ReplaceBindings(ctx, knowledgeCode, newBindings)
	if err != nil {
		return nil, fmt.Errorf("replace source bindings during repair: %w", err)
	}
	return savedBindings, nil
}

func (r sourceBindingRepairRepository) SaveBindings(
	ctx context.Context,
	knowledgeCode string,
	newBindings []sourcebindingdomain.Binding,
) ([]sourcebindingdomain.Binding, error) {
	savedBindings, err := r.repo.SaveBindings(ctx, knowledgeCode, newBindings)
	if err != nil {
		return nil, fmt.Errorf("save source bindings during repair: %w", err)
	}
	return savedBindings, nil
}

type sourceBindingRepairDocumentStore struct {
	app *KnowledgeBaseDocumentFlowApp
}

func (s sourceBindingRepairDocumentStore) ListManagedDocumentCodeByThirdFile(
	ctx context.Context,
	knowledgeCode string,
	thirdPlatformType string,
) (map[string]string, error) {
	return s.app.loadManagedDocumentCodeByThirdFile(ctx, knowledgeCode, thirdPlatformType)
}

func (s sourceBindingRepairDocumentStore) DestroyKnowledgeBaseDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	return s.app.destroyKnowledgeBaseDocuments(ctx, knowledgeBaseCode, organizationCode)
}

type sourceBindingRepairBackfiller struct {
	repair fragmentRepairService
}

func (b sourceBindingRepairBackfiller) BackfillDocumentCodeByThirdFile(
	ctx context.Context,
	input sourcebindingservice.RepairBackfillInput,
) (int64, error) {
	rows, err := b.repair.BackfillDocumentCodeByThirdFile(ctx, thirdfilemappingpkg.BackfillByThirdFileInput{
		OrganizationCode: input.OrganizationCode,
		KnowledgeCode:    input.KnowledgeCode,
		ThirdFileID:      input.ThirdFileID,
		DocumentCode:     input.DocumentCode,
	})
	if err != nil {
		return 0, fmt.Errorf("backfill document code by third file: %w", err)
	}
	return rows, nil
}

func (s *KnowledgeBaseDocumentFlowApp) loadManagedDocumentCodeByThirdFile(
	ctx context.Context,
	knowledgeCode string,
	thirdPlatformType string,
) (map[string]string, error) {
	docs, err := s.listManagedDocumentsByKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return nil, err
	}
	return buildManagedDocumentCodeByThirdFile(docs, thirdPlatformType), nil
}

func (s *KnowledgeBaseDocumentFlowApp) listManagedDocumentsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]*knowledgeBaseManagedDocument, error) {
	if s == nil || s.managedDocuments == nil {
		return nil, ErrKnowledgeBaseDocumentFlowRequired
	}
	docs, err := s.managedDocuments.ListManagedDocumentsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("list managed documents by knowledge base: %w", err)
	}
	return docs, nil
}

func buildManagedDocumentCodeByThirdFile(
	docs []*knowledgeBaseManagedDocument,
	thirdPlatformType string,
) map[string]string {
	result := make(map[string]string, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.DocumentFile == nil {
			continue
		}
		if strings.TrimSpace(doc.DocumentFile.SourceType) != strings.TrimSpace(thirdPlatformType) {
			continue
		}
		thirdFileID := strings.TrimSpace(doc.DocumentFile.ThirdID)
		if thirdFileID == "" || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		result[thirdFileID] = strings.TrimSpace(doc.Code)
	}
	return result
}

func (s *KnowledgeBaseDocumentFlowApp) recordRepairSourceBindingFailure(
	result *kbdto.RepairSourceBindingsResult,
	organizationCode string,
	knowledgeCode string,
	thirdFileID string,
	err error,
) {
	if result == nil || err == nil {
		return
	}
	result.FailedGroups++
	if len(result.Failures) < maxRepairFailureSamples {
		result.Failures = append(result.Failures, kbdto.RepairSourceBindingsFailure{
			OrganizationCode: strings.TrimSpace(organizationCode),
			KnowledgeCode:    strings.TrimSpace(knowledgeCode),
			ThirdFileID:      strings.TrimSpace(thirdFileID),
			Message:          err.Error(),
		})
	}
}
