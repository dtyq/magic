package vision

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/aiability"
	"magic/internal/pkg/ctxmeta"
)

const (
	recognitionModeOCR   = "ocr"
	recognitionModeModel = "model"
	fileTypePDF          = "pdf"
	fileTypeJPG          = "jpg"
	fileTypeJPEG         = "jpeg"
	fileTypePNG          = "png"
	fileTypeBMP          = "bmp"
)

var (
	errVisualSourceUnavailable = errors.New("visual source unavailable")
	errVisualModelEmptyText    = errors.New("vision model returned empty text")
	errVisualModelConfigAbsent = errors.New("visual model call config provider unavailable")
	errVisualModelConfigType   = errors.New("visual model call config type invalid")
	errModelExtractorAbsent    = errors.New("model visual text extractor unavailable")
	errVisionModelClientAbsent = errors.New("vision model client unavailable")
	errPDFRendererAbsent       = errors.New("pdf renderer unavailable")
	errPDFRenderEmpty          = errors.New("render pdf pages: empty pdf")
)

// OCRVisualTextExtractor 包装现有 OCR 客户端为视觉转文字实现。
type OCRVisualTextExtractor struct {
	ocrClient documentdomain.OCRClient
}

// NewOCRVisualTextExtractor 创建基于现有 OCR 客户端的视觉转文字实现。
func NewOCRVisualTextExtractor(ocrClient documentdomain.OCRClient) *OCRVisualTextExtractor {
	return &OCRVisualTextExtractor{ocrClient: ocrClient}
}

