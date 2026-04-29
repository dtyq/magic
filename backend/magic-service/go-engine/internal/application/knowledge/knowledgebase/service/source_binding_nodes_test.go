package kbapp_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	kbapp "magic/internal/application/knowledge/knowledgebase/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/entity"
	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

var (
	errEnterpriseFolderProbe         = errors.New("probe folder failed")
	errSourceBindingTreeCacheGetFail = errors.New("source binding tree cache get failed")
	errSourceBindingTreeCacheSetFail = errors.New("source binding tree cache set failed")
	errUnusedPortCall                = errors.New("unused test port call")
)

const (
	testEnterpriseFileEmptyRef      = "file-empty"
	testEnterpriseFileFinanceRef    = "file-finance"
	testEnterpriseFileHelloRef      = "file-hello"
	testEnterpriseFileXLSXExt       = "xlsx"
	testEnterpriseFolder1Ref        = "folder-1"
	testEnterpriseFolder2Ref        = "folder-2"
	testEnterpriseKnowledgeBaseRef  = "TS-KB-1"
	testSourceBindingFolder         = "folder"
	testSourceBindingNodeTypeFile   = "file"
	testSourceBindingParentTypeBase = "knowledge_base"
	testSourceBindingSourceTypeEnt  = "enterprise_knowledge_base"
	testSourceBindingRootCacheKey   = "magic:knowledge:source_binding_tree_root:v1:"
)

func testSourceBindingRootCacheRedisKey(
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(organizationCode),
		strings.TrimSpace(userID),
		strings.TrimSpace(provider),
		strings.TrimSpace(knowledgeBaseID),
	}, "\x00")))
	return testSourceBindingRootCacheKey + hex.EncodeToString(sum[:])
}

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

type fakeSharedProjectReader struct {
	sharedProjectIDs map[int64]struct{}
	lastUserID       string
}

func (f *fakeSharedProjectReader) ListWorkspaceIDsByProjectIDs(
	context.Context,
	string,
	[]int64,
) (map[int64]int64, error) {
	return map[int64]int64{}, nil
}

func (f *fakeSharedProjectReader) ListSharedProjectIDsByProjectIDs(
	_ context.Context,
	_ string,
	userID string,
	projectIDs []int64,
) (map[int64]struct{}, error) {
	f.lastUserID = userID
	result := make(map[int64]struct{}, len(projectIDs))
	for _, projectID := range projectIDs {
		if _, ok := f.sharedProjectIDs[projectID]; ok {
			result[projectID] = struct{}{}
		}
	}
	return result, nil
}

type fakeThirdPlatformExpander struct {
	kbs             []thirdplatform.KnowledgeBaseItem
	nodes           []thirdplatform.TreeNode
	nodesByParent   map[string][]thirdplatform.TreeNode
	treeErrByParent map[string]error
	treeCalls       []fakeThirdPlatformTreeCall
	lastOrgCode     string
	lastUserID      string
	lastThirdUserID string
	lastThirdOrg    string
	lastParentType  string
	lastParentRef   string
}

type fakeThirdPlatformTreeCall struct {
	input thirdplatform.TreeNodeListInput
}

func (f *fakeThirdPlatformExpander) Resolve(context.Context, thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	return nil, errUnusedPortCall
}

func (f *fakeThirdPlatformExpander) Expand(context.Context, string, string, []map[string]any) ([]*docentity.File, error) {
	return nil, errUnusedPortCall
}

func (f *fakeThirdPlatformExpander) ListKnowledgeBases(
	_ context.Context,
	input thirdplatform.KnowledgeBaseListInput,
) ([]thirdplatform.KnowledgeBaseItem, error) {
	f.lastOrgCode = input.OrganizationCode
	f.lastUserID = input.UserID
	return f.kbs, nil
}

