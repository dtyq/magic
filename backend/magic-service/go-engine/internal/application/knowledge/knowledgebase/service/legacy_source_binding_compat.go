package kbapp

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

const (
	legacyTeamshareFolderFileType         = 0
	legacyTeamshareKnowledgeBaseFileType  = 9
	legacyTeamshareKnowledgeBaseSpaceType = 8
)

func (s *KnowledgeBaseAppService) resolveCreateSourceBindingInputs(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) ([]kbdto.SourceBindingInput, error) {
	if input == nil {
		return nil, nil
	}
	if input.SourceBindingsProvided {
		return append([]kbdto.SourceBindingInput(nil), input.SourceBindings...), nil
	}
	if len(input.SourceBindings) > 0 {
		return append([]kbdto.SourceBindingInput(nil), input.SourceBindings...), nil
	}
	if len(input.LegacyDocumentFiles) == 0 {
		return nil, nil
	}
	return s.compatLegacyDocumentFilesToSourceBindingInputs(
		ctx,
		input.OrganizationCode,
		input.UserID,
		input.SourceType,
		input.LegacyDocumentFiles,
	)
}

func (s *KnowledgeBaseAppService) resolveUpdateSourceBindingInputs(
	ctx context.Context,
	input *kbdto.UpdateKnowledgeBaseInput,
) ([]kbdto.SourceBindingInput, error) {
	if input == nil {
		return nil, nil
	}
	if input.SourceBindings != nil {
		return append([]kbdto.SourceBindingInput(nil), (*input.SourceBindings)...), nil
	}
	if input.LegacyDocumentFiles == nil {
		return nil, nil
	}
	return s.compatLegacyDocumentFilesToSourceBindingInputs(
		ctx,
		input.OrganizationCode,
		input.UserID,
		input.SourceType,
		*input.LegacyDocumentFiles,
	)
}

func (s *KnowledgeBaseAppService) compatLegacyDocumentFilesToSourceBindingInputs(
	ctx context.Context,
	organizationCode string,
	userID string,
	sourceType *int,
	documentFiles []kbdto.LegacyDocumentFileInput,
) ([]kbdto.SourceBindingInput, error) {
	normalizedFiles := normalizeLegacyDocumentFiles(documentFiles)
	if len(normalizedFiles) == 0 {
		return nil, nil
	}

	effectiveFiles := normalizedFiles
	if shouldExpandLegacyEnterpriseDocumentFiles(sourceType) {
		effectiveFiles = s.expandLegacyEnterpriseDocumentFiles(ctx, organizationCode, userID, normalizedFiles)
	}

	strictEnterprise := isEnterpriseSourceType(sourceType)
	if strictEnterprise || hasEnterpriseKnowledgeBaseBinding(effectiveFiles) {
		return buildLegacyEnterpriseSourceBindingInputs(effectiveFiles, strictEnterprise)
	}

	return buildLegacyDocumentFileBindingInputs(effectiveFiles), nil
}

func normalizeLegacyDocumentFiles(documentFiles []kbdto.LegacyDocumentFileInput) []map[string]any {
	results := make([]map[string]any, 0, len(documentFiles))
	for _, documentFile := range documentFiles {
		normalized := normalizeLegacyDocumentFilePayload(map[string]any(documentFile))
		if len(normalized) == 0 {
			continue
		}
		results = append(results, normalized)
	}
	return results
}

func (s *KnowledgeBaseAppService) expandLegacyEnterpriseDocumentFiles(
	ctx context.Context,
	organizationCode string,
	userID string,
	documentFiles []map[string]any,
) []map[string]any {
	if s == nil || s.thirdPlatformExpander == nil {
		return documentFiles
	}

	thirdPlatformFiles := make([]map[string]any, 0, len(documentFiles))
	for _, documentFile := range documentFiles {
		if isThirdPlatformDocumentFile(documentFile) {
			thirdPlatformFiles = append(thirdPlatformFiles, cloneMap(documentFile))
		}
	}
	if len(thirdPlatformFiles) == 0 {
		return documentFiles
	}

	expanded, err := s.thirdPlatformExpander.Expand(ctx, organizationCode, userID, thirdPlatformFiles)
	if err != nil || len(expanded) == 0 {
		return documentFiles
	}

	knowledgeBaseByThirdID := make(map[string]string, len(expanded))
	for _, documentFile := range expanded {
		if documentFile == nil {
			continue
		}
		thirdID := strings.TrimSpace(documentFile.ThirdID)
		knowledgeBaseID := strings.TrimSpace(documentFile.KnowledgeBaseID)
		if thirdID == "" || knowledgeBaseID == "" {
			continue
		}
		knowledgeBaseByThirdID[thirdID] = knowledgeBaseID
	}
	if len(knowledgeBaseByThirdID) == 0 {
		return documentFiles
	}

	results := make([]map[string]any, 0, len(documentFiles))
	for _, documentFile := range documentFiles {
		cloned := cloneMap(documentFile)
		if strings.TrimSpace(legacyDocumentFileIDString(cloned, "knowledge_base_id")) == "" {
			thirdID := firstNonEmpty(legacyDocumentFileIDString(cloned, "third_id"), legacyDocumentFileIDString(cloned, "third_file_id"))
			if knowledgeBaseID := knowledgeBaseByThirdID[thirdID]; knowledgeBaseID != "" {
				cloned["knowledge_base_id"] = knowledgeBaseID
			}
		}
		results = append(results, cloned)
	}
	return results
}

