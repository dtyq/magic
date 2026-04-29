// Package projectfilemeta 提供项目文件轻量元数据读取实现。
package projectfilemeta

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/projectfile"
	"magic/pkg/convert"
)

var (
	errProjectFileMetadataRepositoryNil = errors.New("project file metadata repository is nil")
	errNegativeInt64Value               = errors.New("int64 value cannot be negative")
)

const maxTaskFileAncestorDepth = 64

// Repository 提供项目文件轻量元数据读取能力。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

// NewRepository 创建项目文件轻量元数据仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// FindByID 按项目文件 ID 读取轻量元数据。
// magic_super_agent_project_files 已经退场，这里只允许从
// magic_super_agent_task_files 读取，不再做旧表 fallback。
func (r *Repository) FindByID(ctx context.Context, projectFileID int64) (meta *projectfile.Meta, err error) {
	if r == nil || r.client == nil {
		return nil, errProjectFileMetadataRepositoryNil
	}
	if projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}

	meta, err = r.findByIDFromTaskFiles(ctx, projectFileID)
	if errors.Is(err, sql.ErrNoRows) {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, err
}

// ListAncestorFolderIDs 按当前位置读取项目文件的祖先目录 ID。
func (r *Repository) ListAncestorFolderIDs(ctx context.Context, projectFileID int64) ([]int64, error) {
	if r == nil || r.client == nil {
		return nil, errProjectFileMetadataRepositoryNil
	}
	if projectFileID <= 0 {
		return nil, nil
	}
	projectFileIDUint64, err := positiveInt64ToUint64(projectFileID, "project_file_id")
	if err != nil {
		return nil, fmt.Errorf("convert project file id: %w", err)
	}

	node, err := r.queries.FindTaskFileParentLinkByID(ctx, projectFileIDUint64)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find task file parent link by id: %w", err)
	}
	parentID, ok, err := taskFileParentID(node.ParentID)
	if err != nil {
		return nil, fmt.Errorf("convert task file parent id: %w", err)
	}
	if !ok {
		return nil, nil
	}

	links, err := r.queries.ListTaskFileParentLinksByProjectID(ctx, node.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("list task file parent links by project id: %w", err)
	}
	linkByFileID := make(map[uint64]mysqlsqlc.ListTaskFileParentLinksByProjectIDRow, len(links))
	for _, link := range links {
		linkByFileID[link.FileID] = link
	}

	ids := make([]int64, 0, maxTaskFileAncestorDepth)
	for range maxTaskFileAncestorDepth {
		ancestor, ok := linkByFileID[parentID]
		if !ok {
			break
		}
		if ancestor.IsDirectory {
			ids = append(ids, convert.ClampToInt64(ancestor.FileID))
		}

		nextParentID, ok, err := taskFileParentID(ancestor.ParentID)
		if err != nil {
			return nil, fmt.Errorf("convert task file ancestor parent id: %w", err)
		}
		if !ok {
			break
		}
		parentID = nextParentID
	}
	return ids, nil
}

func (r *Repository) findByIDFromTaskFiles(ctx context.Context, projectFileID int64) (*projectfile.Meta, error) {
	// 这里有意只走 task_files。project_files 的旧契约已经废弃，避免在
	// Go 侧继续维持双表兼容。
	projectFileIDUint64, err := positiveInt64ToUint64(projectFileID, "project_file_id")
	if err != nil {
		return nil, fmt.Errorf("convert project file id: %w", err)
	}

	item, err := r.queries.FindTaskFileMetaByID(ctx, projectFileIDUint64)
	if err != nil {
		return nil, fmt.Errorf("find task file meta by id: %w", err)
	}
	return mapTaskFileMetaByIDRowToProjectFileMeta(item), nil
}

func mapTaskFileMetaByIDRowToProjectFileMeta(row mysqlsqlc.MagicSuperAgentTaskFile) *projectfile.Meta {
	return buildProjectFileMeta(projectFileMetaRecord{
		organizationCode: row.OrganizationCode,
		projectID:        row.ProjectID,
		fileID:           row.FileID,
		fileKey:          row.FileKey,
		fileName:         row.FileName,
		fileExtension:    row.FileExtension,
		fileSize:         row.FileSize,
		isDirectory:      row.IsDirectory,
		updatedAt:        row.UpdatedAt,
		deletedAt:        row.DeletedAt,
		parentID:         row.ParentID,
	})
}

type projectFileMetaRecord struct {
	organizationCode string
	projectID        uint64
	fileID           uint64
	fileKey          string
	fileName         string
	fileExtension    string
	fileSize         uint64
	isDirectory      bool
	updatedAt        time.Time
	deletedAt        sql.NullTime
	parentID         sql.NullInt64
}

func buildProjectFileMeta(record projectFileMetaRecord) *projectfile.Meta {
	meta := &projectfile.Meta{
		Status:           "active",
		OrganizationCode: record.organizationCode,
		ProjectID:        convert.ClampToInt64(record.projectID),
		ProjectFileID:    convert.ClampToInt64(record.fileID),
		FileKey:          record.fileKey,
		FileName:         record.fileName,
		FileExtension:    projectfile.NormalizeExtension(record.fileName, record.fileExtension),
		FileSize:         convert.ClampToInt64(record.fileSize),
		IsDirectory:      record.isDirectory,
		UpdatedAt:        record.updatedAt.Format("2006-01-02 15:04:05"),
		ParentID:         nullInt64OrZero(record.parentID),
	}
	meta.RelativeFilePath = projectfile.InferRelativeFilePath(meta.FileKey)
	if record.deletedAt.Valid {
		meta.Status = "deleted"
		meta.DeletedAt = record.deletedAt.Time.Format("2006-01-02 15:04:05")
	}
	return meta
}

func nullInt64OrZero(value sql.NullInt64) int64 {
	if !value.Valid {
		return 0
	}
	return value.Int64
}

func taskFileParentID(value sql.NullInt64) (uint64, bool, error) {
	if !value.Valid {
		return 0, false, nil
	}
	id, err := positiveInt64ToUint64(value.Int64, "parent_id")
	if err != nil {
		return 0, false, err
	}
	return id, true, nil
}

func positiveInt64ToUint64(value int64, fieldName string) (uint64, error) {
	if value < 0 {
		return 0, fmt.Errorf("%w: %s: %d", errNegativeInt64Value, fieldName, value)
	}
	return uint64(value), nil
}

func (r *Repository) String() string {
	return fmt.Sprintf("projectfilemeta.Repository<%p>", r)
}
