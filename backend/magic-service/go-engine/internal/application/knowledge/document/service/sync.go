package docapp

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	"magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/filetype"
)

const (
	syncModeCreate = document.SyncModeCreate
	syncModeResync = document.SyncModeResync
)

func (s *DocumentAppService) buildFragments(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	kb *knowledgebasedomain.KnowledgeBase,
	parsed *document.ParsedDocument,
	model string,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	kbSnapshot := knowledgeBaseSnapshotFromDomain(kb)
	segmentConfig := document.BuildSyncSegmentConfig(doc, kbSnapshot)
	requestedMode, fragmentConfig := document.ResolveSyncRequestedModeAndConfig(doc, kbSnapshot)
	chunks, splitVersion, err := documentsplitter.SplitParsedDocumentToChunks(ctx, documentsplitter.ParsedDocumentChunkInput{
		Parsed:           parsed,
		SourceFileType:   normalizeDocumentSourceFileType(doc),
		RequestedMode:    requestedMode,
		FragmentConfig:   fragmentConfig,
		SegmentConfig:    toSplitterSegmentConfig(segmentConfig),
		Model:            model,
		TokenizerService: s.tokenizer,
		Logger:           s.logger,
	})
	if err != nil {
		return nil, fmt.Errorf("split parsed document to chunks: %w", err)
	}

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc:          doc,
		Chunks:       toFragmentTokenChunks(chunks),
		SplitVersion: splitVersion,
	})
	if err != nil {
		return nil, fmt.Errorf("build document fragments: %w", err)
	}
	return fragments, nil
}

func toSplitterSegmentConfig(config document.SyncSegmentConfig) documentsplitter.PreviewSegmentConfig {
	return documentsplitter.PreviewSegmentConfig{
		ChunkSize:          config.ChunkSize,
		ChunkOverlap:       config.ChunkOverlap,
		Separator:          config.Separator,
		TextPreprocessRule: append([]int(nil), config.TextPreprocessRule...),
	}
}

func toFragmentTokenChunks(chunks []documentsplitter.TokenChunk) []fragdomain.TokenChunk {
	result := make([]fragdomain.TokenChunk, 0, len(chunks))
	for _, chunk := range chunks {
		result = append(result, fragdomain.TokenChunk{
			Content:            chunk.Content,
			TokenCount:         chunk.TokenCount,
			SectionPath:        chunk.SectionPath,
			SectionLevel:       chunk.SectionLevel,
			SectionTitle:       chunk.SectionTitle,
			TreeNodeID:         chunk.TreeNodeID,
			ParentNodeID:       chunk.ParentNodeID,
			SectionChunkIndex:  chunk.SectionChunkIndex,
			EffectiveSplitMode: chunk.EffectiveSplitMode,
			HierarchyDetector:  chunk.HierarchyDetector,
			Metadata:           maps.Clone(chunk.Metadata),
		})
	}
	return result
}

func normalizeDocumentSourceFileType(doc *document.KnowledgeBaseDocument) string {
	if doc == nil || doc.DocumentFile == nil {
		return ""
	}
	return filetype.NormalizeExtension(strings.TrimSpace(doc.DocumentFile.Extension))
}

// Sync 同步文档 (解析 -> 切片 -> 向量化)
func (s *DocumentAppService) Sync(ctx context.Context, input *document.SyncDocumentInput) (err error) {
	return NewDocumentSyncAppService(s).Sync(ctx, input)
}

// ScheduleSync 调度文档异步同步。
func (s *DocumentAppService) ScheduleSync(ctx context.Context, input *document.SyncDocumentInput) {
	if s == nil || s.syncScheduler == nil || input == nil {
		return
	}
	s.syncScheduler.Schedule(ctx, input)
}

// IsDocumentSourcePrecheckError 判断是否为同步前文档源预检错误。
func IsDocumentSourcePrecheckError(err error) bool {
	return errors.Is(err, ErrDocumentSourcePrecheckFailed)
}

func (s *DocumentAppService) loadRuntimeKnowledgeBaseForSync(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
) (*knowledgebasedomain.KnowledgeBase, error) {
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, doc.KnowledgeBaseCode, doc.OrganizationCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find knowledge base: %w", err)
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	if route.Model == "" {
		return nil, fmt.Errorf("%w: rebuild target model or collection meta model is required", shared.ErrEmbeddingModelRequired)
	}
	runtimeKB, err := cloneKnowledgeBaseWithResolvedRoute(kb, route)
	if err != nil {
		return nil, fmt.Errorf("bind runtime route to knowledge base copy: %w", err)
	}
	return runtimeKB, nil
}

