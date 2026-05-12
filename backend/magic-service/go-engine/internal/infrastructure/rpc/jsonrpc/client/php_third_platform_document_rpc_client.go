package client

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"

	"magic/internal/constants"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/jsoncompat"
	"magic/internal/pkg/thirdplatform"
)

// PHPThirdPlatformDocumentRPCClient 通过 IPC 调用 PHP 侧第三方文档解析网关。
type PHPThirdPlatformDocumentRPCClient struct {
	server             *unixsocket.Server
	logger             *logging.SugaredLogger
	knowledgeBaseCache *RedisThirdPlatformKnowledgeBaseCache
	isClientReady      func() bool
	callResolveRPC     func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformDocumentResolveResponse,
	) error
	callListKnowledgeBasesRPC func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformKnowledgeBaseListResponse,
	) error
	callListTreeNodesRPC func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformTreeNodeListResponse,
	) error
	callResolveNodeRPC func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformNodeResolveResponse,
	) error
}

type thirdPlatformDocumentResolveResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		SourceKind   string                       `json:"source_kind"`
		RawContent   string                       `json:"raw_content"`
		DownloadURL  string                       `json:"download_url"`
		DownloadURLs []string                     `json:"download_urls"`
		Content      string                       `json:"content"`
		DocType      int                          `json:"doc_type"`
		DocumentFile thirdPlatformDocumentFileMap `json:"document_file"`
	} `json:"data"`
}

type thirdPlatformDocumentFileMap map[string]any

func (m *thirdPlatformDocumentFileMap) UnmarshalJSON(data []byte) error {
	decoded := map[string]any{}
	if err := jsoncompat.UnmarshalObjectOrEmpty(data, map[string]any{}, &decoded); err != nil {
		return fmt.Errorf("decode third platform document_file: %w", err)
	}
	*m = thirdPlatformDocumentFileMap(decoded)
	return nil
}

type thirdPlatformDocumentExpandResponse struct {
	Code    int              `json:"code"`
	Message string           `json:"message"`
	Data    []map[string]any `json:"data"`
}

type thirdPlatformNodeResolveResponse struct {
	Code    int                              `json:"code"`
	Message string                           `json:"message"`
	Data    *thirdplatform.NodeResolveResult `json:"data"`
}

const (
	thirdPlatformDocumentUnavailableCode = 40404
	thirdPlatformPermissionDeniedCode    = 42003
)

// ErrThirdPlatformIdentityMissing 表示请求缺少第三方平台身份信息。
var ErrThirdPlatformIdentityMissing = thirdplatform.ErrIdentityMissing

// NewPHPThirdPlatformDocumentRPCClient 创建客户端。
func NewPHPThirdPlatformDocumentRPCClient(
	server *unixsocket.Server,
	logger *logging.SugaredLogger,
	redisClient *redis.Client,
) *PHPThirdPlatformDocumentRPCClient {
	return &PHPThirdPlatformDocumentRPCClient{
		server:             server,
		logger:             logger,
		knowledgeBaseCache: NewRedisThirdPlatformKnowledgeBaseCache(redisClient),
		isClientReady: func() bool {
			return server != nil && server.GetRPCClientCount() > 0
		},
		callResolveRPC: func(
			ctx context.Context,
			server *unixsocket.Server,
			params map[string]any,
			out *thirdPlatformDocumentResolveResponse,
		) error {
			return unixsocket.CallRPCTypedWithContext(ctx, server, constants.MethodKnowledgeThirdPlatformDocumentResolve, params, out)
		},
		callListKnowledgeBasesRPC: func(
			ctx context.Context,
			server *unixsocket.Server,
			params map[string]any,
			out *thirdPlatformKnowledgeBaseListResponse,
		) error {
			return unixsocket.CallRPCTypedWithContext(
				ctx,
				server,
				constants.MethodKnowledgeThirdPlatformDocumentListKnowledgeBases,
				params,
				out,
			)
		},
		callListTreeNodesRPC: func(
			ctx context.Context,
			server *unixsocket.Server,
			params map[string]any,
			out *thirdPlatformTreeNodeListResponse,
		) error {
			return unixsocket.CallRPCTypedWithContext(
				ctx,
				server,
				constants.MethodKnowledgeThirdPlatformDocumentListTreeNodes,
				params,
				out,
			)
		},
		callResolveNodeRPC: func(
			ctx context.Context,
			server *unixsocket.Server,
			params map[string]any,
			out *thirdPlatformNodeResolveResponse,
		) error {
			return unixsocket.CallRPCTypedWithContext(
				ctx,
				server,
				constants.MethodKnowledgeThirdPlatformDocumentResolveNode,
				params,
				out,
			)
		},
	}
}

