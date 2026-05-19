package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

const thirdFileRevectorizeTaskKind = "third_file_revectorize"

// ThirdFileRevectorizeAppService 负责 third-file 广播型重向量化命令流。
//
// 这条链路的输入是“外部文件变动通知”，目标集合来自
// `(organization_code, third_platform_type, third_file_id)` 在全组织下命中的所有映射文档，
// 允许跨多个知识库扩散；它不是“当前文档手动重试”的替代入口。
//
// 设计上入口只做轻量资格判断；真正执行时重新解析最新命中的文档集合，
// 再逐个改写成自包含 document_sync 任务。
type ThirdFileRevectorizeAppService struct {
	support *DocumentAppService
}

// NewThirdFileRevectorizeAppService 创建 third-file 重向量化命令流应用服务。
func NewThirdFileRevectorizeAppService(support *DocumentAppService) *ThirdFileRevectorizeAppService {
	return &ThirdFileRevectorizeAppService{support: support}
}

// ReVectorizedByThirdFileID 按第三方文件调度一次重向量化。
func (s *ThirdFileRevectorizeAppService) ReVectorizedByThirdFileID(
	ctx context.Context,
	input *docdto.ReVectorizedByThirdFileIDInput,
) error {
	if s == nil || s.support == nil || input == nil {
		return nil
	}

	taskInput := documentdomain.NormalizeThirdFileRevectorizeInput(&documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:              input.OrganizationCode,
		UserID:                        input.UserID,
		ThirdPlatformUserID:           input.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: input.ThirdPlatformOrganizationCode,
		ThirdPlatformType:             input.ThirdPlatformType,
		ThirdFileID:                   input.ThirdFileID,
		ThirdKnowledgeID:              input.ThirdKnowledgeID,
	})
	if taskInput == nil || taskInput.OrganizationCode == "" || taskInput.ThirdPlatformType == "" || taskInput.ThirdFileID == "" {
		return shared.ErrDocumentNotFound
	}

	// flow 向量知识库没有实时同步开关，历史 Teamshare binding 若是 manual 会被后续 realtime 查询误过滤。
	// 这里先按产品线修正本次回调相关的 flow binding，再做资格判断；数字员工 manual 不会被修改。
	if err := s.repairFlowTeamshareRealtimeForCallback(ctx, taskInput); err != nil {
		return err
	}
	decision, err := s.shouldScheduleThirdFileRevectorize(ctx, taskInput)
	if err != nil {
		return err
	}
	if !decision.Eligible {
		s.logSkippedThirdFileBeforeMQ(ctx, taskInput, decision)
		return nil
	}

	return s.RunThirdFileRevectorize(ctx, taskInput)
}

// RunThirdFileRevectorize 执行第三方文件重向量化任务。
func (s *ThirdFileRevectorizeAppService) RunThirdFileRevectorize(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
) error {
	if s == nil || s.support == nil {
		return nil
	}
	task := documentdomain.NormalizeThirdFileRevectorizeInput(input)
	if task == nil || task.OrganizationCode == "" || task.ThirdPlatformType == "" || task.ThirdFileID == "" {
		return shared.ErrDocumentNotFound
	}
	release, acquired := s.support.acquireSourceCallbackLock(ctx, sourcebindingrepository.SourceCallbackSingleflightKey{
		Provider:         sourcebindingdomain.ProviderTeamshare,
		OrganizationCode: task.OrganizationCode,
		FileID:           task.ThirdFileID,
	})
	if !acquired {
		return nil
	}
	defer release()
	return s.runThirdFileRevectorize(ctx, task)
}

func (s *ThirdFileRevectorizeAppService) runThirdFileRevectorize(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
) error {
	if s == nil || s.support == nil || input == nil {
		return nil
	}

	task := documentdomain.NormalizeThirdFileRevectorizeInput(input)
	if task == nil || task.OrganizationCode == "" || task.ThirdPlatformType == "" || task.ThirdFileID == "" {
		return shared.ErrDocumentNotFound
	}
	// 队列任务/直接执行也可能绕过入口方法，执行前再修一次，确保 fan-out 用到的是修正后的 binding。
	if err := s.repairFlowTeamshareRealtimeForCallback(ctx, task); err != nil {
		return err
	}
	sourceCacheVersion, skipSourceCache := s.prepareThirdFileSourceCacheVersion(ctx, task)
	docs, err := s.support.domainService.ListRealtimeByThirdFileInOrg(
		ctx,
		task.OrganizationCode,
		task.ThirdPlatformType,
		task.ThirdFileID,
	)
	if err != nil {
		return fmt.Errorf("list realtime third-file documents: %w", err)
	}
	current, handled, err := s.prepareThirdFileCurrentSource(ctx, task, docs)
	if err != nil || handled {
		return err
	}
	bindings, err := s.coveringThirdFileBindings(ctx, task, current)
	if err != nil {
		return err
	}
	bindings, docs, err = s.filterThirdFileCoverageByEnabledKnowledgeBases(ctx, task, bindings, docs)
	if err != nil {
		return err
	}
	plan := documentdomain.BuildThirdFileChangePlan(
		task,
		thirdFileCurrentSourceRef(current),
		buildThirdFileBindingRefs(bindings),
		docs,
	)
	if err := s.destroyThirdFileDocuments(ctx, plan.DeleteDocuments); err != nil {
		return err
	}
	if len(plan.CreateTargets) == 0 && len(plan.ResyncDocuments) == 0 {
		return nil
	}

	requests, err := s.buildThirdFileChangeSyncRequests(ctx, task, current, plan, sourceCacheVersion, skipSourceCache)
	if err != nil {
		return err
	}
	return s.scheduleThirdFileChangeRequests(ctx, task, requests)
}