func (s *DocumentAppService) fetchDocumentForSync(ctx context.Context, input *document.SyncDocumentInput) (*document.KnowledgeBaseDocument, error) {
	if err := validateDocumentKnowledgeBaseCode(input.KnowledgeBaseCode); err != nil {
		return nil, err
	}
	doc, err := s.domainService.ShowByCodeAndKnowledgeBase(ctx, input.Code, input.KnowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	return doc, nil
}

func (s *DocumentAppService) validateDocumentOrg(doc *document.KnowledgeBaseDocument, orgCode string) error {
	if doc != nil && !doc.BelongsToOrganization(orgCode) {
		return ErrDocumentOrgMismatch
	}
	return nil
}

func (s *DocumentAppService) redirectThirdPlatformResync(
	ctx context.Context,
	mode string,
	doc *document.KnowledgeBaseDocument,
	input *document.SyncDocumentInput,
) (bool, error) {
	if input != nil && input.SingleDocumentThirdPlatformResync {
		return false, nil
	}
	userID := ""
	organizationCode := ""
	if input != nil && input.BusinessParams != nil {
		userID = input.BusinessParams.UserID
	}
	if input != nil {
		organizationCode = input.OrganizationCode
	}
	decision := document.ResolveThirdPlatformRedirect(doc, mode, input != nil && input.SourceOverride != nil, organizationCode, userID)
	if !decision.Redirect {
		if !decision.IncompleteBinding {
			return false, nil
		}
		if s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Third-platform document binding is incomplete, fallback to standard resync",
				"organization_code", doc.OrganizationCode,
				"knowledge_base_code", doc.KnowledgeBaseCode,
				"document_code", doc.Code,
				"third_platform_type", strings.ToLower(strings.TrimSpace(doc.ThirdPlatformType)),
				"third_file_id", strings.TrimSpace(doc.ThirdFileID),
			)
		}
		return false, nil
	}

	redirectInput := &docdto.ReVectorizedByThirdFileIDInput{
		OrganizationCode:  decision.Input.OrganizationCode,
		UserID:            decision.Input.UserID,
		ThirdPlatformType: decision.Input.ThirdPlatformType,
		ThirdFileID:       decision.Input.ThirdFileID,
	}
	if input != nil && !input.Async {
		err := s.runThirdFileRevectorize(ctx, &document.ThirdFileRevectorizeInput{
			OrganizationCode:  redirectInput.OrganizationCode,
			UserID:            redirectInput.UserID,
			ThirdPlatformType: redirectInput.ThirdPlatformType,
			ThirdFileID:       redirectInput.ThirdFileID,
		}, false)
		return true, err
	}
	if err := s.ReVectorizedByThirdFileID(ctx, redirectInput); err != nil {
		return true, err
	}
	return true, nil
}

func (s *DocumentAppService) injectProjectFileSourceOverride(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	input *document.SyncDocumentInput,
) error {
	if s == nil || doc == nil || input == nil || input.SourceOverride != nil || doc.ProjectFileID <= 0 {
		return nil
	}
	shouldUseOverride, err := s.shouldUseProjectFileSourceOverride(ctx, doc)
	if err != nil {
		return err
	}
	if !shouldUseOverride {
		return nil
	}
	resolved, override, err := s.resolveProjectFileSourceOverride(ctx, doc.ProjectFileID)
	if err != nil {
		return err
	}
	if resolved == nil || override == nil {
		return nil
	}
	input.SourceOverride = override
	return nil
}

func (s *DocumentAppService) preflightDocumentSource(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
	sourceOverride *document.SourceOverride,
) error {
	shouldParseProjectFileDirectly, err := s.shouldParseProjectFileDirectly(ctx, doc, sourceOverride)
	if err != nil {
		return errors.Join(ErrDocumentSourcePrecheckFailed, err)
	}
	if shouldParseProjectFileDirectly {
		return s.preflightProjectFileSource(ctx, doc)
	}
	plan, err := document.BuildSourcePrecheckPlan(doc, sourceOverride, s.thirdPlatformDocumentPort != nil)
	if err != nil {
		return errors.Join(ErrDocumentSourcePrecheckFailed, err)
	}
	if plan.SkipValidation {
		return nil
	}
	if s.parseService == nil {
		return fmt.Errorf("%w: parse service is nil", ErrDocumentSourcePrecheckFailed)
	}
	if err := s.parseService.ValidateSource(ctx, plan.ValidateURL); err != nil {
		return errors.Join(ErrDocumentSourcePrecheckFailed, err)
	}
	return nil
}

func (s *DocumentAppService) preflightProjectFileSource(
	ctx context.Context,
	doc *document.KnowledgeBaseDocument,
) error {
	link, err := document.ResolveProjectFileContentLink(ctx, s.projectFileContentPort, doc.ProjectFileID, 10*time.Minute)
	if err != nil {
		return errors.Join(ErrDocumentSourcePrecheckFailed, err)
	}
	if strings.TrimSpace(link) == "" {
		return errors.Join(ErrDocumentSourcePrecheckFailed, ErrDocumentFileEmpty)
	}

	// 项目文件内容链接由 PHP 侧项目文件/文件服务按业务规则生成，常见实现是只签名 GET 的临时下载链接。
	// 这里如果继续把它当成通用远程 URL 做 HEAD 探活，会把本来可读的项目文件误判成 403。
	// 因此项目文件预检只校验“能否解析出内容链接”，真正的内容可读性留给后续解析阶段用 GET 拉取时确认。
	return nil
}

