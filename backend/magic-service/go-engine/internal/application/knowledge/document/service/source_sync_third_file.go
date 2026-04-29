package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/filetype"
	"magic/internal/pkg/thirdplatform"
)

const thirdPlatformDocumentFileType = "third_platform"

var errThirdFileNodeResolverUnavailable = errors.New("third-file node resolver unavailable")

type thirdFileCurrentSource struct {
	Node               thirdplatform.TreeNode
	DocumentFile       *docentity.File
	KnowledgeBaseID    string
	AncestorFolderRefs []string
	Processable        bool
}

func (s *ThirdFileRevectorizeAppService) resolveThirdFileCoveringBindings(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) ([]sourcebindingdomain.Binding, error) {
	node, err := s.resolveThirdFileNode(ctx, task)
	if err != nil {
		if errors.Is(err, thirdplatform.ErrDocumentUnavailable) ||
			errors.Is(err, thirdplatform.ErrIdentityMissing) ||
			errors.Is(err, errThirdFileNodeResolverUnavailable) {
			return []sourcebindingdomain.Binding{}, nil
		}
		if s != nil && s.support != nil && s.support.logger != nil {
			s.support.logger.WarnContext(
				ctx,
				"Resolve third-file node meta failed before eligibility, skip uncached miss",
				"organization_code", task.OrganizationCode,
				"third_platform_type", task.ThirdPlatformType,
				"third_file_id", task.ThirdFileID,
				"third_knowledge_id", task.ThirdKnowledgeID,
				"error", err,
			)
		}
		return []sourcebindingdomain.Binding{}, nil
	}
	if node == nil {
		return []sourcebindingdomain.Binding{}, nil
	}
	current := buildThirdFileCurrentSource(task, node)
	if current.KnowledgeBaseID == "" || !current.Processable {
		return []sourcebindingdomain.Binding{}, nil
	}
	return s.coveringThirdFileBindings(ctx, task, current)
}

func (s *ThirdFileRevectorizeAppService) resolveThirdFileNode(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) (*thirdplatform.NodeResolveResult, error) {
	if s == nil || s.support == nil || s.support.thirdPlatformDocumentPort == nil || task == nil {
		return nil, errThirdFileNodeResolverUnavailable
	}
	resolver, ok := s.support.thirdPlatformDocumentPort.(thirdPlatformNodeResolver)
	if !ok {
		return nil, errThirdFileNodeResolverUnavailable
	}
	node, err := resolver.ResolveNode(ctx, thirdplatform.NodeResolveInput{
		OrganizationCode:              task.OrganizationCode,
		UserID:                        task.UserID,
		ThirdPlatformUserID:           task.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: task.ThirdPlatformOrganizationCode,
		ThirdPlatformType:             task.ThirdPlatformType,
		ThirdFileID:                   task.ThirdFileID,
		KnowledgeBaseID:               task.ThirdKnowledgeID,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve third-file node: %w", err)
	}
	return node, nil
}

func (s *ThirdFileRevectorizeAppService) coveringThirdFileBindings(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	current thirdFileCurrentSource,
) ([]sourcebindingdomain.Binding, error) {
	if current.KnowledgeBaseID == "" {
		return nil, nil
	}
	bindings, err := s.support.listRealtimeTeamshareBindings(
		ctx,
		task.OrganizationCode,
		sourcebindingdomain.ProviderTeamshare,
		current.KnowledgeBaseID,
	)
	if err != nil {
		return nil, err
	}
	input := sourcebindingservice.SourceFileCoverageInput{
		OrganizationCode:   task.OrganizationCode,
		Provider:           sourcebindingdomain.ProviderTeamshare,
		RootType:           sourcebindingdomain.RootTypeKnowledgeBase,
		RootRef:            current.KnowledgeBaseID,
		FileRef:            current.DocumentFile.ThirdID,
		AncestorFolderRefs: current.AncestorFolderRefs,
	}
	result := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		if sourcebindingservice.BindingCoversSourceFile(binding, input) {
			result = append(result, binding)
		}
	}
	return result, nil
}

