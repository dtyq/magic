package fragapp_test

import (
	"strings"
	"testing"

	service "magic/internal/application/knowledge/fragment/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
)

func TestBuildPreviewSegmentConfigShouldRespectChunkConfig(t *testing.T) {
	t.Parallel()

	cfg := service.BuildPreviewSegmentConfigForTest(&confighelper.FragmentConfigDTO{
		Mode: 1,
		Normal: &confighelper.NormalFragmentConfigDTO{
			TextPreprocessRule: []int{2, 1},
			SegmentRule: &confighelper.SegmentRuleDTO{
				Separator:    `\n\n`,
				ChunkSize:    128,
				ChunkOverlap: 16,
			},
		},
	})

	if cfg.Separator != "\n\n" {
		t.Fatalf("expected decoded separator, got %q", cfg.Separator)
	}
	if cfg.ChunkSize != 128 || cfg.ChunkOverlap != 16 {
		t.Fatalf("unexpected chunk config: %#v", cfg)
	}
}

func TestBuildPreviewSegmentConfigShouldConvertPercentOverlap(t *testing.T) {
	t.Parallel()

	cfg := service.BuildPreviewSegmentConfigForTest(&confighelper.FragmentConfigDTO{
		Mode: 1,
		Normal: &confighelper.NormalFragmentConfigDTO{
			SegmentRule: &confighelper.SegmentRuleDTO{
				Separator:        `\n`,
				ChunkSize:        800,
				ChunkOverlap:     10,
				ChunkOverlapUnit: "percent",
			},
		},
	})

	if cfg.Separator != "\n" {
		t.Fatalf("expected decoded separator, got %q", cfg.Separator)
	}
	if cfg.ChunkSize != 800 || cfg.ChunkOverlap != 80 {
		t.Fatalf("unexpected percent chunk config: %#v", cfg)
	}
}

func TestPreviewPreprocessRulesOrder(t *testing.T) {
	t.Parallel()

	content := "hello https://example.com\nworld"
	preprocessed := documentsplitter.ApplyPreviewPreprocess(content, []int{documentsplitter.PreviewRuleRemoveURLEmail})
	if strings.Contains(preprocessed, "https://example.com") {
		t.Fatalf("expected url removed, got %q", preprocessed)
	}

	post := documentsplitter.ApplyPreviewReplaceWhitespace(preprocessed)
	if strings.ContainsAny(post, " \n\t") {
		t.Fatalf("expected whitespace removed, got %q", post)
	}
}

func TestApplyPreviewReplaceWhitespacePreservesMagicTag(t *testing.T) {
	t.Parallel()

	content := `<MagicCompressibleContent Type="Image">![image](magic_knowledge_base_file_x)</MagicCompressibleContent> text`
	processed := documentsplitter.ApplyPreviewReplaceWhitespace(content)
	if !strings.Contains(processed, `<MagicCompressibleContent Type="Image">![image](magic_knowledge_base_file_x)</MagicCompressibleContent>`) {
		t.Fatalf("expected magic tag preserved, got %q", processed)
	}
}
