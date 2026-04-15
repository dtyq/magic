// Package taskfile 提供 task file 可见性读取的 MySQL 实现。
package taskfile

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
	errTaskFileRepositoryNil = errors.New("task file repository is nil")
	errNegativeInt64Value    = errors.New("int64 value cannot be negative")
)

// Repository 提供 task file 可见性读取能力。
type Repository struct {
	client  *mysqlclient.SQLCClient
	queries *mysqlsqlc.Queries
}

// NewRepository 创建 task file MySQL 仓储。
func NewRepository(client *mysqlclient.SQLCClient) *Repository {
	var queries *mysqlsqlc.Queries
	if client != nil {
		queries = client.Q()
	}
	return &Repository{client: client, queries: queries}
}

// FindByID 按项目文件 ID 读取 task file 元数据。
func (r *Repository) FindByID(ctx context.Context, projectFileID int64) (meta *projectfile.Meta, err error) {
	if r == nil || r.client == nil {
		return nil, errTaskFileRepositoryNil
	}
	if projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}

	meta, err = r.findByIDFromTaskFiles(ctx, projectFileID)
	if err == nil {
		return meta, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	meta, err = r.findByIDFromProjectFiles(ctx, projectFileID)
	if errors.Is(err, sql.ErrNoRows) {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return meta, err
}

// FindRootDirectoryByProjectID 读取项目根目录节点。
func (r *Repository) FindRootDirectoryByProjectID(ctx context.Context, projectID int64) (meta *projectfile.Meta, err error) {
	if r == nil || r.client == nil {
		return nil, errTaskFileRepositoryNil
	}
	if projectID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}

	projectIDUint64, err := positiveInt64ToUint64(projectID, "project_id")
	if err != nil {
		return nil, fmt.Errorf("convert project id: %w", err)
	}

	item, err := r.queries.FindTaskFileRootDirectoryByProjectID(ctx, projectIDUint64)
	if errors.Is(err, sql.ErrNoRows) {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find task file root directory: %w", err)
	}
	return mapTaskFileRootDirectoryByProjectIDRowToMeta(item), nil
}