func buildThirdFileCurrentSource(
	task *documentdomain.ThirdFileRevectorizeInput,
	resolved *thirdplatform.NodeResolveResult,
) thirdFileCurrentSource {
	if resolved == nil {
		return thirdFileCurrentSource{}
	}
	node := resolved.TreeNode
	if strings.TrimSpace(node.ThirdFileID) == "" {
		node.ThirdFileID = thirdFileNodeRef(node)
	}
	if strings.TrimSpace(node.ThirdFileID) == "" && task != nil {
		node.ThirdFileID = strings.TrimSpace(task.ThirdFileID)
	}
	knowledgeBaseID := thirdFileKnowledgeBaseID(node)
	documentFile := thirdFileDocumentFileFromNode(task, node, resolved.DocumentFile)
	if documentFile != nil {
		documentFile.KnowledgeBaseID = knowledgeBaseID
	}
	return thirdFileCurrentSource{
		Node:               node,
		DocumentFile:       documentFile,
		KnowledgeBaseID:    knowledgeBaseID,
		AncestorFolderRefs: thirdFileAncestorFolderRefs(node),
		Processable:        !node.IsDirectory && documentdomain.IsSupportedKnowledgeBaseDocumentFile(documentFile),
	}
}

func thirdFileDocumentFileFromNode(
	task *documentdomain.ThirdFileRevectorizeInput,
	node thirdplatform.TreeNode,
	payload map[string]any,
) *docentity.File {
	clonedPayload := documentdomain.CloneDocumentFilePayload(payload)
	if len(clonedPayload) == 0 {
		clonedPayload = map[string]any{}
	}
	clonedPayload["type"] = thirdPlatformDocumentFileType
	clonedPayload["source_type"] = sourcebindingdomain.ProviderTeamshare
	clonedPayload["platform_type"] = sourcebindingdomain.ProviderTeamshare
	clonedPayload["third_id"] = thirdFileFirstNonEmpty(clonedPayload["third_id"], clonedPayload["third_file_id"], node.ThirdFileID, node.ID, node.FileID, taskThirdFileID(task))
	clonedPayload["third_file_id"] = clonedPayload["third_id"]
	clonedPayload["name"] = thirdFileFirstNonEmpty(clonedPayload["name"], node.Name, clonedPayload["third_id"])
	clonedPayload["extension"] = thirdFileFirstNonEmpty(clonedPayload["extension"], clonedPayload["third_file_extension_name"], node.Extension)
	clonedPayload["third_file_type"] = thirdFileFirstNonEmpty(clonedPayload["third_file_type"], clonedPayload["file_type"], node.FileType)
	clonedPayload["file_type"] = clonedPayload["third_file_type"]
	documentFile, ok := documentdomain.FileFromPayload(clonedPayload)
	if !ok || documentFile == nil {
		documentFile = &docentity.File{}
	}
	documentFile.Type = thirdPlatformDocumentFileType
	documentFile.SourceType = sourcebindingdomain.ProviderTeamshare
	documentFile.ThirdID = strings.TrimSpace(thirdFileAnyString(clonedPayload["third_id"]))
	documentFile.Name = strings.TrimSpace(thirdFileAnyString(clonedPayload["name"]))
	documentFile.Extension = filetype.NormalizeExtension(strings.TrimSpace(thirdFileAnyString(clonedPayload["extension"])))
	documentFile.ThirdFileType = strings.TrimSpace(thirdFileAnyString(clonedPayload["third_file_type"]))
	documentFile.KnowledgeBaseID = ""
	if documentFile.Extension == "" {
		documentFile.Extension = documentdomain.InferDocumentFileExtensionLight(documentFile)
	}
	return documentFile
}

func thirdFileKnowledgeBaseID(node thirdplatform.TreeNode) string {
	if id := normalizeThirdFileKnowledgeBaseID(node.KnowledgeBaseID); id != "" {
		return id
	}
	return thirdFileRootFromPath(node)
}

func thirdFileAncestorFolderRefs(node thirdplatform.TreeNode) []string {
	refs := make([]string, 0, len(node.Path)+1)
	if strings.TrimSpace(node.ParentID) != "" {
		refs = append(refs, strings.TrimSpace(node.ParentID))
	}
	rootRef := thirdFileRootFromPath(node)
	for _, pathNode := range node.Path {
		id := strings.TrimSpace(pathNode.ID)
		if id == "" {
			continue
		}
		if id == rootRef || id == thirdFileNodeRef(node) {
			continue
		}
		refs = append(refs, id)
	}
	return compactThirdFileStrings(refs)
}

func thirdFileRootFromPath(node thirdplatform.TreeNode) string {
	for _, pathNode := range node.Path {
		if id := normalizeThirdFilePathRoot(pathNode); id != "" {
			return id
		}
	}
	return ""
}