// Resolve 调用 PHP 网关解析第三方文档内容。
func (c *PHPThirdPlatformDocumentRPCClient) Resolve(
	ctx context.Context,
	input thirdplatform.DocumentResolveInput,
) (*thirdplatform.DocumentResolveResult, error) {
	if c == nil || c.server == nil || c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	dataIsolation := map[string]any{
		"organization_code": input.OrganizationCode,
		"user_id":           input.UserID,
	}
	if strings.TrimSpace(input.ThirdPlatformUserID) != "" {
		dataIsolation["third_platform_user_id"] = input.ThirdPlatformUserID
	}
	if strings.TrimSpace(input.ThirdPlatformOrganizationCode) != "" {
		dataIsolation["third_platform_organization_code"] = input.ThirdPlatformOrganizationCode
	}

	params := map[string]any{
		"data_isolation":      dataIsolation,
		"knowledge_base_code": input.KnowledgeBaseCode,
		"third_platform_type": input.ThirdPlatformType,
		"third_file_id":       input.ThirdFileID,
		"document_file":       input.DocumentFile,
	}

	var result thirdPlatformDocumentResolveResponse
	if err := c.callResolveRPC(ctx, c.server, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 第三方文档解析失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if err := thirdPlatformRPCResultError(result.Code, result.Message); err != nil {
			return nil, err
		}
		if result.Code == thirdPlatformDocumentUnavailableCode {
			return nil, fmt.Errorf("%w: code=%d, message=%s", thirdplatform.ErrDocumentUnavailable, result.Code, result.Message)
		}
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	return &thirdplatform.DocumentResolveResult{
		SourceKind:   result.Data.SourceKind,
		RawContent:   result.Data.RawContent,
		DownloadURL:  result.Data.DownloadURL,
		DownloadURLs: append([]string(nil), result.Data.DownloadURLs...),
		Content:      result.Data.Content,
		DocType:      result.Data.DocType,
		DocumentFile: map[string]any(result.Data.DocumentFile),
	}, nil
}

// Expand 调用 PHP 网关展开第三方文档列表。
func (c *PHPThirdPlatformDocumentRPCClient) Expand(
	ctx context.Context,
	organizationCode string,
	userID string,
	documentFiles []map[string]any,
) ([]*docentity.File, error) {
	if c == nil || c.server == nil || c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"document_files": documentFiles,
	}

	var result thirdPlatformDocumentExpandResponse
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeThirdPlatformDocumentExpand, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 第三方文档展开失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if err := thirdPlatformRPCResultError(result.Code, result.Message); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	files := make([]*docentity.File, 0, len(result.Data))
	for _, payload := range result.Data {
		file, ok := documentdomain.FileFromPayload(payload)
		if !ok || file == nil {
			continue
		}
		files = append(files, file)
	}
	return files, nil
}

type thirdPlatformKnowledgeBaseListResponse struct {
	Code    int                               `json:"code"`
	Message string                            `json:"message"`
	Data    []thirdplatform.KnowledgeBaseItem `json:"data"`
}

type thirdPlatformTreeNodeListResponse struct {
	Code    int                      `json:"code"`
	Message string                   `json:"message"`
	Data    []thirdplatform.TreeNode `json:"data"`
}

// ListKnowledgeBases 调用 PHP 网关列出企业知识库。
func (c *PHPThirdPlatformDocumentRPCClient) ListKnowledgeBases(
	ctx context.Context,
	input thirdplatform.KnowledgeBaseListInput,
) ([]thirdplatform.KnowledgeBaseItem, error) {
	if strings.TrimSpace(input.ThirdPlatformUserID) == "" {
		return nil, ErrThirdPlatformIdentityMissing
	}
	if c != nil && c.knowledgeBaseCache != nil {
		items, hit, err := c.knowledgeBaseCache.Get(ctx, input)
		switch {
		case err != nil:
			if c.logger != nil {
				c.logger.KnowledgeWarnContext(
					ctx,
					"读取企业知识库列表缓存失败，回退到 PHP IPC",
					"organization_code", input.OrganizationCode,
					"user_id", input.UserID,
					"third_platform_user_id", input.ThirdPlatformUserID,
					"third_platform_organization_code", input.ThirdPlatformOrganizationCode,
					"error", err,
				)
			}
		case hit:
			return items, nil
		}
	}
	if c == nil || c.server == nil || c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code":                input.OrganizationCode,
			"user_id":                          input.UserID,
			"third_platform_user_id":           input.ThirdPlatformUserID,
			"third_platform_organization_code": input.ThirdPlatformOrganizationCode,
		},
	}

	var result thirdPlatformKnowledgeBaseListResponse
	if err := c.callListKnowledgeBasesRPC(ctx, c.server, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 企业知识库列表失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if err := thirdPlatformRPCResultError(result.Code, result.Message); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	if c != nil && c.knowledgeBaseCache != nil {
		if err := c.knowledgeBaseCache.Set(ctx, input, result.Data); err != nil && c.logger != nil {
			c.logger.KnowledgeWarnContext(
				ctx,
				"写入企业知识库列表缓存失败，忽略缓存错误",
				"organization_code", input.OrganizationCode,
				"user_id", input.UserID,
				"third_platform_user_id", input.ThirdPlatformUserID,
				"third_platform_organization_code", input.ThirdPlatformOrganizationCode,
				"error", err,
			)
		}
	}
	return result.Data, nil
}

