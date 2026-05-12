package docapp

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/domain/knowledge/shared/parseddocument"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/filetype"
)

const (
	syncModeCreate = document.SyncModeCreate
	syncModeResync = document.SyncModeResync
)

func (s *DocumentAppService) buildFragments(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	kb *kbentity.KnowledgeBase,
	parsed *parseddocument.ParsedDocument,
	model string,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	kbSnapshot := knowledgeBaseSnapshotFromDomain(kb)
	splitPlan := document.ResolveEffectiveSyncSplitPlan(doc, kbSnapshot, shouldForceAutoSplitForKnowledgeBase(kb))
	chunks, splitVersion, err := documentsplitter.SplitParsedDocumentToChunks(ctx, documentsplitter.ParsedDocumentChunkInput{
		Parsed:           parsed,
		SourceFileType:   normalizeDocumentSourceFileType(doc),
		RequestedMode:    splitPlan.RequestedMode,
		FragmentConfig:   splitPlan.FragmentConfig,
		SegmentConfig:    toSplitterSegmentConfig(splitPlan.SegmentConfig),
		Model:            model,
		TokenizerService: s.tokenizer,
		Logger:           s.logger,
	})
	if err != nil {
		return nil, fmt.Errorf("split parsed document to chunks: %w", err)
	}
	if err := document.CheckFragmentCount(len(chunks), s.ResourceLimits()); err != nil {
		return nil, fmt.Errorf("check document chunk count: %w", err)
	}

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc:          fragDocumentFromDomain(doc),
		Chunks:       toFragmentTokenChunks(chunks),
		SplitVersion: splitVersion,
	})
	if err != nil {
		return nil, fmt.Errorf("build document fragments: %w", err)
	}
	if err := document.CheckFragmentCount(len(fragments), s.ResourceLimits()); err != nil {
		return nil, fmt.Errorf("check document fragment count: %w", err)
	}
	return fragments, nil
}

func shouldForceAutoSplitForKnowledgeBase(kb *kbentity.KnowledgeBase) bool {
	if kb == nil {
		return false
	}
	return kbentity.NormalizeKnowledgeBaseTypeOrDefault(kb.KnowledgeBaseType) == kbentity.KnowledgeBaseTypeFlowVector
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

func normalizeDocumentSourceFileType(doc *docentity.KnowledgeBaseDocument) string {
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
	cloned := *input
	cloned.Async = true
	s.syncScheduler.Schedule(ctx, &cloned)
}

// IsDocumentSourcePrecheckError 判断是否为同步前文档源预检错误。
func IsDocumentSourcePrecheckError(err error) bool {
	return errors.Is(err, ErrDocumentSourcePrecheckFailed)
}

func (s *DocumentAppService) loadRuntimeKnowledgeBaseForSync(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) (*kbentity.KnowledgeBase, error) {
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

func (s *DocumentAppService) fetchDocumentForSync(ctx context.Context, input *document.SyncDocumentInput) (*docentity.KnowledgeBaseDocument, error) {
	if input == nil {
		return nil, shared.ErrDocumentKnowledgeBaseRequired
	}
	if err := validateDocumentKnowledgeBaseCode(input.KnowledgeBaseCode); err != nil {
		return nil, err
	}
	doc, err := s.domainService.ShowByCodeAndKnowledgeBase(ctx, input.Code, input.KnowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}
	if err := s.completeDocumentSyncBusinessContext(ctx, input, doc); err != nil {
		return doc, err
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, input.BusinessParams.UserID, input.KnowledgeBaseCode, "edit"); err != nil {
		return doc, err
	}
	return doc, nil
}

func (s *DocumentAppService) completeDocumentSyncBusinessContext(
	ctx context.Context,
	input *document.SyncDocumentInput,
	doc *docentity.KnowledgeBaseDocument,
) error {
	if input == nil {
		return shared.ErrDocumentKnowledgeBaseRequired
	}
	input.OrganizationCode = s.resolveDocumentSyncOrganizationCode(ctx, input, doc)
	if err := s.validateDocumentOrg(doc, input.OrganizationCode); err != nil {
		return err
	}

	if input.BusinessParams == nil {
		input.BusinessParams = &ctxmeta.BusinessParams{}
	}
	params := input.BusinessParams
	params.OrganizationCode = strings.TrimSpace(input.OrganizationCode)
	if strings.TrimSpace(params.BusinessID) == "" {
		params.BusinessID = strings.TrimSpace(input.KnowledgeBaseCode)
	}
	if strings.TrimSpace(params.UserID) == "" {
		userID, err := s.resolveDocumentSyncUserID(ctx, input, doc)
		if err != nil {
			return err
		}
		params.UserID = userID
	}
	params.UserID = strings.TrimSpace(params.UserID)
	if params.UserID == "" && s.knowledgeAccessService() != nil {
		return fmt.Errorf(
			"%w: organization_code=%s knowledge_base_code=%s document_code=%s",
			ErrDocumentAccessActorMissing,
			input.OrganizationCode,
			input.KnowledgeBaseCode,
			input.Code,
		)
	}
	return nil
}

func (s *DocumentAppService) resolveDocumentSyncOrganizationCode(
	ctx context.Context,
	input *document.SyncDocumentInput,
	doc *docentity.KnowledgeBaseDocument,
) string {
	if input == nil {
		return ""
	}
	if organizationCode := strings.TrimSpace(input.OrganizationCode); organizationCode != "" {
		return organizationCode
	}
	if input.BusinessParams != nil {
		if organizationCode := strings.TrimSpace(input.BusinessParams.GetOrganizationCode()); organizationCode != "" {
			return organizationCode
		}
	}
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if organizationCode := strings.TrimSpace(actor.OrganizationCode); organizationCode != "" {
			return organizationCode
		}
	}
	if doc != nil {
		return strings.TrimSpace(doc.OrganizationCode)
	}
	return ""
}

func (s *DocumentAppService) resolveDocumentSyncUserID(
	ctx context.Context,
	input *document.SyncDocumentInput,
	doc *docentity.KnowledgeBaseDocument,
) (string, error) {
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if userID := strings.TrimSpace(actor.UserID); userID != "" {
			return userID, nil
		}
	}
	if userID := strings.TrimSpace(document.ResolveMappedDocumentUserID(doc)); userID != "" {
		return userID, nil
	}
	return s.resolveKnowledgeBaseSyncUserIDForDocumentSyncActor(ctx, input)
}