func normalizeThirdFilePathRoot(pathNode thirdplatform.PathNode) string {
	id := normalizeThirdFileKnowledgeBaseID(pathNode.ID)
	if id == "" {
		return ""
	}
	if strings.EqualFold(strings.TrimSpace(pathNode.Type), "space") {
		return ""
	}
	return id
}

func normalizeThirdFileKnowledgeBaseID(id string) string {
	id = strings.TrimSpace(id)
	if id == "" || id == "0" {
		return ""
	}
	return id
}

func thirdFileCurrentSourceRef(current thirdFileCurrentSource) documentdomain.ThirdFileCurrentRef {
	if current.DocumentFile == nil {
		return documentdomain.ThirdFileCurrentRef{}
	}
	return documentdomain.ThirdFileCurrentRef{
		ThirdFileID:  strings.TrimSpace(current.DocumentFile.ThirdID),
		DocumentName: thirdFileFirstNonEmpty(current.DocumentFile.Name, current.DocumentFile.ThirdID),
	}
}

func buildThirdFileBindingRefs(bindings []sourcebindingdomain.Binding) []documentdomain.ThirdFileBindingRef {
	refs := make([]documentdomain.ThirdFileBindingRef, 0, len(bindings))
	for _, binding := range bindings {
		refs = append(refs, documentdomain.ThirdFileBindingRef{
			ID:                binding.ID,
			OrganizationCode:  strings.TrimSpace(binding.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(binding.KnowledgeBaseCode),
			Provider:          strings.TrimSpace(binding.Provider),
			RootType:          strings.TrimSpace(binding.RootType),
			RootRef:           strings.TrimSpace(binding.RootRef),
			UserID:            strings.TrimSpace(sourcebindingservice.BindingUserID(binding)),
			TargetCount:       len(binding.Targets),
		})
	}
	return refs
}

func collectThirdFileKnowledgeBaseCodes(
	bindings []sourcebindingdomain.Binding,
	docs []*docentity.KnowledgeBaseDocument,
) []string {
	codes := make([]string, 0, len(bindings)+len(docs))
	for _, binding := range bindings {
		codes = append(codes, binding.KnowledgeBaseCode)
	}
	for _, doc := range docs {
		if doc != nil {
			codes = append(codes, doc.KnowledgeBaseCode)
		}
	}
	return compactThirdFileStrings(codes)
}

func filterThirdFileBindingsByEnabledKnowledgeBases(
	bindings []sourcebindingdomain.Binding,
	enabledCodes map[string]struct{},
) []sourcebindingdomain.Binding {
	if len(bindings) == 0 || len(enabledCodes) == 0 {
		return []sourcebindingdomain.Binding{}
	}
	result := make([]sourcebindingdomain.Binding, 0, len(bindings))
	for _, binding := range bindings {
		if _, ok := enabledCodes[strings.TrimSpace(binding.KnowledgeBaseCode)]; ok {
			result = append(result, binding)
		}
	}
	return result
}

func (s *ThirdFileRevectorizeAppService) createThirdFileManagedDocument(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	target documentdomain.ThirdFileCreateTarget,
	current thirdFileCurrentSource,
) (string, error) {
	if s == nil || s.support == nil || s.support.sourceBindingRepo == nil || current.DocumentFile == nil {
		return "", errDocumentSourceBindingRepositoryRequired
	}
	now := time.Now()
	sourceItem, err := s.support.sourceBindingRepo.UpsertSourceItem(ctx, sourcebindingdomain.SourceItem{
		OrganizationCode: strings.TrimSpace(target.OrganizationCode),
		Provider:         strings.TrimSpace(target.Provider),
		RootType:         strings.TrimSpace(target.RootType),
		RootRef:          strings.TrimSpace(target.RootRef),
		GroupRef:         strings.TrimSpace(current.Node.ParentID),
		ItemType:         sourcebindingdomain.RootTypeFile,
		ItemRef:          strings.TrimSpace(current.DocumentFile.ThirdID),
		DisplayName:      strings.TrimSpace(current.DocumentFile.Name),
		Extension:        strings.TrimSpace(current.DocumentFile.Extension),
		SnapshotMeta:     thirdFileDocumentFileToMap(current.DocumentFile),
		LastResolvedAt:   &now,
	})
	if err != nil {
		return "", fmt.Errorf("upsert realtime third-file source item: %w", err)
	}
	userID := strings.TrimSpace(target.UserID)
	if userID == "" {
		userID = strings.TrimSpace(task.UserID)
	}
	documentDTO, err := s.support.createManagedDocument(ctx, &documentdomain.CreateManagedDocumentInput{
		OrganizationCode:  strings.TrimSpace(target.OrganizationCode),
		UserID:            userID,
		KnowledgeBaseCode: strings.TrimSpace(target.KnowledgeBaseCode),
		Code: documentdomain.BuildManagedSourceDocumentCode(
			target.Provider,
			target.BindingID,
			sourceItem.ID,
		),
		SourceBindingID:   target.BindingID,
		SourceItemID:      sourceItem.ID,
		Name:              thirdFileFirstNonEmpty(target.DocumentName, current.DocumentFile.Name, current.DocumentFile.ThirdID),
		DocType:           int(docentity.DocumentInputKindFile),
		DocumentFile:      thirdFileCloneDocumentFile(current.DocumentFile),
		ThirdPlatformType: sourcebindingdomain.ProviderTeamshare,
		ThirdFileID:       strings.TrimSpace(current.DocumentFile.ThirdID),
		AutoAdded:         target.AutoAdded,
		AutoSync:          false,
	})
	if err != nil {
		return "", fmt.Errorf("auto create realtime third-file document: %w", err)
	}
	return documentDTO.Code, nil
}

func thirdFileCreateSyncRequest(
	task *documentdomain.ThirdFileRevectorizeInput,
	target documentdomain.ThirdFileCreateTarget,
	documentCode string,
) *documentdomain.SyncDocumentInput {
	userID := strings.TrimSpace(target.UserID)
	if userID == "" && task != nil {
		userID = strings.TrimSpace(task.UserID)
	}
	return &documentdomain.SyncDocumentInput{
		OrganizationCode:  strings.TrimSpace(target.OrganizationCode),
		KnowledgeBaseCode: strings.TrimSpace(target.KnowledgeBaseCode),
		Code:              strings.TrimSpace(documentCode),
		Mode:              documentdomain.SyncModeCreate,
		Async:             true,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode:              strings.TrimSpace(target.OrganizationCode),
			UserID:                        userID,
			BusinessID:                    strings.TrimSpace(target.KnowledgeBaseCode),
			ThirdPlatformUserID:           strings.TrimSpace(task.ThirdPlatformUserID),
			ThirdPlatformOrganizationCode: strings.TrimSpace(task.ThirdPlatformOrganizationCode),
		},
		RevectorizeSource:                 documentdomain.RevectorizeSourceThirdFileBroadcast,
		SingleDocumentThirdPlatformResync: true,
	}
}

