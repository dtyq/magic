package kbapp_test

import (
	"context"
	"errors"
	"testing"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

var errUnusedPortCall = errors.New("unused test port call")

const (
	testSourceBindingNodeTypeFolder = "folder"
	testSourceBindingNodeTypeFile   = "file"
)

type fakeProjectFileResolver struct {
	workspaces      []projectfile.WorkspaceItem
	workspacesTotal int64
	projects        []projectfile.ProjectItem
	projectsTotal   int64
	treeNodes       []projectfile.TreeNode
	lastOrgCode     string
	lastUserID      string
	lastWorkspaceID int64
	lastOffset      int
	lastLimit       int
	lastParentType  string
	lastParentRef   int64
}

func (f *fakeProjectFileResolver) Resolve(context.Context, int64) (*projectfile.ResolveResult, error) {
	return nil, errUnusedPortCall
}

func (f *fakeProjectFileResolver) ListByProject(context.Context, int64) ([]projectfile.ListItem, error) {
	return nil, errUnusedPortCall
}

func (f *fakeProjectFileResolver) ListWorkspaces(
	_ context.Context,
	organizationCode string,
	userID string,
	offset int,
	limit int,
) (*projectfile.WorkspacePage, error) {
	f.lastOrgCode = organizationCode
	f.lastUserID = userID
	f.lastOffset = offset
	f.lastLimit = limit
	total := f.workspacesTotal
	if total == 0 {
		total = int64(len(f.workspaces))
	}
	return &projectfile.WorkspacePage{
		Total: total,
		List:  f.workspaces,
	}, nil
}

func (f *fakeProjectFileResolver) ListProjects(
	_ context.Context,
	organizationCode string,
	userID string,
	workspaceID int64,
	offset int,
	limit int,
) (*projectfile.ProjectPage, error) {
	f.lastOrgCode = organizationCode
	f.lastUserID = userID
	f.lastWorkspaceID = workspaceID
	f.lastOffset = offset
	f.lastLimit = limit
	total := f.projectsTotal
	if total == 0 {
		total = int64(len(f.projects))
	}
	return &projectfile.ProjectPage{
		Total: total,
		List:  f.projects,
	}, nil
}

func (f *fakeProjectFileResolver) ListTreeNodes(_ context.Context, parentType string, parentRef int64) ([]projectfile.TreeNode, error) {
	f.lastParentType = parentType
	f.lastParentRef = parentRef
	return f.treeNodes, nil
}

type fakeThirdPlatformExpander struct {
	kbs            []thirdplatform.KnowledgeBaseItem
	nodes          []thirdplatform.TreeNode
	lastOrgCode    string
	lastUserID     string
	lastParentType string
	lastParentRef  string
}

func (f *fakeThirdPlatformExpander) Resolve(context.Context, thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	return nil, errUnusedPortCall
}

func (f *fakeThirdPlatformExpander) Expand(context.Context, string, string, []map[string]any) ([]*documentdomain.File, error) {
	return nil, errUnusedPortCall
}

func (f *fakeThirdPlatformExpander) ListKnowledgeBases(
	_ context.Context,
	organizationCode string,
	userID string,
) ([]thirdplatform.KnowledgeBaseItem, error) {
	f.lastOrgCode = organizationCode
	f.lastUserID = userID
	return f.kbs, nil
}

func (f *fakeThirdPlatformExpander) ListTreeNodes(
	_ context.Context,
	organizationCode string,
	userID string,
	parentType string,
	parentRef string,
) ([]thirdplatform.TreeNode, error) {
	f.lastOrgCode = organizationCode
	f.lastUserID = userID
	f.lastParentType = parentType
	f.lastParentRef = parentRef
	return f.nodes, nil
}

type fakeTaskFileService struct {
	treeNodesByProject map[int64][]projectfile.TreeNode
	treeNodesByFolder  map[int64][]projectfile.TreeNode
}

type hiddenRootTaskFileReaderStub struct {
	rootByProjectID       map[int64]*projectfile.Meta
	metasByID             map[int64]*projectfile.Meta
	childrenByParent      map[int64][]*projectfile.Meta
	childrenByParentBatch map[int64][]*projectfile.Meta
}

func (f *fakeTaskFileService) IsVisibleFile(context.Context, int64) (bool, error) {
	return false, errUnusedPortCall
}

func (f *fakeTaskFileService) ListVisibleTreeNodesByProject(_ context.Context, projectID int64) ([]projectfile.TreeNode, error) {
	return f.treeNodesByProject[projectID], nil
}

func (f *fakeTaskFileService) ListVisibleTreeNodesByFolder(_ context.Context, folderID int64) ([]projectfile.TreeNode, error) {
	return f.treeNodesByFolder[folderID], nil
}

func (f *fakeTaskFileService) ListVisibleLeafFileIDsByProject(context.Context, int64) ([]int64, error) {
	return nil, errUnusedPortCall
}

func (f *fakeTaskFileService) ListVisibleLeafFileIDsByFolder(context.Context, int64) ([]int64, error) {
	return nil, errUnusedPortCall
}

func (s *hiddenRootTaskFileReaderStub) FindByID(_ context.Context, projectFileID int64) (*projectfile.Meta, error) {
	return s.metasByID[projectFileID], nil
}

func (s *hiddenRootTaskFileReaderStub) FindRootDirectoryByProjectID(_ context.Context, projectID int64) (*projectfile.Meta, error) {
	return s.rootByProjectID[projectID], nil
}

func (s *hiddenRootTaskFileReaderStub) ListVisibleChildrenByParent(
	_ context.Context,
	_ int64,
	parentID int64,
	_ int,
) ([]*projectfile.Meta, error) {
	return s.childrenByParent[parentID], nil
}

func (s *hiddenRootTaskFileReaderStub) ListVisibleChildrenByParents(
	_ context.Context,
	_ int64,
	parentIDs []int64,
	_ int,
) ([]*projectfile.Meta, error) {
	result := make([]*projectfile.Meta, 0)
	for _, parentID := range parentIDs {
		result = append(result, s.childrenByParentBatch[parentID]...)
	}
	return result, nil
}

func TestListSourceBindingNodesProjectRoot(t *testing.T) {
	t.Parallel()

	projectPort := &fakeProjectFileResolver{
		workspaces: []projectfile.WorkspaceItem{{
			WorkspaceID:   11,
			WorkspaceName: "Workspace A",
			Description:   "desc",
		}},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetProjectFileResolver(projectPort)

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceType:       "project",
		ParentType:       "root",
		Offset:           20,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if projectPort.lastOrgCode != "ORG-1" || projectPort.lastUserID != "user-1" {
		t.Fatalf("expected org/user to be forwarded, got %q/%q", projectPort.lastOrgCode, projectPort.lastUserID)
	}
	if projectPort.lastOffset != 20 || projectPort.lastLimit != 10 {
		t.Fatalf("expected offset/limit to be forwarded, got %d/%d", projectPort.lastOffset, projectPort.lastLimit)
	}
	if len(result.List) != 1 {
		t.Fatalf("expected 1 node, got %d", len(result.List))
	}
	if result.Total != 1 {
		t.Fatalf("expected total=1, got %d", result.Total)
	}
	if result.List[0].NodeType != "workspace" {
		t.Fatalf("expected workspace node, got %q", result.List[0].NodeType)
	}
	if result.List[0].Selectable {
		t.Fatal("expected workspace node not selectable")
	}
}

func TestListSourceBindingNodesProjectChildrenUseVisibleTaskFiles(t *testing.T) {
	t.Parallel()

	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetTaskFileService(&fakeTaskFileService{
		treeNodesByProject: map[int64][]projectfile.TreeNode{
			55: {
				{ProjectID: 55, ProjectFileID: 1001, FileName: "visible.md", RelativeFilePath: "visible.md"},
				{ProjectID: 55, ProjectFileID: 1002, FileName: "folder", IsDirectory: true},
			},
		},
	})

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		SourceType: "project",
		ParentType: "project",
		ParentRef:  "55",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.List) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(result.List))
	}
	if result.List[0].Name != "visible.md" || result.List[0].NodeType != testSourceBindingNodeTypeFile {
		t.Fatalf("unexpected first node: %#v", result.List[0])
	}
	if result.List[1].NodeType != testSourceBindingNodeTypeFolder {
		t.Fatalf("unexpected second node: %#v", result.List[1])
	}
}

