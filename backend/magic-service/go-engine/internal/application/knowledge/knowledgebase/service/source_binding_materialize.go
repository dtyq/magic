package kbapp

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strconv"
	"strings"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/ctxmeta"
)

const knowledgeBaseRebuildListLimit = 10_000

type materializedSourceDocument = sourcebindingdomain.ResolvedDocument

type materializeDocumentsOptions struct {
	ScheduleSync bool
}

func (s *KnowledgeBaseDocumentFlowApp) syncSourceBindingsAndRebuildDocuments(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) error {
	if len(bindings) == 0 {
		return nil
	}
	return s.replaceSourceBindingsAndRebuildDocumentsWithBindings(ctx, kb, organizationCode, userID, bindings)
}

func (s *KnowledgeBaseAppService) buildSourceBindings(
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	inputs []sourcebindingdomain.Binding,
) []sourcebindingdomain.Binding {
	if kb == nil {
		return []sourcebindingdomain.Binding{}
	}
	bindings := make([]sourcebindingdomain.Binding, 0, len(inputs))
	for _, input := range inputs {
		binding := sourcebindingdomain.NormalizeBinding(input)
		binding.OrganizationCode = organizationCode
		binding.KnowledgeBaseCode = kb.Code
		binding.CreatedUID = userID
		binding.UpdatedUID = userID
		binding.SyncConfig = cloneMap(binding.SyncConfig)
		binding.Targets = append([]sourcebindingdomain.BindingTarget(nil), binding.Targets...)
		bindings = append(bindings, binding)
	}
	return bindings
}

func (s *KnowledgeBaseDocumentFlowApp) replaceSourceBindingsAndRebuildDocumentsWithBindings(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) error {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return ErrKnowledgeBaseDocumentFlowRequired
	}

	savedBindings, err := s.support.sourceBindingRepo.ReplaceBindings(ctx, kb.Code, bindings)
	if err != nil {
		return fmt.Errorf("replace source bindings: %w", err)
	}
	return s.rebuildKnowledgeBaseDocumentsFromBindings(ctx, kb, organizationCode, userID, savedBindings)
}

func (s *KnowledgeBaseDocumentFlowApp) replaceSourceBindingsAndMaterializeDocumentsWithBindings(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) error {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return ErrKnowledgeBaseDocumentFlowRequired
	}

	savedBindings, err := s.support.sourceBindingRepo.ReplaceBindings(ctx, kb.Code, bindings)
	if err != nil {
		return fmt.Errorf("replace source bindings: %w", err)
	}
	return s.materializeKnowledgeBaseDocuments(ctx, kb, organizationCode, userID, savedBindings)
}

func (s *KnowledgeBaseDocumentFlowApp) rebuildKnowledgeBaseDocumentsFromBindings(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	savedBindings []sourcebindingdomain.Binding,
) error {
	if err := s.destroyKnowledgeBaseDocuments(ctx, kb.Code, firstNonEmpty(kb.OrganizationCode, organizationCode)); err != nil {
		return err
	}
	return s.materializeKnowledgeBaseDocuments(ctx, kb, organizationCode, userID, savedBindings)
}

func (s *KnowledgeBaseDocumentFlowApp) materializeKnowledgeBaseDocuments(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) error {
	count, err := s.materializeKnowledgeBaseDocumentsWithCount(
		ctx,
		kb,
		organizationCode,
		userID,
		bindings,
		materializeDocumentsOptions{ScheduleSync: true},
	)
	if err != nil {
		return err
	}
	if s != nil && s.support != nil && s.support.logger != nil && kb != nil {
		s.support.logger.InfoContext(
			ctx,
			"Materialized knowledge base documents from source bindings",
			"knowledge_base_code",
			kb.Code,
			"count",
			count,
		)
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) materializeKnowledgeBaseDocumentsWithCount(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
	options materializeDocumentsOptions,
) (int, error) {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return 0, ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return 0, ErrKnowledgeBaseDocumentFlowRequired
	}

	count, err := s.newSourceBindingMaterializationService().Materialize(ctx, sourcebindingdomain.MaterializationInput{
		KnowledgeBaseCode:   kb.Code,
		OrganizationCode:    organizationCode,
		KnowledgeBaseUserID: knowledgeBaseUpdatedUserID(kb),
		KnowledgeBaseOwner:  knowledgeBaseCreatedUserID(kb),
		FallbackUserID:      userID,
		Bindings:            bindings,
		ScheduleSync:        options.ScheduleSync,
	})
	if err != nil {
		return 0, fmt.Errorf("materialize source binding documents: %w", err)
	}
	return count, nil
}

