// Package service 提供 MagicFS 应用层编排。
package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	domainmagicfs "magic/internal/domain/magicfs"
)

// FileVersionRepository 定义 MagicFS 文件版本读取能力。
type FileVersionRepository interface {
	GetMetadataVersion(ctx context.Context, fileID int64) (int64, error)
}

// FileAccessAuthorizer 定义 MagicFS 文件访问鉴权能力。
type FileAccessAuthorizer interface {
	AuthorizeFileViewer(ctx context.Context, headers map[string][]string, fileID string) error
}

// FileVersionService 编排 MagicFS 文件版本查询。
type FileVersionService struct {
	repository FileVersionRepository
	authorizer FileAccessAuthorizer
}

// NewFileVersionService 创建 MagicFS 文件版本应用服务。
func NewFileVersionService(repository FileVersionRepository, authorizer FileAccessAuthorizer) *FileVersionService {
	return &FileVersionService{
		repository: repository,
		authorizer: authorizer,
	}
}

// GetFileVersion 校验访问权限后读取文件元数据版本号。
func (s *FileVersionService) GetFileVersion(ctx context.Context, headers map[string][]string, rawFileID string) (int64, error) {
	if s == nil || s.repository == nil || s.authorizer == nil {
		return 0, ErrServiceNotInitialized
	}

	fileIDText := strings.TrimSpace(rawFileID)
	if err := s.authorizer.AuthorizeFileViewer(ctx, headers, fileIDText); err != nil {
		return 0, fmt.Errorf("authorize magicfs file viewer: %w", err)
	}

	fileID, err := parseFileID(fileIDText)
	if err != nil {
		return 0, err
	}

	version, err := s.repository.GetMetadataVersion(ctx, fileID)
	if errors.Is(err, domainmagicfs.ErrFileNotFound) {
		return 0, ErrFileNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("get magicfs metadata version: %w", err)
	}
	return version, nil
}

func parseFileID(raw string) (int64, error) {
	fileID, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || fileID <= 0 {
		return 0, ErrFileNotFound
	}
	return fileID, nil
}