func (s *ThirdFileRevectorizeAppService) prepareThirdFileSourceCacheVersion(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) (string, bool) {
	if s == nil || s.support == nil || task == nil {
		return "", true
	}
	sourceKey := documentdomain.BuildThirdFileSourceCacheKey(task.OrganizationCode, task.ThirdPlatformType, task.ThirdFileID)
	if s.support.thirdFileSourceVersionStore == nil {
		s.logThirdFileSourceCacheVersionBypass(ctx, task, sourceKey, "version_store_missing", nil)
		return "", true
	}
	version, err := s.support.thirdFileSourceVersionStore.Bump(ctx, sourceKey)
	if err != nil {
		// Redis version 是跨 pod 避免旧进程缓存的保护线。
		// bump 失败时不能继续复用本地 cache，只能让 consumer 每次直接解析最新内容。
		s.logThirdFileSourceCacheVersionBypass(ctx, task, sourceKey, "version_bump_failed", err)
		return "", true
	}
	if s.support.logger != nil {
		s.support.logger.InfoContext(
			ctx,
			"Bumped third-file source cache version before fan-out",
			"organization_code", task.OrganizationCode,
			"third_platform_type", task.ThirdPlatformType,
			"third_file_id", task.ThirdFileID,
			"source_cache_key", sourceKey,
			"source_cache_version", version,
		)
	}
	return strings.TrimSpace(version), false
}

func (s *ThirdFileRevectorizeAppService) prepareThirdFileCurrentSource(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
) (thirdFileCurrentSource, bool, error) {
	node, err := s.resolveThirdFileNode(ctx, task, docs)
	if err != nil {
		if errors.Is(err, thirdplatform.ErrDocumentUnavailable) {
			return thirdFileCurrentSource{}, true, s.destroyThirdFileDocuments(ctx, docs)
		}
		// third_platform_user_id 只是读取凭证，不是回调业务分支条件。
		// create/resync/delete plan 必须依赖当前 node 元信息；缺身份、解析器缺失或临时错误都要返回给 MQ 重试，
		// 不能降级成“只重同步已有文档”，否则文件移动/新增/移出绑定范围时会漏掉自动创建和删除。
		return thirdFileCurrentSource{}, true, fmt.Errorf("resolve third-file node meta: %w", err)
	}
	if node == nil {
		return thirdFileCurrentSource{}, true, fmt.Errorf("resolve third-file node meta: %w", errThirdFileNodeMissing)
	}
	current := buildThirdFileCurrentSource(task, node)
	if current.DocumentFile == nil || strings.TrimSpace(current.DocumentFile.ThirdID) == "" {
		return thirdFileCurrentSource{}, true, fmt.Errorf("resolve third-file node meta: %w", errThirdFileDocumentFileMissing)
	}
	if !current.Processable {
		// 平台已经明确返回当前文件不是可向量化文档时，才清理已有映射，避免保留失效数据。
		return thirdFileCurrentSource{}, true, s.destroyThirdFileDocuments(ctx, docs)
	}
	if current.KnowledgeBaseID == "" {
		s.logSkippedThirdFileRootMissing(ctx, task, len(docs))
		return thirdFileCurrentSource{}, true, fmt.Errorf("resolve third-file node meta: %w", errThirdFileKnowledgeBaseMissing)
	}
	return current, false, nil
}

func (s *ThirdFileRevectorizeAppService) filterThirdFileCoverageByEnabledKnowledgeBases(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	bindings []sourcebindingdomain.Binding,
	docs []*docentity.KnowledgeBaseDocument,
) ([]sourcebindingdomain.Binding, []*docentity.KnowledgeBaseDocument, error) {
	enabledCodes, err := s.support.enabledKnowledgeBaseCodeSet(ctx, task.OrganizationCode, collectThirdFileKnowledgeBaseCodes(bindings, docs))
	if err != nil {
		return nil, nil, err
	}
	return filterThirdFileBindingsByEnabledKnowledgeBases(bindings, enabledCodes),
		filterDocumentsByEnabledKnowledgeBases(docs, enabledCodes),
		nil
}

func (s *ThirdFileRevectorizeAppService) buildThirdFileChangeSyncRequests(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	current thirdFileCurrentSource,
	plan documentdomain.ThirdFileChangePlan,
	sourceCacheVersion string,
	skipSourceCache bool,
) ([]*documentdomain.SyncDocumentInput, error) {
	requests, err := s.buildThirdFileDocumentSyncRequests(ctx, task, plan.ResyncDocuments, sourceCacheVersion, skipSourceCache)
	if err != nil {
		return nil, err
	}
	for _, target := range plan.CreateTargets {
		documentCode, err := s.createThirdFileManagedDocument(ctx, task, target, current)
		if err != nil {
			return nil, err
		}
		requests = append(requests, thirdFileCreateSyncRequest(task, target, documentCode, sourceCacheVersion, skipSourceCache))
	}
	return requests, nil
}