type sourceBindingMaterializationResolver struct {
	flow *KnowledgeBaseDocumentFlowApp
}

func (r sourceBindingMaterializationResolver) ResolveBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	organizationCode string,
	userID string,
) ([]sourcebindingdomain.ResolvedDocument, error) {
	items, err := r.flow.resolveBindingDocuments(ctx, binding, organizationCode, userID)
	if err != nil {
		return nil, fmt.Errorf("resolve binding documents: %w", err)
	}
	return items, nil
}

type sourceBindingMaterializationRepository struct {
	repo sourceBindingRepository
}

func (r sourceBindingMaterializationRepository) UpsertSourceItem(
	ctx context.Context,
	item sourcebindingdomain.SourceItem,
) (*sourcebindingdomain.SourceItem, error) {
	sourceItem, err := r.repo.UpsertSourceItem(ctx, item)
	if err != nil {
		return nil, fmt.Errorf("upsert source item: %w", err)
	}
	return sourceItem, nil
}

func (r sourceBindingMaterializationRepository) ReplaceBindingItems(
	ctx context.Context,
	bindingID int64,
	items []sourcebindingdomain.BindingItem,
) error {
	if err := r.repo.ReplaceBindingItems(ctx, bindingID, items); err != nil {
		return fmt.Errorf("replace binding items: %w", err)
	}
	return nil
}

type sourceBindingManagedDocumentManager struct {
	manager knowledgeBaseManagedDocumentStore
}

func (m sourceBindingManagedDocumentManager) CreateManagedDocument(
	ctx context.Context,
	input sourcebindingdomain.CreateManagedDocumentInput,
) (*sourcebindingdomain.ManagedDocument, error) {
	documentFile, _ := input.DocumentFile.(*documentdomain.File)
	created, err := m.manager.CreateManagedDocument(ctx, &knowledgeBaseCreateManagedDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		SourceBindingID:   input.SourceBindingID,
		SourceItemID:      input.SourceItemID,
		Name:              input.Name,
		DocType:           input.DocType,
		DocumentFile:      cloneDocumentFile(documentFile),
		ThirdPlatformType: strings.TrimSpace(input.ThirdPlatformType),
		ThirdFileID:       strings.TrimSpace(input.ThirdFileID),
		AutoAdded:         input.AutoAdded,
		AutoSync:          input.AutoSync,
	})
	if err != nil {
		return nil, fmt.Errorf("create managed document: %w", err)
	}
	return &sourcebindingdomain.ManagedDocument{Code: created.Code}, nil
}

func (m sourceBindingManagedDocumentManager) DestroyManagedDocument(
	ctx context.Context,
	code string,
	knowledgeBaseCode string,
) error {
	if err := m.manager.DestroyManagedDocument(ctx, code, knowledgeBaseCode); err != nil {
		return fmt.Errorf("destroy managed document: %w", err)
	}
	return nil
}

func (m sourceBindingManagedDocumentManager) ScheduleManagedDocumentSync(ctx context.Context, input sourcebindingdomain.SyncRequest) {
	m.manager.ScheduleManagedDocumentSync(ctx, &knowledgeBaseSyncInput{
		OrganizationCode:  input.OrganizationCode,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		Code:              input.Code,
		Mode:              knowledgeBaseSyncModeCreate,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: input.OrganizationCode,
			UserID:           input.UserID,
			BusinessID:       input.KnowledgeBaseCode,
		},
	})
}

func (s *KnowledgeBaseDocumentFlowApp) newSourceBindingMaterializationService() *sourcebindingdomain.MaterializationService {
	return sourcebindingdomain.NewMaterializationService(
		sourceBindingMaterializationRepository{repo: s.support.sourceBindingRepo},
		sourceBindingMaterializationResolver{flow: s},
		sourceBindingManagedDocumentManager{manager: s.managedDocuments},
		nil,
	)
}

