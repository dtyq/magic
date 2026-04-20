package kbapp

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

const (
	sourceBindingNodeTypeWorkspace     = "workspace"
	sourceBindingNodeTypeProject       = "project"
	sourceBindingNodeTypeKnowledgeBase = "knowledge_base"
	sourceBindingNodeTypeFolder        = "folder"
	sourceBindingNodeTypeFile          = "file"

	sourceBindingParentTypeRoot          = "root"
	sourceBindingParentTypeWorkspace     = "workspace"
	sourceBindingParentTypeProject       = "project"
	sourceBindingParentTypeKnowledgeBase = "knowledge_base"
	sourceBindingParentTypeFolder        = "folder"

	sourceBindingQuerySourceTypeProject    = "project"
	sourceBindingQuerySourceTypeEnterprise = "enterprise_knowledge_base"

	sourceBindingNodesDefaultLimit = 20
	sourceBindingNodesMaxLimit     = 100
)

// ListSourceBindingNodes 查询来源绑定选择器节点。
func (s *SourceBindingNodesApp) ListSourceBindingNodes(
	ctx context.Context,
	input *kbdto.ListSourceBindingNodesInput,
) (*kbdto.ListSourceBindingNodesResult, error) {
	if input == nil {
		return nil, ErrInvalidSourceBindingNodesSourceType
	}

	sourceType := strings.ToLower(strings.TrimSpace(input.SourceType))
	provider := strings.ToLower(strings.TrimSpace(input.Provider))
	parentType := strings.ToLower(strings.TrimSpace(input.ParentType))
	parentRef := strings.TrimSpace(input.ParentRef)

	switch sourceType {
	case sourceBindingQuerySourceTypeProject:
		return s.listProjectSourceBindingNodes(ctx, input, parentType, parentRef)
	case sourceBindingQuerySourceTypeEnterprise:
		if provider != sourcebindingdomain.ProviderTeamshare {
			return nil, fmt.Errorf("%w: %s", ErrInvalidSourceBindingNodesProvider, input.Provider)
		}
		return s.listEnterpriseSourceBindingNodes(
			ctx,
			input.OrganizationCode,
			input.UserID,
			parentType,
			parentRef,
		)
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidSourceBindingNodesSourceType, input.SourceType)
	}
}

func (s *SourceBindingNodesApp) listProjectSourceBindingNodes(
	ctx context.Context,
	input *kbdto.ListSourceBindingNodesInput,
	parentType string,
	parentRef string,
) (*kbdto.ListSourceBindingNodesResult, error) {
	offset, limit := normalizeSourceBindingNodesWindow(input.Offset, input.Limit)

	switch parentType {
	case sourceBindingParentTypeRoot:
		if s.projectFilePort == nil {
			return nil, ErrKnowledgeBaseProjectFileResolverRequired
		}
		page, err := s.projectFilePort.ListWorkspaces(ctx, input.OrganizationCode, input.UserID, offset, limit)
		if err != nil {
			return nil, fmt.Errorf("list workspaces: %w", err)
		}
		if page == nil {
			return &kbdto.ListSourceBindingNodesResult{
				Total: 0,
				List:  []kbdto.SourceBindingNode{},
			}, nil
		}
		return &kbdto.ListSourceBindingNodesResult{
			Total: page.Total,
			List:  buildWorkspaceNodes(page.List),
		}, nil
	case sourceBindingParentTypeWorkspace:
		if s.projectFilePort == nil {
			return nil, ErrKnowledgeBaseProjectFileResolverRequired
		}
		workspaceID, err := parsePositiveInt64ParentRef(parentRef)
		if err != nil {
			return nil, err
		}
		page, err := s.projectFilePort.ListProjects(ctx, input.OrganizationCode, input.UserID, workspaceID, offset, limit)
		if err != nil {
			return nil, fmt.Errorf("list projects: %w", err)
		}
		if page == nil {
			return &kbdto.ListSourceBindingNodesResult{
				Total: 0,
				List:  []kbdto.SourceBindingNode{},
			}, nil
		}
		return &kbdto.ListSourceBindingNodesResult{
			Total: page.Total,
			List:  buildProjectNodes(page.List),
		}, nil
	case sourceBindingParentTypeProject, sourceBindingParentTypeFolder:
		if s.taskFileService == nil {
			return nil, ErrKnowledgeBaseTaskFileDomainRequired
		}
		parentID, err := parsePositiveInt64ParentRef(parentRef)
		if err != nil {
			return nil, err
		}
		var (
			items   []projectfile.TreeNode
			listErr error
		)
		if parentType == sourceBindingParentTypeProject {
			items, listErr = s.taskFileService.ListVisibleTreeNodesByProject(ctx, parentID)
		} else {
			items, listErr = s.taskFileService.ListVisibleTreeNodesByFolder(ctx, parentID)
		}
		if listErr != nil {
			return nil, fmt.Errorf("list visible project tree nodes: %w", listErr)
		}
		nodes := buildProjectTreeNodes(items)
		return &kbdto.ListSourceBindingNodesResult{
			Total: int64(len(nodes)),
			List:  nodes,
		}, nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidSourceBindingNodesParentType, parentType)
	}
}

