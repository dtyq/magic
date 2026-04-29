package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	texthelper "magic/internal/application/knowledge/helper/text"
	bindingplan "magic/internal/domain/knowledge/binding_plan"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
)

var (
	errIncrementalResolvedSourceItemNotFound = errors.New("incremental resolved source item not found")
	errIncrementalSavedBindingNotFound       = errors.New("incremental saved binding not found")
)

type incrementalBindingResolvedItem struct {
	bindingKey     string
	resolvedUserID string
	sourceItem     *sourcebindingentity.SourceItem
	document       sourcebindingservice.ResolvedDocument
}

type incrementalSyncOptions struct {
	ReplaceAgentBinding bool
	AgentCodes          []string
	PreviousKB          *kbentity.KnowledgeBase
	PreviousAgentCodes  []string
}

type preparedBindingChange struct {
	plan                bindingplan.BindingChangePlan
	applyInput          sourcebindingrepository.ApplyKnowledgeBaseBindingsInput
	rollbackInput       sourcebindingrepository.ApplyKnowledgeBaseBindingsInput
	previousBindingKeys map[string]struct{}
	resolvedItemsByID   map[string]incrementalBindingResolvedItem
}

type executedBindingChange struct {
	savedBindings []sourcebindingentity.Binding
	createdDocs   []*ManagedDocument
}

type rollbackBindingChangeInput struct {
	organizationCode        string
	prepared                *preparedBindingChange
	executed                executedBindingChange
	options                 incrementalSyncOptions
	restoreDeletedDocuments bool
	cause                   error
}

type sourceBindingIncrementalResolutionRepository struct {
	repo sourceBindingRepository
}

func (r sourceBindingIncrementalResolutionRepository) UpsertSourceItems(
	ctx context.Context,
	items []sourcebindingentity.SourceItem,
) ([]*sourcebindingentity.SourceItem, error) {
	sourceItems, err := r.repo.UpsertSourceItems(ctx, items)
	if err != nil {
		return nil, fmt.Errorf("upsert source items: %w", err)
	}
	return sourceItems, nil
}

func (s *KnowledgeBaseDocumentFlowApp) incrementallySyncSourceBindings(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingentity.Binding,
	options incrementalSyncOptions,
) error {
	prepared, err := s.prepareBindingChange(ctx, kb, organizationCode, userID, bindings)
	if err != nil {
		return err
	}
	return s.executeBindingChange(ctx, kb, organizationCode, userID, prepared, options)
}

func (s *KnowledgeBaseDocumentFlowApp) prepareBindingChange(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingentity.Binding,
) (*preparedBindingChange, error) {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return nil, ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return nil, ErrKnowledgeBaseDocumentFlowRequired
	}

	currentBindings, err := s.support.sourceBindingRepo.ListBindingsByKnowledgeBase(ctx, kb.Code)
	if err != nil {
		return nil, fmt.Errorf("list current source bindings: %w", err)
	}
	currentItems, err := s.support.sourceBindingRepo.ListBindingItemsByKnowledgeBase(ctx, kb.Code)
	if err != nil {
		return nil, fmt.Errorf("list current source binding items: %w", err)
	}
	currentBindingIDs := make([]int64, 0, len(currentBindings))
	for _, binding := range currentBindings {
		if binding.ID == 0 {
			continue
		}
		currentBindingIDs = append(currentBindingIDs, binding.ID)
	}
	currentDocuments, err := s.managedDocuments.ListManagedDocumentsBySourceBindingIDs(ctx, kb.Code, currentBindingIDs)
	if err != nil {
		return nil, fmt.Errorf("list current managed documents: %w", err)
	}
	if _, err := s.support.healKnowledgeBaseUIDs(ctx, kb, "source binding incremental"); err != nil {
		return nil, err
	}

	resolvedBindings, err := sourcebindingservice.NewIncrementalResolutionService(
		sourceBindingIncrementalResolutionRepository{repo: s.support.sourceBindingRepo},
		sourceBindingMaterializationResolver{flow: s},
		time.Now,
	).Resolve(ctx, sourcebindingservice.IncrementalResolveInput{
		OrganizationCode:    organizationCode,
		KnowledgeBaseUserID: knowledgeBaseUpdatedUserID(kb),
		KnowledgeBaseOwner:  knowledgeBaseCreatedUserID(kb),
		FallbackUserID:      userID,
		Bindings:            bindings,
		MaxDocuments:        knowledgeBaseMaterializeDocumentLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve incremental source bindings: %w", err)
	}
	desiredBindings, resolvedItemsByID := toIncrementalResolvedBindings(resolvedBindings)
	plan := bindingplan.Build(bindingplan.PlanInput{
		CurrentBindings:  toBindingSnapshots(currentBindings),
		CurrentItems:     toBindingItemSnapshots(currentItems),
		CurrentDocuments: toManagedDocumentSnapshots(currentDocuments),
		DesiredBindings:  desiredBindings,
	})

	return &preparedBindingChange{
		plan:                plan,
		applyInput:          buildBindingApplyInput(kb.Code, plan, bindings),
		rollbackInput:       buildRollbackBindingApplyInput(kb.Code, currentBindings, currentItems),
		previousBindingKeys: bindingKeysFromBindings(currentBindings),
		resolvedItemsByID:   resolvedItemsByID,
	}, nil
}