func (s *KnowledgeBaseDocumentFlowApp) resolveBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	organizationCode string,
	userID string,
) ([]materializedSourceDocument, error) {
	switch binding.Provider {
	case sourcebindingdomain.ProviderProject:
		return s.resolveProjectBindingDocuments(ctx, binding)
	case sourcebindingdomain.ProviderTeamshare:
		return s.resolveThirdPlatformBindingDocuments(ctx, binding, organizationCode, userID)
	case sourcebindingdomain.ProviderLocalUpload:
		return s.resolveLocalUploadBindingDocuments(binding)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedSourceBindingProvider, binding.Provider)
	}
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
) ([]materializedSourceDocument, error) {
	if s == nil || s.support == nil || s.support.projectFilePort == nil {
		return nil, ErrKnowledgeBaseProjectFileResolverRequired
	}
	projectID, err := parseProjectRootRef(binding.RootRef)
	if err != nil {
		return nil, err
	}
	selectedFiles, selectedFolders := collectSelectedProjectTargetRefs(binding.Targets)
	fileIDs, err := s.resolveProjectFileIDs(ctx, projectID, selectedFiles, selectedFolders)
	if err != nil {
		return nil, err
	}
	autoAdded := len(selectedFiles) == 0 && len(selectedFolders) == 0

	result := make([]materializedSourceDocument, 0, len(fileIDs))
	for _, projectFileID := range fileIDs {
		_, requireVisibilityCheck := selectedFiles[projectFileID]
		materialized, ok, err := s.resolveProjectSourceDocument(
			ctx,
			projectFileID,
			binding,
			autoAdded,
			requireVisibilityCheck,
		)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		result = append(result, materialized)
	}
	return result, nil
}

func parseProjectRootRef(rootRef string) (int64, error) {
	projectID, err := strconv.ParseInt(strings.TrimSpace(rootRef), 10, 64)
	if err != nil || projectID <= 0 {
		return 0, fmt.Errorf("%w: %s", ErrInvalidProjectRootRef, rootRef)
	}
	return projectID, nil
}

