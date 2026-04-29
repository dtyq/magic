package taskfile_test

import (
	"context"
	"errors"
	"testing"

	taskfiledomain "magic/internal/domain/taskfile/service"
	"magic/internal/pkg/projectfile"
)

var errTaskFileReaderBoom = errors.New("boom")

type readerStub struct {
	metasByID                 map[int64]*projectfile.Meta
	rootByProjectID           map[int64]*projectfile.Meta
	childrenByParent          map[int64][]*projectfile.Meta
	childrenByParentBatch     map[int64][]*projectfile.Meta
	lastListProjectID         int64
	lastListParentID          int64
	lastBatchProjectID        int64
	lastBatchParentID         int64
	listChildrenByParentCalls int
	listChildrenBatchCalls    int
	err                       error
}

func (s *readerStub) FindByID(_ context.Context, projectFileID int64) (*projectfile.Meta, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.metasByID[projectFileID], nil
}

func (s *readerStub) FindRootDirectoryByProjectID(_ context.Context, projectID int64) (*projectfile.Meta, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.rootByProjectID[projectID], nil
}

func (s *readerStub) ListVisibleChildrenByParent(
	_ context.Context,
	projectID int64,
	parentID int64,
	_ int,
) ([]*projectfile.Meta, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.lastListProjectID = projectID
	s.lastListParentID = parentID
	s.listChildrenByParentCalls++
	return s.childrenByParent[parentID], nil
}