func buildLegacyEnterpriseSourceBindingInputs(
	documentFiles []map[string]any,
	strictEnterprise bool,
) ([]kbdto.SourceBindingInput, error) {
	results := make([]kbdto.SourceBindingInput, 0)
	bindingIndex := make(map[string]int)
	targetSeen := make(map[string]map[string]struct{})

	appendFallback := func(documentFile map[string]any) {
		if binding, ok := buildLegacyDocumentFileBindingInput(documentFile); ok {
			results = append(results, binding)
		}
	}

	for _, documentFile := range documentFiles {
		if !isThirdPlatformDocumentFile(documentFile) {
			if strictEnterprise {
				return nil, fmt.Errorf("%w: legacy document_files must identify a teamshare knowledge_base root", sourcebindingdomain.ErrSemanticMismatch)
			}
			appendFallback(documentFile)
			continue
		}

		provider := firstNonEmpty(anyToString(documentFile["source_type"]), anyToString(documentFile["platform_type"]), sourcebindingdomain.ProviderTeamshare)
		knowledgeBaseID := resolveEnterpriseKnowledgeBaseRootRef(documentFile)
		if provider == "" || knowledgeBaseID == "" {
			if strictEnterprise {
				return nil, fmt.Errorf("%w: legacy document_files must identify a teamshare knowledge_base root", sourcebindingdomain.ErrSemanticMismatch)
			}
			appendFallback(documentFile)
			continue
		}

		bindingKey := provider + ":" + knowledgeBaseID
		idx, ok := bindingIndex[bindingKey]
		if !ok {
			idx = len(results)
			bindingIndex[bindingKey] = idx
			targetSeen[bindingKey] = map[string]struct{}{}
			results = append(results, kbdto.SourceBindingInput{
				Provider: provider,
				RootType: sourcebindingdomain.RootTypeKnowledgeBase,
				RootRef:  knowledgeBaseID,
				SyncMode: sourcebindingdomain.SyncModeManual,
				Enabled:  new(true),
				SyncConfig: map[string]any{
					"root_context": map[string]any{
						"knowledge_base_id": knowledgeBaseID,
					},
				},
			})
		}

		targetRef := firstNonEmpty(legacyDocumentFileIDString(documentFile, "third_id"), legacyDocumentFileIDString(documentFile, "third_file_id"))
		if targetRef == "" || (isTeamshareKnowledgeBaseRoot(documentFile) && targetRef == knowledgeBaseID) {
			continue
		}

		targetType := sourcebindingdomain.TargetTypeFile
		if isTeamshareFolderDocument(documentFile) {
			targetType = sourcebindingdomain.TargetTypeFolder
		}
		targetKey := targetType + ":" + targetRef
		if _, exists := targetSeen[bindingKey][targetKey]; exists {
			continue
		}
		targetSeen[bindingKey][targetKey] = struct{}{}
		results[idx].Targets = append(results[idx].Targets, kbdto.SourceBindingTargetInput{
			TargetType: targetType,
			TargetRef:  targetRef,
		})
	}

	return results, nil
}

func buildLegacyDocumentFileBindingInputs(documentFiles []map[string]any) []kbdto.SourceBindingInput {
	results := make([]kbdto.SourceBindingInput, 0, len(documentFiles))
	for _, documentFile := range documentFiles {
		if binding, ok := buildLegacyDocumentFileBindingInput(documentFile); ok {
			results = append(results, binding)
		}
	}
	return results
}

func buildLegacyDocumentFileBindingInput(documentFile map[string]any) (kbdto.SourceBindingInput, bool) {
	identity := resolveLegacyDocumentFileBindingIdentity(documentFile)
	if identity.Provider == "" || identity.RootType == "" || identity.RootRef == "" {
		return kbdto.SourceBindingInput{}, false
	}
	return kbdto.SourceBindingInput{
		Provider: identity.Provider,
		RootType: identity.RootType,
		RootRef:  identity.RootRef,
		SyncMode: sourcebindingdomain.SyncModeManual,
		Enabled:  new(true),
		SyncConfig: map[string]any{
			"document_file": cloneMap(documentFile),
		},
	}, true
}

