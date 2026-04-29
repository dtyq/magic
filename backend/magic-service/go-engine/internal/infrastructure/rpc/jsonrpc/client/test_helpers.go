package client

import (
	"context"
	"encoding/json"
	"fmt"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/thirdplatform"
)

// MagicAccessTokenResponseForTest 暴露 access token RPC 响应结构供外部测试使用。
type MagicAccessTokenResponseForTest struct {
	Code    int               `json:"code"`
	Message string            `json:"message"`
	Data    map[string]string `json:"data"`
}

// EmbeddingDataForTest 暴露 embedding 数据结构供外部测试使用。
type EmbeddingDataForTest struct {
	Embedding []float64 `json:"embedding"`
	Index     int       `json:"index"`
}

// EmbeddingResultForTest 暴露 embedding 结果结构供外部测试使用。
type EmbeddingResultForTest struct {
	Data []EmbeddingDataForTest `json:"data"`
}

// RPCResultForTest 暴露通用 RPC 结果结构供外部测试使用。
type RPCResultForTest[T any] struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	ErrorCode int    `json:"error_code,omitempty"`
	Data      T      `json:"data"`
}

// UnmarshalMagicAccessTokenDataForTest 暴露 access token data 兼容反序列化逻辑供外部测试使用。
func UnmarshalMagicAccessTokenDataForTest(raw []byte) (map[string]string, error) {
	var decoded magicAccessTokenData
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, fmt.Errorf("unmarshal magic access token data for test: %w", err)
	}
	return map[string]string(decoded), nil
}

// UnmarshalThirdPlatformDocumentFileForTest 暴露第三方文档 document_file 兼容反序列化逻辑供外部测试使用。
func UnmarshalThirdPlatformDocumentFileForTest(raw []byte) (map[string]any, error) {
	var decoded thirdPlatformDocumentFileMap
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, fmt.Errorf("unmarshal third platform document file for test: %w", err)
	}
	return map[string]any(decoded), nil
}

// SetTokenForTest 设置缓存 token。
func (p *PHPAccessTokenRPCClient) SetTokenForTest(token string) {
	p.setToken(token)
}

// CachedTokenForTest 读取缓存 token。
func (p *PHPAccessTokenRPCClient) CachedTokenForTest() (string, bool) {
	return p.cachedToken()
}

// SetClientReadyFuncForTest 替换客户端连接状态判断逻辑。
func (p *PHPAccessTokenRPCClient) SetClientReadyFuncForTest(fn func() bool) {
	p.isClientReady = fn
}

// SetCallGetAccessTokenRPCForTest 替换 access token RPC 调用逻辑。
func (p *PHPAccessTokenRPCClient) SetCallGetAccessTokenRPCForTest(fn func(context.Context, any) error) {
	p.callGetAccessTokenRPC = func(ctx context.Context, result *magicAccessTokenResponse) error {
		testResult := &MagicAccessTokenResponseForTest{
			Code:    result.Code,
			Message: result.Message,
			Data:    result.Data,
		}
		if err := fn(ctx, testResult); err != nil {
			return err
		}
		result.Code = testResult.Code
		result.Message = testResult.Message
		result.Data = testResult.Data
		return nil
	}
}

// SetClientReadyFuncForTest 替换 embedding 客户端连接状态判断逻辑。
func (c *PHPEmbeddingRPCClient) SetClientReadyFuncForTest(fn func() bool) {
	c.isClientReady = fn
}

// SetCallEmbeddingComputeRPCForTest 替换 embedding compute RPC 调用逻辑。
func (c *PHPEmbeddingRPCClient) SetCallEmbeddingComputeRPCForTest(fn func(context.Context, *unixsocket.Server, map[string]any, any) error) {
	c.callEmbeddingComputeRPC = func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[EmbeddingResult]) error {
		testOut := &RPCResultForTest[EmbeddingResultForTest]{
			Code:      out.Code,
			Message:   out.Message,
			ErrorCode: out.ErrorCode,
		}
		for _, item := range out.Data.Data {
			testOut.Data.Data = append(testOut.Data.Data, EmbeddingDataForTest{
				Embedding: append([]float64(nil), item.Embedding...),
				Index:     item.Index,
			})
		}
		if err := fn(ctx, server, params, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.ErrorCode = testOut.ErrorCode
		out.Data.Data = out.Data.Data[:0]
		for _, item := range testOut.Data.Data {
			out.Data.Data = append(out.Data.Data, EmbeddingData{
				Embedding: append([]float64(nil), item.Embedding...),
				Index:     item.Index,
			})
		}
		return nil
	}
}

