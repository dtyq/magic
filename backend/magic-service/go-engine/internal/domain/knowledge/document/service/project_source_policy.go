package document

import (
	"fmt"
	"strings"
	"time"

	"magic/internal/pkg/projectfile"
)

const (
	projectFileResolveSource = "project_file_resolve"
	projectFileStatusDeleted = "deleted"
)

// ProjectResolvedSourcePlan 描述项目文件解析结果对应的稳定源快照计划。
type ProjectResolvedSourcePlan struct {
	CacheKey       string
	SourceOverride *SourceOverride
	Snapshot       *ResolvedSourceSnapshot
}

// BuildProjectResolvedSourcePlan 根据项目文件解析结果构造同步源计划。
func BuildProjectResolvedSourcePlan(
	resolved *projectfile.ResolveResult,
	now time.Time,
) ProjectResolvedSourcePlan {
	if resolved == nil {
		return ProjectResolvedSourcePlan{}
	}
	status := strings.ToLower(strings.TrimSpace(resolved.Status))
	if status == projectFileStatusDeleted || resolved.IsDirectory {
		return ProjectResolvedSourcePlan{}
	}

	snapshot := BuildResolvedSourceSnapshot(SourceSnapshotInput{
		Content:            resolved.Content,
		DocType:            resolved.DocType,
		DocumentFile:       CloneDocumentFilePayload(resolved.DocumentFile),
		Source:             projectFileResolveSource,
		ContentHash:        resolved.ContentHash,
		FetchedAtUnixMilli: now.UnixMilli(),
		Now:                now,
	})
	if snapshot == nil {
		return ProjectResolvedSourcePlan{}
	}

	return ProjectResolvedSourcePlan{
		CacheKey: BuildProjectSourceCacheKey(resolved.OrganizationCode, resolved.ProjectID, resolved.ProjectFileID),
		SourceOverride: &SourceOverride{
			Content:            snapshot.Content,
			DocType:            snapshot.DocType,
			DocumentFile:       CloneDocumentFilePayload(snapshot.DocumentFile),
			Source:             snapshot.Source,
			ContentHash:        snapshot.ContentHash,
			FetchedAtUnixMilli: snapshot.FetchedAtUnixMilli,
		},
		Snapshot: snapshot,
	}
}

// BuildProjectSourceCacheKey 构造项目文件源缓存键。
func BuildProjectSourceCacheKey(organizationCode string, projectID, projectFileID int64) string {
	return strings.Join([]string{
		"project",
		strings.TrimSpace(organizationCode),
		fmt.Sprintf("%d", projectID),
		fmt.Sprintf("%d", projectFileID),
	}, ":")
}
