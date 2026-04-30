package splitter

import (
	"context"
	"fmt"
	"strings"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/splitter"
	"magic/internal/pkg/tokenizer"
)

const (
	splitVersionGoTokenV2   = "go_split_v2_token"
	splitVersionGoTabularV3 = "go_split_v3_tabular_structured"
	syncDefaultChunkSize    = 1000
	maxSegmentChunkSize     = 1000
)

type previewSegmentConfig struct {
	ChunkSize          int
	ChunkOverlap       int
	Separator          string
	TextPreprocessRule []int
}

type tokenChunk struct {
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

func splitContentByTokenPipeline(
	ctx context.Context,
	content string,
	segmentConfig previewSegmentConfig,
	model string,
	tokenizerService *tokenizer.Service,
	logger *logging.SugaredLogger,
) ([]tokenChunk, error) {
	segmentConfig.ChunkSize = normalizeSegmentChunkSize(segmentConfig.ChunkSize)

	preRules, needPostReplaceWhitespace := SplitPreviewPreprocessRules(segmentConfig.TextPreprocessRule)
	preprocessedContent := ApplyPreviewPreprocess(content, preRules)

	tokenSplitter := splitter.NewTokenTextSplitter(
		tokenizerService,
		model,
		segmentConfig.ChunkSize,
		segmentConfig.ChunkOverlap,
		segmentConfig.Separator,
	)
	splitResult, err := tokenSplitter.SplitText(preprocessedContent)
	if err != nil {
		return nil, fmt.Errorf("split content with token pipeline: %w", err)
	}

	if logger != nil && splitResult != nil && splitResult.Encoder != nil && splitResult.Encoder.UsesFallback() {
		logger.KnowledgeWarnContext(ctx, "Tokenizer model fallback to cl100k_base",
			"requested_model", splitResult.Encoder.RequestedModel(),
			"resolved_model", splitResult.Encoder.ResolvedModel(),
			"encoding", splitResult.Encoder.EncodingName(),
		)
	}

	if splitResult == nil || len(splitResult.Chunks) == 0 {
		return nil, nil
	}

	chunks := make([]tokenChunk, 0, len(splitResult.Chunks))
	for _, chunk := range splitResult.Chunks {
		chunkContent := chunk.Text
		if needPostReplaceWhitespace {
			chunkContent = ApplyPreviewReplaceWhitespace(chunkContent)
		}
		if strings.TrimSpace(chunkContent) == "" {
			continue
		}

		tokenCount := chunk.TokenCount
		if splitResult.Encoder != nil && needPostReplaceWhitespace && chunkContent != chunk.Text {
			tokenCount = splitResult.Encoder.CountTokens(chunkContent)
		}
		if tokenCount <= 0 && splitResult.Encoder != nil {
			tokenCount = splitResult.Encoder.CountTokens(chunkContent)
		}

		chunks = append(chunks, tokenChunk{
			Content:    chunkContent,
			TokenCount: tokenCount,
		})
	}
	return chunks, nil
}

func normalizeSegmentChunkSize(chunkSize int) int {
	if chunkSize <= 0 {
		return syncDefaultChunkSize
	}
	return min(chunkSize, maxSegmentChunkSize)
}