// SetCallEmbeddingProvidersRPCForTest 替换 embedding providers RPC 调用逻辑。
func (c *PHPEmbeddingRPCClient) SetCallEmbeddingProvidersRPCForTest(fn func(context.Context, *unixsocket.Server, map[string]any, any) error) {
	c.callEmbeddingProvidersRPC = func(ctx context.Context, server *unixsocket.Server, params map[string]any, out *RPCResult[[]*embedding.Provider]) error {
		testOut := &RPCResultForTest[[]*embedding.Provider]{
			Code:      out.Code,
			Message:   out.Message,
			ErrorCode: out.ErrorCode,
			Data:      append([]*embedding.Provider(nil), out.Data...),
		}
		if err := fn(ctx, server, params, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.ErrorCode = testOut.ErrorCode
		out.Data = append(out.Data[:0], testOut.Data...)
		return nil
	}
}

// SetCallListKnowledgeBasesRPCForTest 替换企业知识库列表 RPC 调用逻辑。
func (c *PHPThirdPlatformDocumentRPCClient) SetCallListKnowledgeBasesRPCForTest(
	fn func(context.Context, *unixsocket.Server, map[string]any, any) error,
) {
	c.callListKnowledgeBasesRPC = func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformKnowledgeBaseListResponse,
	) error {
		testOut := &RPCResultForTest[[]thirdplatform.KnowledgeBaseItem]{
			Code:    out.Code,
			Message: out.Message,
			Data:    append([]thirdplatform.KnowledgeBaseItem(nil), out.Data...),
		}
		if err := fn(ctx, server, params, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.Data = append(out.Data[:0], testOut.Data...)
		return nil
	}
}

// SetCallListTreeNodesRPCForTest 替换企业知识库树节点 RPC 调用逻辑。
func (c *PHPThirdPlatformDocumentRPCClient) SetCallListTreeNodesRPCForTest(
	fn func(context.Context, *unixsocket.Server, map[string]any, any) error,
) {
	c.callListTreeNodesRPC = func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformTreeNodeListResponse,
	) error {
		testOut := &RPCResultForTest[[]thirdplatform.TreeNode]{
			Code:    out.Code,
			Message: out.Message,
			Data:    append([]thirdplatform.TreeNode(nil), out.Data...),
		}
		if err := fn(ctx, server, params, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.Data = append(out.Data[:0], testOut.Data...)
		return nil
	}
}

// SetCallResolveNodeRPCForTest 替换企业知识库单文件元信息 RPC 调用逻辑。
func (c *PHPThirdPlatformDocumentRPCClient) SetCallResolveNodeRPCForTest(
	fn func(context.Context, *unixsocket.Server, map[string]any, any) error,
) {
	c.callResolveNodeRPC = func(
		ctx context.Context,
		server *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformNodeResolveResponse,
	) error {
		testOut := &RPCResultForTest[*thirdplatform.NodeResolveResult]{
			Code:    out.Code,
			Message: out.Message,
			Data:    out.Data,
		}
		if err := fn(ctx, server, params, testOut); err != nil {
			return err
		}
		out.Code = testOut.Code
		out.Message = testOut.Message
		out.Data = testOut.Data
		return nil
	}
}

// SetThirdPlatformDocumentClientReadyFuncForTest 替换第三方文档客户端连接状态判断逻辑。
func (c *PHPThirdPlatformDocumentRPCClient) SetThirdPlatformDocumentClientReadyFuncForTest(fn func() bool) {
	c.isClientReady = fn
}