func (f *fakeThirdPlatformExpander) ListTreeNodes(
	_ context.Context,
	input thirdplatform.TreeNodeListInput,
) ([]thirdplatform.TreeNode, error) {
	f.lastOrgCode = input.OrganizationCode
	f.lastUserID = input.UserID
	f.lastThirdUserID = input.ThirdPlatformUserID
	f.lastThirdOrg = input.ThirdPlatformOrganizationCode
	f.lastParentType = input.ParentType
	f.lastParentRef = input.ParentRef
	f.treeCalls = append(f.treeCalls, fakeThirdPlatformTreeCall{input: input})
	key := fakeThirdPlatformParentKey(input.ParentType, input.ParentRef)
	if err, ok := f.treeErrByParent[key]; ok {
		return nil, err
	}
	if nodes, ok := f.nodesByParent[key]; ok {
		return nodes, nil
	}
	return f.nodes, nil
}

func fakeThirdPlatformParentKey(parentType, parentRef string) string {
	return parentType + ":" + parentRef
}

type fakeSourceBindingTreeRootCache struct {
	store    map[string]*sourcebindingservice.EnterpriseTreeIndex
	getErr   error
	setErr   error
	getCalls []string
	setCalls []string
}

func (f *fakeSourceBindingTreeRootCache) Get(
	_ context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) (*sourcebindingservice.EnterpriseTreeIndex, bool, error) {
	key := fakeSourceBindingTreeRootCacheKey(organizationCode, userID, provider, knowledgeBaseID)
	f.getCalls = append(f.getCalls, key)
	if f.getErr != nil {
		return nil, false, f.getErr
	}
	index, ok := f.store[key]
	return index, ok, nil
}

func (f *fakeSourceBindingTreeRootCache) Set(
	_ context.Context,
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
	index *sourcebindingservice.EnterpriseTreeIndex,
) error {
	key := fakeSourceBindingTreeRootCacheKey(organizationCode, userID, provider, knowledgeBaseID)
	f.setCalls = append(f.setCalls, key)
	if f.setErr != nil {
		return f.setErr
	}
	if f.store == nil {
		f.store = make(map[string]*sourcebindingservice.EnterpriseTreeIndex)
	}
	f.store[key] = index
	return nil
}

func fakeSourceBindingTreeRootCacheKey(
	organizationCode string,
	userID string,
	provider string,
	knowledgeBaseID string,
) string {
	return organizationCode + "\x00" + userID + "\x00" + provider + "\x00" + knowledgeBaseID
}

func enterpriseRootCascadeNodes() []thirdplatform.TreeNode {
	return []thirdplatform.TreeNode{
		newEnterpriseTreeNode(
			testEnterpriseFileEmptyRef,
			"空数据",
			"3",
			[]thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseFileEmptyRef, Name: "空数据", Type: "3"},
			},
		),
		newEnterpriseTreeNode(
			testEnterpriseFolder1Ref,
			"目录1",
			"0",
			[]thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
			},
		),
		newEnterpriseTreeNode(
			testEnterpriseFileHelloRef,
			"你好",
			"16",
			[]thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
				{ID: testEnterpriseFileHelloRef, Name: "你好", Type: "16"},
			},
		),
		newEnterpriseTreeNode(
			testEnterpriseFolder2Ref,
			"目录2",
			"0",
			[]thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
				{ID: testEnterpriseFolder2Ref, Name: "目录2", Type: "0"},
			},
		),
		newEnterpriseTreeNode(
			testEnterpriseFileFinanceRef,
			"财务",
			"3",
			[]thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
				{ID: testEnterpriseFolder2Ref, Name: "目录2", Type: "0"},
				{ID: testEnterpriseFileFinanceRef, Name: "财务", Type: "3"},
			},
		),
	}
}

