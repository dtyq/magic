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

	requests, err := s.buildThirdFileChangeSyncRequests(ctx, task, current, plan)
	if err != nil {
		return err
	}
	return s.scheduleThirdFileChangeRequests(ctx, task, requests)
}

func (s *ThirdFileRevectorizeAppService) prepareThirdFileCurrentSource(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
) (thirdFileCurrentSource, bool, error) {
	node, err := s.resolveThirdFileNode(ctx, task)
	if err != nil {
		if errors.Is(err, errThirdFileNodeResolverUnavailable) {
			return thirdFileCurrentSource{}, true, s.scheduleExistingThirdFileDocuments(ctx, task, docs)
		}
		if errors.Is(err, thirdplatform.ErrDocumentUnavailable) {
			return thirdFileCurrentSource{}, true, s.destroyThirdFileDocuments(ctx, docs)
		}
		if len(docs) == 0 {
			s.logSkippedThirdFileRevectorize(ctx, task)
			return thirdFileCurrentSource{}, true, nil
		}
		return thirdFileCurrentSource{}, true, fmt.Errorf("resolve third-file node meta: %w", err)
	}
	if node == nil {
		return thirdFileCurrentSource{}, true, s.scheduleExistingThirdFileDocuments(ctx, task, docs)
	}
	current := buildThirdFileCurrentSource(task, node)
	if current.DocumentFile == nil || strings.TrimSpace(current.DocumentFile.ThirdID) == "" {
		if len(docs) == 0 {
			s.logSkippedThirdFileRevectorize(ctx, task)
			return thirdFileCurrentSource{}, true, nil
		}
		return thirdFileCurrentSource{}, true, s.scheduleExistingThirdFileDocuments(ctx, task, docs)
	}
	if !current.Processable {
		return thirdFileCurrentSource{}, true, s.destroyThirdFileDocuments(ctx, docs)
	}
	if current.KnowledgeBaseID == "" {
		s.logSkippedThirdFileRootMissing(ctx, task, len(docs))
		return thirdFileCurrentSource{}, true, s.destroyThirdFileDocuments(ctx, docs)
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
) ([]*documentdomain.SyncDocumentInput, error) {
	requests, err := s.buildThirdFileDocumentSyncRequests(ctx, task, plan.ResyncDocuments)
	if err != nil {
		return nil, err
	}
	for _, target := range plan.CreateTargets {
		documentCode, err := s.createThirdFileManagedDocument(ctx, task, target, current)
		if err != nil {
			return nil, err
		}
		requests = append(requests, thirdFileCreateSyncRequest(task, target, documentCode))
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

func (s *ThirdFileRevectorizeAppService) scheduleExistingThirdFileDocuments(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
) error {
	if len(docs) == 0 {
		s.logSkippedThirdFileRevectorize(ctx, task)
		return nil
	}
	plan, err := s.filterThirdFilePlanByEnabledKnowledgeBases(ctx, task, documentdomain.ThirdFileDocumentPlan{Documents: docs})
	if err != nil {
		return err
	}
	if len(plan.Documents) == 0 {
		return nil
	}
	requests, err := s.buildThirdFileDocumentSyncRequests(ctx, task, plan.Documents)
	if err != nil {
		return err
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

func (s *ThirdFileRevectorizeAppService) filterThirdFilePlanByEnabledKnowledgeBases(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	plan documentdomain.ThirdFileDocumentPlan,
) (documentdomain.ThirdFileDocumentPlan, error) {
	if len(plan.Documents) == 0 {
		return plan, nil
	}
	codes := make([]string, 0, len(plan.Documents))
	for _, doc := range plan.Documents {
		if doc == nil {
			continue
		}
		codes = append(codes, doc.KnowledgeBaseCode)
	}
	enabledCodes, err := s.support.enabledKnowledgeBaseCodeSet(ctx, task.OrganizationCode, codes)
	if err != nil {
		return documentdomain.ThirdFileDocumentPlan{}, err
	}
	filteredDocs := filterDocumentsByEnabledKnowledgeBases(plan.Documents, enabledCodes)
	if len(filteredDocs) == 0 {
		return documentdomain.ThirdFileDocumentPlan{Documents: []*docentity.KnowledgeBaseDocument{}}, nil
	}
	seed, err := documentdomain.BuildThirdFileRevectorizeSeed(task, filteredDocs)
	if err != nil {
		return documentdomain.ThirdFileDocumentPlan{}, fmt.Errorf("build third-file revectorize seed: %w", err)
	}
	return documentdomain.ThirdFileDocumentPlan{
		Documents: filteredDocs,
		Seed:      seed,
	}, nil
}

func (s *ThirdFileRevectorizeAppService) logSkippedThirdFileRevectorize(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
) {
	if s == nil || s.support == nil || s.support.logger == nil || task == nil {
		return
	}

	s.support.logger.InfoContext(
		ctx,
		"Skip third-file revectorize because no mapped document remains",
		"organization_code", task.OrganizationCode,
		"third_platform_type", task.ThirdPlatformType,
		"third_file_id", task.ThirdFileID,
		"task_kind", thirdFileRevectorizeTaskKind,
		"skip_reason", "no_mapped_document",
		"mode", documentdomain.SyncModeResync,
	)
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

func (s *ThirdFileRevectorizeAppService) buildThirdFileDocumentSyncRequests(
	ctx context.Context,
	task *documentdomain.ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
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
				ThirdPlatformUserID:           task.ThirdPlatformUserID,
				ThirdPlatformOrganizationCode: task.ThirdPlatformOrganizationCode,
			},
			RevectorizeSource:                 documentdomain.RevectorizeSourceThirdFileBroadcast,
			SingleDocumentThirdPlatformResync: true,
		})
	}
	return requests, nil
}
