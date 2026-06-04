package docapp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

var (
	errDocumentFileLinkProviderNil            = fmt.Errorf("document file link provider is nil")
	errOriginalThirdPlatformSourceUnavailable = errors.New("original third-platform source unavailable")
)

const (
	originalFileLinkTypeDownload = "download"
	originalFileLinkTypeWeb      = "web"
)

type documentOriginalFileLinkResolver struct {
	documentReader            SourceFileDocumentReader
	knowledgeBaseReader       SourceFileKnowledgeBaseReader
	permissionReader          kbaccess.PermissionReader
	thirdPlatformAccess       SourceFileThirdPlatformAccess
	fileLinkProvider          SourceFileObjectLinkProvider
	projectFileContentPort    documentdomain.ProjectFileContentAccessor
	thirdPlatformDocumentPort SourceFileThirdPlatformDocumentResolver
	thirdPlatformProviders    *thirdplatformprovider.Registry
	thirdPlatformUserResolver func(context.Context, *docentity.KnowledgeBaseDocument, string) (string, error)
}

// GetOriginalFileLink 获取文档原始文件访问链接。
func (s *DocumentAppService) GetOriginalFileLink(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) (*docdto.OriginalFileLinkDTO, error) {
	return s.originalFileLinkResolver().GetOriginalFileLink(ctx, code, knowledgeBaseCode, organizationCode, userID)
}

func (s *DocumentAppService) originalFileLinkResolver() documentOriginalFileLinkResolver {
	if s == nil {
		return documentOriginalFileLinkResolver{}
	}
	return documentOriginalFileLinkResolver{
		documentReader:            s.domainService,
		knowledgeBaseReader:       s.kbService,
		permissionReader:          s.permissionReader,
		thirdPlatformAccess:       s.thirdPlatformAccess,
		fileLinkProvider:          s.fileLinkProvider,
		projectFileContentPort:    s.projectFileContentPort,
		thirdPlatformDocumentPort: s.thirdPlatformDocumentPort,
		thirdPlatformProviders:    s.thirdPlatformProviders,
		thirdPlatformUserResolver: s.resolveOriginalFileThirdPlatformUser,
	}
}

func (s *DocumentAppService) resolveOriginalFileThirdPlatformUser(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	fallbackUserID string,
) (string, error) {
	if s != nil && s.userService != nil {
		return s.resolveDocumentReadUser(ctx, doc)
	}
	return strings.TrimSpace(fallbackUserID), nil
}

func (r documentOriginalFileLinkResolver) ready() bool {
	return r.documentReader != nil && r.knowledgeBaseReader != nil
}

// GetKnowledgeSourceFileLink 获取知识库源文件链接，并校验调用方传入的 file_key 与文档源文件一致。
func (r documentOriginalFileLinkResolver) GetKnowledgeSourceFileLink(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID, expectedFileKey string,
) (*docdto.OriginalFileLinkDTO, error) {
	link, err := r.GetOriginalFileLink(ctx, code, knowledgeBaseCode, organizationCode, userID)
	if err != nil {
		return nil, err
	}
	if link == nil {
		return nil, ErrKnowledgeSourceFileUnavailable
	}

	expectedFileKey = strings.TrimSpace(expectedFileKey)
	actualFileKey := strings.TrimSpace(link.Key)
	if expectedFileKey != "" && expectedFileKey != actualFileKey {
		return nil, fmt.Errorf("%w: expected=%s actual=%s", ErrKnowledgeSourceFileKeyMismatch, expectedFileKey, actualFileKey)
	}

	if !link.Available {
		return link, nil
	}
	if strings.TrimSpace(link.URL) == "" {
		return nil, ErrKnowledgeSourceFileUnavailable
	}
	return link, nil
}