func enterpriseFolderCascadeNodes(folderRef string) []thirdplatform.TreeNode {
	switch folderRef {
	case testEnterpriseFolder1Ref:
		return []thirdplatform.TreeNode{
			newEnterpriseTreeNode(
				testEnterpriseFileHelloRef,
				"你好",
				"16",
				[]thirdplatform.PathNode{
					{ID: "0", Name: "企业知识库空间", Type: "space"},
					{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
					{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
					{ID: testEnterpriseFileHelloRef, Name: "你好", Type: "16"},
				},
			),
			newEnterpriseTreeNode(
				testEnterpriseFolder2Ref,
				"目录2",
				"0",
				[]thirdplatform.PathNode{
					{ID: "0", Name: "企业知识库空间", Type: "space"},
					{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
					{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
					{ID: testEnterpriseFolder2Ref, Name: "目录2", Type: "0"},
				},
			),
			newEnterpriseTreeNode(
				testEnterpriseFileFinanceRef,
				"财务",
				"3",
				[]thirdplatform.PathNode{
					{ID: "0", Name: "企业知识库空间", Type: "space"},
					{ID: testEnterpriseKnowledgeBaseRef, Name: "知识库", Type: "9"},
					{ID: testEnterpriseFolder1Ref, Name: "目录1", Type: "0"},
					{ID: testEnterpriseFolder2Ref, Name: "目录2", Type: "0"},
					{ID: testEnterpriseFileFinanceRef, Name: "财务", Type: "3"},
				},
			),
		}
	default:
		return nil
	}
}

func newEnterpriseTreeNode(
	thirdFileID string,
	name string,
	fileType string,
	path []thirdplatform.PathNode,
) thirdplatform.TreeNode {
	extension := ""
	switch fileType {
	case "3":
		extension = testEnterpriseFileXLSXExt
	case "16":
		extension = "md"
	}
	return thirdplatform.TreeNode{
		KnowledgeBaseID: testEnterpriseKnowledgeBaseRef,
		ThirdFileID:     thirdFileID,
		ParentID:        "wrong-parent",
		Name:            name,
		FileType:        fileType,
		Extension:       extension,
		IsDirectory:     fileType == "0",
		Path:            path,
	}
}

func newSourceBindingNodesRedis(t *testing.T) *redis.Client {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = client.Close()
		server.Close()
	})
	return client
}

func assertEnterpriseRootNodes(t *testing.T, nodes []kbdto.SourceBindingNode, stage string) {
	t.Helper()

	if len(nodes) != 2 || nodes[0].NodeRef != testEnterpriseFileEmptyRef || nodes[1].NodeRef != testEnterpriseFolder1Ref {
		t.Fatalf("expected %s nodes only, got %#v", stage, nodes)
	}
	if got := nodes[0].Meta["extension"]; got != testEnterpriseFileXLSXExt {
		t.Fatalf("expected %s file extension %s, got %#v", stage, testEnterpriseFileXLSXExt, got)
	}
	if got := nodes[1].Meta["extension"]; got != "" {
		t.Fatalf("expected %s folder extension empty, got %#v", stage, got)
	}
}

func assertEnterpriseRootCacheStored(t *testing.T, redisClient *redis.Client, rootCacheKey string) {
	t.Helper()

	keyCount, err := redisClient.DBSize(context.Background()).Result()
	if err != nil {
		t.Fatalf("read redis dbsize: %v", err)
	}
	if keyCount != 1 {
		t.Fatalf("expected exactly one root cache key, got %d", keyCount)
	}
	exists, err := redisClient.Exists(context.Background(), rootCacheKey).Result()
	if err != nil {
		t.Fatalf("check root cache key exists: %v", err)
	}
	if exists != 1 {
		t.Fatalf("expected root cache key to exist, got exists=%d", exists)
	}
	ttl, err := redisClient.TTL(context.Background(), rootCacheKey).Result()
	if err != nil {
		t.Fatalf("read root cache ttl: %v", err)
	}
	if ttl != time.Minute {
		t.Fatalf("expected root cache ttl=1m, got %s", ttl)
	}
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

func (f *fakeTaskFileService) LoadVisibleMeta(context.Context, int64) (*projectfile.Meta, error) {
	return nil, errUnusedPortCall
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

func (f *fakeTaskFileService) WalkVisibleLeafFileIDsByProject(context.Context, int64, func(int64) (bool, error)) error {
	return errUnusedPortCall
}

func (f *fakeTaskFileService) WalkVisibleLeafFileIDsByFolder(context.Context, int64, func(int64) (bool, error)) error {
	return errUnusedPortCall
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

func (s *hiddenRootTaskFileReaderStub) ListVisibleChildrenByParentAfter(
	_ context.Context,
	_ int64,
	parentID int64,
	_ int64,
	lastFileID int64,
	limit int,
) ([]*projectfile.Meta, error) {
	items := s.childrenByParentBatch[parentID]
	if len(items) == 0 {
		return nil, nil
	}
	start := 0
	if lastFileID > 0 {
		for idx, item := range items {
			if item != nil && item.ProjectFileID == lastFileID {
				start = idx + 1
				break
			}
		}
	}
	if start >= len(items) {
		return nil, nil
	}
	end := start + limit
	if limit <= 0 || end > len(items) {
		end = len(items)
	}
	return append([]*projectfile.Meta(nil), items[start:end]...), nil
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
	if result.List[0].Meta["workspace_id"] != "11" {
		t.Fatalf("expected workspace_id string, got %#v", result.List[0].Meta["workspace_id"])
	}
	if result.List[0].Meta["workspace_type"] != "normal" {
		t.Fatalf("expected workspace_type normal, got %#v", result.List[0].Meta["workspace_type"])
	}
}

func TestListSourceBindingNodesProjectChildrenUseVisibleTaskFiles(t *testing.T) {
	t.Parallel()

	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetTaskFileService(&fakeTaskFileService{
		treeNodesByProject: map[int64][]projectfile.TreeNode{
			55: {
				{ProjectID: 55, ProjectFileID: 1001, FileName: "visible.md", RelativeFilePath: "visible.md"},
				{ProjectID: 55, ProjectFileID: 1002, FileName: testSourceBindingFolder, IsDirectory: true},
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
	if result.List[1].NodeType != testSourceBindingFolder {
		t.Fatalf("unexpected second node: %#v", result.List[1])
	}
	if result.List[0].Meta["project_id"] != "55" {
		t.Fatalf("expected project_id string, got %#v", result.List[0].Meta["project_id"])
	}
	if result.List[0].Meta["project_file_id"] != "1001" {
		t.Fatalf("expected project_file_id string, got %#v", result.List[0].Meta["project_file_id"])
	}
	if result.List[0].Meta["parent_id"] != "0" {
		t.Fatalf("expected parent_id string, got %#v", result.List[0].Meta["parent_id"])
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
				{
					ProjectID:        66,
					ProjectFileID:    1002,
					ParentID:         900,
					FileName:         testSourceBindingFolder,
					RelativeFilePath: testSourceBindingFolder,
					IsDirectory:      true,
				},
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
	if result.List[1].NodeType != testSourceBindingFolder {
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
		ParentType: testSourceBindingFolder,
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

func TestListSourceBindingNodesProjectWorkspaceChildrenBackfillWorkspaceType(t *testing.T) {
	t.Parallel()

	projectPort := &fakeProjectFileResolver{
		projects: []projectfile.ProjectItem{
			{
				WorkspaceID: 11,
				ProjectID:   55,
				ProjectName: "Project Shared",
				Description: "shared",
			},
			{
				WorkspaceID: 11,
				ProjectID:   56,
				ProjectName: "Project Normal",
				Description: "normal",
			},
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetProjectFileResolver(projectPort)
	projectReader := &fakeSharedProjectReader{
		sharedProjectIDs: map[int64]struct{}{55: {}},
	}
	app.SetSuperMagicProjectReader(projectReader)

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-1",
		UserID:           "user-1",
		SourceType:       "project",
		ParentType:       "workspace",
		ParentRef:        "11",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.List) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(result.List))
	}
	if result.List[0].Meta["workspace_id"] != "11" {
		t.Fatalf("expected first workspace_id string, got %#v", result.List[0].Meta["workspace_id"])
	}
	if result.List[0].Meta["workspace_type"] != "shared" {
		t.Fatalf("expected first workspace_type shared, got %#v", result.List[0].Meta["workspace_type"])
	}
	if result.List[1].Meta["workspace_type"] != "normal" {
		t.Fatalf("expected second workspace_type normal, got %#v", result.List[1].Meta["workspace_type"])
	}
	if projectReader.lastUserID != "user-1" {
		t.Fatalf("expected shared project lookup user_id=user-1, got %q", projectReader.lastUserID)
	}
}

func TestListSourceBindingNodesEnterpriseKnowledgeBaseCachesRootIndexInRedis(t *testing.T) {
	t.Parallel()

	redisClient := newSourceBindingNodesRedis(t)
	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): enterpriseRootCascadeNodes(),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	app.SetSourceBindingTreeRootCache(kbapp.NewRedisSourceBindingTreeRootCache(redisClient))

	first, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	assertEnterpriseRootNodes(t, first.List, "direct root")
	if len(thirdPlatformPort.treeCalls) != 1 {
		t.Fatalf("expected one Teamshare root query, got %#v", thirdPlatformPort.treeCalls)
	}

	rootCacheKey := testSourceBindingRootCacheRedisKey(
		"ORG-2",
		"user-2",
		sourcebindingdomain.ProviderTeamshare,
		testEnterpriseKnowledgeBaseRef,
	)
	assertEnterpriseRootCacheStored(t, redisClient, rootCacheKey)

	second, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if err != nil {
		t.Fatalf("expected nil cached error, got %v", err)
	}
	assertEnterpriseRootNodes(t, second.List, "cached root")
	if len(thirdPlatformPort.treeCalls) != 1 {
		t.Fatalf("expected cache hit without extra Teamshare query, got %#v", thirdPlatformPort.treeCalls)
	}
}

func TestListSourceBindingNodesEnterpriseFolderUsesRootCacheWithoutRPC(t *testing.T) {
	t.Parallel()

	redisClient := newSourceBindingNodesRedis(t)
	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): enterpriseRootCascadeNodes(),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	app.SetSourceBindingTreeRootCache(kbapp.NewRedisSourceBindingTreeRootCache(redisClient))

	_, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if err != nil {
		t.Fatalf("warm root cache: %v", err)
	}

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingFolder,
		ParentRef:        testEnterpriseFolder1Ref,
	})
	if err != nil {
		t.Fatalf("expected nil folder error, got %v", err)
	}
	if len(result.List) != 2 || result.List[0].NodeRef != testEnterpriseFileHelloRef || result.List[1].NodeRef != testEnterpriseFolder2Ref {
		t.Fatalf("expected folder children from root cache, got %#v", result.List)
	}
	if got := result.List[0].Meta["extension"]; got != "md" {
		t.Fatalf("expected cached folder file extension md, got %#v", got)
	}
	if got := result.List[1].Meta["extension"]; got != "" {
		t.Fatalf("expected cached folder extension empty, got %#v", got)
	}
	if len(thirdPlatformPort.treeCalls) != 1 {
		t.Fatalf("expected folder expansion to reuse root cache without Teamshare query, got %#v", thirdPlatformPort.treeCalls)
	}

	rootCacheKey := testSourceBindingRootCacheRedisKey(
		"ORG-2",
		"user-2",
		sourcebindingdomain.ProviderTeamshare,
		testEnterpriseKnowledgeBaseRef,
	)
	keyCount, err := redisClient.DBSize(context.Background()).Result()
	if err != nil {
		t.Fatalf("read redis dbsize: %v", err)
	}
	if keyCount != 1 {
		t.Fatalf("expected folder expansion not to create extra cache keys, got %d", keyCount)
	}
	exists, err := redisClient.Exists(context.Background(), rootCacheKey).Result()
	if err != nil {
		t.Fatalf("check root cache key exists: %v", err)
	}
	if exists != 1 {
		t.Fatalf("expected warmed root cache key to exist, got exists=%d", exists)
	}
}

func TestListSourceBindingNodesEnterpriseTreeForwardsThirdPlatformActor(t *testing.T) {
	t.Parallel()

	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): enterpriseRootCascadeNodes(),
			fakeThirdPlatformParentKey(testSourceBindingFolder, testEnterpriseFolder1Ref):               enterpriseFolderCascadeNodes(testEnterpriseFolder1Ref),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	ctx := ctxmeta.WithAccessActor(context.Background(), ctxmeta.AccessActor{
		OrganizationCode:              "ORG-actor",
		UserID:                        "user-actor",
		ThirdPlatformUserID:           "teamshare-user-1",
		ThirdPlatformOrganizationCode: "teamshare-org-1",
	})

	_, err := app.ListSourceBindingNodes(ctx, &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if err != nil {
		t.Fatalf("expected nil root error, got %v", err)
	}
	_, err = app.ListSourceBindingNodes(ctx, &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingFolder,
		ParentRef:        testEnterpriseFolder1Ref,
	})
	if err != nil {
		t.Fatalf("expected nil folder error, got %v", err)
	}
	if len(thirdPlatformPort.treeCalls) != 2 {
		t.Fatalf("expected root and folder Teamshare queries, got %#v", thirdPlatformPort.treeCalls)
	}
	for _, call := range thirdPlatformPort.treeCalls {
		if call.input.OrganizationCode != "ORG-2" ||
			call.input.UserID != "user-2" ||
			call.input.ThirdPlatformUserID != "teamshare-user-1" ||
			call.input.ThirdPlatformOrganizationCode != "teamshare-org-1" {
			t.Fatalf("expected third-platform actor forwarded, got %#v", call.input)
		}
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

func TestListSourceBindingNodesEnterpriseFolderWithoutRootCacheQueriesLiveWithoutCaching(t *testing.T) {
	t.Parallel()

	redisClient := newSourceBindingNodesRedis(t)
	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingFolder, testEnterpriseFolder1Ref): enterpriseFolderCascadeNodes(testEnterpriseFolder1Ref),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	app.SetSourceBindingTreeRootCache(kbapp.NewRedisSourceBindingTreeRootCache(redisClient))

	result, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingFolder,
		ParentRef:        testEnterpriseFolder1Ref,
	})
	if err != nil {
		t.Fatalf("expected nil folder error, got %v", err)
	}
	if len(result.List) != 2 || result.List[0].NodeRef != testEnterpriseFileHelloRef || result.List[1].NodeRef != testEnterpriseFolder2Ref {
		t.Fatalf("expected live folder direct children, got %#v", result.List)
	}
	if got := result.List[0].Meta["extension"]; got != "md" {
		t.Fatalf("expected live folder file extension md, got %#v", got)
	}
	if got := result.List[1].Meta["extension"]; got != "" {
		t.Fatalf("expected live folder extension empty, got %#v", got)
	}
	if len(thirdPlatformPort.treeCalls) != 1 ||
		thirdPlatformPort.treeCalls[0].input.ParentType != testSourceBindingFolder ||
		thirdPlatformPort.treeCalls[0].input.ParentRef != testEnterpriseFolder1Ref {
		t.Fatalf("expected one live folder Teamshare query, got %#v", thirdPlatformPort.treeCalls)
	}

	rootCacheKey := testSourceBindingRootCacheRedisKey(
		"ORG-2",
		"user-2",
		sourcebindingdomain.ProviderTeamshare,
		testEnterpriseKnowledgeBaseRef,
	)
	keyCount, err := redisClient.DBSize(context.Background()).Result()
	if err != nil {
		t.Fatalf("read redis dbsize: %v", err)
	}
	if keyCount != 0 {
		t.Fatalf("expected folder expansion not to write redis root cache, got %d", keyCount)
	}
	exists, err := redisClient.Exists(context.Background(), rootCacheKey).Result()
	if err != nil {
		t.Fatalf("check root cache key exists: %v", err)
	}
	if exists != 0 {
		t.Fatalf("expected root cache key to be absent, got exists=%d", exists)
	}
}

func TestListSourceBindingNodesEnterpriseTreeCacheGetFailureFallsBackToLiveQuery(t *testing.T) {
	t.Parallel()

	cache := &fakeSourceBindingTreeRootCache{
		getErr: errSourceBindingTreeCacheGetFail,
	}
	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): enterpriseRootCascadeNodes(),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	app.SetSourceBindingTreeRootCache(cache)

	_, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if err != nil {
		t.Fatalf("expected live query success on cache get failure, got %v", err)
	}
	if len(thirdPlatformPort.treeCalls) != 1 {
		t.Fatalf("expected fallback to one live Teamshare query, got %#v", thirdPlatformPort.treeCalls)
	}
	if len(cache.getCalls) != 1 {
		t.Fatalf("expected one cache get call, got %#v", cache.getCalls)
	}
}

func TestListSourceBindingNodesEnterpriseTreeCacheSetFailureFallsBackToLiveQuery(t *testing.T) {
	t.Parallel()

	cache := &fakeSourceBindingTreeRootCache{
		setErr: errSourceBindingTreeCacheSetFail,
	}
	thirdPlatformPort := &fakeThirdPlatformExpander{
		nodesByParent: map[string][]thirdplatform.TreeNode{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): enterpriseRootCascadeNodes(),
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)
	app.SetSourceBindingTreeRootCache(cache)

	for range 2 {
		_, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
			OrganizationCode: "ORG-2",
			UserID:           "user-2",
			SourceType:       testSourceBindingSourceTypeEnt,
			Provider:         sourcebindingdomain.ProviderTeamshare,
			ParentType:       testSourceBindingParentTypeBase,
			ParentRef:        testEnterpriseKnowledgeBaseRef,
		})
		if err != nil {
			t.Fatalf("expected live query success on cache set failure, got %v", err)
		}
	}
	if len(thirdPlatformPort.treeCalls) != 2 {
		t.Fatalf("expected each request to fallback to live Teamshare query, got %#v", thirdPlatformPort.treeCalls)
	}
	if len(cache.setCalls) != 2 {
		t.Fatalf("expected root cache set attempted twice, got %#v", cache.setCalls)
	}
}

func TestListSourceBindingNodesEnterprisePHPFailureReturnsError(t *testing.T) {
	t.Parallel()

	thirdPlatformPort := &fakeThirdPlatformExpander{
		treeErrByParent: map[string]error{
			fakeThirdPlatformParentKey(testSourceBindingParentTypeBase, testEnterpriseKnowledgeBaseRef): errEnterpriseFolderProbe,
		},
	}
	app := kbapp.NewKnowledgeBaseAppServiceForTest(t, nil, nil, nil, nil, "")
	app.SetThirdPlatformExpander(thirdPlatformPort)

	_, err := app.ListSourceBindingNodes(context.Background(), &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: "ORG-2",
		UserID:           "user-2",
		SourceType:       testSourceBindingSourceTypeEnt,
		Provider:         sourcebindingdomain.ProviderTeamshare,
		ParentType:       testSourceBindingParentTypeBase,
		ParentRef:        testEnterpriseKnowledgeBaseRef,
	})
	if !errors.Is(err, errEnterpriseFolderProbe) {
		t.Fatalf("expected Teamshare rpc error, got %v", err)
	}
}
