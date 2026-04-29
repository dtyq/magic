package docapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

func (s *DocumentAppService) parseDocumentContent(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
	sourceOverride *document.SourceOverride,
) (*parseddocument.ParsedDocument, string, error) {
	ctx = withDocumentOCRUsageContext(ctx, doc, businessParams)
	if doc != nil && doc.DocumentFile != nil && document.ResolveDocumentFileExtension(doc.DocumentFile, "") != "" {
		if err := document.ValidateKnowledgeBaseDocumentFileSupport(doc.DocumentFile); err != nil {
			return nil, "", document.NewSyncStageError(document.SyncFailureParsing, err)
		}
	}
	if doc != nil && doc.DocumentFile != nil {
		if err := document.CheckDocumentFileSourceSize(doc.DocumentFile, s.ResourceLimits()); err != nil {
			return nil, "", document.NewSyncStageError(document.SyncFailureResourceLimitExceeded, err)
		}
	}

	parseOptions := document.ResolveDocumentParseOptions(doc)
	if shouldParseProjectFileDirectly, err := s.shouldParseProjectFileDirectly(ctx, doc, sourceOverride); err != nil {
		return nil, "", err
	} else if shouldParseProjectFileDirectly {
		return s.parseProjectFileDocumentContent(ctx, doc, parseOptions)
	}

	plan := document.ResolveDocumentContentPlan(doc, sourceOverride, s.thirdPlatformDocumentPort != nil)
	if plan.UseSourceOverride {
		return s.parseSourceOverrideContent(ctx, doc, sourceOverride)
	}

	if plan.TryThirdPlatform {
		result, err := s.parseThirdPlatformDocumentContent(ctx, doc, businessParams)
		if err == nil {
			return result.Parsed, result.Content, nil
		}
		if !plan.AllowURLParse {
			return nil, "", document.NewSyncStageError(document.SyncFailureResolveThirdPlatform, err)
		}
		s.logger.KnowledgeWarnContext(ctx, "Resolve third-platform document failed, fallback to URL parsing", "documentCode", doc.Code, "error", err)
	}

	if !plan.AllowURLParse {
		return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, ErrDocumentFileEmpty)
	}

	parsedDocument, err := s.parseService.ParseDocumentWithOptions(ctx, doc.DocumentFile.URL, doc.DocumentFile.Extension, parseOptions)
	if err != nil {
		return nil, "", document.NewSyncStageError(document.SyncFailureParsing, err)
	}
	if doc != nil && doc.DocumentFile != nil {
		document.ApplyPreferredParsedDocumentFileName(parsedDocument, doc.DocumentFile.Name)
	}
	result, err := document.BuildSyncContentFromParsedDocument(parsedDocument)
	if err != nil {
		return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, err)
	}
	return result.Parsed, result.Content, nil
}

func (s *DocumentAppService) parseProjectFileDocumentContent(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	parseOptions document.ParseOptions,
) (*parseddocument.ParsedDocument, string, error) {
	link, err := document.ResolveProjectFileContentLink(ctx, s.projectFileContentPort, doc.ProjectFileID, 10*time.Minute)
	if err != nil {
		return nil, "", document.NewSyncStageError(document.SyncFailureParsing, err)
	}
	if link == "" {
		return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, ErrDocumentFileEmpty)
	}
	fileExtension := ""
	if doc != nil && doc.DocumentFile != nil {
		fileExtension = doc.DocumentFile.Extension
	}
	parsedDocument, err := s.parseService.ParseDocumentWithOptions(ctx, link, fileExtension, parseOptions)
	if err != nil {
		return nil, "", document.NewSyncStageError(document.SyncFailureParsing, err)
	}
	if doc != nil && doc.DocumentFile != nil {
		document.ApplyPreferredParsedDocumentFileName(parsedDocument, doc.DocumentFile.Name)
	}
	result, err := document.BuildSyncContentFromParsedDocument(parsedDocument)
	if err != nil {
		return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, err)
	}
	return result.Parsed, result.Content, nil
}