func (s *readerStub) ListVisibleChildrenByParentAfter(
	_ context.Context,
	projectID int64,
	parentID int64,
	_ int64,
	lastFileID int64,
	limit int,
) ([]*projectfile.Meta, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.lastBatchProjectID = projectID
	s.lastBatchParentID = parentID
	s.listChildrenBatchCalls++
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

func TestDomainServiceListVisibleTreeNodesByProject(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			100: {ProjectID: 100, ProjectFileID: 1, IsDirectory: true},
		},
		childrenByParent: map[int64][]*projectfile.Meta{
			1: {
				{ProjectID: 100, ProjectFileID: 2, ParentID: 1, FileName: "visible.md", RelativeFilePath: "visible.md"},
				{ProjectID: 100, ProjectFileID: 3, ParentID: 1, FileName: "folder", IsDirectory: true},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	nodes, err := svc.ListVisibleTreeNodesByProject(context.Background(), 100)
	if err != nil {
		t.Fatalf("ListVisibleTreeNodesByProject returned error: %v", err)
	}
	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}
	if reader.lastListProjectID != 100 || reader.lastListParentID != 1 {
		t.Fatalf("expected project/root 100/1, got %d/%d", reader.lastListProjectID, reader.lastListParentID)
	}
}

func TestDomainServiceListVisibleTreeNodesByProjectAllowsHiddenRoot(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			101: {ProjectID: 101, ProjectFileID: 10, IsDirectory: true, IsHidden: true},
		},
		childrenByParent: map[int64][]*projectfile.Meta{
			10: {
				{ProjectID: 101, ProjectFileID: 11, ParentID: 10, FileName: "visible.md", RelativeFilePath: "visible.md"},
				{ProjectID: 101, ProjectFileID: 12, ParentID: 10, FileName: "docs", IsDirectory: true},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	nodes, err := svc.ListVisibleTreeNodesByProject(context.Background(), 101)
	if err != nil {
		t.Fatalf("ListVisibleTreeNodesByProject returned error: %v", err)
	}
	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes under hidden root, got %#v", nodes)
	}
}

func TestDomainServiceListVisibleTreeNodesByFolderSkipsHiddenAncestorChildren(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		metasByID: map[int64]*projectfile.Meta{
			10: {ProjectID: 200, ProjectFileID: 10, IsDirectory: true},
			20: {ProjectID: 200, ProjectFileID: 20, ParentID: 10, IsDirectory: true, IsHidden: true},
			30: {ProjectID: 200, ProjectFileID: 30, ParentID: 20, IsDirectory: true},
		},
		childrenByParent: map[int64][]*projectfile.Meta{
			30: {
				{ProjectID: 200, ProjectFileID: 31, ParentID: 30, FileName: "hidden-child.md"},
				{ProjectID: 200, ProjectFileID: 32, ParentID: 30, FileName: "hidden-folder", IsDirectory: true},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	nodes, err := svc.ListVisibleTreeNodesByFolder(context.Background(), 30)
	if err != nil {
		t.Fatalf("ListVisibleTreeNodesByFolder returned error: %v", err)
	}
	if len(nodes) != 0 {
		t.Fatalf("expected 0 visible nodes, got %#v", nodes)
	}
}

func TestDomainServiceListVisibleLeafFileIDsByFolderSkipsDirectories(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		metasByID: map[int64]*projectfile.Meta{
			10: {ProjectID: 200, ProjectFileID: 10, IsDirectory: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			10: {
				{ProjectID: 200, ProjectFileID: 11, ParentID: 10, IsDirectory: true},
				{ProjectID: 200, ProjectFileID: 12, ParentID: 10},
			},
			11: {
				{ProjectID: 200, ProjectFileID: 13, ParentID: 11},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	fileIDs, err := svc.ListVisibleLeafFileIDsByFolder(context.Background(), 10)
	if err != nil {
		t.Fatalf("ListVisibleLeafFileIDsByFolder returned error: %v", err)
	}
	if len(fileIDs) != 2 || fileIDs[0] != 12 || fileIDs[1] != 13 {
		t.Fatalf("unexpected visible file ids: %#v", fileIDs)
	}
	if reader.listChildrenBatchCalls != 2 {
		t.Fatalf("expected 2 batch child queries, got %d", reader.listChildrenBatchCalls)
	}
}

func TestDomainServiceListVisibleLeafFileIDsByFolderPaginatesLargeSiblingSet(t *testing.T) {
	t.Parallel()

	children := make([]*projectfile.Meta, 0, 1001)
	for idx := range 1001 {
		children = append(children, &projectfile.Meta{
			ProjectID:     200,
			ProjectFileID: int64(idx + 1),
			ParentID:      10,
			Sort:          int64(idx + 1),
		})
	}
	reader := &readerStub{
		metasByID: map[int64]*projectfile.Meta{
			10: {ProjectID: 200, ProjectFileID: 10, IsDirectory: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			10: children,
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	fileIDs, err := svc.ListVisibleLeafFileIDsByFolder(context.Background(), 10)
	if err != nil {
		t.Fatalf("ListVisibleLeafFileIDsByFolder returned error: %v", err)
	}
	if len(fileIDs) != 1001 {
		t.Fatalf("expected 1001 visible file ids, got %d", len(fileIDs))
	}
	if reader.listChildrenBatchCalls != 2 {
		t.Fatalf("expected paginated child queries, got %d", reader.listChildrenBatchCalls)
	}
}

func TestDomainServiceListVisibleLeafFileIDsByProjectSkipsHiddenDirectories(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			300: {ProjectID: 300, ProjectFileID: 1, IsDirectory: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			1: {
				{ProjectID: 300, ProjectFileID: 2, ParentID: 1, IsDirectory: true},
				{ProjectID: 300, ProjectFileID: 3, ParentID: 1, IsDirectory: true, IsHidden: true},
			},
			2: {
				{ProjectID: 300, ProjectFileID: 5, ParentID: 2},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	fileIDs, err := svc.ListVisibleLeafFileIDsByProject(context.Background(), 300)
	if err != nil {
		t.Fatalf("ListVisibleLeafFileIDsByProject returned error: %v", err)
	}
	if len(fileIDs) != 1 || fileIDs[0] != 5 {
		t.Fatalf("unexpected visible file ids: %#v", fileIDs)
	}
}

func TestDomainServiceListVisibleLeafFileIDsByProjectAllowsHiddenRoot(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		rootByProjectID: map[int64]*projectfile.Meta{
			301: {ProjectID: 301, ProjectFileID: 100, IsDirectory: true, IsHidden: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			100: {
				{ProjectID: 301, ProjectFileID: 101, ParentID: 100},
				{ProjectID: 301, ProjectFileID: 102, ParentID: 100, IsDirectory: true},
			},
			102: {
				{ProjectID: 301, ProjectFileID: 103, ParentID: 102},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	fileIDs, err := svc.ListVisibleLeafFileIDsByProject(context.Background(), 301)
	if err != nil {
		t.Fatalf("ListVisibleLeafFileIDsByProject returned error: %v", err)
	}
	if len(fileIDs) != 2 || fileIDs[0] != 101 || fileIDs[1] != 103 {
		t.Fatalf("unexpected visible file ids under hidden root: %#v", fileIDs)
	}
}

func TestDomainServiceListVisibleLeafFileIDsByFolderSkipsHiddenAncestorSubtree(t *testing.T) {
	t.Parallel()

	reader := &readerStub{
		metasByID: map[int64]*projectfile.Meta{
			10: {ProjectID: 200, ProjectFileID: 10, IsDirectory: true},
			20: {ProjectID: 200, ProjectFileID: 20, ParentID: 10, IsDirectory: true, IsHidden: true},
			30: {ProjectID: 200, ProjectFileID: 30, ParentID: 20, IsDirectory: true},
		},
		childrenByParentBatch: map[int64][]*projectfile.Meta{
			30: {
				{ProjectID: 200, ProjectFileID: 31, ParentID: 30},
			},
		},
	}

	svc := taskfiledomain.NewDomainService(reader)
	fileIDs, err := svc.ListVisibleLeafFileIDsByFolder(context.Background(), 30)
	if err != nil {
		t.Fatalf("ListVisibleLeafFileIDsByFolder returned error: %v", err)
	}
	if len(fileIDs) != 0 {
		t.Fatalf("expected hidden ancestor subtree to be skipped, got %#v", fileIDs)
	}
}

func TestDomainServiceIsVisibleFile(t *testing.T) {
	t.Parallel()

	svc := taskfiledomain.NewDomainService(&readerStub{
		metasByID: map[int64]*projectfile.Meta{
			1:  {ProjectFileID: 1},
			2:  {ProjectFileID: 2, IsDirectory: true},
			3:  {ProjectFileID: 3, IsHidden: true},
			4:  {ProjectFileID: 4, Status: "deleted"},
			5:  {ProjectFileID: 5, ParentID: 6},
			6:  {ProjectFileID: 6, ParentID: 10, IsDirectory: true, IsHidden: true},
			8:  {ProjectFileID: 8, ParentID: 9},
			9:  {ProjectFileID: 9, IsDirectory: true, IsHidden: true},
			10: {ProjectFileID: 10, IsDirectory: true},
		},
	})

	for _, tc := range []struct {
		projectFileID int64
		want          bool
	}{
		{projectFileID: 1, want: true},
		{projectFileID: 2, want: false},
		{projectFileID: 3, want: false},
		{projectFileID: 4, want: false},
		{projectFileID: 5, want: false},
		{projectFileID: 7, want: false},
		{projectFileID: 8, want: true},
	} {
		got, err := svc.IsVisibleFile(context.Background(), tc.projectFileID)
		if err != nil {
			t.Fatalf("IsVisibleFile(%d) returned error: %v", tc.projectFileID, err)
		}
		if got != tc.want {
			t.Fatalf("IsVisibleFile(%d)=%t, want %t", tc.projectFileID, got, tc.want)
		}
	}
}

func TestDomainServicePropagatesReaderError(t *testing.T) {
	t.Parallel()

	svc := taskfiledomain.NewDomainService(&readerStub{err: errTaskFileReaderBoom})
	_, err := svc.ListVisibleLeafFileIDsByProject(context.Background(), 1)
	if err == nil || !errors.Is(err, errTaskFileReaderBoom) {
		t.Fatalf("expected wrapped reader error, got %v", err)
	}
}
