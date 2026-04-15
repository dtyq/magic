// Package external 包含调用外部服务的基础设施 HTTP/SDK 客户端
package external

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"magic/internal/domain/knowledge/embedding"
	"magic/internal/pkg/ctxmeta"
)

// ErrOpenAIRequestFailed 表示 OpenAI API 请求失败
var (
	ErrOpenAIRequestFailed = errors.New("OpenAI embedding request failed")
	ErrAccessTokenEmpty    = errors.New("access token is empty")
	ErrBaseURLInvalid      = errors.New("invalid base URL")
	ErrBaseURLScheme       = errors.New("unsupported base URL scheme")
)

const (
	defaultHTTPTimeout = 30 * time.Second
)

// OpenAIEmbeddingClient 使用自定义 HTTP client 实现 embedding.Client
// 便于在请求中添加 business_params 等自定义字段
type OpenAIEmbeddingClient struct {
	baseURL             string
	apiKey              string
	httpClient          *http.Client
	accessTokenProvider AccessTokenProvider
}

// NewOpenAIEmbeddingClient 创建新的 OpenAIEmbeddingClient，可选自定义 baseURL
func NewOpenAIEmbeddingClient(baseURL string, accessTokenProvider AccessTokenProvider) *OpenAIEmbeddingClient {
	return &OpenAIEmbeddingClient{
		baseURL:             baseURL,
		accessTokenProvider: accessTokenProvider,
		httpClient: &http.Client{
			Timeout: defaultHTTPTimeout,
		},
	}
}

// SetAccessToken 更新 API key
func (c *OpenAIEmbeddingClient) SetAccessToken(accessToken string) {
	c.apiKey = accessToken
}

// ListProviders 返回可用的 embedding 提供方列表
func (c *OpenAIEmbeddingClient) ListProviders(ctx context.Context, businessParams *ctxmeta.BusinessParams) ([]*embedding.Provider, error) {
	accessToken, err := c.resolveAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	modelsURL, err := c.joinStableURL("/v1/models")
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	query := req.URL.Query()
	query.Set("with_info", "true")
	query.Set("type", "embedding")
	req.URL.RawQuery = query.Encode()

	req.Header.Set("Accept", "application/json")
	if accessToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	}

	if businessParams != nil {
		if orgCode := businessParams.GetOrganizationCode(); orgCode != "" {
			req.Header.Set("Magic-Organization-Code", orgCode)
			req.Header.Set("Magic-Organization-Id", orgCode)
		}
		if businessParams.UserID != "" {
			req.Header.Set("Magic-User-Id", businessParams.UserID)
		}
	}

	resp, err := c.send(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w with status %d: %s", ErrOpenAIRequestFailed, resp.StatusCode, string(body))
	}

	var modelResp modelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&modelResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return c.mapToProviders(modelResp), nil
}

func (c *OpenAIEmbeddingClient) mapToProviders(modelResp modelsResponse) []*embedding.Provider {
	providers := make([]*embedding.Provider, 0)
	providerIndex := make(map[string]*embedding.Provider)

	for _, item := range modelResp.Data {
		attrs := item.Info.Attributes
		providerAlias := strings.TrimSpace(attrs.ProviderAlias)
		if providerAlias == "" {
			providerAlias = "MagicAI"
		}

		provider, ok := providerIndex[providerAlias]
		if !ok {
			provider = &embedding.Provider{
				ID:   providerAlias,
				Name: providerAlias,
			}
			providerIndex[providerAlias] = provider
			providers = append(providers, provider)
		}

		modelID := strings.TrimSpace(attrs.Key)
		if modelID == "" {
			modelID = strings.TrimSpace(item.ID)
		}
		if modelID == "" {
			continue
		}

		modelName := strings.TrimSpace(attrs.Label)
		if modelName == "" {
			modelName = strings.TrimSpace(attrs.Name)
		}
		if modelName == "" {
			modelName = modelID
		}

		provider.Models = append(provider.Models, embedding.Model{
			ID:      modelID,
			Name:    modelName,
			ModelID: modelID,
			Icon:    attrs.Icon,
		})
	}
	return providers
}