func (s *KnowledgeBaseDocumentFlowApp) executeBindingChange(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	organizationCode string,
	userID string,
	prepared *preparedBindingChange,
	options incrementalSyncOptions,
) error {
	if prepared == nil {
		return nil
	}
	savedBindings, err := s.applyBindingChange(ctx, kb, prepared, options)
	if err != nil {
		return err
	}
	executed := executedBindingChange{savedBindings: savedBindings}
	syncUserID := firstNonEmpty(userID, knowledgeBaseUpdatedUserID(kb), knowledgeBaseCreatedUserID(kb))
	createdDocs, pendingSyncs, err := s.createBindingChangeDocuments(
		ctx,
		kb,
		organizationCode,
		savedBindings,
		prepared,
		syncUserID,
	)
	if err != nil {
		executed.createdDocs = createdDocs
		return s.rollbackBindingChange(ctx, kb, rollbackBindingChangeInput{
			organizationCode:        organizationCode,
			prepared:                prepared,
			executed:                executed,
			options:                 options,
			restoreDeletedDocuments: false,
			cause:                   err,
		})
	}
	executed.createdDocs = createdDocs
	if err := s.destroyBindingChangeDocuments(ctx, kb.Code, organizationCode, prepared.plan.DeleteTargets); err != nil {
		return s.rollbackBindingChange(ctx, kb, rollbackBindingChangeInput{
			organizationCode:        organizationCode,
			prepared:                prepared,
			executed:                executed,
			options:                 options,
			restoreDeletedDocuments: true,
			cause:                   err,
		})
	}
	for _, request := range pendingSyncs {
		s.managedDocuments.ScheduleManagedDocumentSync(ctx, request)
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) applyBindingChange(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	prepared *preparedBindingChange,
	options incrementalSyncOptions,
) ([]sourcebindingentity.Binding, error) {
	if s.support != nil && s.support.writeCoordinator != nil {
		savedBindings, err := s.support.writeCoordinator.UpdateWithAppliedSourceBindings(
			ctx,
			kb,
			prepared.applyInput,
			options.ReplaceAgentBinding,
			options.AgentCodes,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to update knowledge base bindings: %w", err)
		}
		return savedBindings, nil
	}
	if err := s.support.domainService.Update(ctx, kb); err != nil {
		return nil, fmt.Errorf("failed to update knowledge base: %w", err)
	}
	savedBindings, err := s.support.sourceBindingRepo.ApplyKnowledgeBaseBindings(ctx, prepared.applyInput)
	if err != nil {
		return nil, fmt.Errorf("failed to apply source bindings: %w", err)
	}
	if options.ReplaceAgentBinding {
		if err := s.support.replaceKnowledgeBaseAgentBindings(
			ctx,
			kb.Code,
			kb.OrganizationCode,
			kb.UpdatedUID,
			options.AgentCodes,
		); err != nil {
			return nil, fmt.Errorf("replace knowledge base agent bindings: %w", err)
		}
	}
	return savedBindings, nil
}

func (s *KnowledgeBaseDocumentFlowApp) destroyBindingChangeDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
	targets []bindingplan.DeleteTarget,
) error {
	if len(targets) == 0 {
		return nil
	}
	codes := make([]string, 0, len(targets))
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		code := strings.TrimSpace(target.Document.Code)
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		codes = append(codes, code)
	}
	if err := s.managedDocuments.DestroyManagedDocumentsByCodes(ctx, knowledgeBaseCode, organizationCode, codes); err != nil {
		return fmt.Errorf("destroy changed managed documents: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) createBindingChangeDocuments(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	organizationCode string,
	savedBindings []sourcebindingentity.Binding,
	prepared *preparedBindingChange,
	syncUserID string,
) ([]*ManagedDocument, []*SyncDocumentInput, error) {
	if len(prepared.plan.CreateTargets) == 0 {
		return nil, nil, nil
	}
	savedBindingIDs := make(map[string]int64, len(savedBindings))
	for _, binding := range savedBindings {
		savedBindingIDs[bindingplan.BindingKey(binding.Provider, binding.RootType, binding.RootRef)] = binding.ID
	}

	createdDocs := make([]*ManagedDocument, 0, len(prepared.plan.CreateTargets))
	pendingSyncs := make([]*SyncDocumentInput, 0, len(prepared.plan.CreateTargets))
	for _, target := range prepared.plan.CreateTargets {
		item, exists := prepared.resolvedItemsByID[resolvedItemKey(target.BindingKey, target.SourceItemID)]
		if !exists {
			return nil, nil, fmt.Errorf(
				"%w: binding=%s source_item_id=%d",
				errIncrementalResolvedSourceItemNotFound,
				target.BindingKey,
				target.SourceItemID,
			)
		}
		bindingID, exists := savedBindingIDs[target.BindingKey]
		if !exists || bindingID == 0 {
			return nil, nil, fmt.Errorf("%w: %s", errIncrementalSavedBindingNotFound, target.BindingKey)
		}
		documentFile, _ := item.document.DocumentFile.(*docentity.File)
		created, err := s.managedDocuments.CreateManagedDocument(ctx, &CreateManagedDocumentInput{
			OrganizationCode:  organizationCode,
			UserID:            item.resolvedUserID,
			KnowledgeBaseCode: kb.Code,
			SourceBindingID:   bindingID,
			SourceItemID:      target.SourceItemID,
			AutoAdded:         item.document.AutoAdded,
			Name:              item.document.Name,
			DocType:           item.document.DocumentType,
			DocumentFile:      cloneDocumentFile(documentFile),
			ThirdPlatformType: incrementalMaterializedThirdPlatformType(target.BindingKey),
			ThirdFileID:       item.sourceItem.ItemRef,
			AutoSync:          false,
		})
		if err != nil {
			return createdDocs, pendingSyncs, fmt.Errorf("create managed document: %w", err)
		}
		createdDocs = append(createdDocs, created)
		pendingSyncs = append(pendingSyncs, &SyncDocumentInput{
			OrganizationCode:  organizationCode,
			KnowledgeBaseCode: kb.Code,
			Code:              created.Code,
			Mode:              knowledgeBaseSyncModeCreate,
			BusinessParams:    texthelper.BuildCreateBusinessParams(organizationCode, syncUserID, kb.Code),
		})
	}
	return createdDocs, pendingSyncs, nil
}

func (s *KnowledgeBaseDocumentFlowApp) rollbackBindingChange(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	input rollbackBindingChangeInput,
) error {
	rollbackErrors := []error{input.cause}
	if err := s.destroyCreatedManagedDocuments(ctx, kb.Code, input.executed.createdDocs); err != nil {
		rollbackErrors = append(rollbackErrors, err)
	}
	rollbackRestored := false
	if err := s.rollbackBindingApply(ctx, kb, input.prepared, input.executed.savedBindings, input.options); err != nil {
		rollbackErrors = append(rollbackErrors, err)
	} else {
		rollbackRestored = true
	}
	if input.restoreDeletedDocuments && rollbackRestored {
		s.scheduleRollbackManagedDocumentResyncs(
			ctx,
			kb,
			input.organizationCode,
			input.prepared.plan.DeleteTargets,
			input.options.PreviousKB,
		)
	}
	return errors.Join(rollbackErrors...)
}

func (s *KnowledgeBaseDocumentFlowApp) scheduleRollbackManagedDocumentResyncs(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	organizationCode string,
	targets []bindingplan.DeleteTarget,
	previousKB *kbentity.KnowledgeBase,
) {
	if len(targets) == 0 {
		return
	}
	syncUserID := firstNonEmpty(
		knowledgeBaseUpdatedUserID(previousKB),
		knowledgeBaseCreatedUserID(previousKB),
		knowledgeBaseUpdatedUserID(kb),
		knowledgeBaseCreatedUserID(kb),
	)
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		code := strings.TrimSpace(target.Document.Code)
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		s.managedDocuments.ScheduleManagedDocumentSync(ctx, &SyncDocumentInput{
			OrganizationCode:  organizationCode,
			KnowledgeBaseCode: kb.Code,
			Code:              code,
			Mode:              knowledgeBaseSyncModeResync,
			BusinessParams:    texthelper.BuildCreateBusinessParams(organizationCode, syncUserID, kb.Code),
		})
	}
}

