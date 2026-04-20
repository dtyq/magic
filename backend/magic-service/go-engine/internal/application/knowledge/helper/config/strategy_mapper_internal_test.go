package config

import (
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

func TestApplyStrategyConfigToMetadata_UsesTopLevelOnly(t *testing.T) {
	t.Parallel()

	metadata := ApplyStrategyConfigToMetadata(
		map[string]any{
			"source": "knowledge-demo",
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     documentdomain.ParsingTypeQuick,
				"image_extraction": false,
				"table_extraction": false,
				"image_ocr":        false,
			},
		},
		&StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: false,
			TableExtraction: true,
			ImageOCR:        true,
		},
	)

	if metadata["source"] != "knowledge-demo" {
		t.Fatalf("expected business metadata preserved, got %#v", metadata)
	}
	strategy, ok := metadata[documentdomain.ParseStrategyConfigKey].(map[string]any)
	if !ok {
		t.Fatalf("expected strategy metadata map, got %#v", metadata)
	}
	if strategy["parsing_type"] != documentdomain.ParsingTypePrecise {
		t.Fatalf("expected precise strategy, got %#v", strategy)
	}
	if strategy["image_extraction"] != false || strategy["table_extraction"] != true || strategy["image_ocr"] != true {
		t.Fatalf("unexpected strategy metadata %#v", strategy)
	}
}

func TestStrategyConfigDTOFromMetadata_DefaultsForLegacyDocuments(t *testing.T) {
	t.Parallel()

	cfg := StrategyConfigDTOFromMetadata(nil)
	if cfg == nil {
		t.Fatal("expected non-nil strategy config")
	}
	if cfg.ParsingType != documentdomain.ParsingTypePrecise || !cfg.ImageExtraction || !cfg.TableExtraction || !cfg.ImageOCR {
		t.Fatalf("unexpected default strategy config %#v", cfg)
	}
}
