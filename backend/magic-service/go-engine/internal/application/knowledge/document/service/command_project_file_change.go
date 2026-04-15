package docapp

import (
	"context"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	texthelper "magic/internal/application/knowledge/helper/text"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/projectfile"
)

// ProjectFileChangeAppService 负责项目文件变更命令流。
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

	meta, err := s.support.loadProjectFileChangeMeta(ctx, input.ProjectFileID)
	if err != nil || meta == nil {
		return err
	}
	return s.handleProjectFileChange(ctx, input.ProjectFileID, meta)
}

func (s *ProjectFileChangeAppService) handleProjectFileChange(
	ctx context.Context,
	projectFileID int64,
	meta *projectfile.Meta,
) error {
	bindings, err := s.support.listRealtimeProjectBindings(ctx, meta.OrganizationCode, meta.ProjectID)
	if err != nil {
		return err
	}
	docs, err := s.support.listProjectFileDocumentsInOrg(ctx, meta.OrganizationCode, meta.ProjectFileID)
	if err != nil {
		return err
	}
	if len(bindings) == 0 && len(docs) == 0 {
		return nil
	}

	bindingRefs := buildProjectFileBindingRefs(bindings)
	enterpriseMap, err := s.support.resolveKnowledgeBaseEnterpriseMap(
		ctx,
		documentdomain.CollectProjectFileKnowledgeBaseCodes(bindingRefs, docs),
	)
	if err != nil {
		return err
	}

	plan := documentdomain.BuildProjectFileChangePlan(meta, bindingRefs, docs, enterpriseMap)
	if err := s.destroyDocuments(ctx, plan.DeleteDocuments); err != nil {
		return err
	}
	if plan.Ignore || len(plan.DeleteDocuments) > 0 {
		return nil
	}

	if err := s.executeGroup(ctx, plan.Standard, documentdomain.ProjectFileChangeSource{
		Resolved: documentdomain.ProjectFileMetaToResolved(meta),
	}); err != nil {
		return err
	}

	enterpriseSource, err := s.resolveEnterpriseSource(ctx, projectFileID, plan.NeedEnterpriseResolution)
	if err != nil {
		return err
	}
	return s.executeGroup(ctx, plan.Enterprise, enterpriseSource)
}

func (s *ProjectFileChangeAppService) destroyDocuments(
	ctx context.Context,
	docs []*documentdomain.KnowledgeBaseDocument,
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
	resolved, override, err := s.support.resolveProjectFileSourceOverride(ctx, projectFileID)
	if err != nil {
		return documentdomain.ProjectFileChangeSource{}, err
	}
	return documentdomain.ProjectFileChangeSource{
		Resolved: resolved,
		Override: override,
	}, nil
}

func (s *ProjectFileChangeAppService) executeGroup(
	ctx context.Context,
	group documentdomain.ProjectFileChangeActionGroup,
	source documentdomain.ProjectFileChangeSource,
) error {
	for _, request := range group.ResyncRequests {
		if request == nil {
			continue
		}
		s.support.ScheduleSync(ctx, cloneProjectFileSyncRequestForApp(request, source.Override))
	}

	for _, target := range group.CreateTargets {
		documentCode, err := s.createManagedDocument(ctx, target, source.Resolved, source.Override)
		if err != nil {
			return err
		}
		if documentCode == "" {
			return documentdomain.ErrProjectFileChangeLifecycleDocumentCodeRequired
		}
		s.support.ScheduleSync(ctx, buildProjectFileCreateSyncRequestForApp(target, documentCode, source.Override))
	}
	return nil
}

func (s *ProjectFileChangeAppService) createManagedDocument(
	ctx context.Context,
	target documentdomain.ProjectFileCreateTarget,
	resolved *projectfile.ResolveResult,
	override *documentdomain.SourceOverride,
) (string, error) {
	sourceItem, err := s.support.upsertRealtimeProjectSourceItem(ctx, target, resolved, override)
	if err != nil {
		return "", err
	}
	documentDTO, err := s.support.createManagedDocument(ctx, &documentdomain.CreateManagedDocumentInput{
		OrganizationCode:  strings.TrimSpace(target.OrganizationCode),
		UserID:            strings.TrimSpace(target.UserID),
		KnowledgeBaseCode: strings.TrimSpace(target.KnowledgeBaseCode),
		SourceBindingID:   target.BindingID,
		SourceItemID:      sourceItem.ID,
		ProjectID:         target.ProjectID,
		ProjectFileID:     target.ProjectFileID,
		AutoAdded:         target.AutoAdded,
		Name:              strings.TrimSpace(target.DocumentName),
		DocumentFile:      documentdomain.BuildProjectDocumentFileFromResolved(resolved, override),
		AutoSync:          false,
	})
	if err != nil {
		return "", fmt.Errorf("auto create realtime project document: %w", err)
	}
	return documentDTO.Code, nil
}

func cloneProjectFileSyncRequestForApp(
	input *documentdomain.SyncDocumentInput,
	override *documentdomain.SourceOverride,
) *documentdomain.SyncDocumentInput {
	if input == nil {
		return nil
	}
	cloned := *input
	cloned.SourceOverride = documentdomain.CloneProjectSourceOverride(override)
	return &cloned
}

func buildProjectFileCreateSyncRequestForApp(
	target documentdomain.ProjectFileCreateTarget,
	documentCode string,
	override *documentdomain.SourceOverride,
) *documentdomain.SyncDocumentInput {
	return &documentdomain.SyncDocumentInput{
		OrganizationCode:  target.OrganizationCode,
		KnowledgeBaseCode: target.KnowledgeBaseCode,
		Code:              documentCode,
		Mode:              documentdomain.SyncModeCreate,
		Async:             true,
		BusinessParams:    texthelper.BuildCreateBusinessParams(target.OrganizationCode, target.UserID, target.KnowledgeBaseCode),
		SourceOverride:    documentdomain.CloneProjectSourceOverride(override),
	}
}
