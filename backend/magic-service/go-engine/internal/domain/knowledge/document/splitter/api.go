// Package splitter 定义文档切片的领域策略与对外 API。
package splitter

import (
	"context"

	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/tokenizer"
)

// PreviewSegmentConfig 表示预览切片配置。
type PreviewSegmentConfig struct {
	ChunkSize          int
	ChunkOverlap       int
	Separator          string
	TextPreprocessRule []int
}

// TokenChunk 表示切片策略产出的标准 chunk。
type TokenChunk struct {
	Content            string
	TokenCount         int
	SectionPath        string
	SectionLevel       int
	SectionTitle       string
	TreeNodeID         string
	ParentNodeID       string
	SectionChunkIndex  int
	EffectiveSplitMode string
	HierarchyDetector  string
	Metadata           map[string]any
}

// SplitModeResolution 表示自动切片后的模式判定结果。
type SplitModeResolution struct {
	RequestedMode      shared.FragmentMode
	EffectiveMode      shared.FragmentMode
	EffectiveSplitMode string
	HierarchyDetected  bool
	HierarchyDetector  string
}

// AutoSplitPipelineInput 表示自动切片 pipeline 输入。
type AutoSplitPipelineInput struct {
	Content             string
	SourceFileType      string
	RequestedMode       shared.FragmentMode
	FragmentConfig      *shared.FragmentConfig
	NormalSegmentConfig PreviewSegmentConfig
	Model               string
	TokenizerService    *tokenizer.Service
	Logger              *logging.SugaredLogger
}

// ParsedDocumentChunkInput 表示解析文档切片 pipeline 输入。
type ParsedDocumentChunkInput struct {
	Parsed           *parseddocument.ParsedDocument
	SourceFileType   string
	RequestedMode    shared.FragmentMode
	FragmentConfig   *shared.FragmentConfig
	SegmentConfig    PreviewSegmentConfig
	Model            string
	TokenizerService *tokenizer.Service
	Logger           *logging.SugaredLogger
}

// PreviewSplitter 定义预览切片能力。
type PreviewSplitter interface {
	SplitParsedDocumentToChunks(ctx context.Context, input ParsedDocumentChunkInput) ([]TokenChunk, string, error)
}

// SplitContentByTokenPipeline 执行纯 token 模式切片。
func SplitContentByTokenPipeline(
	ctx context.Context,
	content string,
	segmentConfig PreviewSegmentConfig,
	model string,
	tokenizerService *tokenizer.Service,
	logger *logging.SugaredLogger,
) ([]TokenChunk, error) {
	chunks, err := splitContentByTokenPipeline(ctx, content, toPreviewSegmentConfig(segmentConfig), model, tokenizerService, logger)
	if err != nil {
		return nil, err
	}
	return toTokenChunks(chunks), nil
}

// SplitContentWithEffectiveModePipeline 执行自动模式切片并返回生效模式。
func SplitContentWithEffectiveModePipeline(
	ctx context.Context,
	input AutoSplitPipelineInput,
) ([]TokenChunk, SplitModeResolution, error) {
	chunks, resolution, err := splitContentWithEffectiveModePipeline(ctx, autoSplitPipelineInput{
		Content:             input.Content,
		SourceFileType:      input.SourceFileType,
		RequestedMode:       input.RequestedMode,
		FragmentConfig:      input.FragmentConfig,
		NormalSegmentConfig: toPreviewSegmentConfig(input.NormalSegmentConfig),
		Model:               input.Model,
		TokenizerService:    input.TokenizerService,
		Logger:              input.Logger,
	})
	if err != nil {
		return nil, SplitModeResolution{}, err
	}
	return toTokenChunks(chunks), SplitModeResolution(resolution), nil
}

// SplitParsedDocumentToChunks 将结构化解析结果切为标准 chunk。
func SplitParsedDocumentToChunks(
	ctx context.Context,
	input ParsedDocumentChunkInput,
) ([]TokenChunk, string, error) {
	chunks, splitVersion, err := splitParsedDocumentToChunks(ctx, parsedDocumentChunkInput{
		Parsed:           input.Parsed,
		SourceFileType:   input.SourceFileType,
		RequestedMode:    input.RequestedMode,
		FragmentConfig:   input.FragmentConfig,
		SegmentConfig:    toPreviewSegmentConfig(input.SegmentConfig),
		Model:            input.Model,
		TokenizerService: input.TokenizerService,
		Logger:           input.Logger,
	})
	if err != nil {
		return nil, "", err
	}
	return toTokenChunks(chunks), splitVersion, nil
}

type defaultPreviewSplitter struct{}

func (defaultPreviewSplitter) SplitParsedDocumentToChunks(
	ctx context.Context,
	input ParsedDocumentChunkInput,
) ([]TokenChunk, string, error) {
	return SplitParsedDocumentToChunks(ctx, input)
}

// NewPreviewSplitter 创建标准的预览切片实现。
func NewPreviewSplitter() PreviewSplitter {
	return defaultPreviewSplitter{}
}

func toPreviewSegmentConfig(cfg PreviewSegmentConfig) previewSegmentConfig {
	return previewSegmentConfig{
		ChunkSize:          cfg.ChunkSize,
		ChunkOverlap:       cfg.ChunkOverlap,
		Separator:          cfg.Separator,
		TextPreprocessRule: append([]int(nil), cfg.TextPreprocessRule...),
	}
}

func toTokenChunks(chunks []tokenChunk) []TokenChunk {
	result := make([]TokenChunk, 0, len(chunks))
	for _, chunk := range chunks {
		result = append(result, TokenChunk(chunk))
	}
	return result
}
