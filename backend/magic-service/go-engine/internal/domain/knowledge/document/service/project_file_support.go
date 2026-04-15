package document

import (
	"context"
	"fmt"
	"strings"
	"time"

	"magic/internal/pkg/projectfile"
)

// ProjectFileResolver 定义项目文件解析能力。
type ProjectFileResolver interface {
	Resolve(ctx context.Context, projectFileID int64) (*projectfile.ResolveResult, error)
	ListByProject(ctx context.Context, projectID int64) ([]projectfile.ListItem, error)
}

// ProjectFileMetadataReader 定义项目文件元数据读取能力。
type ProjectFileMetadataReader interface {
	FindByID(ctx context.Context, projectFileID int64) (*projectfile.Meta, error)
}

// ProjectFileContentAccessor 定义项目文件内容访问能力。
type ProjectFileContentAccessor interface {
	GetLink(ctx context.Context, projectFileID int64, expire time.Duration) (string, error)
}

// LoadProjectFileMeta 加载项目文件元数据；记录不存在时返回 deleted 占位。
func LoadProjectFileMeta(
	ctx context.Context,
	reader ProjectFileMetadataReader,
	projectFileID int64,
) (meta *projectfile.Meta, err error) {
	if reader == nil || projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	meta, err = reader.FindByID(ctx, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("find project file meta: %w", err)
	}
	if meta != nil {
		return meta, nil
	}
	return &projectfile.Meta{
		Status:        "deleted",
		ProjectFileID: projectFileID,
	}, nil
}

// ResolveProjectFileSourceOverride 读取项目文件解析结果并构造源覆盖。
func ResolveProjectFileSourceOverride(
	ctx context.Context,
	resolver ProjectFileResolver,
	projectFileID int64,
	now time.Time,
) (resolved *projectfile.ResolveResult, override *SourceOverride, err error) {
	if resolver == nil || projectFileID <= 0 {
		var zeroResolved *projectfile.ResolveResult
		var zeroOverride *SourceOverride
		return zeroResolved, zeroOverride, nil
	}
	resolved, err = resolver.Resolve(ctx, projectFileID)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve project file: %w", err)
	}
	return resolved, BuildProjectResolvedSourcePlan(resolved, now).SourceOverride, nil
}

// ResolveProjectFileContentLink 获取项目文件可访问链接。
func ResolveProjectFileContentLink(
	ctx context.Context,
	accessor ProjectFileContentAccessor,
	projectFileID int64,
	expire time.Duration,
) (string, error) {
	if accessor == nil || projectFileID <= 0 {
		return "", nil
	}
	link, err := accessor.GetLink(ctx, projectFileID, expire)
	if err != nil {
		return "", fmt.Errorf("get project file link: %w", err)
	}
	return strings.TrimSpace(link), nil
}

// ProjectFileMetaToResolved 将项目文件轻量元数据映射为稳定解析结果。
func ProjectFileMetaToResolved(meta *projectfile.Meta) *projectfile.ResolveResult {
	if meta == nil {
		return nil
	}
	return &projectfile.ResolveResult{
		Status:           strings.TrimSpace(meta.Status),
		OrganizationCode: strings.TrimSpace(meta.OrganizationCode),
		ProjectID:        meta.ProjectID,
		ProjectFileID:    meta.ProjectFileID,
		FileKey:          strings.TrimSpace(meta.FileKey),
		RelativeFilePath: strings.TrimSpace(meta.RelativeFilePath),
		FileName:         strings.TrimSpace(meta.FileName),
		FileExtension:    strings.TrimSpace(meta.FileExtension),
		IsDirectory:      meta.IsDirectory,
		UpdatedAt:        strings.TrimSpace(meta.UpdatedAt),
		ContentHash:      projectfile.BuildMetaContentHash(meta),
		DocType:          projectfile.ResolveDocType(meta.FileExtension),
		DocumentFile:     BuildProjectDocumentFilePayload(meta),
	}
}

// BuildProjectDocumentFilePayload 基于项目文件元数据构造稳定 document_file。
func BuildProjectDocumentFilePayload(meta *projectfile.Meta) map[string]any {
	if meta == nil {
		return map[string]any{}
	}
	return map[string]any{
		"type":               "project_file",
		"name":               strings.TrimSpace(meta.FileName),
		"url":                "",
		"size":               meta.FileSize,
		"extension":          strings.TrimSpace(meta.FileExtension),
		"source_type":        "project",
		"project_id":         meta.ProjectID,
		"project_file_id":    meta.ProjectFileID,
		"file_key":           strings.TrimSpace(meta.FileKey),
		"relative_file_path": strings.TrimSpace(meta.RelativeFilePath),
	}
}

// BuildProjectDocumentFileFromResolved 根据解析结果或源覆盖构造文档文件。
func BuildProjectDocumentFileFromResolved(resolved *projectfile.ResolveResult, override *SourceOverride) *File {
	filePayload := map[string]any{}
	switch {
	case override != nil && len(override.DocumentFile) > 0:
		filePayload = override.DocumentFile
	case resolved != nil && len(resolved.DocumentFile) > 0:
		filePayload = resolved.DocumentFile
	}
	file, _ := FileFromPayload(filePayload)
	return file
}