func (s *KnowledgeBaseDocumentFlowApp) destroyCreatedManagedDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	createdDocs []*ManagedDocument,
) error {
	var destroyErr error
	for idx := len(createdDocs) - 1; idx >= 0; idx-- {
		doc := createdDocs[idx]
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		if err := s.managedDocuments.DestroyManagedDocument(ctx, doc.Code, knowledgeBaseCode); err != nil {
			destroyErr = errors.Join(destroyErr, fmt.Errorf("destroy created managed document %s: %w", doc.Code, err))
		}
	}
	return destroyErr
}

func (s *KnowledgeBaseDocumentFlowApp) rollbackBindingApply(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	prepared *preparedBindingChange,
	savedBindings []sourcebindingentity.Binding,
	options incrementalSyncOptions,
) error {
	rollbackTarget := buildRollbackKnowledgeBase(kb, options.PreviousKB)
	if prepared == nil || rollbackTarget == nil {
		return nil
	}
	rollbackInput := prepared.rollbackInput
	rollbackInput.DeleteBindingIDs = append(rollbackInput.DeleteBindingIDs, rollbackDeleteBindingIDs(savedBindings, prepared.previousBindingKeys)...)
	if s.support != nil && s.support.writeCoordinator != nil {
		_, err := s.support.writeCoordinator.UpdateWithAppliedSourceBindings(
			ctx,
			rollbackTarget,
			rollbackInput,
			options.ReplaceAgentBinding,
			options.PreviousAgentCodes,
		)
		if err != nil {
			return fmt.Errorf("rollback knowledge base bindings with coordinator: %w", err)
		}
		return nil
	}
	if err := s.support.domainService.Update(ctx, rollbackTarget); err != nil {
		return fmt.Errorf("rollback knowledge base: %w", err)
	}
	if _, err := s.support.sourceBindingRepo.ApplyKnowledgeBaseBindings(ctx, rollbackInput); err != nil {
		return fmt.Errorf("rollback source bindings: %w", err)
	}
	if options.ReplaceAgentBinding {
		if err := s.support.replaceKnowledgeBaseAgentBindings(
			ctx,
			rollbackTarget.Code,
			rollbackTarget.OrganizationCode,
			firstNonEmpty(strings.TrimSpace(kb.UpdatedUID), strings.TrimSpace(rollbackTarget.UpdatedUID)),
			options.PreviousAgentCodes,
		); err != nil {
			return fmt.Errorf("rollback knowledge base agent bindings: %w", err)
		}
	}
	return nil
}

