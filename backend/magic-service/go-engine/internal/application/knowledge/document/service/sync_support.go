package docapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

func (s *DocumentAppService) parseDocumentContent(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
	sourceOverride *document.SourceOverride,
) (*document.ParsedDocument, string, error) {
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
		s.logger.WarnContext(ctx, "Resolve third-platform document failed, fallback to URL parsing", "documentCode", doc.Code, "error", err)
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
	doc *document.KnowledgeBaseDocument,
	parseOptions document.ParseOptions,
) (*document.ParsedDocument, string, error) {
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
	doc *document.KnowledgeBaseDocument,
	sourceOverride *document.SourceOverride,
) (*document.ParsedDocument, string, error) {
	result, err := document.BuildSyncContentFromSourceOverride(doc, sourceOverride)
	if err == nil {
		return result.Parsed, result.Content, nil
	}
	return nil, "", document.NewSyncStageError(document.SyncFailureDocumentFileEmpty, err)
}

func (s *DocumentAppService) parseThirdPlatformDocumentContent(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
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
	doc *document.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) (*thirdplatform.DocumentResolveResult, error) {
	request := document.BuildThirdPlatformResolveRequest(doc, businessParamsUserID(businessParams))
	resolved, err := s.thirdPlatformDocumentPort.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:  request.OrganizationCode,
		UserID:            request.UserID,
		KnowledgeBaseCode: request.KnowledgeBaseCode,
		ThirdPlatformType: request.ThirdPlatformType,
		ThirdFileID:       request.ThirdFileID,
		DocumentFile:      request.DocumentFile,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve third-platform document failed: %w", err)
	}
	return resolved, nil
}

func (s *DocumentAppService) shouldParseProjectFileDirectly(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
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

func (s *DocumentAppService) ensureDocumentFileExtensionForPersist(ctx context.Context, doc *document.KnowledgeBaseDocument) {
	s.ensureDocumentFileExtension(ctx, doc, "persist")
}

func (s *DocumentAppService) ensureDocumentFileExtensionForSync(ctx context.Context, doc *document.KnowledgeBaseDocument) {
	s.ensureDocumentFileExtension(ctx, doc, "sync")
}

func (s *DocumentAppService) ensureDocumentFileExtension(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	stage string,
) {
	if doc == nil || doc.DocumentFile == nil {
		return
	}
	doc.DocumentFile.Extension = s.resolveDocumentFileExtensionForStage(ctx, doc, stage)
}

func (s *DocumentAppService) resolveDocumentFileExtensionForStage(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
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
			s.logger.WarnContext(
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

func (s *DocumentAppService) resolveDocumentFileExtension(ctx context.Context, file *document.File) (string, error) {
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

func businessParamsUserID(params *ctxmeta.BusinessParams) string {
	if params == nil {
		return ""
	}
	return params.UserID
}

type documentSyncTracer struct {
	service *DocumentAppService
	doc     *document.KnowledgeBaseDocument
	mode    string
}

func newDocumentSyncTracer(service *DocumentAppService, mode string) *documentSyncTracer {
	return &documentSyncTracer{
		service: service,
		mode:    mode,
	}
}

func (t *documentSyncTracer) withDocument(doc *document.KnowledgeBaseDocument) {
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
