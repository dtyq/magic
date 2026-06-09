package vision

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
)

var (
	// ErrVisionModelRequestFailed 表示视觉理解模型请求失败。
	ErrVisionModelRequestFailed = errors.New("vision model request failed")
	// ErrVisionModelInvalidResponse 表示视觉理解模型返回格式不符合预期。
	ErrVisionModelInvalidResponse = errors.New("vision model invalid response")
	// ErrVisionModelUnsupportedProvider 表示当前视觉理解尚未支持该模型服务商。
	ErrVisionModelUnsupportedProvider = errors.New("vision model unsupported provider")
)

const (
	maxVisionErrorBodyBytes    = 64 << 10
	visionExtractionPrompt     = "请从图片中提取所有可见文字，保持原文顺序和换行。只输出识别到的文字；如果没有可见文字，输出空字符串。不要总结、不要翻译、不要解释。"
	maxLoggedVisionPromptRunes = 1600
	base64DataURLMarker        = ";base64,"
	imageContentType           = "image_url"
	textContentType            = "text"
	roleUser                   = "user"
	roleSystem                 = "system"
	mimeImageJPEG              = "image/jpeg"
	mimeImagePNG               = "image/png"
	mimeImageBMP               = "image/bmp"
)

// TextClient 定义图片转文字模型客户端。
type TextClient interface {
	RecognizeImage(ctx context.Context, input ImageInput) (string, error)
}

// ImageInput 是一次图片视觉转文字模型请求。
type ImageInput struct {
	Config       documentdomain.ModelCallConfig
	Image        []byte
	MIMEType     string
	Prompt       string
	PageIndex    int
	PDFPageCount int
	FileType     string
	RuntimeCfg   Config
}

// OpenAICompatibleVisionTextClient 调用 OpenAI-compatible chat completions 多模态模型。
type OpenAICompatibleVisionTextClient struct {
	httpClient *http.Client
	logger     *logging.SugaredLogger
}

// NewOpenAICompatibleVisionTextClient 创建 OpenAI-compatible 视觉转文字客户端。
func NewOpenAICompatibleVisionTextClient(cfg Config, logger *logging.SugaredLogger) *OpenAICompatibleVisionTextClient {
	normalized := normalizeConfig(cfg)
	return &OpenAICompatibleVisionTextClient{
		httpClient: &http.Client{Timeout: normalized.requestTimeout()},
		logger:     logger,
	}
}

// RecognizeImage 调用多模态模型识别图片文字。
func (c *OpenAICompatibleVisionTextClient) RecognizeImage(ctx context.Context, input ImageInput) (string, error) {
	if c == nil {
		return "", ErrVisionModelRequestFailed
	}
	if err := ensureVisionProviderSupported(input.Config.ProviderCode); err != nil {
		return "", err
	}
	request := buildVisionChatRequest(input)
	body, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("%w: marshal request: %w", ErrVisionModelRequestFailed, err)
	}
	maxRequestBytes := normalizeConfig(input.RuntimeCfg).MaxModelRequestBytes
	if int64(len(body)) > maxRequestBytes {
		return "", fmt.Errorf("%w", documentdomain.NewResourceLimitError(
			documentdomain.ResourceLimitMaxVisualModelRequestBytes,
			maxRequestBytes,
			int64(len(body)),
			documentdomain.ResourceLimitStageVisualUnderstanding,
			"vision model request payload exceeds limit",
		))
	}

	requestURL := normalizeChatCompletionsURL(input.Config.RequestBaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("%w: create request: %w", ErrVisionModelRequestFailed, err)
	}
	if accessToken := strings.TrimSpace(input.Config.AccessToken); accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	c.logVisionRequest(ctx, input, requestURL, request)
	httpClient := c.httpClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultRequestTimeoutSeconds * time.Second}
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: send request: %w", ErrVisionModelRequestFailed, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxVisionErrorBodyBytes))
		return "", &visionUpstreamStatusError{
			statusCode: resp.StatusCode,
			body:       strings.TrimSpace(string(body)),
		}
	}

	text, err := parseVisionChatResponse(resp.Body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(text), nil
}

// SetHTTPClientForTest 替换测试用 HTTP Client。
func (c *OpenAICompatibleVisionTextClient) SetHTTPClientForTest(httpClient *http.Client) {
	if c == nil || httpClient == nil {
		return
	}
	c.httpClient = httpClient
}

type visionChatRequest struct {
	Model       string              `json:"model"`
	Messages    []visionChatMessage `json:"messages"`
	Temperature *float64            `json:"temperature,omitempty"`
	MaxTokens   int                 `json:"max_tokens,omitempty"`
}

type visionChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type visionChatContent struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *visionImageURL `json:"image_url,omitempty"`
}

type visionImageURL struct {
	URL string `json:"url"`
}

func buildVisionChatRequest(input ImageInput) visionChatRequest {
	cfg := normalizeConfig(input.RuntimeCfg)
	prompt := strings.TrimSpace(input.Prompt)
	if prompt == "" {
		prompt = visionExtractionPrompt
	}
	messages := []visionChatMessage{
		{
			Role: roleUser,
			Content: []visionChatContent{
				{Type: textContentType, Text: prompt},
				{
					Type: imageContentType,
					ImageURL: &visionImageURL{
						URL: dataImageURL(input.MIMEType, input.Image),
					},
				},
			},
		},
	}
	request := visionChatRequest{
		Model:       strings.TrimSpace(input.Config.Model),
		Messages:    messages,
		Temperature: &cfg.ModelTemperature,
	}
	if cfg.ModelMaxTokens > 0 {
		request.MaxTokens = cfg.ModelMaxTokens
	}
	return request
}