func buildBindingApplyInput(
	knowledgeBaseCode string,
	plan bindingplan.BindingChangePlan,
	bindings []sourcebindingentity.Binding,
) sourcebindingrepository.ApplyKnowledgeBaseBindingsInput {
	input := sourcebindingrepository.ApplyKnowledgeBaseBindingsInput{
		KnowledgeBaseCode: knowledgeBaseCode,
		DeleteBindingIDs:  append([]int64(nil), plan.DeleteBindingIDs...),
		UpsertBindings:    make([]sourcebindingrepository.ApplyKnowledgeBaseBinding, 0, len(plan.ApplyBindings)),
	}
	bindingsByKey := make(map[string]sourcebindingentity.Binding, len(bindings))
	for _, binding := range bindings {
		binding = sourcebindingentity.NormalizeBinding(binding)
		bindingsByKey[bindingplan.BindingKey(binding.Provider, binding.RootType, binding.RootRef)] = binding
	}
	resolvedAt := time.Now()
	for _, target := range plan.ApplyBindings {
		bindingKey := bindingplan.BindingKey(
			target.DesiredBinding.Provider,
			target.DesiredBinding.RootType,
			target.DesiredBinding.RootRef,
		)
		binding := bindingsByKey[bindingKey]
		binding.ID = target.CurrentBindingID
		items := make([]sourcebindingentity.BindingItem, 0, len(target.DesiredItems))
		for _, item := range target.DesiredItems {
			items = append(items, sourcebindingentity.BindingItem{
				SourceItemID:   item.SourceItemID,
				ResolveReason:  item.ResolveReason,
				LastResolvedAt: &resolvedAt,
			})
		}
		input.UpsertBindings = append(input.UpsertBindings, sourcebindingrepository.ApplyKnowledgeBaseBinding{
			Binding: binding,
			Items:   items,
		})
	}
	return input
}

