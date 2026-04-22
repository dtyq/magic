package docapp

import (
	"context"
	"fmt"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
)

// ReVectorizedByThirdFileID 按第三方文件调度一次重向量化。
func (s *DocumentAppService) ReVectorizedByThirdFileID(ctx context.Context, input *docdto.ReVectorizedByThirdFileIDInput) error {
	return NewThirdFileRevectorizeAppService(s).ReVectorizedByThirdFileID(ctx, input)
}

// RunThirdFileRevectorize 执行第三方文件重向量化任务。
func (s *DocumentAppService) RunThirdFileRevectorize(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput) error {
	return NewThirdFileRevectorizeAppService(s).RunThirdFileRevectorize(ctx, input)
}

func (s *DocumentAppService) runThirdFileRevectorize(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput, async bool) error {
	return NewThirdFileRevectorizeAppService(s).runThirdFileRevectorize(ctx, input, async)
}

type thirdFileProviderGuardFunc func(platformType string) error

func (f thirdFileProviderGuardFunc) EnsureThirdFileProvider(platformType string) error {
	return f(platformType)
}

type thirdFileSourceSnapshotResolverFunc func(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	seed *documentdomain.ThirdFileRevectorizeSeed,
) (*documentdomain.ResolvedSourceSnapshot, error)

func (f thirdFileSourceSnapshotResolverFunc) ResolveThirdFileSourceSnapshot(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	seed *documentdomain.ThirdFileRevectorizeSeed,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	return f(ctx, input, seed)
}

func (s *DocumentAppService) ensureThirdPlatformProvider(platformType string) error {
	if s == nil || s.thirdPlatformProviders == nil {
		return shared.ErrUnsupportedThirdPlatformType
	}
	if _, err := s.thirdPlatformProviders.Provider(platformType); err != nil {
		return fmt.Errorf("resolve third-platform provider: %w", err)
	}
	return nil
}

func (s *DocumentAppService) resolveThirdPlatformSourceSnapshot(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	seed *documentdomain.ThirdFileRevectorizeSeed,
) (*documentdomain.ResolvedSourceSnapshot, error) {
	if seed == nil {
		return nil, shared.ErrDocumentNotFound
	}
	if cached, ok := s.loadCachedResolvedSource(seed.SourceCacheKey); ok {
		return cachedResolvedSourceToSnapshot(cached), nil
	}

	seedDocument := cloneThirdPlatformSeedDocument(seed.SeedDocument)
	if seedDocument == nil {
		return nil, shared.ErrDocumentNotFound
	}
	resolved, err := s.resolveThirdPlatformDocumentSource(ctx, seedDocument, &ctxmeta.BusinessParams{
		OrganizationCode: input.OrganizationCode,
		UserID:           input.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve latest third-platform content: %w", err)
	}
	documentdomain.ApplyResolvedDocumentResult(seedDocument, resolved.DocType, resolved.DocumentFile)
	parsedDocument, err := thirdplatformsource.ParseResolvedDocument(
		ctx,
		s.parseService,
		resolved,
		documentdomain.ResolveDocumentParseOptions(seedDocument),
	)
	if err != nil {
		return nil, fmt.Errorf("parse latest third-platform source: %w", err)
	}
	if seedDocument.DocumentFile != nil {
		documentdomain.ApplyPreferredParsedDocumentFileName(parsedDocument, seedDocument.DocumentFile.Name)
	}
	syncContent, err := documentdomain.BuildSyncContentFromParsedDocument(parsedDocument)
	if err != nil {
		return nil, fmt.Errorf("build latest third-platform sync content: %w", err)
	}
	snapshot := documentdomain.BuildResolvedSourceSnapshot(documentdomain.SourceSnapshotInput{
		Content:            syncContent.Content,
		DocType:            resolved.DocType,
		DocumentFile:       resolved.DocumentFile,
		Source:             thirdPlatformResolvedSource,
		ContentHash:        "",
		FetchedAtUnixMilli: time.Now().UnixMilli(),
		Now:                time.Now(),
	})
	s.storeResolvedSource(seed.SourceCacheKey, newCachedResolvedSource(snapshot))
	return snapshot, nil
}

const thirdPlatformResolvedSource = "third_platform_resolve"

func cloneThirdPlatformSeedDocument(doc *documentdomain.KnowledgeBaseDocument) *documentdomain.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	cloned := *doc
	if doc.DocumentFile != nil {
		file := *doc.DocumentFile
		cloned.DocumentFile = &file
	}
	return &cloned
}
