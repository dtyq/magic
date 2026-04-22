// Package taskfile 定义 task file 可见性领域服务。
package taskfile

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"magic/internal/pkg/projectfile"
)

// ErrTaskFileReaderRequired 表示缺少 task file reader 依赖。
var ErrTaskFileReaderRequired = errors.New("task file reader is required")

const (
	defaultTreeNodeLimit = 1000
	defaultWalkBatchSize = 1000
	defaultWalkMaxDepth  = 10
)

// Reader 定义 task file 领域对可见文件的读取能力。
type Reader interface {
	FindByID(ctx context.Context, projectFileID int64) (*projectfile.Meta, error)
	FindRootDirectoryByProjectID(ctx context.Context, projectID int64) (*projectfile.Meta, error)
	ListVisibleChildrenByParent(
		ctx context.Context,
		projectID int64,
		parentID int64,
		limit int,
	) ([]*projectfile.Meta, error)
	ListVisibleChildrenByParents(
		ctx context.Context,
		projectID int64,
		parentIDs []int64,
		limit int,
	) ([]*projectfile.Meta, error)
}

// DomainService 封装 task file 的可见性规则。
type DomainService struct {
	reader Reader
}

type visibilityCache struct {
	metasByID   map[int64]*projectfile.Meta
	visibleByID map[int64]bool
}

type visibleChildBatch struct {
	nextQueue []int64
	fileIDs   []int64
}

// NewDomainService 创建 task file 领域服务。
func NewDomainService(reader Reader) *DomainService {
	return &DomainService{reader: reader}
}

// IsVisibleFile 判断文件当前是否对知识库侧可见。
func (s *DomainService) IsVisibleFile(ctx context.Context, projectFileID int64) (bool, error) {
	meta, err := s.loadVisibleMeta(ctx, projectFileID)
	if err != nil {
		return false, err
	}
	return meta != nil && !meta.IsDirectory, nil
}