func TestListSourceBindingNodesProjectChildrenUseVisibleTaskFilesWithHiddenRoot(t *testing.T) {
	t.Parallel()

	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetTaskFileService(taskfiledomain.NewDomainService(&hiddenRootTaskFileReaderStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			66: {ProjectID: 66, ProjectFileID: 900, IsDirectory: true, IsHidden: true},
		},
		childrenByParent: map[int64][]*projectfile.Meta{
			900: {
				{ProjectID: 66, ProjectFileID: 1001, ParentID: 900, FileName: "visible.md", RelativeFilePath: "visible.md"},
				{ProjectID: 66, ProjectFileID: 1002, ParentID: 900, FileName: "folder", RelativeFilePath: "folder", IsDirectory: true},
			},
		},
	}))

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		SourceType: "project",
		ParentType: "project",
		ParentRef:  "66",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.List) != 2 {
		t.Fatalf("expected 2 nodes under hidden root, got %d", len(result.List))
	}
	if result.List[0].Name != "visible.md" || result.List[0].NodeType != testSourceBindingNodeTypeFile {
		t.Fatalf("unexpected first node: %#v", result.List[0])
	}
	if result.List[1].NodeType != testSourceBindingNodeTypeFolder {
		t.Fatalf("unexpected second node: %#v", result.List[1])
	}
}