func buildRollbackBindingApplyInput(
	knowledgeBaseCode string,
	currentBindings []sourcebindingentity.Binding,
	currentItems []sourcebindingentity.BindingItem,
) sourcebindingrepository.ApplyKnowledgeBaseBindingsInput {
	itemsByBinding := make(map[int64][]sourcebindingentity.BindingItem, len(currentBindings))
	for _, item := range currentItems {
		itemsByBinding[item.BindingID] = append(itemsByBinding[item.BindingID], sourcebindingentity.BindingItem{
			SourceItemID:   item.SourceItemID,
			ResolveReason:  item.ResolveReason,
			LastResolvedAt: item.LastResolvedAt,
		})
	}
	input := sourcebindingrepository.ApplyKnowledgeBaseBindingsInput{
		KnowledgeBaseCode: knowledgeBaseCode,
		UpsertBindings:    make([]sourcebindingrepository.ApplyKnowledgeBaseBinding, 0, len(currentBindings)),
	}
	for _, binding := range currentBindings {
		input.UpsertBindings = append(input.UpsertBindings, sourcebindingrepository.ApplyKnowledgeBaseBinding{
			Binding: binding,
			Items:   append([]sourcebindingentity.BindingItem(nil), itemsByBinding[binding.ID]...),
		})
	}
	return input
}

func toBindingSnapshots(bindings []sourcebindingentity.Binding) []bindingplan.BindingSnapshot {
	snapshots := make([]bindingplan.BindingSnapshot, 0, len(bindings))
	for _, binding := range bindings {
		snapshots = append(snapshots, bindingplan.BindingSnapshot{
			ID:       binding.ID,
			Provider: binding.Provider,
			RootType: binding.RootType,
			RootRef:  binding.RootRef,
		})
	}
	return snapshots
}

func bindingKeysFromBindings(bindings []sourcebindingentity.Binding) map[string]struct{} {
	keys := make(map[string]struct{}, len(bindings))
	for _, binding := range bindings {
		keys[bindingplan.BindingKey(binding.Provider, binding.RootType, binding.RootRef)] = struct{}{}
	}
	return keys
}

func toBindingItemSnapshots(items []sourcebindingentity.BindingItem) []bindingplan.BindingItemSnapshot {
	snapshots := make([]bindingplan.BindingItemSnapshot, 0, len(items))
	for _, item := range items {
		snapshots = append(snapshots, bindingplan.BindingItemSnapshot{
			BindingID:    item.BindingID,
			SourceItemID: item.SourceItemID,
		})
	}
	return snapshots
}

func toManagedDocumentSnapshots(documents []*ManagedDocument) []bindingplan.ManagedDocumentSnapshot {
	snapshots := make([]bindingplan.ManagedDocumentSnapshot, 0, len(documents))
	for _, document := range documents {
		if document == nil {
			continue
		}
		snapshots = append(snapshots, bindingplan.ManagedDocumentSnapshot{
			Code:            document.Code,
			SourceBindingID: document.SourceBindingID,
			SourceItemID:    document.SourceItemID,
		})
	}
	return snapshots
}

