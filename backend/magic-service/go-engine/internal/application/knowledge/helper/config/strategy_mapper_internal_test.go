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

func TestStrategyConfigDTOToParseOptionsForKnowledgeBaseType_DigitalEmployeeCompat(t *testing.T) {
	t.Parallel()

	quick := StrategyConfigDTOToParseOptionsForKnowledgeBaseType("digital_employee", &StrategyConfigDTO{
		ParsingType: 0,
	})
	if quick.ParsingType != documentdomain.ParsingTypeQuick || quick.ImageExtraction || quick.TableExtraction || quick.ImageOCR {
		t.Fatalf("expected digital employee mode=0 quick, got %#v", quick)
	}

	precise := StrategyConfigDTOToParseOptionsForKnowledgeBaseType("digital_employee", &StrategyConfigDTO{
		ParsingType:     1,
		ImageExtraction: false,
		TableExtraction: true,
		ImageOCR:        true,
	})
	if precise.ParsingType != documentdomain.ParsingTypePrecise || precise.ImageExtraction || !precise.TableExtraction || !precise.ImageOCR {
		t.Fatalf("expected digital employee mode=1 precise, got %#v", precise)
	}

	compatPrecise := StrategyConfigDTOToParseOptionsForKnowledgeBaseType("digital_employee", &StrategyConfigDTO{
		ParsingType:     2,
		ImageExtraction: false,
		TableExtraction: true,
		ImageOCR:        true,
	})
	if compatPrecise.ParsingType != documentdomain.ParsingTypePrecise ||
		compatPrecise.ImageExtraction ||
		!compatPrecise.TableExtraction ||
		!compatPrecise.ImageOCR {
		t.Fatalf("expected digital employee compat mode=2 precise, got %#v", compatPrecise)
	}
}

func TestStrategyConfigDTOFromMetadataForKnowledgeBaseType_ProjectsDigitalEmployeeProtocol(t *testing.T) {
	t.Parallel()

	cfg := StrategyConfigDTOFromMetadataForKnowledgeBaseType("digital_employee", map[string]any{
		documentdomain.ParseStrategyConfigKey: map[string]any{
			"parsing_type":     documentdomain.ParsingTypeQuick,
			"image_extraction": false,
			"table_extraction": false,
			"image_ocr":        false,
		},
	})
	if cfg == nil || cfg.ParsingType != 0 {
		t.Fatalf("expected digital employee quick protocol value, got %#v", cfg)
	}

	precise := StrategyConfigDTOFromMetadataForKnowledgeBaseType("digital_employee", map[string]any{
		documentdomain.ParseStrategyConfigKey: map[string]any{
			"parsing_type":     documentdomain.ParsingTypePrecise,
			"image_extraction": false,
			"table_extraction": true,
			"image_ocr":        true,
		},
	})
	if precise == nil || precise.ParsingType != 1 || precise.ImageExtraction || !precise.TableExtraction || !precise.ImageOCR {
		t.Fatalf("expected digital employee precise protocol value, got %#v", precise)
	}
}
