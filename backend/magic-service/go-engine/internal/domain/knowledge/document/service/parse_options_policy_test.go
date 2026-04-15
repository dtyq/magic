package document_test

import (
	"testing"

	document "magic/internal/domain/knowledge/document/service"
)

func TestResolveDocumentParseOptionsFromMetadata_DefaultsToPrecise(t *testing.T) {
	t.Parallel()

	options := document.ResolveDocumentParseOptionsFromMetadata(nil)
	if options != document.DefaultParseOptions() {
		t.Fatalf("expected default parse options, got %#v", options)
	}
}

func TestResolveDocumentParseOptionsFromMetadata_UsesNewStrategyFields(t *testing.T) {
	t.Parallel()

	options := document.ResolveDocumentParseOptionsFromMetadata(map[string]any{
		document.ParseStrategyConfigKey: map[string]any{
			"parsing_type":     document.ParsingTypePrecise,
			"image_extraction": false,
			"table_extraction": true,
			"image_ocr":        false,
		},
	})
	if options.ParsingType != document.ParsingTypePrecise || options.ImageExtraction || !options.TableExtraction || options.ImageOCR {
		t.Fatalf("unexpected parse options: %#v", options)
	}
}

func TestResolveDocumentParseOptionsFromMetadata_QuickModeDisablesExtraExtraction(t *testing.T) {
	t.Parallel()

	options := document.ResolveDocumentParseOptionsFromMetadata(map[string]any{
		document.ParseStrategyConfigKey: map[string]any{
			"parsing_type":     document.ParsingTypeQuick,
			"image_extraction": true,
			"table_extraction": true,
			"image_ocr":        true,
		},
	})
	if options.ParsingType != document.ParsingTypeQuick {
		t.Fatalf("expected quick parsing type, got %#v", options)
	}
	if options.ImageExtraction || options.TableExtraction || options.ImageOCR {
		t.Fatalf("expected quick mode to disable extra parsing, got %#v", options)
	}
}

func TestResolveDocumentParseOptionsFromMetadata_SupportsLegacyStrategyFields(t *testing.T) {
	t.Parallel()

	options := document.ResolveDocumentParseOptionsFromMetadata(map[string]any{
		document.ParseStrategyConfigKey: map[string]any{
			"parse_mode":     "precise",
			"extract_images": false,
			"extract_tables": false,
			"enable_ocr":     true,
		},
	})
	if options.ParsingType != document.ParsingTypePrecise || options.ImageExtraction || options.TableExtraction || !options.ImageOCR {
		t.Fatalf("unexpected parse options from legacy fields: %#v", options)
	}
}

func TestBuildParseStrategyConfigValue_NormalizesQuickMode(t *testing.T) {
	t.Parallel()

	value := document.BuildParseStrategyConfigValue(document.ParseOptions{
		ParsingType:     document.ParsingTypeQuick,
		ImageExtraction: true,
		TableExtraction: true,
		ImageOCR:        true,
	})

	if got := value["parsing_type"]; got != document.ParsingTypeQuick {
		t.Fatalf("expected quick parsing_type, got %#v", value)
	}
	if value["image_extraction"] != false || value["table_extraction"] != false || value["image_ocr"] != false {
		t.Fatalf("expected quick mode to disable extras, got %#v", value)
	}
}