func (s *DocumentAppService) markDocumentSyncing(ctx context.Context, doc *document.KnowledgeBaseDocument) error {
	if err := s.domainService.MarkSyncing(ctx, doc); err != nil {
		return fmt.Errorf("failed to mark document syncing: %w", err)
	}
	return nil
}

func (s *DocumentAppService) cleanupFragmentsByDocument(ctx context.Context, doc *document.KnowledgeBaseDocument, collectionName string) {
	if err := s.fragmentService.DeletePointsByDocument(ctx, collectionName, doc.OrganizationCode, doc.KnowledgeBaseCode, doc.Code); err != nil {
		s.logger.WarnContext(ctx, "Failed to delete vector points", "documentCode", doc.Code, "error", err)
	}
	if err := s.fragmentService.DeleteByDocument(ctx, doc.KnowledgeBaseCode, doc.Code); err != nil {
		s.logger.WarnContext(ctx, "Failed to delete fragments", "documentCode", doc.Code, "error", err)
	}
}

func (s *DocumentAppService) finishSync(ctx context.Context, doc *document.KnowledgeBaseDocument, content string) error {
	if err := s.domainService.MarkSynced(ctx, doc, document.CountSyncContentWordCount(content)); err != nil {
		return fmt.Errorf("failed to mark document synced: %w", err)
	}
	return nil
}

type documentFragmentSyncRequest struct {
	doc            *document.KnowledgeBaseDocument
	kb             *knowledgebasedomain.KnowledgeBase
	collectionName string
	fragments      []*fragmodel.KnowledgeBaseFragment
	businessParams *ctxmeta.BusinessParams
}

func (s *DocumentAppService) syncDocumentFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	req documentFragmentSyncRequest,
) error {
	if document.ShouldCleanupBeforeSync(trace.mode) {
		cleanupStartedAt := time.Now()
		s.cleanupFragmentsByDocument(ctx, req.doc, req.collectionName)
		trace.log(ctx, "cleanup_document_fragments", cleanupStartedAt, nil, "collection_name", req.collectionName)
	}

	if trace.mode == document.SyncModeResync {
		return s.runIncrementalResync(ctx, trace, req)
	}
	return s.runFullFragmentSync(ctx, trace, req)
}

func (s *DocumentAppService) runIncrementalResync(
	ctx context.Context,
	trace *documentSyncTracer,
	req documentFragmentSyncRequest,
) error {
	resyncStartedAt := time.Now()
	if err := s.resyncFragmentsIncrementally(ctx, req.doc, req.kb, req.collectionName, req.fragments, req.businessParams); err != nil {
		trace.log(
			ctx,
			"resync_fragments_incrementally",
			resyncStartedAt,
			err,
			"collection_name", req.collectionName,
			"fragment_count", len(req.fragments),
		)
		return document.NewSyncStageError(document.SyncFailureIncrementalResync, err)
	}
	trace.log(
		ctx,
		"resync_fragments_incrementally",
		resyncStartedAt,
		nil,
		"collection_name", req.collectionName,
		"fragment_count", len(req.fragments),
	)
	return nil
}

func (s *DocumentAppService) runFullFragmentSync(
	ctx context.Context,
	trace *documentSyncTracer,
	req documentFragmentSyncRequest,
) error {
	saveStartedAt := time.Now()
	if err := s.fragmentService.SaveBatch(ctx, req.fragments); err != nil {
		trace.log(ctx, "save_fragment_batch", saveStartedAt, err, "fragment_count", len(req.fragments))
		return document.NewSyncStageError(
			document.SyncFailureSaveFragments,
			fmt.Errorf("save fragment batch: %w", err),
		)
	}
	trace.log(ctx, "save_fragment_batch", saveStartedAt, nil, "fragment_count", len(req.fragments))

	syncStartedAt := time.Now()
	if err := s.fragmentService.SyncFragmentBatch(ctx, req.kb, req.fragments, req.businessParams); err != nil {
		trace.log(
			ctx,
			"sync_fragment_batch",
			syncStartedAt,
			err,
			"fragment_count", len(req.fragments),
			"collection_name", req.collectionName,
		)
		return document.NewSyncStageError(
			document.SyncFailureSyncVector,
			fmt.Errorf("sync fragment batch: %w", err),
		)
	}
	trace.log(
		ctx,
		"sync_fragment_batch",
		syncStartedAt,
		nil,
		"fragment_count", len(req.fragments),
		"collection_name", req.collectionName,
	)
	return nil
}