func ensureVisionProviderSupported(providerCode string) error {
	switch strings.ToLower(strings.TrimSpace(providerCode)) {
	case "qwen", "dashscope", "openai", "openai-compatible", "openai_compatible",
		"volcengine", "volcengineark", "volcengine_ark", "ark":
		return nil
	default:
		return fmt.Errorf("%w: %s", ErrVisionModelUnsupportedProvider, strings.TrimSpace(providerCode))
	}
}

func (c *OpenAICompatibleVisionTextClient) logVisionRequest(
	ctx context.Context,
	input ImageInput,
	requestURL string,
	request visionChatRequest,
) {
	if c == nil || c.logger == nil {
		return
	}
	c.logger.InfoContext(ctx, "知识库视觉理解模型请求",
		"recognition_mode", "model",
		"ability_code", documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
		"model_id", input.Config.ModelID,
		"provider_code", input.Config.ProviderCode,
		"model", input.Config.Model,
		"request_url", requestURL,
		"file_type", input.FileType,
		"pdf_page_count", input.PDFPageCount,
		"page_index", input.PageIndex,
		"image_bytes", len(input.Image),
		"request_body", redactedVisionRequestJSON(request, len(input.Image)),
	)
}

func redactedVisionRequestJSON(request visionChatRequest, imageByteCount int) string {
	request.Messages = redactVisionMessages(request.Messages, imageByteCount)
	payload, err := json.Marshal(request)
	if err != nil {
		return fmt.Sprintf(`{"log_error":"marshal redacted vision request failed: %s"}`, err)
	}
	return string(payload)
}

func redactVisionMessages(messages []visionChatMessage, imageByteCount int) []visionChatMessage {
	if len(messages) == 0 {
		return nil
	}
	redacted := make([]visionChatMessage, len(messages))
	copy(redacted, messages)
	for i := range redacted {
		if redacted[i].Role == roleSystem {
			redacted[i].Content = compactVisionTextForLog(redacted[i].Content)
			continue
		}
		parts, ok := redacted[i].Content.([]visionChatContent)
		if !ok {
			continue
		}
		cloned := make([]visionChatContent, len(parts))
		copy(cloned, parts)
		for j := range cloned {
			if cloned[j].Type == textContentType {
				cloned[j].Text = compactTextForLog(cloned[j].Text, maxLoggedVisionPromptRunes)
			}
			if cloned[j].ImageURL != nil {
				imageURL := *cloned[j].ImageURL
				imageURL.URL = redactedDataURL(imageURL.URL, imageByteCount)
				cloned[j].ImageURL = &imageURL
			}
		}
		redacted[i].Content = cloned
	}
	return redacted
}

func compactVisionTextForLog(content any) any {
	text, ok := content.(string)
	if !ok {
		return content
	}
	return compactTextForLog(text, maxLoggedVisionPromptRunes)
}

func compactTextForLog(text string, maxRunes int) string {
	runes := []rune(text)
	if len(runes) <= maxRunes {
		return text
	}
	return string(runes[:maxRunes]) + "\n...<truncated>"
}

func redactedDataURL(url string, rawByteCount int) string {
	prefix, payload, ok := strings.Cut(url, base64DataURLMarker)
	if !ok {
		return fmt.Sprintf("<image payload omitted: %d raw bytes, %d chars>", rawByteCount, len(url))
	}
	return prefix + base64DataURLMarker + fmt.Sprintf("<image payload omitted: %d raw bytes, %d chars>", rawByteCount, len(payload))
}

func dataImageURL(mimeType string, data []byte) string {
	mimeType = strings.TrimSpace(mimeType)
	if mimeType == "" {
		mimeType = mimeImageJPEG
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func normalizeChatCompletionsURL(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(baseURL, "/chat/completions") {
		return baseURL
	}
	return baseURL + "/chat/completions"
}

type visionUpstreamStatusError struct {
	statusCode int
	body       string
}

func (e *visionUpstreamStatusError) Error() string {
	return fmt.Sprintf("%s: status=%d", ErrVisionModelRequestFailed, e.statusCode)
}

func (e *visionUpstreamStatusError) Is(target error) bool {
	return target == ErrVisionModelRequestFailed
}

func parseVisionChatResponse(reader io.Reader) (string, error) {
	payload, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("%w: read response: %w", ErrVisionModelInvalidResponse, err)
	}
	var response visionChatResponse
	if err := json.Unmarshal(bytes.TrimSpace(payload), &response); err != nil {
		return "", fmt.Errorf("%w: decode JSON: %w", ErrVisionModelInvalidResponse, err)
	}
	var builder strings.Builder
	for _, choice := range response.Choices {
		if content := decodeVisionContent(choice.Message.Content); content != "" {
			builder.WriteString(content)
		}
	}
	text := strings.TrimSpace(builder.String())
	if text == "" {
		return "", fmt.Errorf("%w: empty JSON response", ErrVisionModelInvalidResponse)
	}
	return text, nil
}

type visionChatResponse struct {
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func decodeVisionContent(raw json.RawMessage) string {
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err != nil {
		return ""
	}
	var builder strings.Builder
	for _, part := range parts {
		if part.Type == "" || part.Type == textContentType {
			builder.WriteString(part.Text)
		}
	}
	return builder.String()
}