func (s *SourceBindingNodesApp) listEnterpriseSourceBindingNodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	parentType string,
	parentRef string,
) (*kbdto.ListSourceBindingNodesResult, error) {
	if s.thirdPlatformExpander == nil {
		return nil, ErrKnowledgeBaseThirdPlatformExpanderRequired
	}

	switch parentType {
	case sourceBindingParentTypeRoot:
		items, err := s.thirdPlatformExpander.ListKnowledgeBases(ctx, organizationCode, userID)
		if err != nil {
			return nil, fmt.Errorf("list enterprise knowledge bases: %w", err)
		}
		nodes := buildEnterpriseKnowledgeBaseNodes(items)
		return &kbdto.ListSourceBindingNodesResult{
			Total: int64(len(nodes)),
			List:  nodes,
		}, nil
	case sourceBindingParentTypeKnowledgeBase, sourceBindingParentTypeFolder:
		if parentRef == "" {
			return nil, ErrSourceBindingNodesParentRefRequired
		}
		items, err := s.thirdPlatformExpander.ListTreeNodes(ctx, organizationCode, userID, parentType, parentRef)
		if err != nil {
			return nil, fmt.Errorf("list enterprise tree nodes: %w", err)
		}
		nodes := buildEnterpriseTreeNodes(items)
		return &kbdto.ListSourceBindingNodesResult{
			Total: int64(len(nodes)),
			List:  nodes,
		}, nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidSourceBindingNodesParentType, parentType)
	}
}

func parsePositiveInt64ParentRef(parentRef string) (int64, error) {
	trimmed := strings.TrimSpace(parentRef)
	if trimmed == "" {
		return 0, ErrSourceBindingNodesParentRefRequired
	}
	value, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%w: %s", ErrSourceBindingNodesParentRefRequired, parentRef)
	}
	return value, nil
}

func normalizeSourceBindingNodesWindow(offset, limit int) (int, int) {
	if offset < 0 {
		offset = 0
	}
	switch {
	case limit <= 0:
		limit = sourceBindingNodesDefaultLimit
	case limit > sourceBindingNodesMaxLimit:
		limit = sourceBindingNodesMaxLimit
	}
	return offset, limit
}

func buildWorkspaceNodes(items []projectfile.WorkspaceItem) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    sourceBindingNodeTypeWorkspace,
			NodeRef:     strconv.FormatInt(item.WorkspaceID, 10),
			Name:        strings.TrimSpace(item.WorkspaceName),
			Description: strings.TrimSpace(item.Description),
			HasChildren: true,
			Selectable:  false,
			Meta: map[string]any{
				"workspace_id": item.WorkspaceID,
			},
		})
	}
	return nodes
}

func buildProjectNodes(items []projectfile.ProjectItem) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    sourceBindingNodeTypeProject,
			NodeRef:     strconv.FormatInt(item.ProjectID, 10),
			Name:        strings.TrimSpace(item.ProjectName),
			Description: strings.TrimSpace(item.Description),
			HasChildren: true,
			Selectable:  true,
			Meta: map[string]any{
				"workspace_id": item.WorkspaceID,
				"project_id":   item.ProjectID,
			},
		})
	}
	return nodes
}

func buildProjectTreeNodes(items []projectfile.TreeNode) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		nodeType := sourceBindingNodeTypeFile
		if item.IsDirectory {
			nodeType = sourceBindingNodeTypeFolder
		}
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    nodeType,
			NodeRef:     strconv.FormatInt(item.ProjectFileID, 10),
			Name:        strings.TrimSpace(item.FileName),
			Description: strings.TrimSpace(item.RelativeFilePath),
			HasChildren: item.IsDirectory,
			Selectable:  true,
			Meta: map[string]any{
				"project_id":         item.ProjectID,
				"project_file_id":    item.ProjectFileID,
				"parent_id":          item.ParentID,
				"relative_file_path": item.RelativeFilePath,
				"file_extension":     item.FileExtension,
			},
		})
	}
	return nodes
}

func buildEnterpriseKnowledgeBaseNodes(items []thirdplatform.KnowledgeBaseItem) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    sourceBindingNodeTypeKnowledgeBase,
			NodeRef:     strings.TrimSpace(item.KnowledgeBaseID),
			Name:        strings.TrimSpace(item.Name),
			Description: strings.TrimSpace(item.Description),
			HasChildren: true,
			Selectable:  true,
			Meta: map[string]any{
				"knowledge_base_id": strings.TrimSpace(item.KnowledgeBaseID),
			},
		})
	}
	return nodes
}

func buildEnterpriseTreeNodes(items []thirdplatform.TreeNode) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		nodeType := sourceBindingNodeTypeFile
		if item.IsDirectory {
			nodeType = sourceBindingNodeTypeFolder
		}
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    nodeType,
			NodeRef:     strings.TrimSpace(item.ThirdFileID),
			Name:        strings.TrimSpace(item.Name),
			Description: strings.TrimSpace(item.Extension),
			HasChildren: item.IsDirectory,
			Selectable:  true,
			Meta: map[string]any{
				"knowledge_base_id": strings.TrimSpace(item.KnowledgeBaseID),
				"parent_id":         strings.TrimSpace(item.ParentID),
				"file_type":         strings.TrimSpace(item.FileType),
				"extension":         strings.TrimSpace(item.Extension),
			},
		})
	}
	return nodes
}
