package client

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/projectfile"
)

var (
	errProjectFileFetchFailed     = errors.New("fetch project file failed")
	errRemoteURLEmpty             = errors.New("remote url is empty")
	errUnsupportedRemoteURLScheme = errors.New("unsupported remote url scheme")
)

// PHPProjectFileRPCClient 通过 IPC 调用 PHP 侧项目文件网关。
type PHPProjectFileRPCClient struct {
	server *unixsocket.Server
	logger *logging.SugaredLogger
}

type projectFileRPCResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// NewPHPProjectFileRPCClient 创建项目文件 RPC 客户端。
func NewPHPProjectFileRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPProjectFileRPCClient {
	return &PHPProjectFileRPCClient{
		server: server,
		logger: logger,
	}
}

// Resolve 调用 PHP 侧解析指定项目文件的当前内容。
func (c *PHPProjectFileRPCClient) Resolve(ctx context.Context, projectFileID int64) (*projectfile.ResolveResult, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result projectFileRPCResponse[projectfile.ResolveResult]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileResolve, map[string]any{
		"project_file_id": projectFileID,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 项目文件解析失败", "project_file_id", projectFileID, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return &result.Data, nil
}

// ListByProject 调用 PHP 侧列出项目下的叶子文件。
func (c *PHPProjectFileRPCClient) ListByProject(ctx context.Context, projectID int64) ([]projectfile.ListItem, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result projectFileRPCResponse[[]projectfile.ListItem]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileListByProject, map[string]any{
		"project_id": projectID,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 项目文件列表失败", "project_id", projectID, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}

// ListWorkspaces 调用 PHP 侧列出当前用户可见工作区。
func (c *PHPProjectFileRPCClient) ListWorkspaces(
	ctx context.Context,
	organizationCode string,
	userID string,
	offset int,
	limit int,
) (*projectfile.WorkspacePage, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result projectFileRPCResponse[projectfile.WorkspacePage]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileListWorkspaces, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"offset": offset,
		"limit":  limit,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 工作区列表失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	page := result.Data
	return &page, nil
}

// ListProjects 调用 PHP 侧列出工作区下项目。
func (c *PHPProjectFileRPCClient) ListProjects(
	ctx context.Context,
	organizationCode string,
	userID string,
	workspaceID int64,
	offset int,
	limit int,
) (*projectfile.ProjectPage, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result projectFileRPCResponse[projectfile.ProjectPage]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileListProjects, map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"workspace_id": workspaceID,
		"offset":       offset,
		"limit":        limit,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 项目列表失败", "workspace_id", workspaceID, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	page := result.Data
	return &page, nil
}

// ListTreeNodes 调用 PHP 侧列出项目树节点。
func (c *PHPProjectFileRPCClient) ListTreeNodes(ctx context.Context, parentType string, parentRef int64) ([]projectfile.TreeNode, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	var result projectFileRPCResponse[[]projectfile.TreeNode]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileListTreeNodes, map[string]any{
		"parent_type": parentType,
		"parent_ref":  parentRef,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 项目树节点失败", "parent_type", parentType, "parent_ref", parentRef, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}

// GetLink 调用 PHP 侧获取项目文件访问链接。
func (c *PHPProjectFileRPCClient) GetLink(ctx context.Context, projectFileID int64, expire time.Duration) (string, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return "", ErrNoClientConnected
	}

	expireSeconds := int64(expire.Seconds())
	if expireSeconds <= 0 {
		expireSeconds = int64((10 * time.Minute).Seconds())
	}

	var result projectFileRPCResponse[struct {
		URL string `json:"url"`
	}]
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeProjectFileGetLink, map[string]any{
		"project_file_id": projectFileID,
		"expire_seconds":  expireSeconds,
	}, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 项目文件链接失败", "project_file_id", projectFileID, "error", err)
		}
		return "", errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if result.Code == http.StatusNotFound {
			return "", fmt.Errorf("%w: code=%d, message=%s", projectfile.ErrFileUnavailable, result.Code, result.Message)
		}
		return "", fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return strings.TrimSpace(result.Data.URL), nil
}

// Fetch 通过临时链接拉取项目文件流。
func (c *PHPProjectFileRPCClient) Fetch(ctx context.Context, projectFileID int64) (io.ReadCloser, error) {
	link, err := c.GetLink(ctx, projectFileID, 10*time.Minute)
	if err != nil {
		return nil, err
	}
	target, err := normalizeRemoteURL(link)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}
	resp, err := roundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("%w: status=%d", errProjectFileFetchFailed, resp.StatusCode)
	}
	return resp.Body, nil
}

func normalizeRemoteURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errRemoteURLEmpty
	}
	parsed, err := neturl.ParseRequestURI(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid remote url: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: %s", errUnsupportedRemoteURLScheme, parsed.Scheme)
	}
	return parsed.String(), nil
}
