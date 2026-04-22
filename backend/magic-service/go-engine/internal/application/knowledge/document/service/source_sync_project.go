package docapp

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	documentdomain "magic/internal/domain/knowledge/document/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
)

var errDocumentSourceBindingRepositoryRequired = errors.New("source binding repository is required")

func (s *DocumentAppService) listRealtimeProjectBindings(
	ctx context.Context,
	organizationCode string,
	projectID int64,
) ([]sourcebindingdomain.Binding, error) {
	if s == nil || s.sourceBindingRepo == nil || projectID <= 0 {
		return nil, nil
	}
	bindings, err := s.sourceBindingRepo.ListRealtimeProjectBindingsByProject(ctx, organizationCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list realtime project bindings: %w", err)
	}
	return bindings, nil
}

// NotifyProjectFileChange 按项目文件变更通知调度文档重同步。
func (s *DocumentAppService) NotifyProjectFileChange(ctx context.Context, input *docdto.NotifyProjectFileChangeInput) error {
	return NewProjectFileChangeAppService(s).NotifyProjectFileChange(ctx, input)
}

func (s *DocumentAppService) listProjectFileDocumentsInOrg(
	ctx context.Context,
	organizationCode string,
	projectFileID int64,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	if s == nil || s.domainService == nil || projectFileID <= 0 || strings.TrimSpace(organizationCode) == "" {
		return nil, nil
	}
	docs, err := s.domainService.ListByProjectFileInOrg(ctx, organizationCode, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("list project documents in org: %w", err)
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
	itemToUpsert, err := sourcebindingdomain.BuildProjectSourceItem(sourcebindingdomain.ProjectSourceItemInput{
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
	projectFileID int64,
) (meta *projectfile.Meta, err error) {
	meta, err = documentdomain.LoadProjectFileMeta(ctx, s.projectFileMetadataReader, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("load project file change meta: %w", err)
	}
	if meta == nil || meta.ProjectFileID <= 0 || strings.TrimSpace(meta.OrganizationCode) == "" {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, nil
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