func (s *ThirdFileRevectorizeAppService) scheduleThirdFileChangeRequests(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	requests []*documentdomain.SyncDocumentInput,
) error {
	if len(requests) == 0 {
		return nil
	}
	if s.support.logger != nil {
		s.support.logger.InfoContext(
			ctx,
			"Schedule third-file broadcast revectorize",
			"organization_code", task.OrganizationCode,
			"third_platform_type", task.ThirdPlatformType,
			"third_file_id", task.ThirdFileID,
			"revectorize_source", documentdomain.RevectorizeSourceThirdFileBroadcast,
			"target_scope", "third_file_documents",
			"target_count", len(requests),
		)
	}
	for _, request := range requests {
		s.support.ScheduleSync(ctx, request)
	}
	return nil
}

func (s *ThirdFileRevectorizeAppService) destroyThirdFileDocuments(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) error {
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if err := s.support.destroyDocument(ctx, doc); err != nil {
			return fmt.Errorf("destroy third-file document %s: %w", doc.Code, err)
		}
	}
	return nil
}

func (s *ThirdFileRevectorizeAppService) logSkippedThirdFileRootMissing(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	documentCount int,
) {
	if s == nil || s.support == nil || s.support.logger == nil || task == nil {
		return
	}

	s.support.logger.WarnContext(
		ctx,
		"Skip third-file create/resync because current knowledge base root is missing",
		"organization_code", task.OrganizationCode,
		"third_platform_type", task.ThirdPlatformType,
		"third_file_id", task.ThirdFileID,
		"third_knowledge_id", task.ThirdKnowledgeID,
		"existing_document_count", documentCount,
		"task_kind", thirdFileRevectorizeTaskKind,
		"mode", documentdomain.SyncModeResync,
	)
}

func (s *ThirdFileRevectorizeAppService) logThirdFileSourceCacheVersionBypass(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	sourceKey string,
	reason string,
	cause error,
) {
	if s == nil || s.support == nil || s.support.logger == nil || task == nil {
		return
	}
	fields := []any{
		"organization_code", task.OrganizationCode,
		"third_platform_type", task.ThirdPlatformType,
		"third_file_id", task.ThirdFileID,
		"source_cache_key", sourceKey,
		"skip_reason", reason,
		"task_kind", thirdFileRevectorizeTaskKind,
		"mode", documentdomain.SyncModeResync,
	}
	if cause != nil {
		fields = append(fields, "error", cause)
	}
	s.support.logger.WarnContext(ctx, "Skip third-file source local cache for fan-out tasks", fields...)
}

func (s *ThirdFileRevectorizeAppService) buildThirdFileDocumentSyncRequests(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
	sourceCacheVersion string,
	skipSourceCache bool,
) ([]*documentdomain.SyncDocumentInput, error) {
	if err := s.support.ensureThirdPlatformProvider(task.ThirdPlatformType); err != nil {
		return nil, fmt.Errorf("ensure third-file provider: %w", err)
	}
	// 异步 third-file 变更通知统一退化成“每文档一条 document_sync MQ”。
	// 这里故意不携带 SourceOverride/ParsedDocument，避免 producer 侧承担大对象 clone/fan-out。
	readUsers, err := s.support.resolveDocumentsReadUsersBestEffort(ctx, docs)
	if err != nil {
		return nil, err
	}
	requests := make([]*documentdomain.SyncDocumentInput, 0, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.Code == "" || doc.KnowledgeBaseCode == "" {
			continue
		}
		readUserID := strings.TrimSpace(readUsers[doc.Code])
		if readUserID == "" && s.support.userService != nil {
			continue
		}
		requests = append(requests, &documentdomain.SyncDocumentInput{
			OrganizationCode:  task.OrganizationCode,
			KnowledgeBaseCode: doc.KnowledgeBaseCode,
			Code:              doc.Code,
			Mode:              documentdomain.SyncModeResync,
			Async:             true,
			BusinessParams: &ctxmeta.BusinessParams{
				OrganizationCode:              task.OrganizationCode,
				UserID:                        readUserID,
				BusinessID:                    doc.KnowledgeBaseCode,
				SourceID:                      ctxmeta.SourceIDFragmentSaved,
				ThirdPlatformUserID:           task.ThirdPlatformUserID,
				ThirdPlatformOrganizationCode: task.ThirdPlatformOrganizationCode,
			},
			RevectorizeSource:                 documentdomain.RevectorizeSourceThirdFileBroadcast,
			SingleDocumentThirdPlatformResync: true,
			ThirdFileSourceCacheVersion:       strings.TrimSpace(sourceCacheVersion),
			SkipThirdFileSourceCache:          skipSourceCache,
		})
	}
	return requests, nil
}