func (s *DocumentAppService) parseSourceOverrideContent(
	_ context.Context,
	doc *docentity.KnowledgeBaseDocument,
	sourceOverride *document.SourceOverride,
) (*parseddocument.ParsedDocument, string, error) {
	result, err := document.BuildSyncContentFromSourceOverride(doc, sourceOverride)
	if err == nil {
		if limitErr := document.CheckParsedResourceLimits(result.Parsed, s.ResourceLimits()); limitErr != nil {
			return nil, "", document.NewSyncStageError(document.SyncFailureResourceLimitExceeded, limitErr)
		}
		return result.Parsed, result.Content, nil
	}
	return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, err)
}

func (s *DocumentAppService) parseThirdPlatformDocumentContent(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) (document.SyncContentResult, error) {
	resolved, err := s.resolveThirdPlatformDocumentSource(ctx, doc, businessParams)
	if err != nil {
		return document.SyncContentResult{}, err
	}
	if resolved == nil {
		return document.SyncContentResult{}, ErrDocumentFileEmpty
	}
	document.ApplyResolvedDocumentResult(doc, resolved.DocType, resolved.DocumentFile)
	parsedDocument, err := thirdplatformsource.ParseResolvedDocument(
		ctx,
		s.parseService,
		resolved,
		document.ResolveDocumentParseOptions(doc),
	)
	if err != nil {
		return document.SyncContentResult{}, fmt.Errorf("parse third-platform resolved source: %w", err)
	}
	if doc != nil && doc.DocumentFile != nil {
		document.ApplyPreferredParsedDocumentFileName(parsedDocument, doc.DocumentFile.Name)
	}
	result, err := document.BuildSyncContentFromParsedDocument(parsedDocument)
	if err != nil {
		return document.SyncContentResult{}, fmt.Errorf("build third-platform sync content: %w", err)
	}
	return result, nil
}

