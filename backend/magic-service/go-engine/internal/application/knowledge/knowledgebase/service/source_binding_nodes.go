package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
	"magic/pkg/convert"
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

var errSourceBindingTreeRootKnowledgeBaseMismatch = errors.New("source binding tree root knowledge base mismatch")

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
		projectIDs := collectProjectIDsFromProjectItems(page.List)
		sharedProjectIDs := s.loadSharedProjectIDsByProjectIDs(ctx, input.OrganizationCode, input.UserID, projectIDs)
		return &kbdto.ListSourceBindingNodesResult{
			Total: page.Total,
			List:  buildProjectNodes(page.List, sharedProjectIDs),
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
		actor := resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID)
		items, err := s.thirdPlatformExpander.ListKnowledgeBases(ctx, thirdplatform.KnowledgeBaseListInput{
			OrganizationCode:              actor.OrganizationCode,
			UserID:                        actor.UserID,
			ThirdPlatformUserID:           actor.ThirdPlatformUserID,
			ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
		})
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
		items, err := s.listDirectEnterpriseTreeNodes(ctx, organizationCode, userID, parentType, parentRef)
		if err != nil {
			return nil, err
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

func (s *SourceBindingNodesApp) listDirectEnterpriseTreeNodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	parentType string,
	parentRef string,
) ([]thirdplatform.TreeNode, error) {
	switch parentType {
	case sourceBindingParentTypeKnowledgeBase:
		index, err := s.loadEnterpriseRootTreeIndex(
			ctx,
			organizationCode,
			userID,
			sourcebindingdomain.ProviderTeamshare,
			parentRef,
		)
		if err != nil {
			return nil, fmt.Errorf("load enterprise knowledge base tree index: %w", err)
		}
		return index.DirectChildren(parentRef), nil
	case sourceBindingParentTypeFolder:
		nodes, err := s.listEnterpriseFolderDirectTreeNodes(
			ctx,
			organizationCode,
			userID,
			sourcebindingdomain.ProviderTeamshare,
			parentRef,
		)
		if err != nil {
			return nil, fmt.Errorf("list enterprise folder direct children: %w", err)
		}
		return nodes, nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidSourceBindingNodesParentType, parentType)
	}
}

func (s *SourceBindingNodesApp) loadEnterpriseRootTreeIndex(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) (*sourcebindingservice.EnterpriseTreeIndex, error) {
	if index, hit, err := s.getCachedEnterpriseRootTreeIndex(ctx, organizationCode, userID, provider, knowledgeBaseID); err != nil {
		s.warnSourceBindingTreeRootCache(
			ctx,
			"Read source binding root cache failed, fallback to live Teamshare query",
			"knowledge_base_id",
			knowledgeBaseID,
			"error",
			err,
		)
	} else if hit {
		return index, nil
	}

	actor := resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID)
	nodes, err := s.thirdPlatformExpander.ListTreeNodes(
		ctx,
		thirdplatform.TreeNodeListInput{
			OrganizationCode:              actor.OrganizationCode,
			UserID:                        actor.UserID,
			ThirdPlatformUserID:           actor.ThirdPlatformUserID,
			ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
			ParentType:                    sourceBindingParentTypeKnowledgeBase,
			ParentRef:                     knowledgeBaseID,
		},
	)
	if err != nil {
		return nil, fmt.Errorf(
			"list enterprise tree nodes %s/%s: %w",
			sourceBindingParentTypeKnowledgeBase,
			knowledgeBaseID,
			err,
		)
	}
	index, err := sourcebindingservice.BuildEnterpriseTreeIndex(nodes)
	if err != nil {
		return nil, fmt.Errorf("build enterprise tree index for knowledge base %s: %w", knowledgeBaseID, err)
	}
	if index.KnowledgeBaseID == "" {
		index.KnowledgeBaseID = knowledgeBaseID
	} else if index.KnowledgeBaseID != knowledgeBaseID {
		return nil, fmt.Errorf(
			"%w: requested=%s, actual=%s",
			errSourceBindingTreeRootKnowledgeBaseMismatch,
			knowledgeBaseID,
			index.KnowledgeBaseID,
		)
	}
	s.rememberEnterpriseTreeRootIndex(organizationCode, userID, provider, index)
	if err := s.setCachedEnterpriseRootTreeIndex(ctx, organizationCode, userID, provider, knowledgeBaseID, index); err != nil {
		s.warnSourceBindingTreeRootCache(
			ctx,
			"Write source binding root cache failed, keep live Teamshare result",
			"knowledge_base_id",
			knowledgeBaseID,
			"error",
			err,
		)
	}
	return index, nil
}

