package docapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"

	docdto "magic/internal/application/knowledge/document/dto"
	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
	"magic/internal/pkg/projectfile"
)

const projectDirectoryDeleteConcurrency = 4

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
	meta, err := s.support.loadProjectFileChangeMeta(ctx, input)
	if err != nil {
		return err
	}
	if isDeletedProjectDirectory(meta) {
		return s.RunProjectFileChange(ctx, input)
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
	if isDeletedProjectDirectory(meta) {
		return s.handleProjectDirectoryDeleted(ctx, meta)
	}
	return s.handleProjectFileChange(ctx, input.ProjectFileID, meta)
}

func isDeletedProjectDirectory(meta *projectfile.Meta) bool {
	return meta != nil && meta.IsDirectory && projectfile.IsDeletedResolveStatus(meta.Status)
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

func (s *ProjectFileChangeAppService) handleProjectDirectoryDeleted(
	ctx context.Context,
	meta *projectfile.Meta,
) error {
	if s == nil || s.support == nil || meta == nil || meta.ProjectFileID <= 0 || meta.ProjectID <= 0 {
		return nil
	}
	descendantReader, ok := s.support.projectFileMetadataReader.(documentdomain.ProjectFileDescendantReader)
	if !ok {
		return errProjectFileDescendantReaderRequired
	}
	descendants, err := descendantReader.ListDescendants(ctx, meta.ProjectID, meta.ProjectFileID)
	if err != nil {
		return fmt.Errorf("list project directory descendants: %w", err)
	}
	fileIDs := documentdomain.ProjectDirectoryDeleteFileIDs(descendants)
	if len(fileIDs) == 0 {
		return nil
	}

	bindings, err := s.support.listRealtimeProjectBindings(ctx, meta.OrganizationCode, meta.ProjectID)
	if err != nil {
		return err
	}
	if len(bindings) == 0 {
		return nil
	}
	ancestorRefs, err := s.support.loadProjectFileAncestorFolderRefs(ctx, meta)
	if err != nil {
		return err
	}
	bindingRefs := documentdomain.FilterProjectDirectoryDeleteBindingRefs(
		buildProjectFileBindingRefs(bindings),
		meta.ProjectFileID,
		ancestorRefs,
		descendants,
	)
	if len(bindingRefs) == 0 {
		return nil
	}
	enabledCodes, err := s.support.enabledKnowledgeBaseCodeSet(
		ctx,
		meta.OrganizationCode,
		documentdomain.CollectProjectFileKnowledgeBaseCodes(bindingRefs, nil),
	)
	if err != nil {
		return err
	}
	bindingRefs = filterProjectFileBindingRefsByEnabledKnowledgeBases(bindingRefs, enabledCodes)
	if len(bindingRefs) == 0 {
		return nil
	}

	docs, err := s.support.listRealtimeProjectFileDocumentsBySourceBindings(
		ctx,
		meta.OrganizationCode,
		fileIDs,
		collectProjectFileBindingIDs(bindingRefs),
	)
	if err != nil {
		return err
	}
	docs = filterDocumentsByEnabledKnowledgeBases(docs, enabledCodes)
	if len(docs) == 0 {
		return nil
	}

	if s.support.logger != nil {
		s.support.logger.InfoContext(
			ctx,
			"Destroy project directory descendant documents",
			"organization_code", meta.OrganizationCode,
			"project_id", meta.ProjectID,
			"project_file_id", meta.ProjectFileID,
			"revectorize_source", documentdomain.RevectorizeSourceProjectFileNotify,
			"target_scope", "project_directory_deleted",
			"descendant_file_count", len(fileIDs),
			"target_count", len(docs),
		)
	}
	return s.destroyDocumentsConcurrently(ctx, docs, projectDirectoryDeleteConcurrency)
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

func (s *ProjectFileChangeAppService) destroyDocumentsConcurrently(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
	concurrency int,
) error {
	docs = dedupeDocumentsForDestroy(docs)
	if len(docs) == 0 {
		return nil
	}
	if concurrency <= 1 || len(docs) == 1 {
		return s.destroyDocuments(ctx, docs)
	}

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	errs := make([]error, 0)
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		sem <- struct{}{}
		wg.Add(1)
		go func(doc *docentity.KnowledgeBaseDocument) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := s.support.destroyDocument(ctx, doc); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("destroy project document %s: %w", doc.Code, err))
				mu.Unlock()
			}
		}(doc)
	}
	wg.Wait()
	return errors.Join(errs...)
}

func dedupeDocumentsForDestroy(docs []*docentity.KnowledgeBaseDocument) []*docentity.KnowledgeBaseDocument {
	result := make([]*docentity.KnowledgeBaseDocument, 0, len(docs))
	seen := make(map[int64]struct{}, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if doc.ID > 0 {
			if _, exists := seen[doc.ID]; exists {
				continue
			}
			seen[doc.ID] = struct{}{}
		}
		result = append(result, doc)
	}
	return result
}

func collectProjectFileBindingIDs(bindings []documentdomain.ProjectFileBindingRef) []int64 {
	ids := make([]int64, 0, len(bindings))
	seen := make(map[int64]struct{}, len(bindings))
	for _, binding := range bindings {
		if binding.ID <= 0 {
			continue
		}
		if _, exists := seen[binding.ID]; exists {
			continue
		}
		seen[binding.ID] = struct{}{}
		ids = append(ids, binding.ID)
	}
	return ids
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
