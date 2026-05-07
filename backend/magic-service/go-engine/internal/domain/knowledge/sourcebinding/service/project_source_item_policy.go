package sourcebinding

import (
	"errors"
	"maps"
	"strings"
	"time"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	"magic/internal/pkg/projectfile"
)

var errProjectFileResolveResultRequired = errors.New("project file resolve result is required")

// ProjectSourceItemInput 描述项目文件来源项构造所需的最小输入。
type ProjectSourceItemInput struct {
	OrganizationCode    string
	RootRef             string
	Resolved            *projectfile.ResolveResult
	SnapshotMeta        map[string]any
	FallbackContentHash string
	ResolvedAt          time.Time
}

// BuildProjectSourceItem 基于项目文件解析结果构造来源项。
func BuildProjectSourceItem(input ProjectSourceItemInput) (sourcebindingentity.SourceItem, error) {
	if input.Resolved == nil {
		return sourcebindingentity.SourceItem{}, errProjectFileResolveResultRequired
	}
	resolvedAt := input.ResolvedAt
	if resolvedAt.IsZero() {
		resolvedAt = time.Now()
	}
	return sourcebindingentity.SourceItem{
		OrganizationCode: strings.TrimSpace(input.OrganizationCode),
		Provider:         sourcebindingentity.ProviderProject,
		RootType:         sourcebindingentity.RootTypeProject,
		RootRef:          strings.TrimSpace(input.RootRef),
		ItemType:         sourcebindingentity.RootTypeFile,
		ItemRef:          FormatProjectFileRef(input.Resolved.ProjectFileID),
		DisplayName:      strings.TrimSpace(ResolveProjectFileDocumentName(input.Resolved)),
		Extension:        strings.TrimSpace(input.Resolved.FileExtension),
		ContentHash: strings.TrimSpace(firstNonEmptyProjectSourceValue(
			input.Resolved.ContentHash,
			input.FallbackContentHash,
		)),
		SnapshotMeta:   cloneSourceSnapshotMeta(input.SnapshotMeta),
		LastResolvedAt: &resolvedAt,
	}, nil
}

func cloneSourceSnapshotMeta(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func firstNonEmptyProjectSourceValue(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
