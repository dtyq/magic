package docapp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

var errDocumentFileLinkProviderNil = fmt.Errorf("document file link provider is nil")

// GetOriginalFileLink 获取文档原始文件访问链接。
func (s *DocumentAppService) GetOriginalFileLink(
	ctx context.Context,
	code, knowledgeBaseCode, organizationCode, userID string,
) (*docdto.OriginalFileLinkDTO, error) {
	if err := s.authorizeKnowledgeBaseAction(ctx, organizationCode, userID, knowledgeBaseCode, "read"); err != nil {
		return nil, err
	}
	if err := validateDocumentKnowledgeBaseCode(knowledgeBaseCode); err != nil {
		return nil, err
	}
	doc, err := s.domainService.ShowByCodeAndKnowledgeBase(ctx, code, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	if err := s.validateDocumentOrg(doc, organizationCode); err != nil {
		return nil, err
	}
	if err := s.ensureKnowledgeBaseAccessibleInAgentScope(ctx, doc.OrganizationCode, doc.KnowledgeBaseCode); err != nil {
		return nil, err
	}

	result := buildUnavailableOriginalFileLink(doc)
	if doc == nil || doc.DocumentFile == nil {
		return result, nil
	}

	switch documentdomain.NormalizeDocumentFileType(doc.DocumentFile.Type) {
	case docFileTypeExternal:
		return s.buildExternalOriginalFileLink(ctx, doc, result)
	case docFileTypeThirdParty:
		return s.buildThirdPlatformOriginalFileLink(ctx, doc, result)
	case "project_file":
		return s.buildProjectOriginalFileLink(ctx, doc, result)
	default:
		return result, nil
	}
}

func (s *DocumentAppService) buildExternalOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
) (*docdto.OriginalFileLinkDTO, error) {
	fileKey := strings.TrimSpace(doc.DocumentFile.URL)
	if fileKey == "" {
		return result, nil
	}
	if s == nil || s.fileLinkProvider == nil {
		return nil, errDocumentFileLinkProviderNil
	}

	link, err := s.fileLinkProvider.GetLink(ctx, fileKey, http.MethodGet, 10*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("get original document file link: %w", err)
	}

	return &docdto.OriginalFileLinkDTO{
		Available: true,
		URL:       strings.TrimSpace(link),
		Name:      result.Name,
		Key:       fileKey,
		Type:      result.Type,
	}, nil
}

func (s *DocumentAppService) buildProjectOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
) (*docdto.OriginalFileLinkDTO, error) {
	link, err := documentdomain.ResolveProjectFileContentLink(ctx, s.projectFileContentPort, doc.ProjectFileID, 10*time.Minute)
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
		Available: true,
		URL:       link,
		Name:      result.Name,
		Key:       result.Key,
		Type:      result.Type,
	}, nil
}

func (s *DocumentAppService) buildThirdPlatformOriginalFileLink(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	result *docdto.OriginalFileLinkDTO,
) (*docdto.OriginalFileLinkDTO, error) {
	if s == nil || s.thirdPlatformDocumentPort == nil {
		return result, nil
	}

	resolved, err := s.resolveThirdPlatformDocumentSource(ctx, doc, nil)
	if err != nil {
		return nil, fmt.Errorf("get original third-platform document link: %w", err)
	}
	if resolved == nil {
		return result, nil
	}

	merged := mergeResolvedOriginalFileLink(result, resolved)
	if strings.TrimSpace(resolved.SourceKind) != thirdplatform.DocumentSourceKindDownloadURL {
		return merged, nil
	}

	downloadURL := resolveThirdPlatformDownloadURL(doc, resolved)
	if downloadURL == "" {
		return merged, nil
	}

	if strings.TrimSpace(merged.Key) == "" {
		merged.Key = downloadURL
	}
	merged.Available = true
	merged.URL = downloadURL
	return merged, nil
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
			Available: false,
			URL:       "",
			Name:      "",
			Key:       "",
			Type:      "",
		}
	}

	return &docdto.OriginalFileLinkDTO{
		Available: false,
		URL:       "",
		Name:      firstNonEmptyDocumentString(strings.TrimSpace(doc.DocumentFile.Name), strings.TrimSpace(doc.Name)),
		Key:       resolveDocumentFileDTOKey(doc.DocumentFile),
		Type:      documentdomain.NormalizeDocumentFileType(doc.DocumentFile.Type),
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
	if key := resolveDocumentFileDTOKey(file); key != "" {
		merged.Key = key
	}
	if docType := documentdomain.NormalizeDocumentFileType(file.Type); docType != "" {
		merged.Type = docType
	}
	return &merged
}

func firstNonEmptyDocumentString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