type legacyBindingIdentity struct {
	Provider string
	RootType string
	RootRef  string
}

func resolveLegacyDocumentFileBindingIdentity(documentFile map[string]any) legacyBindingIdentity {
	if !isThirdPlatformDocumentFile(documentFile) {
		return legacyBindingIdentity{
			Provider: sourcebindingdomain.ProviderLocalUpload,
			RootType: sourcebindingdomain.RootTypeFile,
			RootRef: firstNonEmpty(
				anyToString(documentFile["url"]),
				anyToString(documentFile["key"]),
				anyToString(documentFile["name"]),
			),
		}
	}

	provider := firstNonEmpty(anyToString(documentFile["source_type"]), anyToString(documentFile["platform_type"]), sourcebindingdomain.ProviderTeamshare)
	rootRef := resolveEnterpriseKnowledgeBaseRootRef(documentFile)
	rootType := sourcebindingdomain.RootTypeKnowledgeBase
	if rootRef == "" {
		rootRef = firstNonEmpty(legacyDocumentFileIDString(documentFile, "third_id"), legacyDocumentFileIDString(documentFile, "third_file_id"))
		if isTeamshareFolderDocument(documentFile) {
			rootType = sourcebindingdomain.RootTypeFolder
		} else {
			rootType = sourcebindingdomain.RootTypeFile
		}
	}

	return legacyBindingIdentity{
		Provider: provider,
		RootType: rootType,
		RootRef:  strings.TrimSpace(rootRef),
	}
}

func normalizeLegacyDocumentFilePayload(documentFile map[string]any) map[string]any {
	if len(documentFile) == 0 {
		return nil
	}

	key := firstNonEmpty(anyToString(documentFile["key"]), anyToString(documentFile["file_key"]))
	url := firstNonEmpty(anyToString(documentFile["url"]), extractLegacyFileLinkURL(documentFile["file_link"]), key)
	thirdID := firstNonEmpty(legacyDocumentFileIDString(documentFile, "third_id"), legacyDocumentFileIDString(documentFile, "third_file_id"))
	sourceType := firstNonEmpty(anyToString(documentFile["source_type"]), anyToString(documentFile["platform_type"]))

	payload := map[string]any{
		"type":                      normalizeLegacyDocumentFileType(documentFile),
		"name":                      anyToString(documentFile["name"]),
		"url":                       url,
		"size":                      toOptionalInt64(documentFile["size"]),
		"extension":                 firstNonEmpty(anyToString(documentFile["extension"]), anyToString(documentFile["third_file_extension_name"])),
		"third_id":                  thirdID,
		"source_type":               sourceType,
		"third_file_id":             firstNonEmpty(legacyDocumentFileIDString(documentFile, "third_file_id"), thirdID),
		"platform_type":             firstNonEmpty(anyToString(documentFile["platform_type"]), sourceType),
		"key":                       key,
		"third_file_type":           normalizeLegacyThirdFileType(documentFile),
		"third_file_extension_name": anyToString(documentFile["third_file_extension_name"]),
		"knowledge_base_id":         legacyDocumentFileIDString(documentFile, "knowledge_base_id"),
	}
	if fileType, ok := toOptionalInt(documentFile["file_type"]); ok {
		payload["file_type"] = fileType
	}
	if spaceType, ok := toOptionalInt(documentFile["space_type"]); ok {
		payload["space_type"] = spaceType
	}
	if fileLink, ok := documentFile["file_link"]; ok {
		payload["file_link"] = fileLink
	}
	return payload
}

func extractLegacyFileLinkURL(value any) string {
	fileLink, ok := value.(map[string]any)
	if !ok {
		return ""
	}
	return anyToString(fileLink["url"])
}

func normalizeLegacyDocumentFileType(documentFile map[string]any) string {
	typeValue := strings.TrimSpace(anyToString(documentFile["type"]))
	switch typeValue {
	case "", "0":
	case "1":
		return "external"
	case "2":
		return thirdPlatformDocumentFileType
	default:
		if typeValue != "" {
			return strings.ToLower(typeValue)
		}
	}

	if firstNonEmpty(
		legacyDocumentFileIDString(documentFile, "third_id"),
		legacyDocumentFileIDString(documentFile, "third_file_id"),
		anyToString(documentFile["source_type"]),
		anyToString(documentFile["platform_type"]),
		legacyDocumentFileIDString(documentFile, "knowledge_base_id"),
	) != "" {
		return "third_platform"
	}
	return "external"
}