func (s *DocumentAppService) resolveKnowledgeBaseSyncUserIDForDocumentSyncActor(
	ctx context.Context,
	input *document.SyncDocumentInput,
) (string, error) {
	if s == nil || s.kbService == nil || input == nil {
		return "", nil
	}
	organizationCode := strings.TrimSpace(input.OrganizationCode)
	knowledgeBaseCode := strings.TrimSpace(input.KnowledgeBaseCode)
	if organizationCode == "" || knowledgeBaseCode == "" {
		return "", nil
	}
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return "", fmt.Errorf("load knowledge base while resolving document sync actor: %w", err)
	}
	return resolveKnowledgeBaseSyncUserID(kb), nil
}

func resolveKnowledgeBaseSyncUserID(kb *kbentity.KnowledgeBase) string {
	if kb == nil {
		return ""
	}
	if userID := strings.TrimSpace(kb.UpdatedUID); userID != "" {
		return userID
	}
	return strings.TrimSpace(kb.CreatedUID)
}

func (s *DocumentAppService) validateDocumentOrg(doc *docentity.KnowledgeBaseDocument, orgCode string) error {
	if doc != nil && !doc.BelongsToOrganization(orgCode) {
		return ErrDocumentOrgMismatch
	}
	return nil
}

func (s *DocumentAppService) redirectThirdPlatformResync(
	ctx context.Context,
	mode string,
	doc *docentity.KnowledgeBaseDocument,
	input *document.SyncDocumentInput,
) (bool, error) {
	source := ""
	if input != nil {
		source = document.NormalizeRevectorizeSource(input.RevectorizeSource)
	}
	if input != nil && shouldPrepareSingleDocumentThirdPlatformResync(input) {
		// third-file fan-out 之后的单文档任务必须停留在 document_sync，
		// 不能再从 consumer 里回跳到 third-file 广播入口，否则会形成回环。
		s.logThirdPlatformRedirect(ctx, "info", "Skip third-file broadcast redirect for fixed single-document scope", doc, thirdPlatformRedirectLog{
			source:         source,
			targetScope:    "document",
			targetCount:    1,
			allowBroadcast: false,
		})
		return false, nil
	}
	allowBroadcast := document.RevectorizeSourceAllowsThirdFileBroadcast(source)
	decision := document.ResolveThirdPlatformRedirect(
		doc,
		mode,
		input != nil && input.SourceOverride != nil,
		redirectOrganizationCode(input),
		redirectUserID(input),
	)
	if !decision.Redirect {
		if decision.IncompleteBinding {
			s.logThirdPlatformRedirect(ctx, "warn", "Third-platform document binding is incomplete, fallback to standard resync", doc, thirdPlatformRedirectLog{
				source:         source,
				targetScope:    "document",
				targetCount:    1,
				allowBroadcast: false,
			})
		}
		return false, nil
	}
	if !allowBroadcast {
		// 单文档手动入口、项目文件通知、Teamshare 单知识库批量入口都自带稳定目标集合，
		// 这里不能再借 third-file 链路扩散成“全组织同源广播”。
		s.logThirdPlatformRedirect(ctx, "info", "Skip third-file broadcast redirect because source scope is fixed", doc, thirdPlatformRedirectLog{
			source:         source,
			targetScope:    "document",
			targetCount:    1,
			allowBroadcast: false,
		})
		return false, nil
	}
	s.logThirdPlatformRedirect(ctx, "info", "Redirect document resync to third-file broadcast", doc, thirdPlatformRedirectLog{
		source:         source,
		targetScope:    "third_file_documents",
		allowBroadcast: true,
	})

	redirectInput := &docdto.ReVectorizedByThirdFileIDInput{
		OrganizationCode:  decision.Input.OrganizationCode,
		UserID:            decision.Input.UserID,
		ThirdPlatformType: decision.Input.ThirdPlatformType,
		ThirdFileID:       decision.Input.ThirdFileID,
	}
	if err := s.ReVectorizedByThirdFileID(ctx, redirectInput); err != nil {
		return true, err
	}
	return true, nil
}

