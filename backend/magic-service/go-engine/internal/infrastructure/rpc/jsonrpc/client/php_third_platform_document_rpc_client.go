package client

import (
	"context"
	"errors"
	"fmt"

	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/jsoncompat"
	"magic/internal/pkg/thirdplatform"
)

// PHPThirdPlatformDocumentRPCClient 通过 IPC 调用 PHP 侧第三方文档解析网关。
type PHPThirdPlatformDocumentRPCClient struct {
	server *unixsocket.Server
	logger *logging.SugaredLogger
}

type thirdPlatformDocumentResolveResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		SourceKind   string                       `json:"source_kind"`
		RawContent   string                       `json:"raw_content"`
		DownloadURL  string                       `json:"download_url"`
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

// NewPHPThirdPlatformDocumentRPCClient 创建客户端。
func NewPHPThirdPlatformDocumentRPCClient(server *unixsocket.Server, logger *logging.SugaredLogger) *PHPThirdPlatformDocumentRPCClient {
	return &PHPThirdPlatformDocumentRPCClient{
		server: server,
		logger: logger,
	}
}

// Resolve 调用 PHP 网关解析第三方文档内容。
func (c *PHPThirdPlatformDocumentRPCClient) Resolve(
	ctx context.Context,
	input thirdplatform.DocumentResolveInput,
) (*thirdplatform.DocumentResolveResult, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code": input.OrganizationCode,
			"user_id":           input.UserID,
		},
		"knowledge_base_code": input.KnowledgeBaseCode,
		"third_platform_type": input.ThirdPlatformType,
		"third_file_id":       input.ThirdFileID,
		"document_file":       input.DocumentFile,
	}

	var result thirdPlatformDocumentResolveResponse
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeThirdPlatformDocumentResolve, params, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 第三方文档解析失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	return &thirdplatform.DocumentResolveResult{
		SourceKind:   result.Data.SourceKind,
		RawContent:   result.Data.RawContent,
		DownloadURL:  result.Data.DownloadURL,
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
) ([]*documentdomain.File, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
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
			c.logger.ErrorContext(ctx, "调用 PHP 第三方文档展开失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}

	files := make([]*documentdomain.File, 0, len(result.Data))
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
	organizationCode string,
	userID string,
) ([]thirdplatform.KnowledgeBaseItem, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
	}

	var result thirdPlatformKnowledgeBaseListResponse
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeThirdPlatformDocumentListKnowledgeBases, params, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 企业知识库列表失败", "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}

// ListTreeNodes 调用 PHP 网关列出企业知识库树节点。
func (c *PHPThirdPlatformDocumentRPCClient) ListTreeNodes(
	ctx context.Context,
	organizationCode string,
	userID string,
	parentType string,
	parentRef string,
) ([]thirdplatform.TreeNode, error) {
	if c == nil || c.server == nil || c.server.GetRPCClientCount() == 0 {
		return nil, ErrNoClientConnected
	}

	params := map[string]any{
		"data_isolation": map[string]any{
			"organization_code": organizationCode,
			"user_id":           userID,
		},
		"parent_type": parentType,
		"parent_ref":  parentRef,
	}

	var result thirdPlatformTreeNodeListResponse
	if err := unixsocket.CallRPCTypedWithContext(ctx, c.server, constants.MethodKnowledgeThirdPlatformDocumentListTreeNodes, params, &result); err != nil {
		if c.logger != nil {
			c.logger.ErrorContext(ctx, "调用 PHP 企业知识库树节点失败", "parent_type", parentType, "parent_ref", parentRef, "error", err)
		}
		return nil, errors.Join(ErrPHPRequestFailed, err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("%w: code=%d, message=%s", ErrPHPRequestFailed, result.Code, result.Message)
	}
	return result.Data, nil
}
