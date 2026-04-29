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
	documentdomain "magic/internal/domain/knowledge/document/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
)

var (
	errDocumentSourceBindingRepositoryRequired = errors.New("source binding repository is required")
	errProjectFileAncestorReaderRequired       = errors.New("project file ancestor reader is required")
)

type projectFileAncestorReader interface {
	ListAncestorFolderIDs(ctx context.Context, projectFileID int64) ([]int64, error)
}

func (s *DocumentAppService) listRealtimeProjectBindings(
	ctx context.Context,
	organizationCode string,
	projectID int64,
) ([]sourcebindingdomain.Binding, error) {
	if s == nil || s.sourceBindingRepo == nil || projectID <= 0 {
		return nil, nil
	}
	if s.sourceBindingCache != nil {
		bindings, hit, err := s.sourceBindingCache.GetProjectBindings(ctx, organizationCode, projectID)
		if err != nil {
			s.logSourceBindingCacheWarning(ctx, "Read realtime project source bindings cache failed", err,
				"organization_code", organizationCode,
				"project_id", projectID,
			)
		} else if hit {
			return bindings, nil
		}
	}
	bindings, err := s.sourceBindingRepo.ListRealtimeProjectBindingsByProject(ctx, organizationCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list realtime project bindings: %w", err)
	}
	if s.sourceBindingCache != nil {
		if cacheErr := s.sourceBindingCache.SetProjectBindings(ctx, organizationCode, projectID, bindings); cacheErr != nil {
			s.logSourceBindingCacheWarning(ctx, "Write realtime project source bindings cache failed", cacheErr,
				"organization_code", organizationCode,
				"project_id", projectID,
			)
		}
	}
	return bindings, nil
}

func (s *DocumentAppService) listRealtimeTeamshareBindings(
	ctx context.Context,
	organizationCode string,
	platform string,
	knowledgeBaseID string,
) ([]sourcebindingdomain.Binding, error) {
	if s == nil || s.sourceBindingRepo == nil || strings.TrimSpace(knowledgeBaseID) == "" {
		return nil, nil
	}
	if s.sourceBindingCache != nil {
		bindings, hit, err := s.sourceBindingCache.GetTeamshareBindings(ctx, organizationCode, platform, knowledgeBaseID)
		if err != nil {
			s.logSourceBindingCacheWarning(ctx, "Read realtime teamshare source bindings cache failed", err,
				"organization_code", organizationCode,
				"platform", platform,
				"knowledge_base_id", knowledgeBaseID,
			)
		} else if hit {
			return bindings, nil
		}
	}
	bindings, err := s.sourceBindingRepo.ListRealtimeTeamshareBindingsByKnowledgeBase(ctx, organizationCode, platform, knowledgeBaseID)
	if err != nil {
		return nil, fmt.Errorf("list realtime teamshare bindings: %w", err)
	}
	if s.sourceBindingCache != nil {
		if cacheErr := s.sourceBindingCache.SetTeamshareBindings(ctx, organizationCode, platform, knowledgeBaseID, bindings); cacheErr != nil {
			s.logSourceBindingCacheWarning(ctx, "Write realtime teamshare source bindings cache failed", cacheErr,
				"organization_code", organizationCode,
				"platform", platform,
				"knowledge_base_id", knowledgeBaseID,
			)
		}
	}
	return bindings, nil
}

// NotifyProjectFileChange 按项目文件变更通知调度文档重同步。
func (s *DocumentAppService) NotifyProjectFileChange(ctx context.Context, input *docdto.NotifyProjectFileChangeInput) error {
	return NewProjectFileChangeAppService(s).NotifyProjectFileChange(ctx, input)
}

// RunProjectFileChange 执行一次项目文件变更 fan-out。
func (s *DocumentAppService) RunProjectFileChange(ctx context.Context, input *docdto.NotifyProjectFileChangeInput) error {
	return NewProjectFileChangeAppService(s).RunProjectFileChange(ctx, input)
}

func (s *DocumentAppService) listProjectFileDocumentsInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*docentity.KnowledgeBaseDocument, error) {
	if s == nil || s.domainService == nil || projectFileID <= 0 || strings.TrimSpace(organizationCode) == "" {
		return nil, nil
	}
	docs, err := s.domainService.ListRealtimeByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("list realtime project documents in org: %w", err)
	}
	return docs, nil
}