func normalizeLegacyThirdFileType(documentFile map[string]any) string {
	thirdFileType := anyToString(documentFile["third_file_type"])
	if thirdFileType != "" {
		return thirdFileType
	}
	if fileType, ok := toOptionalInt(documentFile["file_type"]); ok {
		return fmt.Sprintf("%d", fileType)
	}
	return ""
}

func shouldExpandLegacyEnterpriseDocumentFiles(sourceType *int) bool {
	return sourceType == nil || isEnterpriseSourceType(sourceType)
}

func isEnterpriseSourceType(sourceType *int) bool {
	if sourceType == nil {
		return false
	}
	switch *sourceType {
	case int(kbentity.SourceTypeLegacyEnterpriseWiki), int(kbentity.SourceTypeEnterpriseWiki):
		return true
	default:
		return false
	}
}

func hasEnterpriseKnowledgeBaseBinding(documentFiles []map[string]any) bool {
	for _, documentFile := range documentFiles {
		if !isThirdPlatformDocumentFile(documentFile) {
			continue
		}
		provider := firstNonEmpty(anyToString(documentFile["source_type"]), anyToString(documentFile["platform_type"]), sourcebindingdomain.ProviderTeamshare)
		if provider != "" && resolveEnterpriseKnowledgeBaseRootRef(documentFile) != "" {
			return true
		}
	}
	return false
}

func resolveEnterpriseKnowledgeBaseRootRef(documentFile map[string]any) string {
	if knowledgeBaseID := firstNonEmpty(legacyDocumentFileIDString(documentFile, "knowledge_base_id")); knowledgeBaseID != "" {
		return knowledgeBaseID
	}
	if !isTeamshareKnowledgeBaseRoot(documentFile) {
		return ""
	}
	return firstNonEmpty(legacyDocumentFileIDString(documentFile, "third_id"), legacyDocumentFileIDString(documentFile, "third_file_id"))
}

func isTeamshareKnowledgeBaseRoot(documentFile map[string]any) bool {
	if !isTeamshareDocumentFile(documentFile) {
		return false
	}
	if firstNonEmpty(legacyDocumentFileIDString(documentFile, "knowledge_base_id")) != "" {
		return true
	}
	fileType, fileTypeOK := toOptionalInt(documentFile["file_type"])
	spaceType, spaceTypeOK := toOptionalInt(documentFile["space_type"])
	return fileTypeOK && spaceTypeOK &&
		fileType == legacyTeamshareKnowledgeBaseFileType &&
		spaceType == legacyTeamshareKnowledgeBaseSpaceType
}

func isTeamshareFolderDocument(documentFile map[string]any) bool {
	if strings.EqualFold(anyToString(documentFile["third_file_type"]), sourcebindingdomain.TargetTypeFolder) {
		return true
	}
	fileType, ok := toOptionalInt(documentFile["file_type"])
	return ok && fileType == legacyTeamshareFolderFileType
}

func isTeamshareDocumentFile(documentFile map[string]any) bool {
	if !isThirdPlatformDocumentFile(documentFile) {
		return false
	}
	return strings.EqualFold(
		firstNonEmpty(anyToString(documentFile["source_type"]), anyToString(documentFile["platform_type"]), sourcebindingdomain.ProviderTeamshare),
		sourcebindingdomain.ProviderTeamshare,
	)
}

func isThirdPlatformDocumentFile(documentFile map[string]any) bool {
	if strings.EqualFold(anyToString(documentFile["type"]), "third_platform") {
		return true
	}
	return firstNonEmpty(
		legacyDocumentFileIDString(documentFile, "third_id"),
		legacyDocumentFileIDString(documentFile, "third_file_id"),
		anyToString(documentFile["source_type"]),
		anyToString(documentFile["platform_type"]),
		legacyDocumentFileIDString(documentFile, "knowledge_base_id"),
	) != ""
}

func legacyDocumentFileIDString(documentFile map[string]any, key string) string {
	value, _, err := pkgjsoncompat.IDStringFromAny(documentFile[key], "legacy_document_file."+key)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

func toOptionalInt(value any) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	default:
		stringValue := strings.TrimSpace(anyToString(value))
		if stringValue == "" {
			return 0, false
		}
		parsed, err := strconv.Atoi(stringValue)
		if err != nil {
			return 0, false
		}
		return parsed, true
	}
}

func toOptionalInt64(value any) int64 {
	switch typed := value.(type) {
	case int64:
		return typed
	case int:
		return int64(typed)
	case float64:
		return int64(typed)
	default:
		return 0
	}
}
