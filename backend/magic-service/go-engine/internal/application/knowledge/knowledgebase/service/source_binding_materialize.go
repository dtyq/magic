package kbapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"strconv"
	"strings"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	kshared "magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/filetype"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

const knowledgeBaseRebuildListLimit = 10_000

const knowledgeBaseMaterializeDocumentLimit = 1000

const (
	thirdPlatformDocumentFileType         = "third_platform"
	sourceBindingResolveReasonRoot        = "root"
	sourceBindingResolveReasonTarget      = "target"
	sourceBindingUnavailableReason        = "source_item_unavailable"
	sourceBindingUnavailableLogFieldCount = 12
)

type materializeDocumentsOptions struct {
	ScheduleSync bool
}

func (s *KnowledgeBaseAppService) buildSourceBindings(
	kb *kbentity.KnowledgeBase,
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

func (s *KnowledgeBaseDocumentFlowApp) materializeKnowledgeBaseDocuments(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
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
	kb *kbentity.KnowledgeBase,
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
	if _, err := s.support.healKnowledgeBaseUIDs(ctx, kb, "source binding materialize"); err != nil {
		return 0, err
	}

	report, err := s.newSourceBindingMaterializationService().MaterializeWithReport(ctx, sourcebindingservice.MaterializationInput{
		KnowledgeBaseCode:   kb.Code,
		OrganizationCode:    organizationCode,
		KnowledgeBaseUserID: knowledgeBaseUpdatedUserID(kb),
		KnowledgeBaseOwner:  knowledgeBaseCreatedUserID(kb),
		FallbackUserID:      userID,
		Bindings:            bindings,
		MaxDocuments:        knowledgeBaseMaterializeDocumentLimit,
		ScheduleSync:        options.ScheduleSync,
	})
	if err != nil {
		return 0, fmt.Errorf("materialize source binding documents: %w", err)
	}
	s.logInfo(
		ctx,
		"Materialized source binding documents",
		"knowledge_base_code", kb.Code,
		"created_documents", len(report.CreatedDocuments),
		"scheduled_syncs", len(report.PendingSyncs),
	)
	return len(report.CreatedDocuments), nil
}

type sourceBindingMaterializationResolver struct {
	flow *KnowledgeBaseDocumentFlowApp
}

func (r sourceBindingMaterializationResolver) ResolveBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	organizationCode string,
	userID string,
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	items, err := r.flow.resolveBindingDocuments(ctx, binding, organizationCode, userID, maxDocuments)
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
	input sourcebindingservice.CreateManagedDocumentInput,
) (*sourcebindingservice.ManagedDocument, error) {
	documentFile, _ := input.DocumentFile.(*docentity.File)
	created, err := m.manager.CreateManagedDocument(ctx, &knowledgeBaseCreateManagedDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		SourceBindingID:   input.SourceBindingID,
		SourceItemID:      input.SourceItemID,
		ProjectID:         input.ProjectID,
		ProjectFileID:     input.ProjectFileID,
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
	return &sourcebindingservice.ManagedDocument{Code: created.Code}, nil
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

func (m sourceBindingManagedDocumentManager) ScheduleManagedDocumentSync(ctx context.Context, input sourcebindingservice.SyncRequest) {
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

func (s *KnowledgeBaseDocumentFlowApp) newSourceBindingMaterializationService() *sourcebindingservice.MaterializationService {
	return sourcebindingservice.NewMaterializationService(
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
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	switch binding.Provider {
	case sourcebindingdomain.ProviderProject:
		return s.resolveProjectBindingDocuments(ctx, binding, maxDocuments)
	case sourcebindingdomain.ProviderTeamshare:
		return s.resolveThirdPlatformBindingDocuments(ctx, binding, organizationCode, userID, maxDocuments)
	case sourcebindingdomain.ProviderLocalUpload:
		return s.resolveLocalUploadBindingDocuments(binding)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedSourceBindingProvider, binding.Provider)
	}
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	if s == nil || s.support == nil || s.support.taskFileService == nil {
		return nil, ErrKnowledgeBaseTaskFileDomainRequired
	}
	projectID, err := parseProjectRootRef(binding.RootRef)
	if err != nil {
		return nil, err
	}
	selectedTargets := collectSelectedProjectTargets(binding.Targets)
	autoAdded := len(selectedTargets) == 0
	if maxDocuments <= 0 {
		return []sourcebindingservice.ResolvedDocument{}, nil
	}

	result := make([]sourcebindingservice.ResolvedDocument, 0, maxDocuments)
	state := projectBindingResolveState{
		binding:      binding,
		autoAdded:    autoAdded,
		maxDocuments: maxDocuments,
		seenFileIDs:  make(map[int64]struct{}, maxDocuments),
		result:       &result,
	}

	if len(selectedTargets) == 0 {
		if err := s.walkProjectBindingLeafFiles(ctx, projectID, 0, func(projectFileID int64) (bool, error) {
			return s.appendResolvedProjectBindingDocument(ctx, projectFileID, state)
		}); err != nil {
			return nil, err
		}
		return result, nil
	}

	if err := s.resolveSelectedProjectBindingDocuments(ctx, projectID, selectedTargets, state); err != nil {
		return nil, err
	}
	return result, nil
}

type projectBindingResolveState struct {
	binding      sourcebindingdomain.Binding
	autoAdded    bool
	maxDocuments int
	seenFileIDs  map[int64]struct{}
	result       *[]sourcebindingservice.ResolvedDocument
}

func (s *KnowledgeBaseDocumentFlowApp) resolveSelectedProjectBindingDocuments(
	ctx context.Context,
	projectID int64,
	selectedTargets []selectedProjectTarget,
	state projectBindingResolveState,
) error {
	for _, target := range selectedTargets {
		switch target.targetType {
		case sourcebindingdomain.TargetTypeFile:
			keepWalking, err := s.appendResolvedProjectBindingDocument(ctx, target.projectFileID, state)
			if err != nil {
				return err
			}
			if !keepWalking {
				return nil
			}
		case sourcebindingdomain.TargetTypeFolder:
			if err := s.walkProjectBindingLeafFiles(ctx, projectID, target.projectFileID, func(projectFileID int64) (bool, error) {
				return s.appendResolvedProjectBindingDocument(ctx, projectFileID, state)
			}); err != nil {
				return err
			}
			if len(*state.result) >= state.maxDocuments {
				return nil
			}
		}
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) appendResolvedProjectBindingDocument(
	ctx context.Context,
	projectFileID int64,
	state projectBindingResolveState,
) (bool, error) {
	if _, exists := state.seenFileIDs[projectFileID]; exists {
		return true, nil
	}
	materialized, ok, err := s.resolveProjectSourceDocument(
		ctx,
		projectFileID,
		state.binding,
		state.autoAdded,
	)
	if err != nil {
		return false, err
	}
	state.seenFileIDs[projectFileID] = struct{}{}
	if !ok {
		return true, nil
	}
	*state.result = append(*state.result, materialized)
	return len(*state.result) < state.maxDocuments, nil
}

func parseProjectRootRef(rootRef string) (int64, error) {
	projectID, err := strconv.ParseInt(strings.TrimSpace(rootRef), 10, 64)
	if err != nil || projectID <= 0 {
		return 0, fmt.Errorf("%w: %s", ErrInvalidProjectRootRef, rootRef)
	}
	return projectID, nil
}

type selectedProjectTarget struct {
	targetType    string
	projectFileID int64
}

func collectSelectedProjectTargets(targets []sourcebindingdomain.BindingTarget) []selectedProjectTarget {
	selectedTargets := make([]selectedProjectTarget, 0, len(targets))
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		projectFileID, err := strconv.ParseInt(strings.TrimSpace(target.TargetRef), 10, 64)
		if err != nil || projectFileID <= 0 {
			continue
		}
		targetType := normalizeSourceBindingTargetType(target.TargetType)
		switch targetType {
		case sourcebindingdomain.TargetTypeFile:
		case sourcebindingdomain.TargetTypeFolder:
		default:
			continue
		}
		dedupeKey := targetType + ":" + strconv.FormatInt(projectFileID, 10)
		if _, exists := seen[dedupeKey]; exists {
			continue
		}
		seen[dedupeKey] = struct{}{}
		selectedTargets = append(selectedTargets, selectedProjectTarget{
			targetType:    targetType,
			projectFileID: projectFileID,
		})
	}
	return selectedTargets
}

func (s *KnowledgeBaseDocumentFlowApp) walkProjectBindingLeafFiles(
	ctx context.Context,
	projectID int64,
	folderID int64,
	visitor func(projectFileID int64) (bool, error),
) error {
	if s == nil || s.support == nil || s.support.taskFileService == nil {
		return ErrKnowledgeBaseTaskFileDomainRequired
	}
	if folderID > 0 {
		if err := s.support.taskFileService.WalkVisibleLeafFileIDsByFolder(ctx, folderID, visitor); err != nil {
			return fmt.Errorf("walk visible project files by folder: %w", err)
		}
		return nil
	}
	if err := s.support.taskFileService.WalkVisibleLeafFileIDsByProject(ctx, projectID, visitor); err != nil {
		return fmt.Errorf("walk visible project files by project: %w", err)
	}
	return nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveProjectSourceDocument(
	ctx context.Context,
	projectFileID int64,
	binding sourcebindingdomain.Binding,
	autoAdded bool,
) (sourcebindingservice.ResolvedDocument, bool, error) {
	meta, err := s.loadVisibleProjectFileMeta(ctx, projectFileID)
	if err != nil {
		if isProjectSourceBindingItemUnavailable(err) {
			s.warnUnavailableSourceBindingItem(
				ctx,
				binding,
				strconv.FormatInt(projectFileID, 10),
				err,
				"project_file_id", projectFileID,
			)
			return sourcebindingservice.ResolvedDocument{}, false, nil
		}
		return sourcebindingservice.ResolvedDocument{}, false, err
	}
	if meta == nil {
		s.warnUnavailableSourceBindingItem(
			ctx,
			binding,
			strconv.FormatInt(projectFileID, 10),
			projectfile.ErrFileUnavailable,
			"project_file_id", projectFileID,
		)
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	resolved := buildProjectMaterializedResolved(meta)
	if projectfile.IsUnsupportedResolveStatus(resolved.Status) {
		s.logInfo(
			ctx,
			"Skip unsupported project source binding document",
			"knowledge_base_code",
			binding.KnowledgeBaseCode,
			"project_file_id",
			projectFileID,
			"extension",
			strings.TrimSpace(resolved.FileExtension),
		)
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	if !documentdomain.ShouldMaterializeProjectResolvedFile(resolved) {
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	documentFile, ok, err := mapToDocumentFile(resolved.DocumentFile)
	if err != nil {
		return sourcebindingservice.ResolvedDocument{}, false, fmt.Errorf("convert project document file: %w", err)
	}
	if !ok || documentFile == nil {
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	return sourcebindingservice.ResolvedDocument{
		Name:          firstNonEmpty(strings.TrimSpace(resolved.FileName), strings.TrimSpace(documentFile.Name)),
		DocumentFile:  documentFile,
		DocumentType:  int(docentity.DocumentInputKindFile),
		ItemRef:       strconv.FormatInt(resolved.ProjectFileID, 10),
		ProjectID:     resolved.ProjectID,
		ProjectFileID: resolved.ProjectFileID,
		Extension:     strings.TrimSpace(resolved.FileExtension),
		ResolveReason: resolveReasonFromProjectBinding(binding),
		AutoAdded:     autoAdded,
		SnapshotMeta:  cloneMap(resolved.DocumentFile),
	}, true, nil
}

func (s *KnowledgeBaseDocumentFlowApp) loadVisibleProjectFileMeta(
	ctx context.Context,
	projectFileID int64,
) (*projectfile.Meta, error) {
	if s == nil || s.support == nil || s.support.taskFileService == nil {
		return nil, ErrKnowledgeBaseTaskFileDomainRequired
	}
	meta, err := s.support.taskFileService.LoadVisibleMeta(ctx, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("load visible project file meta %d: %w", projectFileID, err)
	}
	return meta, nil
}

func buildProjectMaterializedResolved(meta *projectfile.Meta) *projectfile.ResolveResult {
	resolved := documentdomain.ProjectFileMetaToResolved(meta)
	if resolved == nil {
		return nil
	}

	normalizedExtension := projectfile.NormalizeExtension(resolved.FileName, resolved.FileExtension)
	resolved.FileExtension = normalizedExtension
	resolved.DocType = projectfile.ResolveDocType(normalizedExtension)
	if strings.TrimSpace(resolved.Status) == "" {
		resolved.Status = projectfile.ResolveStatusActive
	}
	if len(resolved.DocumentFile) == 0 {
		resolved.DocumentFile = documentdomain.BuildProjectDocumentFilePayload(meta)
	}
	if normalizedExtension != "" {
		resolved.DocumentFile["extension"] = normalizedExtension
	}
	if normalizedExtension != "" && !documentdomain.IsSupportedKnowledgeBaseFileExtension(normalizedExtension) {
		resolved.Status = projectfile.ResolveStatusUnsupported
	}
	return resolved
}

func (s *KnowledgeBaseDocumentFlowApp) resolveThirdPlatformBindingDocuments(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	organizationCode string,
	userID string,
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	if s == nil || s.support == nil || s.support.thirdPlatformExpander == nil {
		return nil, ErrKnowledgeBaseThirdPlatformExpanderRequired
	}
	if maxDocuments <= 0 {
		return []sourcebindingservice.ResolvedDocument{}, nil
	}
	result := make([]sourcebindingservice.ResolvedDocument, 0, maxDocuments)
	state := thirdPlatformMaterializeState{
		binding:          binding,
		organizationCode: organizationCode,
		userID:           userID,
		seenDirectoryIDs: make(map[string]struct{}, maxDocuments),
		seenThirdFileIDs: make(map[string]struct{}, maxDocuments),
	}
	specs := sourcebindingservice.BuildEnterpriseBindingExpansionSpecs(binding)
	for _, spec := range specs {
		if len(result) >= maxDocuments {
			break
		}
		items, err := s.resolveThirdPlatformBindingSpec(ctx, state, spec, maxDocuments-len(result))
		if err != nil {
			return nil, err
		}
		result = append(result, items...)
	}
	return result, nil
}

type thirdPlatformMaterializeState struct {
	binding          sourcebindingdomain.Binding
	organizationCode string
	userID           string
	seenDirectoryIDs map[string]struct{}
	seenThirdFileIDs map[string]struct{}
}

func (s *KnowledgeBaseDocumentFlowApp) resolveThirdPlatformBindingSpec(
	ctx context.Context,
	state thirdPlatformMaterializeState,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	if maxDocuments <= 0 {
		return []sourcebindingservice.ResolvedDocument{}, nil
	}

	if spec.RootType == sourcebindingdomain.RootTypeFile {
		item, ok, err := s.resolveThirdPlatformFileRoot(ctx, state, spec)
		if err != nil {
			return nil, err
		}
		if !ok {
			return []sourcebindingservice.ResolvedDocument{}, nil
		}
		return []sourcebindingservice.ResolvedDocument{item}, nil
	}

	return s.collectThirdPlatformResolvedDocuments(ctx, state, spec, maxDocuments)
}

type thirdPlatformTreeParent struct {
	parentType string
	parentRef  string
}

func (s *KnowledgeBaseDocumentFlowApp) collectThirdPlatformResolvedDocuments(
	ctx context.Context,
	state thirdPlatformMaterializeState,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	maxDocuments int,
) ([]sourcebindingservice.ResolvedDocument, error) {
	result := make([]sourcebindingservice.ResolvedDocument, 0, maxDocuments)
	queue := initializeThirdPlatformTreeQueue(spec, state.seenDirectoryIDs)

	for len(queue) > 0 && len(result) < maxDocuments {
		parent := queue[0]
		queue = queue[1:]

		nodes, err := s.listThirdPlatformTreeNodes(ctx, state, parent)
		if err != nil {
			return nil, err
		}
		queue = s.enqueueThirdPlatformDirectoryNodes(queue, nodes, state.seenDirectoryIDs)
		result = s.appendThirdPlatformResolvedDocuments(ctx, result, state, spec, nodes, maxDocuments)
	}
	return result, nil
}

func initializeThirdPlatformTreeQueue(
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	seenDirectoryIDs map[string]struct{},
) []thirdPlatformTreeParent {
	parentType := sourceBindingParentTypeKnowledgeBase
	if spec.RootType == sourcebindingdomain.RootTypeFolder {
		parentType = sourceBindingParentTypeFolder
	}
	parentRef := strings.TrimSpace(spec.RootRef)
	if parentRef != "" {
		seenDirectoryIDs[parentRef] = struct{}{}
	}
	return []thirdPlatformTreeParent{{
		parentType: parentType,
		parentRef:  parentRef,
	}}
}

func (s *KnowledgeBaseDocumentFlowApp) listThirdPlatformTreeNodes(
	ctx context.Context,
	state thirdPlatformMaterializeState,
	parent thirdPlatformTreeParent,
) ([]thirdplatform.TreeNode, error) {
	actor := resolveKnowledgeBaseAccessActor(ctx, state.organizationCode, state.userID)
	nodes, err := s.support.thirdPlatformExpander.ListTreeNodes(
		ctx,
		thirdplatform.TreeNodeListInput{
			OrganizationCode:              actor.OrganizationCode,
			UserID:                        actor.UserID,
			ThirdPlatformUserID:           actor.ThirdPlatformUserID,
			ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
			ParentType:                    parent.parentType,
			ParentRef:                     parent.parentRef,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list third-platform tree nodes %s/%s: %w", parent.parentType, parent.parentRef, err)
	}
	return nodes, nil
}

func (s *KnowledgeBaseDocumentFlowApp) enqueueThirdPlatformDirectoryNodes(
	queue []thirdPlatformTreeParent,
	nodes []thirdplatform.TreeNode,
	seenDirectoryIDs map[string]struct{},
) []thirdPlatformTreeParent {
	for _, node := range nodes {
		if !node.IsDirectory {
			continue
		}
		directoryRef := thirdPlatformTreeNodeRef(node)
		if directoryRef == "" {
			continue
		}
		if _, exists := seenDirectoryIDs[directoryRef]; exists {
			continue
		}
		seenDirectoryIDs[directoryRef] = struct{}{}
		queue = append(queue, thirdPlatformTreeParent{
			parentType: sourceBindingParentTypeFolder,
			parentRef:  directoryRef,
		})
	}
	return queue
}

func (s *KnowledgeBaseDocumentFlowApp) appendThirdPlatformResolvedDocuments(
	ctx context.Context,
	result []sourcebindingservice.ResolvedDocument,
	state thirdPlatformMaterializeState,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	nodes []thirdplatform.TreeNode,
	maxDocuments int,
) []sourcebindingservice.ResolvedDocument {
	for _, node := range nodes {
		if node.IsDirectory {
			continue
		}
		item, ok := s.mapThirdPlatformTreeNodeToResolvedDocument(
			ctx,
			state.binding,
			spec,
			node,
			state.seenThirdFileIDs,
		)
		if !ok {
			continue
		}
		result = append(result, item)
		if len(result) >= maxDocuments {
			break
		}
	}
	return result
}

func (s *KnowledgeBaseDocumentFlowApp) resolveThirdPlatformFileRoot(
	ctx context.Context,
	state thirdPlatformMaterializeState,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
) (sourcebindingservice.ResolvedDocument, bool, error) {
	itemRef := strings.TrimSpace(spec.RootRef)
	if itemRef == "" {
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	if _, exists := state.seenThirdFileIDs[itemRef]; exists {
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}

	documentFile, found, err := s.resolveThirdPlatformFileDocumentFile(ctx, state, spec)
	if err != nil {
		if errors.Is(err, thirdplatform.ErrDocumentUnavailable) {
			s.warnUnavailableSourceBindingItem(
				ctx,
				state.binding,
				itemRef,
				err,
				"third_file_id", itemRef,
			)
			return sourcebindingservice.ResolvedDocument{}, false, nil
		}
		return sourcebindingservice.ResolvedDocument{}, false, err
	}
	if !found {
		s.warnUnavailableSourceBindingItem(
			ctx,
			state.binding,
			itemRef,
			thirdplatform.ErrDocumentUnavailable,
			"third_file_id", itemRef,
		)
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	if !documentdomain.IsSupportedKnowledgeBaseDocumentFile(documentFile) {
		s.logInfo(
			ctx,
			"Skip unsupported third-platform source binding document",
			"knowledge_base_code", state.binding.KnowledgeBaseCode,
			"third_file_id", itemRef,
			"extension", strings.TrimSpace(documentFile.Extension),
		)
		return sourcebindingservice.ResolvedDocument{}, false, nil
	}
	state.seenThirdFileIDs[itemRef] = struct{}{}
	return buildThirdPlatformResolvedDocument(state.binding, documentFile, resolveReasonFromThirdPlatformSpec(state.binding, spec)), true, nil
}

func (s *KnowledgeBaseDocumentFlowApp) resolveThirdPlatformFileDocumentFile(
	ctx context.Context,
	state thirdPlatformMaterializeState,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
) (*docentity.File, bool, error) {
	rootDocumentFile := thirdPlatformExpansionDocumentFile(
		state.binding.Provider,
		spec.RootType,
		spec.RootRef,
		spec.RootContext,
	)
	resolved, err := s.support.thirdPlatformExpander.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:  state.organizationCode,
		UserID:            state.userID,
		KnowledgeBaseCode: state.binding.KnowledgeBaseCode,
		ThirdPlatformType: state.binding.Provider,
		ThirdFileID:       spec.RootRef,
		DocumentFile:      rootDocumentFile,
	})
	if err != nil {
		return nil, false, fmt.Errorf("resolve third-platform file %s: %w", spec.RootRef, err)
	}
	if resolved == nil {
		return nil, false, nil
	}
	documentFile, ok, err := mapToDocumentFile(resolved.DocumentFile)
	if err != nil {
		return nil, false, fmt.Errorf("convert resolved third-platform document file: %w", err)
	}
	if !ok || documentFile == nil {
		return nil, false, nil
	}
	if documentFile.Extension == "" {
		documentFile.Extension = documentdomainInferExtension(documentFile)
	}
	if documentFile.SourceType == "" {
		documentFile.SourceType = state.binding.Provider
	}
	if documentFile.Type == "" {
		documentFile.Type = thirdPlatformDocumentFileType
	}
	if documentFile.ThirdID == "" {
		documentFile.ThirdID = strings.TrimSpace(spec.RootRef)
	}
	if documentFile.KnowledgeBaseID == "" {
		documentFile.KnowledgeBaseID = rootContextKnowledgeBaseID(spec.RootContext)
	}
	return documentFile, true, nil
}

func isProjectSourceBindingItemUnavailable(err error) bool {
	return errors.Is(err, projectfile.ErrFileUnavailable) || errors.Is(err, kshared.ErrNotFound)
}

func (s *KnowledgeBaseDocumentFlowApp) warnUnavailableSourceBindingItem(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	targetRef string,
	err error,
	extraFields ...any,
) {
	if s == nil || s.support == nil || s.support.logger == nil {
		return
	}
	fields := make([]any, 0, sourceBindingUnavailableLogFieldCount+len(extraFields))
	fields = append(
		fields,
		"provider", binding.Provider,
		"binding_id", binding.ID,
		"knowledge_base_code", binding.KnowledgeBaseCode,
		"target_ref", strings.TrimSpace(targetRef),
		"reason", sourceBindingUnavailableReason,
		"error", err,
	)
	fields = append(fields, extraFields...)
	s.support.logger.KnowledgeWarnContext(ctx, "Skip unavailable source binding document", fields...)
}

func (s *KnowledgeBaseDocumentFlowApp) mapThirdPlatformTreeNodeToResolvedDocument(
	ctx context.Context,
	binding sourcebindingdomain.Binding,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	node thirdplatform.TreeNode,
	seenThirdFileIDs map[string]struct{},
) (sourcebindingservice.ResolvedDocument, bool) {
	if node.IsDirectory {
		return sourcebindingservice.ResolvedDocument{}, false
	}
	documentFile := mapThirdPlatformTreeNodeToDocumentFile(binding.Provider, spec, node)
	itemRef := strings.TrimSpace(documentFile.ThirdID)
	if itemRef == "" {
		return sourcebindingservice.ResolvedDocument{}, false
	}
	if _, exists := seenThirdFileIDs[itemRef]; exists {
		return sourcebindingservice.ResolvedDocument{}, false
	}
	if !documentdomain.IsSupportedKnowledgeBaseDocumentFile(documentFile) {
		s.logInfo(
			ctx,
			"Skip unsupported third-platform source binding document",
			"knowledge_base_code", binding.KnowledgeBaseCode,
			"third_file_id", itemRef,
			"extension", strings.TrimSpace(documentFile.Extension),
		)
		return sourcebindingservice.ResolvedDocument{}, false
	}
	seenThirdFileIDs[itemRef] = struct{}{}
	return buildThirdPlatformResolvedDocument(binding, documentFile, resolveReasonFromThirdPlatformSpec(binding, spec)), true
}

func mapThirdPlatformTreeNodeToDocumentFile(
	provider string,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
	node thirdplatform.TreeNode,
) *docentity.File {
	documentFile := &docentity.File{
		Type:            thirdPlatformDocumentFileType,
		Name:            strings.TrimSpace(node.Name),
		ThirdID:         thirdPlatformTreeNodeRef(node),
		SourceType:      strings.TrimSpace(provider),
		Extension:       filetype.NormalizeExtension(strings.TrimSpace(node.Extension)),
		KnowledgeBaseID: strings.TrimSpace(node.KnowledgeBaseID),
	}
	if documentFile.Extension == "" {
		documentFile.Extension = documentdomainInferExtension(documentFile)
	}
	if documentFile.KnowledgeBaseID == "" {
		documentFile.KnowledgeBaseID = rootContextKnowledgeBaseID(spec.RootContext)
	}
	return documentFile
}

func thirdPlatformTreeNodeRef(node thirdplatform.TreeNode) string {
	return firstNonEmpty(strings.TrimSpace(node.ThirdFileID), strings.TrimSpace(node.ID), strings.TrimSpace(node.FileID))
}

func buildThirdPlatformResolvedDocument(
	binding sourcebindingdomain.Binding,
	documentFile *docentity.File,
	resolveReason string,
) sourcebindingservice.ResolvedDocument {
	return sourcebindingservice.ResolvedDocument{
		Name:          firstNonEmpty(strings.TrimSpace(documentFile.Name), strings.TrimSpace(documentFile.ThirdID)),
		DocumentFile:  cloneDocumentFile(documentFile),
		DocumentType:  int(docentity.DocumentInputKindFile),
		ItemRef:       strings.TrimSpace(documentFile.ThirdID),
		Extension:     strings.TrimSpace(documentFile.Extension),
		ResolveReason: resolveReason,
		AutoAdded:     len(binding.Targets) == 0 && binding.RootType != sourcebindingdomain.RootTypeFile,
		SnapshotMeta:  documentFileToMap(documentFile),
	}
}

func resolveReasonFromThirdPlatformSpec(
	binding sourcebindingdomain.Binding,
	spec sourcebindingservice.EnterpriseBindingExpansionSpec,
) string {
	if len(binding.Targets) > 0 {
		return sourceBindingResolveReasonTarget
	}
	if binding.RootType == sourcebindingdomain.RootTypeFile && strings.TrimSpace(binding.RootRef) == strings.TrimSpace(spec.RootRef) {
		return sourceBindingResolveReasonRoot
	}
	return sourceBindingResolveReasonRoot
}

func rootContextKnowledgeBaseID(rootContext map[string]any) string {
	value, _, err := pkgjsoncompat.IDStringFromAny(rootContext["knowledge_base_id"], "root_context.knowledge_base_id")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

func documentdomainInferExtension(file *docentity.File) string {
	return filetype.NormalizeExtension(firstNonEmpty(
		strings.TrimSpace(file.Extension),
		filetype.ExtractExtension(strings.TrimSpace(file.Name)),
		filetype.ExtractExtension(strings.TrimSpace(file.URL)),
		filetype.ExtractExtension(strings.TrimSpace(file.FileKey)),
	))
}

func (s *KnowledgeBaseDocumentFlowApp) resolveLocalUploadBindingDocuments(
	binding sourcebindingdomain.Binding,
) ([]sourcebindingservice.ResolvedDocument, error) {
	rawDocumentFile, _ := binding.SyncConfig["document_file"].(map[string]any)
	documentFile, _, err := mapToDocumentFile(rawDocumentFile)
	if err != nil {
		return nil, fmt.Errorf("convert local upload document file: %w", err)
	}
	if documentFile == nil {
		documentFile = &docentity.File{
			Type:       "external",
			Name:       binding.RootRef,
			URL:        binding.RootRef,
			SourceType: sourcebindingdomain.ProviderLocalUpload,
		}
	}
	itemRef := firstNonEmpty(strings.TrimSpace(binding.RootRef), strings.TrimSpace(documentFile.URL), strings.TrimSpace(documentFile.Name))
	return []sourcebindingservice.ResolvedDocument{{
		Name:          firstNonEmpty(strings.TrimSpace(documentFile.Name), itemRef),
		DocumentFile:  documentFile,
		DocumentType:  int(docentity.DocumentInputKindFile),
		ItemRef:       itemRef,
		Extension:     strings.TrimSpace(documentFile.Extension),
		ResolveReason: "root",
		AutoAdded:     false,
		SnapshotMeta:  documentFileToMap(documentFile),
	}}, nil
}

func thirdPlatformExpansionDocumentFile(provider, rootType, rootRef string, rootContext map[string]any) map[string]any {
	payload := map[string]any{
		"type":          thirdPlatformDocumentFileType,
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
	kb *kbentity.KnowledgeBase,
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
	kb *kbentity.KnowledgeBase,
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
	if _, err := s.support.healKnowledgeBaseUIDs(ctx, kb, "source binding preflight"); err != nil {
		return err
	}
	if err := s.newSourceBindingMaterializationService().Preflight(ctx, sourcebindingservice.MaterializationInput{
		KnowledgeBaseCode:   kb.Code,
		OrganizationCode:    organizationCode,
		KnowledgeBaseUserID: knowledgeBaseUpdatedUserID(kb),
		KnowledgeBaseOwner:  knowledgeBaseCreatedUserID(kb),
		FallbackUserID:      userID,
		Bindings:            bindings,
		MaxDocuments:        knowledgeBaseMaterializeDocumentLimit,
	}); err != nil {
		return fmt.Errorf("preflight source binding documents: %w", err)
	}
	return nil
}

func shouldSkipPrepareRebuildKnowledgeBase(scopeMode RebuildScopeMode, err error) bool {
	return scopeMode != RebuildScopeModeKnowledgeBase && sourcebindingservice.ShouldRetryResolve(err)
}

func (s *KnowledgeBaseDocumentFlowApp) warnSkippedPrepareRebuildKnowledgeBase(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
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
	s.support.logger.KnowledgeWarnContext(
		ctx,
		"Skip prepare knowledge rebuild because source binding documents cannot be resolved",
		"knowledge_base_code", knowledgeBaseCode,
		"knowledge_base_name", knowledgeBaseName,
		"error", err,
	)
}

func (s *KnowledgeBaseDocumentFlowApp) listKnowledgeBasesForRebuild(ctx context.Context, scope RebuildScope) ([]*kbentity.KnowledgeBase, error) {
	switch scope.Mode {
	case RebuildScopeModeKnowledgeBase:
		kb, err := s.support.domainService.ShowByCodeAndOrg(ctx, scope.KnowledgeBaseCode, scope.OrganizationCode)
		if err != nil {
			return nil, fmt.Errorf("show knowledge base for rebuild: %w", err)
		}
		return []*kbentity.KnowledgeBase{kb}, nil
	case RebuildScopeModeOrganization:
		kbs, _, err := s.support.domainService.List(ctx, &kbrepository.Query{
			OrganizationCode: scope.OrganizationCode,
			Offset:           0,
			Limit:            knowledgeBaseRebuildListLimit,
		})
		if err != nil {
			return nil, fmt.Errorf("list organization knowledge bases for rebuild: %w", err)
		}
		return kbs, nil
	case RebuildScopeModeAll:
		kbs, _, err := s.support.domainService.List(ctx, &kbrepository.Query{
			Offset: 0,
			Limit:  knowledgeBaseRebuildListLimit,
		})
		if err != nil {
			return nil, fmt.Errorf("list all knowledge bases for rebuild: %w", err)
		}
		return kbs, nil
	default:
		return []*kbentity.KnowledgeBase{}, nil
	}
}

func (s *KnowledgeBaseDocumentFlowApp) bootstrapSourceBindings(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	userID string,
) ([]sourcebindingdomain.Binding, error) {
	if kb != nil && kb.SourceType != nil {
		knowledgeBaseType := knowledgeBaseTypeFromKnowledgeBase(kb)
		semanticSourceType, err := kbentity.ResolveSemanticSourceType(knowledgeBaseType, *kb.SourceType)
		if err == nil && semanticSourceType == kbentity.SemanticSourceTypeProject {
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

func bootstrapBindingUserID(kb *kbentity.KnowledgeBase, fallbackUserID string) string {
	if userID := knowledgeBaseUpdatedUserID(kb); userID != "" {
		return userID
	}
	if userID := knowledgeBaseCreatedUserID(kb); userID != "" {
		return userID
	}
	return strings.TrimSpace(fallbackUserID)
}

func knowledgeBaseUpdatedUserID(kb *kbentity.KnowledgeBase) string {
	if kb == nil {
		return ""
	}
	return strings.TrimSpace(kb.UpdatedUID)
}

func knowledgeBaseCreatedUserID(kb *kbentity.KnowledgeBase) string {
	if kb == nil {
		return ""
	}
	return strings.TrimSpace(kb.CreatedUID)
}

func mapToDocumentFile(raw map[string]any) (*docentity.File, bool, error) {
	if len(raw) == 0 {
		return nil, false, nil
	}
	encoded, err := json.Marshal(normalizeDocumentFileIDMap(raw))
	if err != nil {
		return nil, false, fmt.Errorf("marshal document file payload: %w", err)
	}
	var dto docfilehelper.DocumentFileDTO
	if err := dto.UnmarshalJSON(encoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal document file payload: %w", err)
	}
	return docfilehelper.ToDomainFile(&dto), true, nil
}

func normalizeDocumentFileIDMap(raw map[string]any) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	normalized := cloneMap(raw)
	for _, key := range []string{"third_id", "third_file_id", "knowledge_base_id", "project_file_id"} {
		value, provided, err := pkgjsoncompat.IDStringFromAny(normalized[key], "document_file."+key)
		if err != nil || !provided {
			continue
		}
		normalized[key] = value
	}
	return normalized
}

func documentFileToMap(documentFile *docentity.File) map[string]any {
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

func cloneDocumentFile(documentFile *docentity.File) *docentity.File {
	if documentFile == nil {
		return nil
	}
	cloned := *documentFile
	return &cloned
}
