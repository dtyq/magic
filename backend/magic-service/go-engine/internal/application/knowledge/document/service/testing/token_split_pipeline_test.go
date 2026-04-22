package docapp_test

import (
	"context"
	"strings"
	"testing"

	service "magic/internal/application/knowledge/document/service"
	"magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/knowledgeroute"
	"magic/internal/pkg/tokenizer"
)

func TestBuildSyncSegmentConfigShouldRespectAbsoluteChunkConfig(t *testing.T) {
	t.Parallel()

	doc := &document.KnowledgeBaseDocument{
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeNormal,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{
					service.PreviewRuleRemoveURLEmailForTest(),
					service.PreviewRuleReplaceWhitespaceForTest(),
				},
				SegmentRule: &shared.SegmentRule{
					Separator:    `\n\n`,
					ChunkSize:    256,
					ChunkOverlap: 32,
				},
			},
		},
	}

	cfg := service.BuildSyncSegmentConfigForTest(doc, nil)
	if cfg.Separator != "\n\n" {
		t.Fatalf("expected decoded separator, got %q", cfg.Separator)
	}
	if cfg.ChunkSize != 256 || cfg.ChunkOverlap != 32 {
		t.Fatalf("unexpected chunk config: %+v", cfg)
	}
	if len(cfg.TextPreprocessRule) != 2 {
		t.Fatalf("unexpected preprocess rules: %+v", cfg.TextPreprocessRule)
	}
}

func TestBuildSyncSegmentConfigShouldConvertKnowledgeBasePercentOverlap(t *testing.T) {
	t.Parallel()

	kb := &knowledgebase.KnowledgeBase{
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeNormal,
			Normal: &shared.NormalFragmentConfig{
				SegmentRule: &shared.SegmentRule{
					Separator:        `\n\n`,
					ChunkSize:        800,
					ChunkOverlap:     10,
					ChunkOverlapUnit: shared.ChunkOverlapUnitPercent,
				},
			},
		},
	}

	cfg := service.BuildSyncSegmentConfigForTest(nil, kb)
	if cfg.ChunkSize != 800 {
		t.Fatalf("expected configured chunk size 800, got %d", cfg.ChunkSize)
	}
	if cfg.ChunkOverlap != 80 {
		t.Fatalf("expected converted chunk overlap 80, got %d", cfg.ChunkOverlap)
	}
	if cfg.Separator != "\n\n" {
		t.Fatalf("expected decoded separator, got %q", cfg.Separator)
	}
}

func TestSplitContentByTokenPipeline(t *testing.T) {
	t.Parallel()
	tokenizerSvc := newSharedTokenizerForTest(t)

	t.Run("ShouldApplyPostReplaceWhitespace", func(t *testing.T) {
		t.Parallel()
		assertTokenSplitAppliesPostReplaceWhitespace(t, tokenizerSvc)
	})

	t.Run("ShouldFallbackForUnknownModel", func(t *testing.T) {
		t.Parallel()
		assertTokenSplitFallsBackForUnknownModel(t, tokenizerSvc)
	})

	t.Run("ShouldCapChunkSizeAtOneThousand", func(t *testing.T) {
		t.Parallel()
		assertTokenSplitCapsChunkSizeAtOneThousand(t, tokenizerSvc)
	})
}

func assertTokenSplitAppliesPostReplaceWhitespace(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          20,
		ChunkOverlap:       5,
		Separator:          "\n\n",
		TextPreprocessRule: []int{service.PreviewRuleReplaceWhitespaceForTest()},
	}
	content := "alpha beta\n\n  \n\ngamma delta"

	chunks, err := service.SplitContentByTokenPipelineWithTokenizerForTest(
		context.Background(),
		content,
		cfg,
		"text-embedding-3-small",
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}
	encoder, err := service.ResolveTokenizerEncoderWithServiceForTest(tokenizerSvc, "text-embedding-3-small")
	if err != nil {
		t.Fatalf("resolve encoder failed: %v", err)
	}
	for i, chunk := range chunks {
		if strings.TrimSpace(chunk.Content) == "" {
			t.Fatalf("chunk %d should not be empty", i)
		}
		if strings.ContainsAny(chunk.Content, " \n\t") {
			t.Fatalf("chunk %d should not contain whitespace after post process, got %q", i, chunk.Content)
		}
		if chunk.TokenCount <= 0 {
			t.Fatalf("chunk %d token count should be positive, got %d", i, chunk.TokenCount)
		}
		if got, want := chunk.TokenCount, encoder.CountTokens(chunk.Content); got != want {
			t.Fatalf("chunk %d token count mismatch after post process: got=%d want=%d", i, got, want)
		}
	}
}

func assertTokenSplitFallsBackForUnknownModel(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          30,
		ChunkOverlap:       5,
		Separator:          "\n",
		TextPreprocessRule: []int{},
	}
	content := "hello world\nthis is tokenizer fallback test"

	chunks, err := service.SplitContentByTokenPipelineWithTokenizerForTest(
		context.Background(),
		content,
		cfg,
		"unsupported-embedding-model",
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}
}

func assertTokenSplitCapsChunkSizeAtOneThousand(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          4096,
		ChunkOverlap:       0,
		Separator:          "\n",
		TextPreprocessRule: []int{},
	}
	content := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta iota kappa\n", 110)

	chunks, err := service.SplitContentByTokenPipelineWithTokenizerForTest(
		context.Background(),
		content,
		cfg,
		"text-embedding-3-small",
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected capped chunking to produce multiple chunks, got %d", len(chunks))
	}
	for i, chunk := range chunks {
		if chunk.TokenCount > 1000 {
			t.Fatalf("chunk %d exceeds max token cap: %d", i, chunk.TokenCount)
		}
	}
}

func TestResolveSplitModelShouldPreferRebuildOverrideTargetModel(t *testing.T) {
	t.Parallel()

	ctx := knowledgeroute.WithRebuildOverride(context.Background(), &knowledgeroute.RebuildOverride{
		TargetModel: "text-embedding-3-small",
	})
	kbReader := &knowledgeBaseReaderStub{
		routeModel: "text-embedding-3-small",
	}

	model := service.ResolveSplitModelForTest(ctx, t, kbReader, nil, "")
	if model != "text-embedding-3-small" {
		t.Fatalf("expected rebuild override model, got %q", model)
	}
}

func TestResolveSplitModelShouldPreferCollectionMetaModelOverDocumentHistory(t *testing.T) {
	t.Parallel()

	kbReader := &knowledgeBaseReaderStub{
		routeModel: "text-embedding-3-large",
	}
	kb := &knowledgebase.KnowledgeBase{Model: "text-embedding-3-small"}

	model := service.ResolveSplitModelForTest(context.Background(), t, kbReader, kb, "")
	if model != "text-embedding-3-large" {
		t.Fatalf("expected collection meta model, got %q", model)
	}
}