func thirdFileDocumentFileToMap(file *docentity.File) map[string]any {
	if file == nil {
		return map[string]any{}
	}
	payload := map[string]any{
		"type":          file.Type,
		"name":          file.Name,
		"url":           file.URL,
		"file_key":      file.FileKey,
		"size":          file.Size,
		"extension":     file.Extension,
		"third_id":      file.ThirdID,
		"third_file_id": file.ThirdID,
		"source_type":   file.SourceType,
		"platform_type": file.SourceType,
	}
	if strings.TrimSpace(file.ThirdFileType) != "" {
		payload["third_file_type"] = file.ThirdFileType
	}
	if strings.TrimSpace(file.KnowledgeBaseID) != "" {
		payload["knowledge_base_id"] = file.KnowledgeBaseID
	}
	return payload
}

func thirdFileCloneDocumentFile(file *docentity.File) *docentity.File {
	if file == nil {
		return nil
	}
	cloned := *file
	return &cloned
}

func thirdFileNodeRef(node thirdplatform.TreeNode) string {
	return thirdFileFirstNonEmpty(node.ThirdFileID, node.ID, node.FileID)
}

func taskThirdFileID(task *documentdomain.ThirdFileRevectorizeInput) string {
	if task == nil {
		return ""
	}
	return strings.TrimSpace(task.ThirdFileID)
}

func thirdFileFirstNonEmpty(values ...any) string {
	for _, value := range values {
		if text := thirdFileAnyString(value); text != "" {
			return text
		}
	}
	return ""
}

func thirdFileAnyString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		if typed == nil {
			return ""
		}
		return strings.TrimSpace(fmt.Sprintf("%v", typed))
	}
}

func compactThirdFileStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