func TestListSourceBindingNodesProjectFolderChildrenUseVisibleTaskFiles(t *testing.T) {
	t.Parallel()

	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetTaskFileService(&fakeTaskFileService{
		treeNodesByFolder: map[int64][]projectfile.TreeNode{
			88: {
				{ProjectID: 55, ProjectFileID: 1003, ParentID: 88, FileName: "visible-child.md", RelativeFilePath: "folder/visible-child.md"},
			},
		},
	})

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		SourceType: "project",
		ParentType: "folder",
		ParentRef:  "88",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.List) != 1 {
		t.Fatalf("expected 1 node, got %d", len(result.List))
	}
	if result.List[0].Name != "visible-child.md" || result.List[0].NodeType != testSourceBindingNodeTypeFile {
		t.Fatalf("unexpected node: %#v", result.List[0])
	}
}

func TestListSourceBindingNodesEnterpriseFolder(t *testing.T) {
	t.Parallel()

	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodes: []thirdplatform.TreeNode{
			{
				KnowledgeBaseID: "TS-KB-1",
				ThirdFileID:     "folder-1",
				ParentID:        "TS-KB-1",
				Name:            "Folder A",
				FileType:        "0",
				IsDirectory:     true,
			},
			{
				KnowledgeBaseID: "TS-KB-1",
				ThirdFileID:     "file-1",
				ParentID:        "TS-KB-1",
				Name:            "Doc A",
				Extension:       "md",
				FileType:        "15",
				IsDirectory:     false,
			},
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       "enterprise_knowledge_base",
		Provider:         "teamshare",
		ParentType:       "folder",
		ParentRef:        "folder-root",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if thirdPlatformPort.lastParentType != "folder" || thirdPlatformPort.lastParentRef != "folder-root" {
		t.Fatalf("expected folder parent forwarded, got %q/%q", thirdPlatformPort.lastParentType, thirdPlatformPort.lastParentRef)
	}
	if len(result.List) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(result.List))
	}
	if result.List[0].NodeType != "folder" {
		t.Fatalf("expected first node folder, got %q", result.List[0].NodeType)
	}
	if result.List[1].NodeType != testSourceBindingNodeTypeFile {
		t.Fatalf("expected second node file, got %q", result.List[1].NodeType)
	}
}

func TestListSourceBindingNodesRejectsInvalidEnterpriseProvider(t *testing.T) {
	t.Parallel()

	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")

	_, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		SourceType: "enterprise_knowledge_base",
		Provider:   "unknown",
		ParentType: "root",
	})
	if !errors.Is(err, kbapp.ErrInvalidSourceBindingNodesProvider) {
		t.Fatalf("expected invalid provider error, got %v", err)
	}
}