func collectSelectedProjectTargetRefs(targets []sourcebindingdomain.BindingTarget) (map[int64]struct{}, map[int64]struct{}) {
	selectedFiles := make(map[int64]struct{}, len(targets))
	selectedFolders := make(map[int64]struct{}, len(targets))
	for _, target := range targets {
		projectFileID, err := strconv.ParseInt(strings.TrimSpace(target.TargetRef), 10, 64)
		if err != nil || projectFileID <= 0 {
			continue
		}
		switch normalizeSourceBindingTargetType(target.TargetType) {
		case sourcebindingdomain.TargetTypeFile:
			selectedFiles[projectFileID] = struct{}{}
		case sourcebindingdomain.TargetTypeFolder:
			selectedFolders[projectFileID] = struct{}{}
		}
	}
	return selectedFiles, selectedFolders
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectFileIDs(
	ctx context.Context,
	projectID int64,
	selectedFiles map[int64]struct{},
	selectedFolders map[int64]struct{},
) ([]int64, error) {
	if s == nil || s.support == nil || s.support.taskFileService == nil {
		return nil, ErrKnowledgeBaseTaskFileDomainRequired
	}
	if len(selectedFiles) == 0 && len(selectedFolders) == 0 {
		fileIDs, err := s.support.taskFileService.ListVisibleLeafFileIDsByProject(ctx, projectID)
		if err != nil {
			return nil, fmt.Errorf("list visible project files by project: %w", err)
		}
		return fileIDs, nil
	}

	fileIDSet := make(map[int64]struct{}, len(selectedFiles))
	for projectFileID := range selectedFiles {
		fileIDSet[projectFileID] = struct{}{}
	}

	for folderID := range selectedFolders {
		descendantFileIDs, err := s.resolveProjectFolderLeafFileIDs(ctx, folderID)
		if err != nil {
			return nil, err
		}
		for _, fileID := range descendantFileIDs {
			fileIDSet[fileID] = struct{}{}
		}
	}

	fileIDs := make([]int64, 0, len(fileIDSet))
	for fileID := range fileIDSet {
		fileIDs = append(fileIDs, fileID)
	}
	return fileIDs, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectFolderLeafFileIDs(ctx context.Context, folderID int64) ([]int64, error) {
	if s == nil || s.support == nil || s.support.taskFileService == nil {
		return nil, ErrKnowledgeBaseTaskFileDomainRequired
	}
	fileIDs, err := s.support.taskFileService.ListVisibleLeafFileIDsByFolder(ctx, folderID)
	if err != nil {
		return nil, fmt.Errorf("list visible project files by folder: %w", err)
	}
	return fileIDs, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectSourceDocument(
	ctx context.Context,
	projectFileID int64,
	binding sourcebindingdomain.Binding,
	autoAdded bool,
	requireVisibilityCheck bool,
) (materializedSourceDocument, bool, error) {
	if requireVisibilityCheck {
		if s == nil || s.support == nil || s.support.taskFileService == nil {
			return materializedSourceDocument{}, false, ErrKnowledgeBaseTaskFileDomainRequired
		}
		visible, err := s.support.taskFileService.IsVisibleFile(ctx, projectFileID)
		if err != nil {
			return materializedSourceDocument{}, false, fmt.Errorf("check project file visibility %d: %w", projectFileID, err)
		}
		if !visible {
			return materializedSourceDocument{}, false, nil
		}
	}
	resolved, err := s.support.projectFilePort.Resolve(ctx, projectFileID)
	if err != nil {
		return materializedSourceDocument{}, false, fmt.Errorf("resolve project file %d: %w", projectFileID, err)
	}
	if resolved == nil || strings.EqualFold(strings.TrimSpace(resolved.Status), "deleted") || resolved.IsDirectory {
		return materializedSourceDocument{}, false, nil
	}
	documentFile, ok, err := mapToDocumentFile(resolved.DocumentFile)
	if err != nil {
		return materializedSourceDocument{}, false, fmt.Errorf("convert project document file: %w", err)
	}
	if !ok || documentFile == nil {
		return materializedSourceDocument{}, false, nil
	}
	return materializedSourceDocument{
		Name:          firstNonEmpty(strings.TrimSpace(resolved.FileName), strings.TrimSpace(documentFile.Name)),
		DocumentFile:  documentFile,
		DocumentType:  int(documentdomain.DocTypeFile),
		ItemRef:       strconv.FormatInt(resolved.ProjectFileID, 10),
		Extension:     strings.TrimSpace(resolved.FileExtension),
		ResolveReason: resolveReasonFromProjectBinding(binding),
		AutoAdded:     autoAdded,
		SnapshotMeta:  cloneMap(resolved.DocumentFile),
	}, true, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveThirdPlatformBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	organizationCode string,
	userID string,
) ([]materializedSourceDocument, error) {
	if s == nil || s.support == nil || s.support.thirdPlatformExpander == nil {
		return nil, ErrKnowledgeBaseThirdPlatformExpanderRequired
	}
	rawDocumentFiles := buildThirdPlatformExpansionInputs(binding)
	expanded, err := s.support.thirdPlatformExpander.Expand(ctx, organizationCode, userID, rawDocumentFiles)
	if err != nil {
		return nil, fmt.Errorf("expand third-platform documents: %w", err)
	}
	result := make([]materializedSourceDocument, 0, len(expanded))
	for _, documentFile := range expanded {
		if documentFile == nil {
			continue
		}
		itemRef := strings.TrimSpace(documentFile.ThirdID)
		if itemRef == "" {
			continue
		}
		result = append(result, materializedSourceDocument{
			Name:          firstNonEmpty(strings.TrimSpace(documentFile.Name), itemRef),
			DocumentFile:  cloneDocumentFile(documentFile),
			DocumentType:  int(documentdomain.DocTypeFile),
			ItemRef:       itemRef,
			Extension:     strings.TrimSpace(documentFile.Extension),
			ResolveReason: resolveReasonFromThirdPlatformBinding(binding, documentFile),
			AutoAdded:     binding.RootType != sourcebindingdomain.RootTypeFile,
			SnapshotMeta:  documentFileToMap(documentFile),
		})
	}
	return result, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveLocalUploadBindingDocuments(
	binding sourcebindingdomain.Binding,
) ([]materializedSourceDocument, error) {
	rawDocumentFile, _ := binding.SyncConfig["document_file"].(map[string]any)
	documentFile, _, err := mapToDocumentFile(rawDocumentFile)
	if err != nil {
		return nil, fmt.Errorf("convert local upload document file: %w", err)
	}
	if documentFile == nil {
		documentFile = &documentdomain.File{
			Type:       "external",
			Name:       binding.RootRef,
			URL:        binding.RootRef,
			SourceType: sourcebindingdomain.ProviderLocalUpload,
		}
	}
	itemRef := firstNonEmpty(strings.TrimSpace(binding.RootRef), strings.TrimSpace(documentFile.URL), strings.TrimSpace(documentFile.Name))
	return []materializedSourceDocument{{
		Name:          firstNonEmpty(strings.TrimSpace(documentFile.Name), itemRef),
		DocumentFile:  documentFile,
		DocumentType:  int(documentdomain.DocTypeFile),
		ItemRef:       itemRef,
		Extension:     strings.TrimSpace(documentFile.Extension),
		ResolveReason: "root",
		AutoAdded:     false,
		SnapshotMeta:  documentFileToMap(documentFile),
	}}, nil
}

func buildThirdPlatformExpansionInputs(binding sourcebindingdomain.Binding) []map[string]any {
	inputs := make([]map[string]any, 0)
	if len(binding.Targets) == 0 {
		inputs = append(inputs, thirdPlatformExpansionDocumentFile(
			binding.Provider,
			binding.RootType,
			binding.RootRef,
			rootContextFromBinding(binding),
		))
		return inputs
	}
	for _, target := range binding.Targets {
		if target.TargetRef == "" {
			continue
		}
		targetType := target.TargetType
		if targetType == "" {
			targetType = sourcebindingdomain.TargetTypeFile
		}
		inputs = append(inputs, thirdPlatformExpansionDocumentFile(
			binding.Provider,
			targetTypeToRootType(targetType),
			target.TargetRef,
			rootContextFromBinding(binding),
		))
	}
	return inputs
}

func thirdPlatformExpansionDocumentFile(provider, rootType, rootRef string, rootContext map[string]any) map[string]any {
	payload := map[string]any{
		"type":          "third_platform",
		"source_type":   provider,
		"platform_type": provider,
		"name":          rootRef,
	}
	switch rootType {
	case sourcebindingdomain.RootTypeKnowledgeBase:
		payload["knowledge_base_id"] = rootRef
		payload["third_id"] = rootRef
		payload["third_file_id"] = rootRef
	case sourcebindingdomain.RootTypeFolder:
		payload["third_id"] = rootRef
		payload["third_file_id"] = rootRef
		payload["third_file_type"] = "folder"
	default:
		payload["third_id"] = rootRef
		payload["third_file_id"] = rootRef
	}
	for key, value := range rootContext {
		if _, exists := payload[key]; exists {
			continue
		}
		payload[key] = value
	}
	return payload
}

func (s *KnowledgeBaseDocumentFlowApp) destroyKnowledgeBaseDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	if s == nil || s.managedDocuments == nil {
		return ErrKnowledgeBaseDocumentFlowRequired
	}
	s.logInfo(
		ctx,
		"Batch destroy managed documents by knowledge base started",
		"organization_code", organizationCode,
		"knowledge_base_code", knowledgeBaseCode,
	)
	if err := s.managedDocuments.DestroyKnowledgeBaseDocuments(ctx, knowledgeBaseCode, organizationCode); err != nil {
		return fmt.Errorf("batch destroy managed documents by knowledge base: %w", err)
	}
	s.logInfo(
		ctx,
		"Batch destroy managed documents by knowledge base finished",
		"organization_code", organizationCode,
		"knowledge_base_code", knowledgeBaseCode,
	)
	return nil
}

// PrepareRebuild 在重建前补齐来源绑定并重建知识库下的来源文档。
func (s *RebuildPrepareApp) PrepareRebuild(ctx context.Context, operatorOrganizationCode string, scope RebuildScope) error {
	flow, err := s.requireDocumentFlow()
	if err != nil {
		return err
	}
	return flow.prepareRebuild(ctx, operatorOrganizationCode, scope)
}

func (s *KnowledgeBaseDocumentFlowApp) prepareRebuild(
	ctx context.Context,
	operatorOrganizationCode string,
	scope RebuildScope,
) error {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return nil
	}
	s.logInfo(
		ctx,
		"Knowledge rebuild source binding prepare started",
		"operator_organization_code", operatorOrganizationCode,
		"scope", string(scope.Mode),
		"organization_code", scope.OrganizationCode,
		"knowledge_base_code", scope.KnowledgeBaseCode,
		"document_code", scope.DocumentCode,
		"user_id", scope.UserID,
	)
	if err := s.support.ensureOfficialOrganizationMember(ctx, operatorOrganizationCode); err != nil {
		return err
	}
	if scope.Mode == RebuildScopeModeDocument {
		s.logInfo(ctx, "Skip source binding prepare for document rebuild", "document_code", scope.DocumentCode)
		return nil
	}
	if scope.Mode == RebuildScopeModeOrganization || scope.Mode == RebuildScopeModeAll {
		s.logInfo(ctx, "Skip source binding prepare for broad rebuild scope", "scope", string(scope.Mode))
		return nil
	}

	knowledgeBases, err := s.listKnowledgeBasesForRebuild(ctx, scope)
	if err != nil {
		return err
	}
	s.logInfo(ctx, "Knowledge rebuild source binding prepare targets loaded", "knowledge_base_count", len(knowledgeBases))
	for _, kb := range knowledgeBases {
		if err := s.prepareRebuildKnowledgeBase(ctx, kb, scope); err != nil {
			if shouldSkipPrepareRebuildKnowledgeBase(scope.Mode, err) {
				s.warnSkippedPrepareRebuildKnowledgeBase(ctx, kb, err)
				continue
			}
			return err
		}
	}
	s.logInfo(ctx, "Knowledge rebuild source binding prepare finished", "knowledge_base_count", len(knowledgeBases))
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) prepareRebuildKnowledgeBase(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	scope RebuildScope,
) error {
	if kb == nil {
		return nil
	}
	s.logInfo(
		ctx,
		"Prepare knowledge base source bindings before rebuild",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"scope", string(scope.Mode),
	)
	bindings, err := s.support.sourceBindingRepo.ListBindingsByKnowledgeBase(ctx, kb.Code)
	if err != nil {
		return fmt.Errorf("list source bindings before rebuild: %w", err)
	}
	s.logInfo(
		ctx,
		"Knowledge base source bindings loaded before rebuild",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"binding_count", len(bindings),
	)
	if len(bindings) == 0 {
		s.logInfo(ctx, "Bootstrap source bindings before rebuild started", "knowledge_base_code", kb.Code)
		bindings, err = s.bootstrapSourceBindings(ctx, kb, scope.UserID)
		if err != nil {
			return err
		}
		s.logInfo(
			ctx,
			"Bootstrap source bindings before rebuild finished",
			"knowledge_base_code", kb.Code,
			"binding_count", len(bindings),
		)
	}
	s.logInfo(
		ctx,
		"Preflight source bindings before rebuild started",
		"knowledge_base_code", kb.Code,
		"binding_count", len(bindings),
	)
	if err := s.preflightRebuildSourceBindings(ctx, kb, kb.OrganizationCode, scope.UserID, bindings); err != nil {
		return err
	}
	s.logInfo(ctx, "Preflight source bindings before rebuild finished", "knowledge_base_code", kb.Code)
	s.logInfo(ctx, "Destroy managed documents before rebuild started", "knowledge_base_code", kb.Code)
	if err := s.destroyKnowledgeBaseDocuments(ctx, kb.Code, kb.OrganizationCode); err != nil {
		return err
	}
	s.logInfo(ctx, "Destroy managed documents before rebuild finished", "knowledge_base_code", kb.Code)
	s.logInfo(
		ctx,
		"Materialize source binding documents before rebuild started",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"binding_count", len(bindings),
	)
	count, err := s.materializeKnowledgeBaseDocumentsWithCount(
		ctx,
		kb,
		kb.OrganizationCode,
		scope.UserID,
		bindings,
		materializeDocumentsOptions{ScheduleSync: false},
	)
	if err != nil {
		return err
	}
	s.logInfo(
		ctx,
		"Materialize source binding documents before rebuild finished",
		"organization_code", kb.OrganizationCode,
		"knowledge_base_code", kb.Code,
		"document_count", count,
	)
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) preflightRebuildSourceBindings(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	organizationCode string,
	userID string,
	bindings []sourcebindingdomain.Binding,
) error {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil {
		return ErrKnowledgeBaseSourceBindingRepositoryRequired
	}
	if s.managedDocuments == nil {
		return ErrKnowledgeBaseDocumentFlowRequired
	}
	if err := s.newSourceBindingMaterializationService().Preflight(ctx, sourcebindingdomain.MaterializationInput{
		KnowledgeBaseCode:   kb.Code,
		OrganizationCode:    organizationCode,
		KnowledgeBaseUserID: knowledgeBaseUpdatedUserID(kb),
		KnowledgeBaseOwner:  knowledgeBaseCreatedUserID(kb),
		FallbackUserID:      userID,
		Bindings:            bindings,
	}); err != nil {
		return fmt.Errorf("preflight source binding documents: %w", err)
	}
	return nil
}

func shouldSkipPrepareRebuildKnowledgeBase(scopeMode RebuildScopeMode, err error) bool {
	return scopeMode != RebuildScopeModeKnowledgeBase && sourcebindingdomain.ShouldRetryResolve(err)
}

func (s *KnowledgeBaseDocumentFlowApp) warnSkippedPrepareRebuildKnowledgeBase(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	err error,
) {
	if s == nil || s.support == nil || s.support.logger == nil {
		return
	}
	knowledgeBaseCode := ""
	knowledgeBaseName := ""
	if kb != nil {
		knowledgeBaseCode = kb.Code
		knowledgeBaseName = kb.Name
	}
	s.support.logger.WarnContext(
		ctx,
		"Skip prepare knowledge rebuild because source binding documents cannot be resolved",
		"knowledge_base_code", knowledgeBaseCode,
		"knowledge_base_name", knowledgeBaseName,
		"error", err,
	)
}

func (s *KnowledgeBaseDocumentFlowApp) listKnowledgeBasesForRebuild(ctx context.Context, scope RebuildScope) ([]*knowledgebasedomain.KnowledgeBase, error) {
	switch scope.Mode {
	case RebuildScopeModeKnowledgeBase:
		kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, scope.KnowledgeBaseCode, scope.OrganizationCode)
		if err != nil {
			return nil, fmt.Errorf("show knowledge base for rebuild: %w", err)
		}
		return []*knowledgebasedomain.KnowledgeBase{kb}, nil
	case RebuildScopeModeOrganization:
		kbs, _, err := s.support.domainService.List(ctx, &knowledgebasedomain.Query{
			OrganizationCode: scope.OrganizationCode,
			Offset:           0,
			Limit:            knowledgeBaseRebuildListLimit,
		})
		if err != nil {
			return nil, fmt.Errorf("list organization knowledge bases for rebuild: %w", err)
		}
		return kbs, nil
	case RebuildScopeModeAll:
		kbs, _, err := s.support.domainService.List(ctx, &knowledgebasedomain.Query{
			Offset: 0,
			Limit:  knowledgeBaseRebuildListLimit,
		})
		if err != nil {
			return nil, fmt.Errorf("list all knowledge bases for rebuild: %w", err)
		}
		return kbs, nil
	default:
		return []*knowledgebasedomain.KnowledgeBase{}, nil
	}
}

func (s *KnowledgeBaseDocumentFlowApp) bootstrapSourceBindings(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	userID string,
) ([]sourcebindingdomain.Binding, error) {
	if kb != nil && kb.SourceType != nil {
		knowledgeBaseType := knowledgeBaseTypeFromKnowledgeBase(kb)
		semanticSourceType, err := knowledgebasedomain.ResolveSemanticSourceType(knowledgeBaseType, *kb.SourceType)
		if err == nil && semanticSourceType == knowledgebasedomain.SemanticSourceTypeProject {
			return nil, ErrMissingProjectSourceBindings
		}
	}
	if s == nil || s.managedDocuments == nil {
		return nil, ErrKnowledgeBaseDocumentFlowRequired
	}
	docs, err := s.managedDocuments.ListManagedDocumentsByKnowledgeBase(ctx, kb.Code)
	if err != nil {
		return nil, fmt.Errorf("list managed documents for source bootstrap: %w", err)
	}
	bindingUserID := bootstrapBindingUserID(kb, userID)
	bindings := make([]sourcebindingdomain.Binding, 0, len(docs))
	seen := make(map[string]struct{}, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.DocumentFile == nil {
			continue
		}
		provider := strings.TrimSpace(doc.DocumentFile.SourceType)
		if provider == "" {
			provider = sourcebindingdomain.ProviderLocalUpload
		}
		rootRef := firstNonEmpty(strings.TrimSpace(doc.DocumentFile.ThirdID), strings.TrimSpace(doc.DocumentFile.URL), strings.TrimSpace(doc.DocumentFile.Name))
		if rootRef == "" {
			continue
		}
		key := strings.Join([]string{provider, sourcebindingdomain.RootTypeFile, rootRef}, ":")
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		bindings = append(bindings, sourcebindingdomain.Binding{
			OrganizationCode:  kb.OrganizationCode,
			KnowledgeBaseCode: kb.Code,
			Provider:          provider,
			RootType:          sourcebindingdomain.RootTypeFile,
			RootRef:           rootRef,
			SyncMode:          sourcebindingdomain.SyncModeManual,
			SyncConfig: map[string]any{
				"document_file": documentFileToMap(doc.DocumentFile),
			},
			Enabled:    true,
			CreatedUID: bindingUserID,
			UpdatedUID: bindingUserID,
		})
		if provider == sourcebindingdomain.ProviderTeamshare {
			knowledgeBaseID := anyToString(documentFileToMap(doc.DocumentFile)["knowledge_base_id"])
			if knowledgeBaseID != "" {
				bindings[len(bindings)-1].SyncConfig["root_context"] = map[string]any{
					"knowledge_base_id": knowledgeBaseID,
				}
			}
		}
	}
	savedBindings, err := s.support.sourceBindingRepo.ReplaceBindings(ctx, kb.Code, bindings)
	if err != nil {
		return nil, fmt.Errorf("bootstrap source bindings: %w", err)
	}
	return savedBindings, nil
}

func bootstrapBindingUserID(kb *knowledgebasedomain.KnowledgeBase, fallbackUserID string) string {
	if userID := knowledgeBaseUpdatedUserID(kb); userID != "" {
		return userID
	}
	if userID := knowledgeBaseCreatedUserID(kb); userID != "" {
		return userID
	}
	return strings.TrimSpace(fallbackUserID)
}

func knowledgeBaseUpdatedUserID(kb *knowledgebasedomain.KnowledgeBase) string {
	if kb == nil {
		return ""
	}
	return strings.TrimSpace(kb.UpdatedUID)
}

func knowledgeBaseCreatedUserID(kb *knowledgebasedomain.KnowledgeBase) string {
	if kb == nil {
		return ""
	}
	return strings.TrimSpace(kb.CreatedUID)
}

func mapToDocumentFile(raw map[string]any) (*documentdomain.File, bool, error) {
	if len(raw) == 0 {
		return nil, false, nil
	}
	encoded, err := json.Marshal(raw)
	if err != nil {
		return nil, false, fmt.Errorf("marshal document file payload: %w", err)
	}
	var dto docfilehelper.DocumentFileDTO
	if err := dto.UnmarshalJSON(encoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal document file payload: %w", err)
	}
	return docfilehelper.ToDomainFile(&dto), true, nil
}

func documentFileToMap(documentFile *documentdomain.File) map[string]any {
	if documentFile == nil {
		return map[string]any{}
	}
	payload := map[string]any{
		"type":          documentFile.Type,
		"name":          documentFile.Name,
		"url":           documentFile.URL,
		"file_key":      documentFile.FileKey,
		"size":          documentFile.Size,
		"extension":     documentFile.Extension,
		"third_id":      documentFile.ThirdID,
		"third_file_id": documentFile.ThirdID,
		"source_type":   documentFile.SourceType,
	}
	if strings.TrimSpace(documentFile.KnowledgeBaseID) != "" {
		payload["knowledge_base_id"] = documentFile.KnowledgeBaseID
	}
	return payload
}

func resolveReasonFromProjectBinding(binding sourcebindingdomain.Binding) string {
	if len(binding.Targets) > 0 {
		return "target"
	}
	return "root"
}

func resolveReasonFromThirdPlatformBinding(binding sourcebindingdomain.Binding, documentFile *documentdomain.File) string {
	if len(binding.Targets) > 0 {
		return "target"
	}
	if binding.RootType == sourcebindingdomain.RootTypeFile && documentFile != nil && documentFile.ThirdID == binding.RootRef {
		return "root"
	}
	return "expanded"
}

func cloneMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func rootContextFromBinding(binding sourcebindingdomain.Binding) map[string]any {
	context := cloneMap(mapValue(binding.SyncConfig, "root_context"))
	if binding.RootType == sourcebindingdomain.RootTypeKnowledgeBase && context["knowledge_base_id"] == nil {
		context["knowledge_base_id"] = binding.RootRef
	}
	return context
}

func targetTypeToRootType(targetType string) string {
	switch normalizeSourceBindingTargetType(targetType) {
	case sourcebindingdomain.TargetTypeFolder:
		return sourcebindingdomain.RootTypeFolder
	default:
		return sourcebindingdomain.RootTypeFile
	}
}

func mapValue(input map[string]any, key string) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	value, _ := input[key].(map[string]any)
	return value
}

func anyToString(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", value))
	}
}

func cloneDocumentFile(documentFile *documentdomain.File) *documentdomain.File {
	if documentFile == nil {
		return nil
	}
	cloned := *documentFile
	return &cloned
}