func (s *SourceBindingNodesApp) listEnterpriseFolderDirectTreeNodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) ([]thirdplatform.TreeNode, error) {
	if knowledgeBaseID, ok := s.lookupEnterpriseTreeKnowledgeBaseID(organizationCode, userID, provider, folderRef); ok {
		index, hit, err := s.getCachedEnterpriseRootTreeIndex(ctx, organizationCode, userID, provider, knowledgeBaseID)
		switch {
		case err != nil:
			s.warnSourceBindingTreeRootCache(
				ctx,
				"Read source binding root cache failed during folder expansion, fallback to live Teamshare query",
				"folder_ref",
				folderRef,
				"knowledge_base_id",
				knowledgeBaseID,
				"error",
				err,
			)
		case hit:
			return index.DirectChildren(folderRef), nil
		default:
			s.forgetEnterpriseTreeKnowledgeBaseID(organizationCode, userID, provider, folderRef)
		}
	}

	actor := resolveKnowledgeBaseAccessActor(ctx, organizationCode, userID)
	nodes, err := s.thirdPlatformExpander.ListTreeNodes(
		ctx,
		thirdplatform.TreeNodeListInput{
			OrganizationCode:              actor.OrganizationCode,
			UserID:                        actor.UserID,
			ThirdPlatformUserID:           actor.ThirdPlatformUserID,
			ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
			ParentType:                    sourceBindingParentTypeFolder,
			ParentRef:                     folderRef,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list enterprise tree nodes %s/%s: %w", sourceBindingParentTypeFolder, folderRef, err)
	}
	index, err := sourcebindingservice.BuildEnterpriseTreeIndex(nodes)
	if err != nil {
		return nil, fmt.Errorf("build enterprise tree index for folder %s: %w", folderRef, err)
	}
	if index.KnowledgeBaseID != "" {
		s.rememberEnterpriseTreeRootIndex(organizationCode, userID, provider, index)
	}
	return index.DirectChildren(folderRef), nil
}

func (s *SourceBindingNodesApp) getCachedEnterpriseRootTreeIndex(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) (*sourcebindingservice.EnterpriseTreeIndex, bool, error) {
	if s == nil || s.sourceBindingTreeRootCache == nil {
		return nil, false, nil
	}

	index, hit, err := s.sourceBindingTreeRootCache.Get(ctx, organizationCode, userID, provider, knowledgeBaseID)
	if err != nil {
		return nil, false, fmt.Errorf("get source binding tree root cache: %w", err)
	}
	if !hit || index == nil {
		return nil, false, nil
	}
	s.rememberEnterpriseTreeRootIndex(organizationCode, userID, provider, index)
	return index, true, nil
}

func (s *SourceBindingNodesApp) setCachedEnterpriseRootTreeIndex(
	ctx context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
	index *sourcebindingservice.EnterpriseTreeIndex,
) error {
	if s == nil || s.sourceBindingTreeRootCache == nil || index == nil {
		return nil
	}
	if err := s.sourceBindingTreeRootCache.Set(ctx, organizationCode, userID, provider, knowledgeBaseID, index); err != nil {
		return fmt.Errorf("set source binding tree root cache: %w", err)
	}
	return nil
}

func (s *SourceBindingNodesApp) rememberEnterpriseTreeRootIndex(
	organizationCode string,
	userID string,
	provider string,
	index *sourcebindingservice.EnterpriseTreeIndex,
) {
	if s == nil || index == nil {
		return
	}
	if s.sourceBindingTreeRootLocator == nil {
		s.sourceBindingTreeRootLocator = newSourceBindingTreeRootLocator()
	}
	s.sourceBindingTreeRootLocator.remember(
		organizationCode,
		userID,
		provider,
		index.KnowledgeBaseIDByFolderRef,
	)
}

func (s *SourceBindingNodesApp) lookupEnterpriseTreeKnowledgeBaseID(
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) (string, bool) {
	if s == nil {
		return "", false
	}
	if s.sourceBindingTreeRootLocator == nil {
		s.sourceBindingTreeRootLocator = newSourceBindingTreeRootLocator()
	}
	return s.sourceBindingTreeRootLocator.get(organizationCode, userID, provider, folderRef)
}

func (s *SourceBindingNodesApp) forgetEnterpriseTreeKnowledgeBaseID(
	organizationCode string,
	userID string,
	provider string,
	folderRef string,
) {
	if s == nil {
		return
	}
	if s.sourceBindingTreeRootLocator == nil {
		s.sourceBindingTreeRootLocator = newSourceBindingTreeRootLocator()
	}
	s.sourceBindingTreeRootLocator.forget(organizationCode, userID, provider, folderRef)
}

func (s *SourceBindingNodesApp) warnSourceBindingTreeRootCache(
	ctx context.Context,
	message string,
	keysAndValues ...any,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.KnowledgeWarnContext(ctx, message, keysAndValues...)
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
				"workspace_id":   convert.ToString(item.WorkspaceID),
				"workspace_type": workspaceTypeNormal,
			},
		})
	}
	return nodes
}

func buildProjectNodes(items []projectfile.ProjectItem, sharedProjectIDs map[int64]struct{}) []kbdto.SourceBindingNode {
	nodes := make([]kbdto.SourceBindingNode, 0, len(items))
	for _, item := range items {
		workspaceType := workspaceTypeNormal
		if _, ok := sharedProjectIDs[item.ProjectID]; ok {
			workspaceType = workspaceTypeShared
		}
		nodes = append(nodes, kbdto.SourceBindingNode{
			NodeType:    sourceBindingNodeTypeProject,
			NodeRef:     strconv.FormatInt(item.ProjectID, 10),
			Name:        strings.TrimSpace(item.ProjectName),
			Description: strings.TrimSpace(item.Description),
			HasChildren: true,
			Selectable:  true,
			Meta: map[string]any{
				"workspace_id":   convert.ToString(item.WorkspaceID),
				"workspace_type": workspaceType,
				"project_id":     convert.ToString(item.ProjectID),
			},
		})
	}
	return nodes
}

func collectProjectIDsFromProjectItems(items []projectfile.ProjectItem) []int64 {
	if len(items) == 0 {
		return nil
	}

	seen := make(map[int64]struct{}, len(items))
	projectIDs := make([]int64, 0, len(items))
	for _, item := range items {
		if item.ProjectID <= 0 {
			continue
		}
		if _, ok := seen[item.ProjectID]; ok {
			continue
		}
		seen[item.ProjectID] = struct{}{}
		projectIDs = append(projectIDs, item.ProjectID)
	}
	return projectIDs
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
				"project_id":         convert.ToString(item.ProjectID),
				"project_file_id":    convert.ToString(item.ProjectFileID),
				"parent_id":          convert.ToString(item.ParentID),
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