func toBindingTargetSnapshots(targets []sourcebindingentity.BindingTarget) []bindingplan.BindingTargetSnapshot {
	snapshots := make([]bindingplan.BindingTargetSnapshot, 0, len(targets))
	for _, target := range targets {
		snapshots = append(snapshots, bindingplan.BindingTargetSnapshot{
			TargetType: target.TargetType,
			TargetRef:  target.TargetRef,
		})
	}
	return snapshots
}

func resolvedItemKey(bindingKey string, sourceItemID int64) string {
	return bindingKey + "|" + strconv.FormatInt(sourceItemID, 10)
}

func toIncrementalResolvedBindings(
	resolvedBindings []sourcebindingservice.IncrementalResolvedBinding,
) ([]bindingplan.DesiredBinding, map[string]incrementalBindingResolvedItem) {
	desiredBindings := make([]bindingplan.DesiredBinding, 0, len(resolvedBindings))
	resolvedItemsByID := make(map[string]incrementalBindingResolvedItem)
	for _, resolvedBinding := range resolvedBindings {
		binding := sourcebindingentity.NormalizeBinding(resolvedBinding.Binding)
		bindingKey := bindingplan.BindingKey(binding.Provider, binding.RootType, binding.RootRef)
		desired := bindingplan.DesiredBinding{
			Provider:   binding.Provider,
			RootType:   binding.RootType,
			RootRef:    binding.RootRef,
			SyncMode:   binding.SyncMode,
			Enabled:    binding.Enabled,
			SyncConfig: cloneMap(binding.SyncConfig),
			Targets:    toBindingTargetSnapshots(binding.Targets),
		}
		desired.ResolvedItems = make([]bindingplan.ResolvedSourceItem, 0, len(resolvedBinding.ResolvedItems))
		for _, resolvedItem := range resolvedBinding.ResolvedItems {
			if resolvedItem.SourceItem == nil {
				continue
			}
			desired.ResolvedItems = append(desired.ResolvedItems, bindingplan.ResolvedSourceItem{
				SourceItemID:  resolvedItem.SourceItem.ID,
				ResolveReason: resolvedItem.ResolveReason,
			})
			resolvedItemsByID[resolvedItemKey(bindingKey, resolvedItem.SourceItem.ID)] = incrementalBindingResolvedItem{
				bindingKey:     bindingKey,
				resolvedUserID: resolvedItem.ResolvedUserID,
				sourceItem:     resolvedItem.SourceItem,
				document:       resolvedItem.Document,
			}
		}
		desiredBindings = append(desiredBindings, desired)
	}
	return desiredBindings, resolvedItemsByID
}

func incrementalMaterializedThirdPlatformType(bindingKey string) string {
	parts := strings.Split(bindingKey, "|")
	if len(parts) == 0 {
		return ""
	}
	switch parts[0] {
	case "", sourcebindingentity.ProviderLocalUpload, sourcebindingentity.ProviderProject:
		return ""
	default:
		return parts[0]
	}
}

func rollbackDeleteBindingIDs(savedBindings []sourcebindingentity.Binding, previousBindingKeys map[string]struct{}) []int64 {
	deleteIDs := make([]int64, 0)
	for _, binding := range savedBindings {
		key := bindingplan.BindingKey(binding.Provider, binding.RootType, binding.RootRef)
		if _, exists := previousBindingKeys[key]; exists {
			continue
		}
		if binding.ID != 0 {
			deleteIDs = append(deleteIDs, binding.ID)
		}
	}
	return deleteIDs
}

func buildRollbackKnowledgeBase(currentKB, previousKB *kbentity.KnowledgeBase) *kbentity.KnowledgeBase {
	if previousKB == nil {
		return nil
	}
	rollbackTarget := cloneKnowledgeBaseForUpdate(previousKB)
	if rollbackTarget == nil {
		return nil
	}
	if currentKB != nil {
		rollbackTarget.UpdatedUID = currentKB.UpdatedUID
	}
	return rollbackTarget
}
