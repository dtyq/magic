package docapp

import (
	"context"
	"fmt"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

// ReVectorizedByThirdFileID 按第三方文件触发重向量化。
func (s *DocumentAppService) ReVectorizedByThirdFileID(
	ctx context.Context,
	input *docdto.ReVectorizedByThirdFileIDInput,
) error {
	return NewThirdFileRevectorizeAppService(s).ReVectorizedByThirdFileID(ctx, input)
}

// RunThirdFileRevectorize 执行第三方文件重向量化任务。
func (s *DocumentAppService) RunThirdFileRevectorize(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
) error {
	return NewThirdFileRevectorizeAppService(s).RunThirdFileRevectorize(ctx, input)
}

func (s *DocumentAppService) ensureThirdPlatformProvider(platformType string) error {
	if s == nil || s.thirdPlatformProviders == nil {
		return shared.ErrUnsupportedThirdPlatformType
	}
	_, err := s.thirdPlatformProviders.Provider(platformType)
	if err != nil {
		return fmt.Errorf("get third-platform provider: %w", err)
	}
	return nil
}

func (s *DocumentAppService) resolveThirdPlatformSourceSnapshot(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	seed *documentdomain.ThirdFileRevectorizeSeed,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	if s == nil || input == nil || seed == nil || seed.SeedDocument == nil {
		return emptyResolvedSourceSnapshot(), nil
	}
	if cached, ok := s.loadCachedResolvedSource(seed.SourceCacheKey); ok {
		return cachedResolvedSourceToSnapshot(cached), nil
	}
	provider, err := s.thirdPlatformProviders.Provider(input.ThirdPlatformType)
	if err != nil {
		return nil, fmt.Errorf("get third-platform provider: %w", err)
	}
	latest, err := provider.ResolveLatestContent(ctx, thirdplatformprovider.ResolveLatestContentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: seed.SeedDocument.KnowledgeBaseCode,
		ThirdFileID:       input.ThirdFileID,
		Document:          seed.SeedDocument,
	})
	if err != nil {
		if s.thirdPlatformDocumentPort == nil {
			return nil, fmt.Errorf("resolve third-platform latest content: %w", err)
		}
		return s.resolveThirdPlatformSourceSnapshotWithDocumentPort(ctx, input, seed)
	}
	if latest == nil {
		return s.resolveThirdPlatformSourceSnapshotWithDocumentPort(ctx, input, seed)
	}
	snapshot, err := buildLatestContentSourceSnapshot(latest)
	if err != nil {
		return nil, err
	}
	s.storeResolvedSource(seed.SourceCacheKey, newCachedResolvedSource(snapshot))
	return snapshot, nil
}

func (s *DocumentAppService) resolveThirdPlatformSourceSnapshotWithDocumentPort(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	seed *documentdomain.ThirdFileRevectorizeSeed,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	if s == nil || s.thirdPlatformDocumentPort == nil || input == nil || seed == nil || seed.SeedDocument == nil {
		return emptyResolvedSourceSnapshot(), nil
	}
	seedDoc := cloneThirdPlatformSeedDocument(seed.SeedDocument)
	applyThirdFileInputToSeedDocument(seedDoc, input)
	resolved, err := s.resolveThirdPlatformDocumentSource(ctx, seedDoc, &ctxmeta.BusinessParams{
		OrganizationCode:              input.OrganizationCode,
		UserID:                        input.UserID,
		BusinessID:                    seedDoc.KnowledgeBaseCode,
		ThirdPlatformUserID:           input.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: input.ThirdPlatformOrganizationCode,
	})
	if err != nil {
		return nil, err
	}
	snapshot, err := s.buildSourceSnapshotFromResolvedThirdPlatform(ctx, seedDoc, resolved)
	if err != nil {
		return nil, err
	}
	if snapshot != nil {
		s.storeResolvedSource(seed.SourceCacheKey, newCachedResolvedSource(snapshot))
	}
	return snapshot, nil
}

func buildLatestContentSourceSnapshot(
	latest *thirdplatformprovider.LatestContentResult,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	if latest == nil {
		return emptyResolvedSourceSnapshot(), nil
	}
	file, _ := documentdomain.FileFromPayload(latest.DocumentFile)
	if file != nil {
		if err := documentdomain.ValidateKnowledgeBaseDocumentFileSupport(file); err != nil {
			return nil, fmt.Errorf("validate third-platform latest file support: %w", err)
		}
	}
	return documentdomain.BuildResolvedSourceSnapshot(documentdomain.SourceSnapshotInput{
		Content:            latest.Content,
		DocType:            latest.DocType,
		DocumentFile:       latest.DocumentFile,
		Source:             latest.Source,
		ContentHash:        latest.ContentHash,
		FetchedAtUnixMilli: latest.FetchedAtUnixMilli,
		Now:                time.Now(),
	}), nil
}

func (s *DocumentAppService) buildSourceSnapshotFromResolvedThirdPlatform(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	resolved *thirdplatform.DocumentResolveResult,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	if resolved == nil {
		return emptyResolvedSourceSnapshot(), nil
	}
	documentdomain.ApplyResolvedDocumentResult(doc, resolved.DocType, resolved.DocumentFile)
	if doc != nil && doc.DocumentFile != nil {
		if err := documentdomain.ValidateKnowledgeBaseDocumentFileSupport(doc.DocumentFile); err != nil {
			return nil, fmt.Errorf("validate third-platform resolved file support: %w", err)
		}
	}

	var parsed *parseddocument.ParsedDocument
	if s != nil && s.parseService != nil {
		var err error
		parsed, err = thirdplatformsource.ParseResolvedDocument(
			ctx,
			s.parseService,
			resolved,
			documentdomain.ResolveDocumentParseOptions(doc),
		)
		if err != nil {
			return nil, fmt.Errorf("parse third-platform resolved source: %w", err)
		}
		if doc != nil && doc.DocumentFile != nil {
			documentdomain.ApplyPreferredParsedDocumentFileName(parsed, doc.DocumentFile.Name)
		}
	}
	content := resolved.RawContent
	if content == "" {
		content = resolved.Content
	}
	return documentdomain.BuildResolvedSourceSnapshot(documentdomain.SourceSnapshotInput{
		Content:        content,
		DocType:        resolved.DocType,
		DocumentFile:   documentdomain.BuildDocumentFilePayload(doc),
		ParsedDocument: parsed,
		Source:         "third_platform_resolve",
		Now:            time.Now(),
	}), nil
}

func cloneThirdPlatformSeedDocument(src *docentity.KnowledgeBaseDocument) *docentity.KnowledgeBaseDocument {
	if src == nil {
		return nil
	}
	dst := *src
	if src.DocumentFile != nil {
		file := *src.DocumentFile
		dst.DocumentFile = &file
	}
	return &dst
}

func applyThirdFileInputToSeedDocument(doc *docentity.KnowledgeBaseDocument, input *documentdomain.ThirdFileRevectorizeInput) {
	if doc == nil || input == nil {
		return
	}
	if input.OrganizationCode != "" {
		doc.OrganizationCode = input.OrganizationCode
	}
	if input.ThirdPlatformType != "" {
		doc.ThirdPlatformType = input.ThirdPlatformType
	}
	if input.ThirdFileID != "" {
		doc.ThirdFileID = input.ThirdFileID
	}
}

func emptyResolvedSourceSnapshot() *documentdomain.ResolvedSourceSnapshot {
	return &documentdomain.ResolvedSourceSnapshot{}
}