func (r documentOriginalFileLinkResolver) GetOriginalFileLink(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) (*docdto.OriginalFileLinkDTO, error) {
	if err := r.authorizeKnowledgeBaseAction(ctx, organizationCode, userID, knowledgeBaseCode, "read"); err != nil {
		return nil, err
	}
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
		return nil, err
	}
	doc, err := r.documentReader.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	if err := validateOriginalFileDocumentOrg(doc, organizationCode); err != nil {
		return nil, err
	}
	if err := ensureOriginalFileKnowledgeBaseAccessible(ctx, r.knowledgeBaseReader, doc.OrganizationCode, doc.KnowledgeBaseCode); err != nil {
		return nil, err
	}

	result := buildUnavailableOriginalFileLink(doc)
	if doc == nil || doc.DocumentFile == nil {
		return result, nil
	}

	switch documentdomain.NormalizeDocumentFileType(doc.DocumentFile.Type) {
	case docFileTypeExternal:
		return r.buildExternalOriginalFileLink(ctx, doc, result)
	case docFileTypeThirdParty:
		return r.buildThirdPlatformOriginalFileLink(ctx, doc, result, userID)
	case "project_file":
		return r.buildProjectOriginalFileLink(ctx, doc, result)
	default:
		return result, nil
	}
}

func (r documentOriginalFileLinkResolver) authorizeKnowledgeBaseAction(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	action string,
) error {
	accessService := newDocumentKnowledgeAccessService(documentKnowledgeAccessDeps{
		permissionReader:    r.permissionReader,
		thirdPlatformAccess: r.thirdPlatformAccess,
		knowledgeBaseReader: r.knowledgeBaseReader,
	})
	if accessService == nil {
		return nil
	}
	actor := resolveDocumentAccessActor(ctx, organizationCode, userID)
	result, err := accessService.Authorize(ctx, actor, action, kbaccess.Target{
		KnowledgeBaseCode: knowledgeBaseCode,
	})
	if err != nil {
		return fmt.Errorf("authorize document knowledge base access: %w", err)
	}
	if !result.Operation.ValidateAction(action) {
		return fmt.Errorf("%w: action=%s knowledge_base_code=%s", ErrDocumentPermissionDenied, action, knowledgeBaseCode)
	}
	return nil
}

func (r documentOriginalFileLinkResolver) buildExternalOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
) (*docdto.OriginalFileLinkDTO, error) {
	fileKey := resolveOriginalDocumentFileKey(doc)
	if fileKey == "" {
		return result, nil
	}
	if r.fileLinkProvider == nil {
		return nil, errDocumentFileLinkProviderNil
	}

	link, err := r.fileLinkProvider.GetLink(ctx, fileKey, http.MethodGet, 10*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("get original document file link: %w", err)
	}

	return &docdto.OriginalFileLinkDTO{
		Available:  true,
		URL:        strings.TrimSpace(link),
		Name:       result.Name,
		Key:        fileKey,
		Type:       result.Type,
		SourceType: result.SourceType,
		LinkType:   originalFileLinkTypeDownload,
	}, nil
}

func (r documentOriginalFileLinkResolver) buildProjectOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
) (*docdto.OriginalFileLinkDTO, error) {
	link, err := documentdomain.ResolveProjectFileContentLink(ctx, r.projectFileContentPort, doc.ProjectFileID, 10*time.Minute)
	if err != nil {
		if errors.Is(err, projectfile.ErrFileUnavailable) {
			return result, nil
		}
		return nil, fmt.Errorf("get original project file link: %w", err)
	}
	if link == "" {
		return result, nil
	}

	return &docdto.OriginalFileLinkDTO{
		Available:  true,
		URL:        link,
		Name:       result.Name,
		Key:        result.Key,
		Type:       result.Type,
		SourceType: result.SourceType,
		LinkType:   originalFileLinkTypeDownload,
	}, nil
}

func (r documentOriginalFileLinkResolver) buildThirdPlatformOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
	userID string,
) (*docdto.OriginalFileLinkDTO, error) {
	if r.thirdPlatformDocumentPort == nil && r.thirdPlatformProviders == nil {
		return result, nil
	}

	resolved, err := r.resolveThirdPlatformDocumentSource(ctx, doc, userID)
	if err != nil {
		if errors.Is(err, errOriginalThirdPlatformSourceUnavailable) {
			return result, nil
		}
		return nil, fmt.Errorf("get original third-platform document link: %w", err)
	}
	if resolved == nil {
		return result, nil
	}

	merged := mergeResolvedOriginalFileLink(result, resolved)
	if strings.TrimSpace(resolved.SourceKind) != thirdplatform.DocumentSourceKindDownloadURL {
		if webURL := resolveThirdPlatformWebURL(doc, resolved); webURL != "" {
			merged.Available = true
			merged.URL = webURL
			merged.LinkType = originalFileLinkTypeWeb
		}
		return merged, nil
	}

	downloadURL := resolveThirdPlatformDownloadURL(doc, resolved)
	if downloadURL == "" {
		return merged, nil
	}

	if strings.TrimSpace(merged.Key) == "" {
		return merged, nil
	}
	merged.Available = true
	merged.URL = downloadURL
	merged.LinkType = originalFileLinkTypeDownload
	return merged, nil
}