// ListTreeNodes 调用 PHP 网关列出企业知识库树节点。
func (c *PHPThirdPlatformDocumentRPCClient) ListTreeNodes(
	ctx context.Context,
	input thirdplatform.TreeNodeListInput,
) ([]thirdplatform.TreeNode, error) {
	if strings.TrimSpace(input.ThirdPlatformUserID) == "" {
		return nil, ErrThirdPlatformIdentityMissing
	}
	if c == nil || c.server == nil || c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code":                input.OrganizationCode,
			"user_id":                          input.UserID,
			"third_platform_user_id":           input.ThirdPlatformUserID,
			"third_platform_organization_code": input.ThirdPlatformOrganizationCode,
		},
		"parent_type": input.ParentType,
		"parent_ref":  input.ParentRef,
	}

	var result thirdPlatformTreeNodeListResponse
	if err := c.callListTreeNodesRPC(ctx, c.server, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(ctx, "调用 PHP 企业知识库树节点失败", "parent_type", input.ParentType, "parent_ref", input.ParentRef, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if err := thirdPlatformRPCResultError(result.Code, result.Message); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}

// ResolveNode 调用 PHP 网关读取企业知识库单文件元信息。
func (c *PHPThirdPlatformDocumentRPCClient) ResolveNode(
	ctx context.Context,
	input thirdplatform.NodeResolveInput,
) (*thirdplatform.NodeResolveResult, error) {
	if strings.TrimSpace(input.ThirdPlatformUserID) == "" {
		return nil, ErrThirdPlatformIdentityMissing
	}
	if c == nil || c.server == nil || c.isClientReady == nil || !c.isClientReady() {
		return nil, ErrNoClientConnected
	}
	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code":                input.OrganizationCode,
			"user_id":                          input.UserID,
			"third_platform_user_id":           input.ThirdPlatformUserID,
			"third_platform_organization_code": input.ThirdPlatformOrganizationCode,
		},
		"third_platform_type": input.ThirdPlatformType,
		"third_file_id":       input.ThirdFileID,
		"third_knowledge_id":  input.KnowledgeBaseID,
	}
	var result thirdPlatformNodeResolveResponse
	if err := c.callResolveNodeRPC(ctx, c.server, params, &result); err != nil {
		if c.logger != nil {
			c.logger.KnowledgeErrorContext(
				ctx,
				"调用 PHP 企业知识库单文件元信息失败",
				"third_platform_type", input.ThirdPlatformType,
				"third_file_id", input.ThirdFileID,
				"third_knowledge_id", input.KnowledgeBaseID,
				"error", err,
			)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		if err := thirdPlatformRPCResultError(result.Code, result.Message); err != nil {
			return nil, err
		}
		if result.Code == thirdPlatformDocumentUnavailableCode {
			return nil, fmt.Errorf("%w: code=%d, message=%s", thirdplatform.ErrDocumentUnavailable, result.Code, result.Message)
		}
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}

func thirdPlatformRPCResultError(code int, message string) error {
	if code == thirdPlatformPermissionDeniedCode || isThirdPlatformPermissionMessage(message) {
		return fmt.Errorf("%w: code=%d, message=%s", thirdplatform.ErrPermissionDenied, code, message)
	}
	return nil
}

func isThirdPlatformPermissionMessage(message string) bool {
	message = strings.TrimSpace(message)
	if message == "" {
		return false
	}
	lowerMessage := strings.ToLower(message)
	permissionMessages := []string{
		"暂无权限",
		"权限不足",
		"没有权限",
		"无权限",
		"permission denied",
		"access denied",
		"forbidden",
	}
	for _, item := range permissionMessages {
		if strings.Contains(lowerMessage, item) {
			return true
		}
	}
	return false
}
