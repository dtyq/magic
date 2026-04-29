package docapp

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/projectfile"
)

// ProjectFileChangeAppService 负责项目文件变更命令流。
//
// 这条链路入口只做轻量资格判断；真正执行时读取最新项目文件元数据、
// 绑定和已物化文档，再逐文档投递自包含 document_sync 任务。
type ProjectFileChangeAppService struct {
	support *DocumentAppService
}

// NewProjectFileChangeAppService 创建项目文件变更命令流应用服务。
func NewProjectFileChangeAppService(support *DocumentAppService) *ProjectFileChangeAppService {
	return &ProjectFileChangeAppService{support: support}
}

// NotifyProjectFileChange 按项目文件变更通知调度文档重同步。
func (s *ProjectFileChangeAppService) NotifyProjectFileChange(
	ctx context.Context,
	input *docdto.NotifyProjectFileChangeInput,
) error {
	if s == nil || s.support == nil || input == nil || input.ProjectFileID <= 0 || s.support.projectFileMetadataReader == nil {
		return nil
	}
	decision, err := s.shouldScheduleProjectFileChange(ctx, input)
	if err != nil {
		return err
	}
	if !decision.Eligible {
		s.logSkippedProjectFileChange(ctx, input, decision)
		return nil
	}
	return s.RunProjectFileChange(ctx, input)
}

// RunProjectFileChange 执行一次项目文件变更 fan-out。
func (s *ProjectFileChangeAppService) RunProjectFileChange(
	ctx context.Context,
	input *docdto.NotifyProjectFileChangeInput,
) error {
	if s == nil || s.support == nil || input == nil || input.ProjectFileID <= 0 || s.support.projectFileMetadataReader == nil {
		return nil
	}
	meta, err := s.support.loadProjectFileChangeMeta(ctx, input)
	if err != nil || meta == nil {
		return err
	}
	meta = documentdomain.NormalizeKnowledgeBaseProjectFileMeta(meta)
	release, acquired := s.support.acquireSourceCallbackLock(ctx, sourcebindingrepository.SourceCallbackSingleflightKey{
		Provider:         sourcebindingdomain.ProviderProject,
		OrganizationCode: meta.OrganizationCode,
		FileID:           strconv.FormatInt(meta.ProjectFileID, 10),
	})
	if !acquired {
		return nil
	}
	defer release()
	return s.handleProjectFileChange(ctx, input.ProjectFileID, meta)
}

func (s *ProjectFileChangeAppService) handleProjectFileChange(
	ctx context.Context,
	projectFileID int64,
	meta *projectfile.Meta,
) error {
	inputs, err := s.loadProjectFileChangeInputs(ctx, meta)
	if err != nil {
		return err
	}
	if inputs.Empty {
		return nil
	}

	bindingRefs := buildProjectFileBindingRefs(inputs.Bindings)
	bindingRefs, docs, empty, err := s.filterProjectFileChangeEnabledKnowledgeBases(ctx, meta, bindingRefs, inputs.Documents)
	if err != nil {
		return err
	}
	if empty {
		return nil
	}

	bindingRefs, docs, staleDocs, err := s.filterProjectFileChangeCoverage(ctx, meta, bindingRefs, docs)
	if err != nil {
		return err
	}
	if len(bindingRefs) == 0 && len(docs) == 0 && len(staleDocs) == 0 {
		return nil
	}

	plan, err := s.buildProjectFileChangePlan(ctx, meta, bindingRefs, docs, staleDocs)
	if err != nil {
		return err
	}
	if s.support.logger != nil {
		s.support.logger.InfoContext(
			ctx,
			"Plan project-file revectorize actions",
			"organization_code", meta.OrganizationCode,
			"project_id", meta.ProjectID,
			"project_file_id", meta.ProjectFileID,
			"revectorize_source", documentdomain.RevectorizeSourceProjectFileNotify,
			"target_scope", "project_bindings",
			"target_count", len(plan.DeleteDocuments)+len(plan.Standard.ResyncRequests)+len(plan.Standard.CreateTargets)+len(plan.Enterprise.ResyncRequests)+len(plan.Enterprise.CreateTargets),
		)
	}
	if err := s.destroyDocuments(ctx, plan.DeleteDocuments); err != nil {
		return err
	}
	if plan.Ignore ||
		(len(plan.DeleteDocuments) > 0 &&
			(projectfile.IsDeletedResolveStatus(meta.Status) || projectfile.IsUnsupportedResolveStatus(meta.Status))) {
		return nil
	}

	standardSource := documentdomain.ProjectFileChangeSource{
		Resolved: documentdomain.ProjectFileMetaToResolved(meta),
	}
	if err := s.executeGroup(ctx, plan.Standard, standardSource); err != nil {
		return err
	}
	enterpriseSource, err := s.resolveEnterpriseSource(ctx, projectFileID, plan.NeedEnterpriseResolution)
	if err != nil {
		return err
	}
	return s.executeGroup(ctx, plan.Enterprise, enterpriseSource)
}