func (r documentOriginalFileLinkResolver) resolveThirdPlatformDocumentSource(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	userID string,
) (*thirdplatform.DocumentResolveResult, error) {
	readUserID := strings.TrimSpace(userID)
	if r.thirdPlatformUserResolver != nil {
		resolvedUserID, err := r.thirdPlatformUserResolver(ctx, doc, readUserID)
		if err != nil {
			return nil, err
		}
		readUserID = resolvedUserID
	}
	request := documentdomain.BuildThirdPlatformResolveRequest(doc, readUserID, "", "")
	if resolved, ok, err := r.resolveThirdPlatformDocumentSourceWithProvider(ctx, doc, request); ok || err != nil {
		return resolved, err
	}
	if r.thirdPlatformDocumentPort == nil {
		return nil, errOriginalThirdPlatformSourceUnavailable
	}
	resolved, err := r.thirdPlatformDocumentPort.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:              request.OrganizationCode,
		UserID:                        request.UserID,
		ThirdPlatformUserID:           request.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: request.ThirdPlatformOrganizationCode,
		KnowledgeBaseCode:             request.KnowledgeBaseCode,
		ThirdPlatformType:             request.ThirdPlatformType,
		ThirdFileID:                   request.ThirdFileID,
		DocumentFile:                  request.DocumentFile,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve third-platform document failed: %w", err)
	}
	return resolved, nil
}

func (r documentOriginalFileLinkResolver) resolveThirdPlatformDocumentSourceWithProvider(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	request documentdomain.ThirdPlatformResolveRequest,
) (*thirdplatform.DocumentResolveResult, bool, error) {
	if r.thirdPlatformProviders == nil {
		return nil, false, nil
	}
	platformType := strings.ToLower(strings.TrimSpace(request.ThirdPlatformType))
	if platformType == "" {
		return nil, false, nil
	}
	provider, err := r.thirdPlatformProviders.Provider(platformType)
	if err != nil {
		if errors.Is(err, shared.ErrUnsupportedThirdPlatformType) {
			return nil, false, nil
		}
		return nil, true, fmt.Errorf("get third-platform provider: %w", err)
	}
	latest, err := provider.ResolveLatestContent(ctx, thirdplatformprovider.ResolveLatestContentInput{
		OrganizationCode:  request.OrganizationCode,
		UserID:            request.UserID,
		KnowledgeBaseCode: request.KnowledgeBaseCode,
		ThirdFileID:       request.ThirdFileID,
		Document:          doc,
	})
	if err != nil {
		return nil, true, fmt.Errorf("resolve third-platform document with provider: %w", err)
	}
	if latest == nil {
		return nil, false, nil
	}
	return &thirdplatform.DocumentResolveResult{
		SourceKind:   thirdplatform.DocumentSourceKindRawContent,
		RawContent:   latest.Content,
		DocumentFile: latest.DocumentFile,
	}, true, nil
}

func resolveThirdPlatformWebURL(
	doc *docentity.KnowledgeBaseDocument,
	resolved *thirdplatform.DocumentResolveResult,
) string {
	if resolved != nil {
		if file, ok := documentdomain.FileFromPayload(resolved.DocumentFile); ok && file != nil {
			if url := strings.TrimSpace(file.URL); isHTTPURL(url) {
				return url
			}
		}
	}
	if doc != nil && doc.DocumentFile != nil {
		if url := strings.TrimSpace(doc.DocumentFile.URL); isHTTPURL(url) {
			return url
		}
	}
	return ""
}