func (s *DocumentAppService) upsertRealtimeProjectSourceItem(
	ctx context.Context,
	target documentdomain.ProjectFileCreateTarget,
	resolved *projectfile.ResolveResult,
	override *documentdomain.SourceOverride,
) (*sourcebindingdomain.SourceItem, error) {
	if s == nil || s.sourceBindingRepo == nil {
		return nil, errDocumentSourceBindingRepositoryRequired
	}
	itemToUpsert, err := sourcebindingservice.BuildProjectSourceItem(sourcebindingservice.ProjectSourceItemInput{
		OrganizationCode:    target.OrganizationCode,
		RootRef:             target.RootRef,
		Resolved:            resolved,
		SnapshotMeta:        buildProjectSourceSnapshotMeta(resolved, override),
		FallbackContentHash: buildProjectSourceFallbackContentHash(resolved),
		ResolvedAt:          time.Now(),
	})
	if err != nil {
		return nil, fmt.Errorf("build realtime project source item: %w", err)
	}
	item, err := s.sourceBindingRepo.UpsertSourceItem(ctx, itemToUpsert)
	if err != nil {
		return nil, fmt.Errorf("upsert realtime project source item: %w", err)
	}
	return item, nil
}

func (s *DocumentAppService) loadProjectFileChangeMeta(
	ctx context.Context,
	input *docdto.NotifyProjectFileChangeInput,
) (meta *projectfile.Meta, err error) {
	if input == nil || input.ProjectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	meta, err = documentdomain.LoadProjectFileMeta(ctx, s.projectFileMetadataReader, input.ProjectFileID)
	if err != nil {
		return nil, fmt.Errorf("load project file change meta: %w", err)
	}
	meta = mergeProjectFileChangeInputMeta(meta, input)
	if meta == nil || meta.ProjectFileID <= 0 || strings.TrimSpace(meta.OrganizationCode) == "" {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, nil
}

func mergeProjectFileChangeInputMeta(meta *projectfile.Meta, input *docdto.NotifyProjectFileChangeInput) *projectfile.Meta {
	if input == nil {
		return meta
	}
	status := projectfile.NormalizeResolveStatus(input.Status)
	if status != projectfile.ResolveStatusDeleted {
		return meta
	}
	if meta == nil {
		meta = &projectfile.Meta{}
	} else {
		cloned := *meta
		meta = &cloned
	}
	meta.Status = projectfile.ResolveStatusDeleted
	meta.ProjectFileID = input.ProjectFileID
	if organizationCode := strings.TrimSpace(input.OrganizationCode); organizationCode != "" {
		meta.OrganizationCode = organizationCode
	}
	if input.ProjectID > 0 {
		meta.ProjectID = input.ProjectID
	}
	return meta
}

func (s *DocumentAppService) loadProjectFileAncestorFolderRefs(
	ctx context.Context,
	meta *projectfile.Meta,
) ([]string, error) {
	if s == nil || meta == nil || meta.ProjectFileID <= 0 || s.projectFileMetadataReader == nil {
		return nil, nil
	}
	if meta.ParentID <= 0 {
		return nil, nil
	}
	if reader, ok := s.projectFileMetadataReader.(projectFileAncestorReader); ok {
		ids, err := reader.ListAncestorFolderIDs(ctx, meta.ProjectFileID)
		if err != nil {
			return nil, fmt.Errorf("list project file ancestor folders: %w", err)
		}
		return sourcebindingservice.Int64Refs(ids), nil
	}
	return nil, errProjectFileAncestorReaderRequired
}

func buildProjectSourceSnapshotMeta(resolved *projectfile.ResolveResult, override *documentdomain.SourceOverride) map[string]any {
	switch {
	case override != nil && len(override.DocumentFile) > 0:
		return cloneProjectSourceSnapshotMeta(override.DocumentFile)
	case resolved != nil && len(resolved.DocumentFile) > 0:
		return cloneProjectSourceSnapshotMeta(resolved.DocumentFile)
	default:
		return map[string]any{}
	}
}

func cloneProjectSourceSnapshotMeta(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func buildProjectSourceFallbackContentHash(resolved *projectfile.ResolveResult) string {
	if resolved == nil {
		return ""
	}
	return projectfile.BuildMetaContentHash(&projectfile.Meta{
		Status:           strings.TrimSpace(resolved.Status),
		OrganizationCode: strings.TrimSpace(resolved.OrganizationCode),
		ProjectID:        resolved.ProjectID,
		ProjectFileID:    resolved.ProjectFileID,
		FileKey:          strings.TrimSpace(resolved.FileKey),
		RelativeFilePath: strings.TrimSpace(resolved.RelativeFilePath),
		FileName:         strings.TrimSpace(resolved.FileName),
		FileExtension:    strings.TrimSpace(resolved.FileExtension),
		IsDirectory:      resolved.IsDirectory,
		UpdatedAt:        strings.TrimSpace(resolved.UpdatedAt),
	})
}

func (s *DocumentAppService) logSourceBindingCacheWarning(ctx context.Context, message string, err error, fields ...any) {
	if s == nil || s.logger == nil || err == nil {
		return
	}
	fields = append(fields, "error", err)
	s.logger.WarnContext(ctx, message, fields...)
}