// ListVisibleChildrenByParent 列出目录下可见的直接子节点。
func (r *Repository) ListVisibleChildrenByParent(
	ctx context.Context,
	projectID int64,
	parentID int64,
	limit int,
) ([]*projectfile.Meta, error) {
	if r == nil || r.client == nil {
		return nil, errTaskFileRepositoryNil
	}
	if projectID <= 0 || parentID <= 0 {
		return []*projectfile.Meta{}, nil
	}
	if limit <= 0 {
		limit = 1000
	}

	projectIDUint64, err := positiveInt64ToUint64(projectID, "project_id")
	if err != nil {
		return nil, fmt.Errorf("convert project id: %w", err)
	}

	items, err := r.queries.ListVisibleTaskFileChildrenByParent(ctx, mysqlsqlc.ListVisibleTaskFileChildrenByParentParams{
		ProjectID: projectIDUint64,
		ParentID: sql.NullInt64{
			Int64: parentID,
			Valid: true,
		},
		Limit: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("list visible task file children by parent: %w", err)
	}
	return mapTaskFileChildrenByParentRowsToMetas(items), nil
}

// ListVisibleChildrenByParents 批量列出多个目录下的可见子节点。
func (r *Repository) ListVisibleChildrenByParents(
	ctx context.Context,
	projectID int64,
	parentIDs []int64,
	limit int,
) ([]*projectfile.Meta, error) {
	if r == nil || r.client == nil {
		return nil, errTaskFileRepositoryNil
	}
	parentIDs = normalizePositiveIDs(parentIDs)
	if projectID <= 0 || len(parentIDs) == 0 {
		return []*projectfile.Meta{}, nil
	}
	if limit <= 0 {
		limit = 1000
	}

	parentIDParams := make([]sql.NullInt64, 0, len(parentIDs))
	for _, parentID := range parentIDs {
		parentIDParams = append(parentIDParams, sql.NullInt64{
			Int64: parentID,
			Valid: true,
		})
	}
	projectIDUint64, err := positiveInt64ToUint64(projectID, "project_id")
	if err != nil {
		return nil, fmt.Errorf("convert project id: %w", err)
	}
	items, err := r.queries.ListVisibleTaskFileChildrenByParents(ctx, mysqlsqlc.ListVisibleTaskFileChildrenByParentsParams{
		ProjectID: projectIDUint64,
		ParentIds: parentIDParams,
		Limit:     int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("list visible task file children by parents: %w", err)
	}
	return mapTaskFileChildrenByParentsRowsToMetas(items), nil
}

func (r *Repository) findByIDFromTaskFiles(ctx context.Context, projectFileID int64) (*projectfile.Meta, error) {
	projectFileIDUint64, err := positiveInt64ToUint64(projectFileID, "project_file_id")
	if err != nil {
		return nil, fmt.Errorf("convert project file id: %w", err)
	}

	item, err := r.queries.FindTaskFileMetaByID(ctx, projectFileIDUint64)
	if err != nil {
		return nil, fmt.Errorf("find task file meta by id: %w", err)
	}
	return mapTaskFileMetaByIDRowToMeta(item), nil
}

func (r *Repository) findByIDFromProjectFiles(ctx context.Context, projectFileID int64) (*projectfile.Meta, error) {
	projectFileIDUint64, err := positiveInt64ToUint64(projectFileID, "project_file_id")
	if err != nil {
		return nil, fmt.Errorf("convert project file id: %w", err)
	}

	item, err := r.queries.FindProjectFileMetaByID(ctx, projectFileIDUint64)
	if err != nil {
		return nil, fmt.Errorf("find project file meta by id: %w", err)
	}
	return mapProjectFileMetaByIDRowToMeta(item), nil
}

func mapTaskFileMetaByIDRowToMeta(row mysqlsqlc.FindTaskFileMetaByIDRow) *projectfile.Meta {
	return buildMeta(metaRecord{
		organizationCode: row.OrganizationCode,
		projectID:        row.ProjectID,
		fileID:           row.FileID,
		fileKey:          row.FileKey,
		fileName:         row.FileName,
		fileExtension:    row.FileExtension,
		fileSize:         row.FileSize,
		isDirectory:      row.IsDirectory,
		isHidden:         row.IsHidden,
		updatedAt:        row.UpdatedAt,
		deletedAt:        row.DeletedAt,
		parentID:         row.ParentID,
	})
}

func mapTaskFileRootDirectoryByProjectIDRowToMeta(row mysqlsqlc.FindTaskFileRootDirectoryByProjectIDRow) *projectfile.Meta {
	return buildMeta(metaRecord{
		organizationCode: row.OrganizationCode,
		projectID:        row.ProjectID,
		fileID:           row.FileID,
		fileKey:          row.FileKey,
		fileName:         row.FileName,
		fileExtension:    row.FileExtension,
		fileSize:         row.FileSize,
		isDirectory:      row.IsDirectory,
		isHidden:         row.IsHidden,
		updatedAt:        row.UpdatedAt,
		deletedAt:        row.DeletedAt,
		parentID:         row.ParentID,
	})
}

func mapProjectFileMetaByIDRowToMeta(row mysqlsqlc.FindProjectFileMetaByIDRow) *projectfile.Meta {
	return buildMeta(metaRecord{
		organizationCode: row.OrganizationCode,
		projectID:        row.ProjectID,
		fileID:           row.FileID,
		fileKey:          row.FileKey,
		fileName:         row.FileName,
		fileExtension:    row.FileExtension,
		fileSize:         row.FileSize,
		updatedAt:        row.UpdatedAt,
	})
}

func mapTaskFileChildrenByParentRowsToMetas(rows []mysqlsqlc.ListVisibleTaskFileChildrenByParentRow) []*projectfile.Meta {
	items := make([]*projectfile.Meta, 0, len(rows))
	for _, row := range rows {
		items = append(items, buildMeta(metaRecord{
			organizationCode: row.OrganizationCode,
			projectID:        row.ProjectID,
			fileID:           row.FileID,
			fileKey:          row.FileKey,
			fileName:         row.FileName,
			fileExtension:    row.FileExtension,
			fileSize:         row.FileSize,
			isDirectory:      row.IsDirectory,
			isHidden:         row.IsHidden,
			updatedAt:        row.UpdatedAt,
			deletedAt:        row.DeletedAt,
			parentID:         row.ParentID,
		}))
	}
	return items
}

func mapTaskFileChildrenByParentsRowsToMetas(rows []mysqlsqlc.ListVisibleTaskFileChildrenByParentsRow) []*projectfile.Meta {
	items := make([]*projectfile.Meta, 0, len(rows))
	for _, row := range rows {
		items = append(items, buildMeta(metaRecord{
			organizationCode: row.OrganizationCode,
			projectID:        row.ProjectID,
			fileID:           row.FileID,
			fileKey:          row.FileKey,
			fileName:         row.FileName,
			fileExtension:    row.FileExtension,
			fileSize:         row.FileSize,
			isDirectory:      row.IsDirectory,
			isHidden:         row.IsHidden,
			updatedAt:        row.UpdatedAt,
			deletedAt:        row.DeletedAt,
			parentID:         row.ParentID,
		}))
	}
	return items
}

type metaRecord struct {
	organizationCode string
	projectID        uint64
	fileID           uint64
	fileKey          string
	fileName         string
	fileExtension    string
	fileSize         uint64
	isDirectory      bool
	isHidden         bool
	updatedAt        time.Time
	deletedAt        sql.NullTime
	parentID         uint64
}

func buildMeta(record metaRecord) *projectfile.Meta {
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
		IsHidden:         record.isHidden,
		UpdatedAt:        record.updatedAt.Format("2006-01-02 15:04:05"),
		ParentID:         convert.ClampToInt64(record.parentID),
	}
	meta.RelativeFilePath = projectfile.InferRelativeFilePath(meta.FileKey)
	if record.deletedAt.Valid {
		meta.Status = "deleted"
		meta.DeletedAt = record.deletedAt.Time.Format("2006-01-02 15:04:05")
	}
	return meta
}

func positiveInt64ToUint64(value int64, fieldName string) (uint64, error) {
	if value < 0 {
		return 0, fmt.Errorf("%w: %s: %d", errNegativeInt64Value, fieldName, value)
	}
	return uint64(value), nil
}

func normalizePositiveIDs(ids []int64) []int64 {
	if len(ids) == 0 {
		return nil
	}
	result := make([]int64, 0, len(ids))
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}