func resolveThirdPlatformDownloadURL(
	doc *docentity.KnowledgeBaseDocument,
	resolved *thirdplatform.DocumentResolveResult,
) string {
	if resolved == nil {
		return ""
	}

	extension := ""
	if file, ok := documentdomain.FileFromPayload(resolved.DocumentFile); ok && file != nil {
		extension = documentdomain.ResolveDocumentFileExtension(file, "")
	}
	if extension == "" && doc != nil && doc.DocumentFile != nil {
		extension = documentdomain.ResolveDocumentFileExtension(doc.DocumentFile, "")
	}
	return thirdplatform.SelectDownloadURL(extension, resolved.DownloadURLs, resolved.DownloadURL)
}

func buildUnavailableOriginalFileLink(doc *docentity.KnowledgeBaseDocument) *docdto.OriginalFileLinkDTO {
	if doc == nil || doc.DocumentFile == nil {
		return &docdto.OriginalFileLinkDTO{
			Available:  false,
			URL:        "",
			Name:       "",
			Key:        "",
			Type:       "",
			SourceType: "",
			LinkType:   "",
		}
	}

	return &docdto.OriginalFileLinkDTO{
		Available:  false,
		URL:        "",
		Name:       firstNonEmptyDocumentString(strings.TrimSpace(doc.DocumentFile.Name), strings.TrimSpace(doc.Name)),
		Key:        resolveOriginalDocumentFileKey(doc),
		Type:       documentdomain.NormalizeDocumentFileType(doc.DocumentFile.Type),
		SourceType: strings.TrimSpace(doc.DocumentFile.SourceType),
		LinkType:   "",
	}
}

func mergeResolvedOriginalFileLink(
	base *docdto.OriginalFileLinkDTO,
	resolved *thirdplatform.DocumentResolveResult,
) *docdto.OriginalFileLinkDTO {
	if base == nil {
		base = &docdto.OriginalFileLinkDTO{}
	}
	merged := *base
	file, _ := documentdomain.FileFromPayload(resolved.DocumentFile)
	if file == nil {
		return &merged
	}

	if name := firstNonEmptyDocumentString(strings.TrimSpace(file.Name), strings.TrimSpace(merged.Name)); name != "" {
		merged.Name = name
	}
	if key := resolveExplicitDocumentFileDTOKey(file); key != "" {
		merged.Key = key
	} else if strings.TrimSpace(merged.Key) == "" {
		merged.Key = documentdomain.ResolveDocumentSourceFileKey(file, "", "")
	}
	if docType := documentdomain.NormalizeDocumentFileType(file.Type); docType != "" {
		merged.Type = docType
	}
	if sourceType := strings.TrimSpace(file.SourceType); sourceType != "" {
		merged.SourceType = sourceType
	}
	return &merged
}

func resolveOriginalDocumentFileKey(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil {
		return ""
	}
	return documentdomain.ResolveDocumentSourceFileKey(
		doc.DocumentFile,
		doc.ThirdPlatformType,
		doc.ThirdFileID,
	)
}

func isHTTPURL(value string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(value)), "http://") ||
		strings.HasPrefix(strings.ToLower(strings.TrimSpace(value)), "https://")
}

func resolveExplicitDocumentFileDTOKey(file *docentity.File) string {
	if file == nil {
		return ""
	}
	if key := strings.TrimSpace(file.FileKey); key != "" {
		return key
	}
	url := strings.TrimSpace(file.URL)
	if url == "" || strings.Contains(url, "://") || strings.HasPrefix(url, "//") {
		return ""
	}
	return url
}

func firstNonEmptyDocumentString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func validateOriginalFileDocumentOrg(doc *docentity.KnowledgeBaseDocument, orgCode string) error {
	if doc != nil && !doc.BelongsToOrganization(orgCode) {
		return ErrDocumentOrgMismatch
	}
	return nil
}

func ensureOriginalFileKnowledgeBaseAccessible(
	ctx context.Context,
	kbReader SourceFileKnowledgeBaseReader,
	organizationCode string,
	knowledgeBaseCode string,
) error {
	kb, err := kbReader.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return fmt.Errorf("show knowledge base by code and org: %w", err)
	}
	if kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	return nil
}