// embeddingRequest 表示 embedding API 的请求负载
type embeddingRequest struct {
	Model          string            `json:"model"`
	Input          any               `json:"input"` // string 或 []string
	BusinessParams map[string]string `json:"business_params,omitempty"`
}

// embeddingResponse 表示 embedding API 的响应
type embeddingResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
	Model string `json:"model"`
}

type modelsResponse struct {
	Data []struct {
		ID   string `json:"id"`
		Info struct {
			Attributes struct {
				Key           string `json:"key"`
				Name          string `json:"name"`
				Label         string `json:"label"`
				Icon          string `json:"icon"`
				ProviderAlias string `json:"provider_alias"`
			} `json:"attributes"`
		} `json:"info"`
	} `json:"data"`
}

// GetEmbedding 返回单条输入的 embedding
func (c *OpenAIEmbeddingClient) GetEmbedding(ctx context.Context, input, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error) {
	// 构建请求体
	reqBody := embeddingRequest{
		Model: model,
		Input: []string{input}, // OpenAI API 期望数组格式
	}

	// 添加 business_params（如果提供）
	if businessParams != nil && !businessParams.IsEmpty() {
		reqBody.BusinessParams = businessParams.ToMap()
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 构建完整 URL
	embeddingsURL, err := c.joinStableURL("/v1/embeddings")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", embeddingsURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	}

	resp, err := c.send(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w with status %d: %s", ErrOpenAIRequestFailed, resp.StatusCode, string(body))
	}

	var embResp embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(embResp.Data) == 0 || len(embResp.Data[0].Embedding) == 0 {
		return []float64{}, nil
	}

	return embResp.Data[0].Embedding, nil
}

func (c *OpenAIEmbeddingClient) resolveAccessToken(ctx context.Context) (string, error) {
	if c.accessTokenProvider != nil {
		token, err := c.accessTokenProvider.GetAccessToken(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to get access token: %w", err)
		}
		if token != "" {
			return token, nil
		}
	}
	if c.apiKey == "" {
		return "", ErrAccessTokenEmpty
	}
	return c.apiKey, nil
}

// GetBatchEmbeddings 返回多条输入的 embedding
func (c *OpenAIEmbeddingClient) GetBatchEmbeddings(ctx context.Context, inputs []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error) {
	// 构建请求体
	reqBody := embeddingRequest{
		Model: model,
		Input: inputs,
	}

	// 添加 business_params（如果提供）
	if businessParams != nil && !businessParams.IsEmpty() {
		reqBody.BusinessParams = businessParams.ToMap()
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 构建完整 URL
	embeddingsURL, err := c.joinStableURL("/v1/embeddings")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", embeddingsURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	}

	resp, err := c.send(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w with status %d: %s", ErrOpenAIRequestFailed, resp.StatusCode, string(body))
	}

	var embResp embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	result := make([][]float64, len(embResp.Data))
	for i, item := range embResp.Data {
		result[i] = item.Embedding
	}

	return result, nil
}

func (c *OpenAIEmbeddingClient) joinStableURL(path string) (string, error) {
	base := strings.TrimSpace(strings.TrimRight(c.baseURL, "/"))
	if base == "" {
		return "", ErrOpenAIRequestFailed
	}
	parsed, err := neturl.ParseRequestURI(base)
	if err != nil {
		return "", errors.Join(ErrBaseURLInvalid, err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: %s", ErrBaseURLScheme, parsed.Scheme)
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/") + path
	parsed.RawPath = ""

	normalized := parsed.String()
	clone := map[string]string{"url": normalized}
	return clone["url"], nil
}

func (c *OpenAIEmbeddingClient) send(req *http.Request) (*http.Response, error) {
	transport := c.httpClient.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}

	roundTripReq := req
	if c.httpClient.Timeout > 0 {
		if _, ok := req.Context().Deadline(); !ok {
			ctx, cancel := context.WithTimeout(req.Context(), c.httpClient.Timeout)
			defer cancel()
			roundTripReq = req.Clone(ctx)
		}
	}

	resp, err := transport.RoundTrip(roundTripReq)
	if err != nil {
		return nil, fmt.Errorf("round trip request: %w", err)
	}
	return resp, nil
}
