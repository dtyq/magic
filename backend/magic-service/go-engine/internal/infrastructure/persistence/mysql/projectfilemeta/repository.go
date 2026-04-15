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
func (r *Repository) FindByID(ctx context.Context, projectFileID int64) (meta *projectfile.Meta, err error) {
	if r == nil || r.client == nil {
		return nil, errProjectFileMetadataRepositoryNil
	}
	if projectFileID <= 0 {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}

	meta, err = r.findByIDFromTaskFiles(ctx, projectFileID)
	if err == nil || !errors.Is(err, sql.ErrNoRows) {
		return meta, err
	}
	return r.findByIDFromProjectFiles(ctx, projectFileID)
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
	return mapTaskFileMetaByIDRowToProjectFileMeta(item), nil
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
	return mapProjectFileMetaByIDRowToProjectFileMeta(item), nil
}

func mapTaskFileMetaByIDRowToProjectFileMeta(row mysqlsqlc.FindTaskFileMetaByIDRow) *projectfile.Meta {
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

func mapProjectFileMetaByIDRowToProjectFileMeta(row mysqlsqlc.FindProjectFileMetaByIDRow) *projectfile.Meta {
	return buildProjectFileMeta(projectFileMetaRecord{
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
	parentID         uint64
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

func (r *Repository) String() string {
	return fmt.Sprintf("projectfilemeta.Repository<%p>", r)
}