type projectFileChangeInputs struct {
	Bindings  []sourcebindingdomain.Binding
	Documents []*docentity.KnowledgeBaseDocument
	Empty     bool
}

func (s *ProjectFileChangeAppService) loadProjectFileChangeInputs(
	ctx context.Context,
	meta *projectfile.Meta,
) (projectFileChangeInputs, error) {
	bindings, err := s.support.listRealtimeProjectBindings(ctx, meta.OrganizationCode, meta.ProjectID)
	if err != nil {
		return projectFileChangeInputs{}, err
	}
	docs, err := s.support.listProjectFileDocumentsInOrg(ctx, meta.OrganizationCode, meta.ProjectFileID)
	if err != nil {
		return projectFileChangeInputs{}, err
	}
	if len(bindings) == 0 && len(docs) == 0 {
		return projectFileChangeInputs{Empty: true}, nil
	}
	return projectFileChangeInputs{
		Bindings:  bindings,
		Documents: docs,
	}, nil
}

func (s *ProjectFileChangeAppService) filterProjectFileChangeEnabledKnowledgeBases(
	ctx context.Context,
	meta *projectfile.Meta,
	bindingRefs []documentdomain.ProjectFileBindingRef,
	docs []*docentity.KnowledgeBaseDocument,
) ([]documentdomain.ProjectFileBindingRef, []*docentity.KnowledgeBaseDocument, bool, error) {
	enabledCodes, err := s.support.enabledKnowledgeBaseCodeSet(
		ctx,
		meta.OrganizationCode,
		documentdomain.CollectProjectFileKnowledgeBaseCodes(bindingRefs, docs),
	)
	if err != nil {
		return nil, nil, false, err
	}
	bindingRefs = filterProjectFileBindingRefsByEnabledKnowledgeBases(bindingRefs, enabledCodes)
	docs = filterDocumentsByEnabledKnowledgeBases(docs, enabledCodes)
	return bindingRefs, docs, len(bindingRefs) == 0 && len(docs) == 0, nil
}

func (s *ProjectFileChangeAppService) filterProjectFileChangeCoverage(
	ctx context.Context,
	meta *projectfile.Meta,
	bindingRefs []documentdomain.ProjectFileBindingRef,
	docs []*docentity.KnowledgeBaseDocument,
) ([]documentdomain.ProjectFileBindingRef, []*docentity.KnowledgeBaseDocument, []*docentity.KnowledgeBaseDocument, error) {
	if !shouldFilterProjectFileChangeCoverage(meta) {
		return bindingRefs, docs, nil, nil
	}
	ancestorRefs, err := s.support.loadProjectFileAncestorFolderRefs(ctx, meta)
	if err != nil {
		return nil, nil, nil, err
	}
	bindingRefs = filterProjectFileBindingRefsByCoverage(bindingRefs, meta, ancestorRefs)
	docs, staleDocs := splitProjectDocumentsByBindingCoverage(docs, bindingRefs)
	return bindingRefs, docs, staleDocs, nil
}

func shouldFilterProjectFileChangeCoverage(meta *projectfile.Meta) bool {
	if meta == nil || meta.IsDirectory {
		return false
	}
	if projectfile.IsDeletedResolveStatus(meta.Status) || projectfile.IsUnsupportedResolveStatus(meta.Status) {
		return false
	}
	return true
}

func (s *ProjectFileChangeAppService) buildProjectFileChangePlan(
	ctx context.Context,
	meta *projectfile.Meta,
	bindingRefs []documentdomain.ProjectFileBindingRef,
	docs []*docentity.KnowledgeBaseDocument,
	staleDocs []*docentity.KnowledgeBaseDocument,
) (documentdomain.ProjectFileChangePlan, error) {
	enterpriseMap, err := s.support.resolveKnowledgeBaseEnterpriseMap(
		ctx,
		documentdomain.CollectProjectFileKnowledgeBaseCodes(bindingRefs, docs),
	)
	if err != nil {
		return documentdomain.ProjectFileChangePlan{}, err
	}
	plan := documentdomain.BuildProjectFileChangePlan(meta, bindingRefs, docs, enterpriseMap)
	if len(staleDocs) > 0 {
		plan.DeleteDocuments = append(staleDocs, plan.DeleteDocuments...)
	}
	return plan, nil
}