// ListVisibleTreeNodesByProject 列出项目根目录下当前可见的直接子节点。
func (s *DomainService) ListVisibleTreeNodesByProject(
	ctx context.Context,
	projectID int64,
) ([]projectfile.TreeNode, error) {
	root, err := s.findVisibleRootDirectory(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if root == nil {
		return []projectfile.TreeNode{}, nil
	}
	return s.listVisibleTreeNodes(ctx, root.ProjectID, root)
}

// ListVisibleTreeNodesByFolder 列出目录下当前可见的直接子节点。
func (s *DomainService) ListVisibleTreeNodesByFolder(
	ctx context.Context,
	folderID int64,
) ([]projectfile.TreeNode, error) {
	folder, err := s.findVisibleDirectory(ctx, folderID)
	if err != nil {
		return nil, err
	}
	if folder == nil {
		return []projectfile.TreeNode{}, nil
	}
	return s.listVisibleTreeNodes(ctx, folder.ProjectID, folder)
}

// ListVisibleLeafFileIDsByProject 列出项目中当前可见的全部叶子文件 ID。
func (s *DomainService) ListVisibleLeafFileIDsByProject(
	ctx context.Context,
	projectID int64,
) ([]int64, error) {
	root, err := s.findVisibleRootDirectory(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if root == nil {
		return []int64{}, nil
	}
	return s.walkVisibleLeafFileIDs(ctx, root.ProjectID, root.ProjectFileID)
}

// ListVisibleLeafFileIDsByFolder 列出目录下当前可见的全部叶子文件 ID。
func (s *DomainService) ListVisibleLeafFileIDsByFolder(
	ctx context.Context,
	folderID int64,
) ([]int64, error) {
	folder, err := s.findVisibleDirectory(ctx, folderID)
	if err != nil {
		return nil, err
	}
	if folder == nil {
		return []int64{}, nil
	}
	return s.walkVisibleLeafFileIDs(ctx, folder.ProjectID, folder.ProjectFileID)
}

// MetaToTreeNode 将轻量元数据映射为树节点。
func MetaToTreeNode(meta *projectfile.Meta) projectfile.TreeNode {
	if meta == nil {
		return projectfile.TreeNode{}
	}
	return projectfile.TreeNode{
		ProjectID:        meta.ProjectID,
		ProjectFileID:    meta.ProjectFileID,
		ParentID:         meta.ParentID,
		FileName:         strings.TrimSpace(meta.FileName),
		FileExtension:    strings.TrimSpace(meta.FileExtension),
		RelativeFilePath: strings.TrimSpace(meta.RelativeFilePath),
		IsDirectory:      meta.IsDirectory,
		UpdatedAt:        strings.TrimSpace(meta.UpdatedAt),
	}
}

func (s *DomainService) listVisibleTreeNodes(
	ctx context.Context,
	projectID int64,
	parent *projectfile.Meta,
) ([]projectfile.TreeNode, error) {
	if s == nil || s.reader == nil {
		return nil, ErrTaskFileReaderRequired
	}
	if parent == nil || parent.ProjectFileID <= 0 {
		return []projectfile.TreeNode{}, nil
	}

	cache := newVisibilityCache()
	cache.storeVisible(parent)

	items, err := s.reader.ListVisibleChildrenByParent(ctx, projectID, parent.ProjectFileID, defaultTreeNodeLimit)
	if err != nil {
		return nil, fmt.Errorf("list visible children: %w", err)
	}
	nodes := make([]projectfile.TreeNode, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		visible, err := s.resolveVisibility(ctx, item, cache)
		if err != nil {
			return nil, err
		}
		if !visible {
			continue
		}
		nodes = append(nodes, MetaToTreeNode(item))
	}
	return nodes, nil
}

func (s *DomainService) walkVisibleLeafFileIDs(
	ctx context.Context,
	projectID int64,
	rootParentID int64,
) ([]int64, error) {
	if s == nil || s.reader == nil {
		return nil, ErrTaskFileReaderRequired
	}

	cache := newVisibilityCache()
	cache.storeVisible(&projectfile.Meta{
		ProjectID:     projectID,
		ProjectFileID: rootParentID,
		IsDirectory:   true,
	})

	queue := []int64{rootParentID}
	seenFolders := map[int64]struct{}{rootParentID: {}}
	seenFiles := make(map[int64]struct{})
	fileIDs := make([]int64, 0)

	for depth := 0; depth < defaultWalkMaxDepth && len(queue) > 0; depth++ {
		children, err := s.reader.ListVisibleChildrenByParents(ctx, projectID, queue, defaultWalkBatchSize)
		if err != nil {
			return nil, fmt.Errorf("list visible descendants: %w", err)
		}
		if len(children) == 0 {
			break
		}

		batch, err := s.collectVisibleChildBatch(ctx, children, cache, seenFolders, seenFiles)
		if err != nil {
			return nil, err
		}
		fileIDs = append(fileIDs, batch.fileIDs...)
		queue = batch.nextQueue
	}

	return fileIDs, nil
}

func (s *DomainService) collectVisibleChildBatch(
	ctx context.Context,
	children []*projectfile.Meta,
	cache *visibilityCache,
	seenFolders map[int64]struct{},
	seenFiles map[int64]struct{},
) (visibleChildBatch, error) {
	batch := visibleChildBatch{
		nextQueue: make([]int64, 0, len(children)),
		fileIDs:   make([]int64, 0, len(children)),
	}
	for _, child := range children {
		if child == nil || child.ProjectFileID <= 0 {
			continue
		}
		visible, err := s.resolveVisibility(ctx, child, cache)
		if err != nil {
			return visibleChildBatch{}, err
		}
		if !visible {
			continue
		}
		if child.IsDirectory {
			if _, exists := seenFolders[child.ProjectFileID]; exists {
				continue
			}
			seenFolders[child.ProjectFileID] = struct{}{}
			batch.nextQueue = append(batch.nextQueue, child.ProjectFileID)
			continue
		}
		if _, exists := seenFiles[child.ProjectFileID]; exists {
			continue
		}
		seenFiles[child.ProjectFileID] = struct{}{}
		batch.fileIDs = append(batch.fileIDs, child.ProjectFileID)
	}
	return batch, nil
}

func (s *DomainService) loadVisibleMeta(ctx context.Context, projectFileID int64) (meta *projectfile.Meta, err error) {
	if s == nil || s.reader == nil {
		return nil, ErrTaskFileReaderRequired
	}
	if projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}

	cache := newVisibilityCache()
	meta, err = cache.loadMeta(ctx, s.reader, projectFileID)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	visible, err := s.resolveVisibility(ctx, meta, cache)
	if err != nil {
		return nil, err
	}
	if !visible {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, nil
}

func (s *DomainService) findVisibleRootDirectory(
	ctx context.Context,
	projectID int64,
) (root *projectfile.Meta, err error) {
	if s == nil || s.reader == nil {
		return nil, ErrTaskFileReaderRequired
	}
	if projectID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	root, err = s.reader.FindRootDirectoryByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("find task file root directory: %w", err)
	}
	if root == nil || !root.IsDirectory || isMetaDeleted(root) {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	if root.IsHidden && !isSyntheticProjectRoot(root) {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return root, nil
}

func (s *DomainService) findVisibleDirectory(
	ctx context.Context,
	projectFileID int64,
) (meta *projectfile.Meta, err error) {
	meta, err = s.loadVisibleMeta(ctx, projectFileID)
	if err != nil {
		return nil, err
	}
	if meta == nil || !meta.IsDirectory {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, nil
}

func newVisibilityCache() *visibilityCache {
	return &visibilityCache{
		metasByID:   make(map[int64]*projectfile.Meta),
		visibleByID: make(map[int64]bool),
	}
}

func (c *visibilityCache) storeVisible(meta *projectfile.Meta) {
	if c == nil || meta == nil || meta.ProjectFileID <= 0 {
		return
	}
	c.metasByID[meta.ProjectFileID] = meta
	c.visibleByID[meta.ProjectFileID] = true
}

func (c *visibilityCache) loadMeta(
	ctx context.Context,
	reader Reader,
	projectFileID int64,
) (*projectfile.Meta, error) {
	if projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	if meta, ok := c.metasByID[projectFileID]; ok {
		return meta, nil
	}
	meta, err := reader.FindByID(ctx, projectFileID)
	if err != nil {
		return nil, fmt.Errorf("find task file by id: %w", err)
	}
	c.metasByID[projectFileID] = meta
	return meta, nil
}

func (s *DomainService) resolveVisibility(
	ctx context.Context,
	meta *projectfile.Meta,
	cache *visibilityCache,
) (bool, error) {
	if s == nil || s.reader == nil {
		return false, ErrTaskFileReaderRequired
	}
	if meta == nil || meta.ProjectFileID <= 0 {
		return false, nil
	}
	if visible, ok := cache.visibleByID[meta.ProjectFileID]; ok {
		return visible, nil
	}

	cache.metasByID[meta.ProjectFileID] = meta
	if isSyntheticProjectRoot(meta) {
		visible := !isMetaDeleted(meta)
		cache.visibleByID[meta.ProjectFileID] = visible
		return visible, nil
	}
	if !isMetaVisible(meta) {
		cache.visibleByID[meta.ProjectFileID] = false
		return false, nil
	}
	if meta.ParentID <= 0 {
		cache.visibleByID[meta.ProjectFileID] = true
		return true, nil
	}

	parent, err := cache.loadMeta(ctx, s.reader, meta.ParentID)
	if err != nil {
		return false, err
	}
	parentVisible, err := s.resolveVisibility(ctx, parent, cache)
	if err != nil {
		return false, err
	}
	cache.visibleByID[meta.ProjectFileID] = parentVisible
	return parentVisible, nil
}

func isMetaVisible(meta *projectfile.Meta) bool {
	if meta == nil {
		return false
	}
	return !isMetaDeleted(meta) && !meta.IsHidden
}

func isMetaDeleted(meta *projectfile.Meta) bool {
	if meta == nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(meta.Status), "deleted")
}

func isSyntheticProjectRoot(meta *projectfile.Meta) bool {
	if meta == nil {
		return false
	}
	return meta.IsDirectory && meta.ParentID <= 0
}