func redirectUserID(input *document.SyncDocumentInput) string {
	if input == nil || input.BusinessParams == nil {
		return ""
	}
	return input.BusinessParams.UserID
}

func redirectOrganizationCode(input *document.SyncDocumentInput) string {
	if input == nil {
		return ""
	}
	return input.OrganizationCode
}

type thirdPlatformRedirectLog struct {
	source         string
	targetScope    string
	targetCount    int
	allowBroadcast bool
}

func (s *DocumentAppService) logThirdPlatformRedirect(
	ctx context.Context,
	level string,
	message string,
	doc *docentity.KnowledgeBaseDocument,
	logMeta thirdPlatformRedirectLog,
) {
	if s == nil || s.logger == nil || doc == nil {
		return
	}
	fields := []any{
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"third_platform_type", strings.ToLower(strings.TrimSpace(doc.ThirdPlatformType)),
		"third_file_id", strings.TrimSpace(doc.ThirdFileID),
		"revectorize_source", logMeta.source,
		"target_scope", logMeta.targetScope,
		"target_count", logMeta.targetCount,
		"allow_broadcast", logMeta.allowBroadcast,
	}
	if level == "warn" {
		s.logger.KnowledgeWarnContext(ctx, message, fields...)
		return
	}
	s.logger.InfoContext(ctx, message, fields...)
}

func (s *DocumentAppService) injectProjectFileSourceOverride(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
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
	doc *docentity.KnowledgeBaseDocument,
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
	doc *docentity.KnowledgeBaseDocument,
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

func (s *DocumentAppService) markDocumentSyncing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) error {
	if err := s.domainService.MarkSyncing(ctx, doc); err != nil {
		return fmt.Errorf("failed to mark document syncing: %w", err)
	}
	return nil
}

func (s *DocumentAppService) cleanupFragmentsByDocument(ctx context.Context, doc *docentity.KnowledgeBaseDocument, collectionName string) {
	if err := s.fragmentService.DeletePointsByDocument(ctx, collectionName, doc.OrganizationCode, doc.KnowledgeBaseCode, doc.Code); err != nil {
		s.logger.KnowledgeWarnContext(ctx, "Failed to delete vector points", "documentCode", doc.Code, "error", err)
	}
	if err := s.fragmentService.DeleteByDocument(ctx, doc.KnowledgeBaseCode, doc.Code); err != nil {
		s.logger.KnowledgeWarnContext(ctx, "Failed to delete fragments", "documentCode", doc.Code, "error", err)
	}
}

func (s *DocumentAppService) finishSync(ctx context.Context, doc *docentity.KnowledgeBaseDocument, content string) error {
	if err := s.domainService.MarkSynced(ctx, doc, document.CountSyncContentWordCount(content)); err != nil {
		return fmt.Errorf("failed to mark document synced: %w", err)
	}
	return nil
}

type documentFragmentSyncRequest struct {
	doc            *docentity.KnowledgeBaseDocument
	kb             *kbentity.KnowledgeBase
	kbSnapshot     *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	collectionName string
	fragments      []*fragmodel.KnowledgeBaseFragment
	businessParams *ctxmeta.BusinessParams
}

func (s *DocumentAppService) syncDocumentFragments(
	ctx context.Context,
	trace *documentSyncTracer,
	req documentFragmentSyncRequest,
) error {
	if err := s.ensureRuntimeCollectionReady(ctx, trace, req); err != nil {
		return err
	}
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

func (s *DocumentAppService) ensureRuntimeCollectionReady(
	ctx context.Context,
	trace *documentSyncTracer,
	req documentFragmentSyncRequest,
) error {
	startedAt := time.Now()
	err := s.kbService.EnsureCollectionExists(ctx, req.kb)
	trace.log(ctx, "ensure_runtime_collection", startedAt, err, "collection_name", req.collectionName)
	if err != nil {
		return document.NewSyncStageError(
			document.SyncFailureSyncVector,
			fmt.Errorf("ensure runtime collection exists: %w", err),
		)
	}
	return nil
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
	if err := s.fragmentService.SyncFragmentBatch(ctx, req.kbSnapshot, req.fragments, req.businessParams); err != nil {
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