func (s *ProjectFileChangeAppService) destroyDocuments(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) error {
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if err := s.support.destroyDocument(ctx, doc); err != nil {
			return fmt.Errorf("destroy project document %s: %w", doc.Code, err)
		}
	}
	return nil
}

func (s *ProjectFileChangeAppService) resolveEnterpriseSource(
	ctx context.Context,
	projectFileID int64,
	needEnterpriseResolution bool,
) (documentdomain.ProjectFileChangeSource, error) {
	if !needEnterpriseResolution {
		return documentdomain.ProjectFileChangeSource{}, nil
	}
	if s.support.projectFilePort == nil {
		return documentdomain.ProjectFileChangeSource{}, nil
	}
	resolved, err := s.support.projectFilePort.Resolve(ctx, projectFileID)
	if err != nil {
		return documentdomain.ProjectFileChangeSource{}, fmt.Errorf("resolve project file source: %w", err)
	}
	return documentdomain.ProjectFileChangeSource{
		Resolved: resolved,
	}, nil
}

func (s *ProjectFileChangeAppService) executeGroup(
	ctx context.Context,
	group documentdomain.ProjectFileChangeActionGroup,
	source documentdomain.ProjectFileChangeSource,
) error {
	// 项目文件变更通知只逐文档发 document_sync，不直接分发 source override 大对象。
	for _, request := range group.ResyncRequests {
		if request == nil {
			continue
		}
		s.support.ScheduleSync(ctx, cloneProjectFileSyncRequestForApp(request))
	}

	for _, target := range group.CreateTargets {
		documentCode, err := s.createManagedDocument(ctx, target, source.Resolved)
		if err != nil {
			return err
		}
		if documentCode == "" {
			return documentdomain.ErrProjectFileChangeLifecycleDocumentCodeRequired
		}
		s.support.ScheduleSync(ctx, buildProjectFileCreateSyncRequestForApp(target, documentCode))
	}
	return nil
}

func (s *ProjectFileChangeAppService) createManagedDocument(
	ctx context.Context,
	target documentdomain.ProjectFileCreateTarget,
	resolved *projectfile.ResolveResult,
) (string, error) {
	sourceItem, err := s.support.upsertRealtimeProjectSourceItem(ctx, target, resolved, nil)
	if err != nil {
		return "", err
	}
	documentDTO, err := s.support.createManagedDocument(ctx, &documentdomain.CreateManagedDocumentInput{
		OrganizationCode:  strings.TrimSpace(target.OrganizationCode),
		UserID:            strings.TrimSpace(target.UserID),
		KnowledgeBaseCode: strings.TrimSpace(target.KnowledgeBaseCode),
		Code: documentdomain.BuildManagedSourceDocumentCode(
			sourcebindingdomain.ProviderProject,
			target.BindingID,
			sourceItem.ID,
		),
		SourceBindingID: target.BindingID,
		SourceItemID:    sourceItem.ID,
		ProjectID:       target.ProjectID,
		ProjectFileID:   target.ProjectFileID,
		AutoAdded:       target.AutoAdded,
		Name:            strings.TrimSpace(target.DocumentName),
		DocumentFile:    documentdomain.BuildProjectDocumentFileFromResolved(resolved, nil),
		AutoSync:        false,
	})
	if err != nil {
		return "", fmt.Errorf("auto create realtime project document: %w", err)
	}
	return documentDTO.Code, nil
}

func cloneProjectFileSyncRequestForApp(
	input *documentdomain.SyncDocumentInput,
) *documentdomain.SyncDocumentInput {
	if input == nil {
		return nil
	}
	cloned := *input
	cloned.RevectorizeSource = documentdomain.RevectorizeSourceProjectFileNotify
	return &cloned
}

func buildProjectFileCreateSyncRequestForApp(
	target documentdomain.ProjectFileCreateTarget,
	documentCode string,
) *documentdomain.SyncDocumentInput {
	return &documentdomain.SyncDocumentInput{
		OrganizationCode:  target.OrganizationCode,
		KnowledgeBaseCode: target.KnowledgeBaseCode,
		Code:              documentCode,
		Mode:              documentdomain.SyncModeCreate,
		Async:             true,
		BusinessParams:    texthelper.BuildCreateBusinessParams(target.OrganizationCode, target.UserID, target.KnowledgeBaseCode),
		RevectorizeSource: documentdomain.RevectorizeSourceProjectFileNotify,
	}
}