// RecognizeSource 使用 OCR 从文件 URL 或文件流识别文字。
func (e *OCRVisualTextExtractor) RecognizeSource(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (string, error) {
	if e == nil || e.ocrClient == nil {
		return "", errVisualSourceUnavailable
	}
	if sourceOCR, ok := e.ocrClient.(documentdomain.OCRSourceClient); ok && file != nil {
		text, err := sourceOCR.OCRSource(ctx, fileURL, file, fileType)
		if err != nil {
			return "", fmt.Errorf("ocr source failed: %w", err)
		}
		return text, nil
	}
	if strings.TrimSpace(fileURL) == "" {
		return "", errVisualSourceUnavailable
	}
	text, err := e.ocrClient.OCR(ctx, fileURL, fileType)
	if err != nil {
		return "", fmt.Errorf("ocr by url failed: %w", err)
	}
	return text, nil
}

// RecognizeBytes 使用 OCR 从文件字节识别文字。
func (e *OCRVisualTextExtractor) RecognizeBytes(ctx context.Context, data []byte, fileType string) (string, error) {
	if e == nil || e.ocrClient == nil {
		return "", errVisualSourceUnavailable
	}
	text, err := e.ocrClient.OCRBytes(ctx, data, fileType)
	if err != nil {
		return "", fmt.Errorf("ocr bytes failed: %w", err)
	}
	return text, nil
}

// NeedsResolvedURL 表示 OCR 兼容路径依赖外部可访问 URL。
func (e *OCRVisualTextExtractor) NeedsResolvedURL(context.Context, string) bool {
	return true
}

// BypassesNativePDFText 表示 OCR 模式保留 PDF 原生文字层优先策略。
func (e *OCRVisualTextExtractor) BypassesNativePDFText(context.Context, string) bool {
	return false
}

// ConfigurableVisualTextExtractor 按能力配置选择 OCR 或多模态模型。
type ConfigurableVisualTextExtractor struct {
	abilityConfigProvider documentdomain.VisualAbilityConfigProvider
	modelConfigProvider   documentdomain.VisualModelCallConfigProvider
	ocrExtractor          *OCRVisualTextExtractor
	modelExtractor        *ModelVisualTextExtractor
	logger                *logging.SugaredLogger
}

// NewConfigurableVisualTextExtractor 创建按后台能力配置切换 OCR/模型的视觉转文字实现。
func NewConfigurableVisualTextExtractor(
	abilityConfigProvider documentdomain.VisualAbilityConfigProvider,
	modelConfigProvider documentdomain.VisualModelCallConfigProvider,
	ocrExtractor *OCRVisualTextExtractor,
	modelExtractor *ModelVisualTextExtractor,
	logger *logging.SugaredLogger,
) *ConfigurableVisualTextExtractor {
	return &ConfigurableVisualTextExtractor{
		abilityConfigProvider: abilityConfigProvider,
		modelConfigProvider:   modelConfigProvider,
		ocrExtractor:          ocrExtractor,
		modelExtractor:        modelExtractor,
		logger:                logger,
	}
}

// RecognizeSource 按能力配置识别文件 URL 或文件流中的可见文字。
func (e *ConfigurableVisualTextExtractor) RecognizeSource(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (string, error) {
	data, err := readVisualSource(file)
	if err != nil {
		return "", err
	}
	selection, err := e.selectExtractor(ctx)
	if err != nil {
		return "", err
	}
	normalizedType := normalizeVisualFileType(fileType)
	if selection.mode == recognitionModeModel {
		return e.recognizeSourceWithModel(ctx, selection.modelConfig, data, normalizedType)
	}
	if e.ocrExtractor == nil {
		return "", errVisualSourceUnavailable
	}
	e.logRecognitionMode(ctx, recognitionModeOCR, "", "", normalizedType)
	return e.ocrExtractor.RecognizeSource(ctx, fileURL, bytes.NewReader(data), normalizedType)
}

// RecognizeBytes 按能力配置识别文件字节中的可见文字。
func (e *ConfigurableVisualTextExtractor) RecognizeBytes(ctx context.Context, data []byte, fileType string) (string, error) {
	selection, err := e.selectExtractor(ctx)
	if err != nil {
		return "", err
	}
	normalizedType := normalizeVisualFileType(fileType)
	if selection.mode == recognitionModeModel {
		return e.recognizeSourceWithModel(ctx, selection.modelConfig, data, normalizedType)
	}
	if e.ocrExtractor == nil {
		return "", errVisualSourceUnavailable
	}
	e.logRecognitionMode(ctx, recognitionModeOCR, "", "", normalizedType)
	return e.ocrExtractor.RecognizeBytes(ctx, data, normalizedType)
}

// NeedsResolvedURL 返回当前能力配置下视觉转文字是否依赖外部可访问 URL。
func (e *ConfigurableVisualTextExtractor) NeedsResolvedURL(ctx context.Context, fileType string) bool {
	return !e.isModelMode(ctx, false) || normalizeVisualFileType(fileType) == ""
}

// BypassesNativePDFText 返回 PDF 是否应直接走视觉理解而跳过原生文字层。
func (e *ConfigurableVisualTextExtractor) BypassesNativePDFText(ctx context.Context, fileType string) bool {
	return normalizeVisualFileType(fileType) == fileTypePDF && e.isModelMode(ctx, false)
}

func (e *ConfigurableVisualTextExtractor) selectExtractor(ctx context.Context) (visualExtractorSelection, error) {
	modelConfig, err := e.resolveModelConfig(ctx)
	if err != nil {
		if errors.Is(err, aiability.ErrAbilityConfigUnavailable) {
			e.logAbilityFallback(ctx, err)
			return visualExtractorSelection{mode: recognitionModeOCR}, nil
		}
		if errors.Is(err, aiability.ErrAbilityDisabled) || errors.Is(err, aiability.ErrAbilityModelIDEmpty) {
			return visualExtractorSelection{mode: recognitionModeOCR}, nil
		}
		if errors.Is(err, aiability.ErrModelConfigUnavailable) {
			return visualExtractorSelection{}, fmt.Errorf("get visual model call config: %w", err)
		}
		return visualExtractorSelection{}, err
	}
	return visualExtractorSelection{mode: recognitionModeModel, modelConfig: modelConfig}, nil
}

func (e *ConfigurableVisualTextExtractor) isModelMode(ctx context.Context, logFallback bool) bool {
	_, err := e.resolveModelSelection(ctx)
	if err == nil {
		return true
	}
	if logFallback && errors.Is(err, aiability.ErrAbilityConfigUnavailable) {
		e.logAbilityFallback(ctx, err)
	}
	return false
}

func (e *ConfigurableVisualTextExtractor) resolveModelConfig(
	ctx context.Context,
) (documentdomain.ModelCallConfig, error) {
	if e == nil || e.abilityConfigProvider == nil {
		return documentdomain.ModelCallConfig{}, aiability.ErrAbilityConfigUnavailable
	}
	if e.modelConfigProvider == nil {
		return documentdomain.ModelCallConfig{}, errVisualModelConfigAbsent
	}
	resolved, err := aiability.ResolveModelConfig(ctx, aiability.ResolveModelConfigInput{
		OrganizationCode: organizationCodeFromContext(ctx),
		AbilityCode:      documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
		ModelType:        documentdomain.DefaultModelTypeLLM,
		AbilityProvider: aiability.AbilityConfigProviderFunc(func(
			callCtx context.Context,
			organizationCode string,
			abilityCode string,
		) (aiability.AbilityConfig, error) {
			ability, err := e.abilityConfigProvider.GetVisualAbilityConfig(callCtx, organizationCode, abilityCode)
			if err != nil {
				return aiability.AbilityConfig{}, fmt.Errorf("get visual ability config: %w", err)
			}
			return aiability.AbilityConfig{
				OrganizationCode: ability.OrganizationCode,
				Enabled:          ability.Enabled,
				Config:           ability.Config,
			}, nil
		}),
		ModelProvider: aiability.ModelConfigProviderFunc(func(
			callCtx context.Context,
			organizationCode string,
			modelID string,
			modelType string,
		) (aiability.ModelConfig, error) {
			modelConfig, err := e.modelConfigProvider.GetVisualModelCallConfig(callCtx, organizationCode, modelID, modelType)
			if err != nil {
				return aiability.ModelConfig{}, fmt.Errorf("get visual model call config: %w", err)
			}
			return aiability.ModelConfig{Value: modelConfig}, nil
		}),
	})
	if err != nil {
		return documentdomain.ModelCallConfig{}, fmt.Errorf("resolve visual model config: %w", err)
	}
	modelConfig, ok := resolved.Value.(documentdomain.ModelCallConfig)
	if !ok {
		return documentdomain.ModelCallConfig{}, errVisualModelConfigType
	}
	return modelConfig, nil
}

func (e *ConfigurableVisualTextExtractor) resolveModelSelection(ctx context.Context) (aiability.ModelSelection, error) {
	if e == nil || e.abilityConfigProvider == nil {
		return aiability.ModelSelection{}, aiability.ErrAbilityConfigUnavailable
	}
	selection, err := aiability.ResolveModelSelection(ctx, aiability.ResolveModelSelectionInput{
		OrganizationCode: organizationCodeFromContext(ctx),
		AbilityCode:      documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
		AbilityProvider: aiability.AbilityConfigProviderFunc(func(
			callCtx context.Context,
			organizationCode string,
			abilityCode string,
		) (aiability.AbilityConfig, error) {
			ability, err := e.abilityConfigProvider.GetVisualAbilityConfig(callCtx, organizationCode, abilityCode)
			if err != nil {
				return aiability.AbilityConfig{}, fmt.Errorf("get visual ability config: %w", err)
			}
			return aiability.AbilityConfig{
				OrganizationCode: ability.OrganizationCode,
				Enabled:          ability.Enabled,
				Config:           ability.Config,
			}, nil
		}),
	})
	if err != nil {
		return aiability.ModelSelection{}, fmt.Errorf("resolve visual model selection: %w", err)
	}
	return selection, nil
}

func (e *ConfigurableVisualTextExtractor) recognizeSourceWithModel(
	ctx context.Context,
	modelConfig documentdomain.ModelCallConfig,
	data []byte,
	fileType string,
) (string, error) {
	if e.modelExtractor == nil {
		return "", errModelExtractorAbsent
	}
	e.logRecognitionMode(ctx, recognitionModeModel, modelConfig.ModelID, modelConfig.ProviderCode, fileType)
	text, err := e.modelExtractor.Recognize(ctx, modelConfig, data, fileType)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(text) == "" {
		return "", errVisualModelEmptyText
	}
	return strings.TrimSpace(text), nil
}

func (e *ConfigurableVisualTextExtractor) logAbilityFallback(ctx context.Context, err error) {
	if e == nil || e.logger == nil {
		return
	}
	e.logger.KnowledgeWarnContext(ctx, "读取知识库视觉理解能力配置失败，回退 OCR",
		"recognition_mode", recognitionModeOCR,
		"ability_code", documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
		"error", err,
	)
}

func (e *ConfigurableVisualTextExtractor) logRecognitionMode(
	ctx context.Context,
	mode string,
	modelID string,
	providerCode string,
	fileType string,
) {
	if e == nil || e.logger == nil {
		return
	}
	e.logger.InfoContext(ctx, "知识库视觉转文字模式",
		"recognition_mode", mode,
		"ability_code", documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
		"model_id", modelID,
		"provider_code", providerCode,
		"file_type", fileType,
	)
}

type visualExtractorSelection struct {
	mode        string
	modelConfig documentdomain.ModelCallConfig
}

// ModelVisualTextExtractor 负责图片/PDF 到多模态 chat。
type ModelVisualTextExtractor struct {
	client      TextClient
	pdfRenderer PDFPageRenderer
	cfg         Config
	limits      documentdomain.ResourceLimits
	logger      *logging.SugaredLogger
}

// NewModelVisualTextExtractor 创建多模态模型视觉转文字实现。
func NewModelVisualTextExtractor(
	client TextClient,
	pdfRenderer PDFPageRenderer,
	cfg Config,
	limits documentdomain.ResourceLimits,
	logger *logging.SugaredLogger,
) *ModelVisualTextExtractor {
	return &ModelVisualTextExtractor{
		client:      client,
		pdfRenderer: pdfRenderer,
		cfg:         normalizeConfig(cfg),
		limits:      documentdomain.NormalizeResourceLimits(limits),
		logger:      logger,
	}
}

// Recognize 使用多模态模型识别图片或 PDF 可见文字。
func (e *ModelVisualTextExtractor) Recognize(
	ctx context.Context,
	modelConfig documentdomain.ModelCallConfig,
	data []byte,
	fileType string,
) (string, error) {
	if e == nil || e.client == nil {
		return "", errVisionModelClientAbsent
	}
	normalizedType := normalizeVisualFileType(fileType)
	if normalizedType == fileTypePDF {
		return e.recognizePDF(ctx, modelConfig, data)
	}
	return e.recognizeImage(ctx, modelConfig, data, normalizedType, 0)
}

func (e *ModelVisualTextExtractor) recognizePDF(
	ctx context.Context,
	modelConfig documentdomain.ModelCallConfig,
	data []byte,
) (string, error) {
	if e.pdfRenderer == nil {
		return "", errPDFRendererAbsent
	}
	var blocks []string
	pageCount := 0
	err := e.pdfRenderer.RenderPages(ctx, data, e.cfg, e.limits, func(page RenderedPDFPage) error {
		pageCount++
		text, err := e.callVisionModel(ctx, modelConfig, modelVisionImage{
			data:         page.Image,
			mimeType:     page.MIMEType,
			fileType:     fileTypePDF,
			pageIndex:    page.Index + 1,
			pdfPageCount: page.PageCount,
		})
		if err != nil {
			return err
		}
		if strings.TrimSpace(text) == "" {
			return errVisualModelEmptyText
		}
		blocks = append(blocks, fmt.Sprintf("## Page %d\n%s", page.Index+1, strings.TrimSpace(text)))
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("process pdf pages: %w", err)
	}
	if pageCount == 0 {
		return "", errPDFRenderEmpty
	}
	return strings.Join(blocks, "\n\n"), nil
}

func (e *ModelVisualTextExtractor) recognizeImage(
	ctx context.Context,
	modelConfig documentdomain.ModelCallConfig,
	data []byte,
	fileType string,
	pageIndex int,
) (string, error) {
	mimeType := mimeTypeForImage(fileType)
	return e.callVisionModel(ctx, modelConfig, modelVisionImage{
		data:      data,
		mimeType:  mimeType,
		fileType:  fileType,
		pageIndex: pageIndex,
	})
}

type modelVisionImage struct {
	data         []byte
	mimeType     string
	fileType     string
	pageIndex    int
	pdfPageCount int
}

func (e *ModelVisualTextExtractor) callVisionModel(
	ctx context.Context,
	modelConfig documentdomain.ModelCallConfig,
	image modelVisionImage,
) (string, error) {
	if int64(len(image.data)) > e.cfg.MaxPageImageBytes && image.fileType != fileTypePDF {
		return "", fmt.Errorf("%w", documentdomain.NewResourceLimitError(
			documentdomain.ResourceLimitMaxVisualPageImageBytes,
			e.cfg.MaxPageImageBytes,
			int64(len(image.data)),
			documentdomain.ResourceLimitStageVisualUnderstanding,
			"visual image exceeds limit",
		))
	}
	if e.logger != nil {
		e.logger.InfoContext(ctx, "知识库多模态视觉转文字",
			"recognition_mode", recognitionModeModel,
			"ability_code", documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding,
			"model_id", modelConfig.ModelID,
			"provider_code", modelConfig.ProviderCode,
			"file_type", image.fileType,
			"pdf_page_count", image.pdfPageCount,
			"page_index", image.pageIndex,
			"image_bytes", len(image.data),
		)
	}
	text, err := e.client.RecognizeImage(ctx, ImageInput{
		Config:       modelConfig,
		Image:        image.data,
		MIMEType:     image.mimeType,
		PageIndex:    image.pageIndex,
		PDFPageCount: image.pdfPageCount,
		FileType:     image.fileType,
		RuntimeCfg:   e.cfg,
	})
	if err != nil {
		return "", fmt.Errorf("call vision model: %w", err)
	}
	return strings.TrimSpace(text), nil
}

func readVisualSource(file io.Reader) ([]byte, error) {
	if file == nil {
		return nil, errVisualSourceUnavailable
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read visual source: %w", err)
	}
	if len(data) == 0 {
		return nil, errVisualSourceUnavailable
	}
	return data, nil
}

func organizationCodeFromContext(ctx context.Context) string {
	if businessParams, ok := ctxmeta.BusinessParamsFromContext(ctx); ok {
		if organizationCode := strings.TrimSpace(businessParams.GetOrganizationCode()); organizationCode != "" {
			return organizationCode
		}
	}
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if organizationCode := strings.TrimSpace(actor.OrganizationCode); organizationCode != "" {
			return organizationCode
		}
	}
	meta, ok := documentdomain.OCRUsageContextFromContext(ctx)
	if !ok {
		return ""
	}
	return strings.TrimSpace(meta.OrganizationCode)
}

func normalizeVisualFileType(fileType string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(fileType)), ".")
}

func mimeTypeForImage(fileType string) string {
	switch normalizeVisualFileType(fileType) {
	case fileTypePNG:
		return mimeImagePNG
	case fileTypeJPG, fileTypeJPEG:
		return mimeImageJPEG
	case fileTypeBMP:
		return mimeImageBMP
	default:
		return mimeImageJPEG
	}
}