func (s *DocumentAppService) resolveThirdPlatformDocumentSource(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) (*thirdplatform.DocumentResolveResult, error) {
	if s != nil && s.userService != nil {
		readUserID, err := s.resolveDocumentReadUser(ctx, doc)
		if err != nil {
			return nil, err
		}
		if businessParams == nil {
			businessParams = &ctxmeta.BusinessParams{}
		} else {
			cloned := *businessParams
			businessParams = &cloned
		}
		businessParams.UserID = readUserID
	}
	request := document.BuildThirdPlatformResolveRequest(
		doc,
		businessParamsUserID(businessParams),
		businessParamsThirdPlatformUserID(businessParams),
		businessParamsThirdPlatformOrganizationCode(businessParams),
	)
	resolved, err := s.thirdPlatformDocumentPort.Resolve(ctx, thirdplatform.DocumentResolveInput{
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

func (s *DocumentAppService) shouldParseProjectFileDirectly(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	sourceOverride *document.SourceOverride,
) (bool, error) {
	if doc == nil || doc.ProjectFileID <= 0 || sourceOverride != nil {
		return false, nil
	}
	shouldUseOverride, err := s.shouldUseProjectFileSourceOverride(ctx, doc)
	if err != nil {
		return false, err
	}
	return !shouldUseOverride, nil
}

func (s *DocumentAppService) ensureDocumentFileExtensionForPersist(ctx context.Context, doc *docentity.KnowledgeBaseDocument) {
	s.ensureDocumentFileExtension(ctx, doc, "persist")
}

func (s *DocumentAppService) ensureDocumentFileExtensionForSync(ctx context.Context, doc *docentity.KnowledgeBaseDocument) {
	s.ensureDocumentFileExtension(ctx, doc, "sync")
}

func (s *DocumentAppService) ensureDocumentFileExtension(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	stage string,
) {
	if doc == nil || doc.DocumentFile == nil {
		return
	}
	doc.DocumentFile.Extension = s.resolveDocumentFileExtensionForStage(ctx, doc, stage)
}

func (s *DocumentAppService) resolveDocumentFileExtensionForStage(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	stage string,
) string {
	if doc == nil || doc.DocumentFile == nil {
		return ""
	}
	if resolved := document.ResolveDocumentFileExtension(doc.DocumentFile, ""); resolved != "" {
		return resolved
	}
	resolved, err := s.resolveDocumentFileExtension(ctx, doc.DocumentFile)
	if err != nil {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(
				ctx,
				"Failed to resolve document extension",
				"stage",
				stage,
				"url",
				doc.DocumentFile.URL,
				"file_key",
				doc.DocumentFile.FileKey,
				"name",
				doc.DocumentFile.Name,
				"error",
				err,
			)
		}
		resolved = ""
	}
	return document.ResolveDocumentFileExtension(doc.DocumentFile, resolved)
}

func (s *DocumentAppService) resolveDocumentFileExtension(ctx context.Context, file *docentity.File) (string, error) {
	if file == nil {
		return "", errDocumentFileNil
	}
	target := strings.TrimSpace(file.URL)
	if target == "" {
		target = strings.TrimSpace(file.FileKey)
	}
	if target == "" {
		return "", errDocumentFileURLEmpty
	}
	if s.parseService == nil {
		return "", errDocumentParseNil
	}
	ext, err := s.parseService.ResolveFileType(ctx, target)
	if err != nil {
		return "", fmt.Errorf("resolve document file extension: %w", err)
	}
	return ext, nil
}

func withDocumentOCRUsageContext(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) context.Context {
	if doc == nil {
		return ctx
	}
	organizationCode := strings.TrimSpace(doc.OrganizationCode)
	userID := ""
	businessID := strings.TrimSpace(doc.KnowledgeBaseCode)
	if businessParams != nil {
		organizationCode = firstNonEmpty(strings.TrimSpace(businessParams.GetOrganizationCode()), organizationCode)
		userID = strings.TrimSpace(businessParams.UserID)
		businessID = firstNonEmpty(strings.TrimSpace(businessParams.BusinessID), businessID)
	}
	return document.WithOCRUsageContext(ctx, document.OCRUsageContext{
		OrganizationCode:  organizationCode,
		UserID:            userID,
		KnowledgeBaseCode: strings.TrimSpace(doc.KnowledgeBaseCode),
		DocumentCode:      strings.TrimSpace(doc.Code),
		BusinessID:        businessID,
		SourceID:          strings.TrimSpace(doc.Code),
	})
}

func businessParamsUserID(params *ctxmeta.BusinessParams) string {
	if params == nil {
		return ""
	}
	return params.UserID
}

func businessParamsThirdPlatformUserID(params *ctxmeta.BusinessParams) string {
	if params == nil {
		return ""
	}
	return params.ThirdPlatformUserID
}

func businessParamsThirdPlatformOrganizationCode(params *ctxmeta.BusinessParams) string {
	if params == nil {
		return ""
	}
	return params.ThirdPlatformOrganizationCode
}

type documentSyncTracer struct {
	service *DocumentAppService
	doc     *docentity.KnowledgeBaseDocument
	mode    string
}

func newDocumentSyncTracer(service *DocumentAppService, mode string) *documentSyncTracer {
	return &documentSyncTracer{
		service: service,
		mode:    mode,
	}
}

func (t *documentSyncTracer) withDocument(doc *docentity.KnowledgeBaseDocument) {
	if t == nil {
		return
	}
	t.doc = doc
}

func (t *documentSyncTracer) log(ctx context.Context, stage string, startedAt time.Time, err error, fields ...any) {
	if t == nil || t.service == nil || t.service.logger == nil {
		return
	}

	attrs := make([]any, 0, len(fields))
	attrs = append(attrs, "stage", stage, "duration_ms", time.Since(startedAt).Milliseconds())
	if t.mode != "" {
		attrs = append(attrs, "sync_mode", t.mode)
	}
	if t.doc != nil {
		attrs = append(
			attrs,
			"document_code", t.doc.Code,
			"knowledge_base_code", t.doc.KnowledgeBaseCode,
			"organization_code", t.doc.OrganizationCode,
		)
	}
	if err != nil {
		attrs = append(attrs, "status", "failed", "error", err)
	} else {
		attrs = append(attrs, "status", "ok")
	}
	attrs = append(attrs, fields...)
	t.service.logger.DebugContext(ctx, "Document sync stage completed", attrs...)
}
