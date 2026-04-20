package document

import "strings"

const (
	// ParseStrategyConfigKey 表示文档元数据里的解析策略配置字段。
	ParseStrategyConfigKey = "strategy_config"

	// ParsingTypeQuick 表示快速解析。
	ParsingTypeQuick = 0
	// ParsingTypePrecise 表示精细解析。
	ParsingTypePrecise = 1
)

// ParseOptions 表示文档解析链路需要的选项。
type ParseOptions struct {
	ParsingType     int
	ImageExtraction bool
	TableExtraction bool
	ImageOCR        bool
}

// DefaultParseOptions 返回保持现有行为的默认解析选项。
func DefaultParseOptions() ParseOptions {
	return ParseOptions{
		ParsingType:     ParsingTypePrecise,
		ImageExtraction: true,
		TableExtraction: true,
		ImageOCR:        true,
	}
}

// ResolveDocumentParseOptions 从文档元数据解析实际生效的解析选项。
func ResolveDocumentParseOptions(doc *KnowledgeBaseDocument) ParseOptions {
	if doc == nil {
		return DefaultParseOptions()
	}
	return ResolveDocumentParseOptionsFromMetadata(doc.DocMetadata)
}

// ResolveDocumentParseOptionsFromMetadata 从元数据映射解析实际生效的解析选项。
func ResolveDocumentParseOptionsFromMetadata(metadata map[string]any) ParseOptions {
	options := DefaultParseOptions()
	if len(metadata) == 0 {
		return options
	}

	rawStrategy, ok := metadata[ParseStrategyConfigKey]
	if !ok {
		return options
	}
	strategy, ok := rawStrategy.(map[string]any)
	if !ok || len(strategy) == 0 {
		return options
	}

	parsingType, hasParsingType := strategyInt(strategy, "parsing_type")
	if !hasParsingType {
		switch strings.ToLower(strings.TrimSpace(strategyString(strategy, "parse_mode"))) {
		case "quick":
			parsingType = ParsingTypeQuick
			hasParsingType = true
		case "precise":
			parsingType = ParsingTypePrecise
			hasParsingType = true
		}
	}
	if hasParsingType {
		options.ParsingType = normalizeParsingType(parsingType)
	}

	if options.ParsingType == ParsingTypeQuick {
		options.ImageExtraction = false
		options.TableExtraction = false
		options.ImageOCR = false
		return options
	}

	options.ImageExtraction = strategyBoolWithAliases(strategy, true, "image_extraction", "extract_images")
	options.TableExtraction = strategyBoolWithAliases(strategy, true, "table_extraction", "extract_tables")
	options.ImageOCR = strategyBoolWithAliases(strategy, true, "image_ocr", "enable_ocr")
	return options
}

func normalizeParsingType(value int) int {
	if value == ParsingTypeQuick {
		return ParsingTypeQuick
	}
	return ParsingTypePrecise
}

// BuildParseStrategyConfigValue 将解析选项标准化为 strategy_config 持久化值。
func BuildParseStrategyConfigValue(options ParseOptions) map[string]any {
	normalized := DefaultParseOptions()
	normalized.ParsingType = normalizeParsingType(options.ParsingType)
	if normalized.ParsingType == ParsingTypeQuick {
		normalized.ImageExtraction = false
		normalized.TableExtraction = false
		normalized.ImageOCR = false
	} else {
		normalized.ImageExtraction = options.ImageExtraction
		normalized.TableExtraction = options.TableExtraction
		normalized.ImageOCR = options.ImageOCR
	}
	return map[string]any{
		"parsing_type":     normalized.ParsingType,
		"image_extraction": normalized.ImageExtraction,
		"table_extraction": normalized.TableExtraction,
		"image_ocr":        normalized.ImageOCR,
	}
}

func strategyBoolWithAliases(strategy map[string]any, defaultValue bool, keys ...string) bool {
	for _, key := range keys {
		if value, ok := strategyBool(strategy, key); ok {
			return value
		}
	}
	return defaultValue
}

func strategyBool(strategy map[string]any, key string) (bool, bool) {
	if len(strategy) == 0 {
		return false, false
	}
	raw, ok := strategy[key]
	if !ok {
		return false, false
	}
	switch value := raw.(type) {
	case bool:
		return value, true
	case string:
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "true", "1", "yes", "y":
			return true, true
		case "false", "0", "no", "n":
			return false, true
		}
	case int:
		return value != 0, true
	case int32:
		return value != 0, true
	case int64:
		return value != 0, true
	case float64:
		return value != 0, true
	}
	return false, false
}

func strategyInt(strategy map[string]any, key string) (int, bool) {
	if len(strategy) == 0 {
		return 0, false
	}
	raw, ok := strategy[key]
	if !ok {
		return 0, false
	}
	switch value := raw.(type) {
	case int:
		return value, true
	case int32:
		return int(value), true
	case int64:
		return int(value), true
	case float64:
		return int(value), true
	}
	return 0, false
}

func strategyString(strategy map[string]any, key string) string {
	if len(strategy) == 0 {
		return ""
	}
	raw, ok := strategy[key]
	if !ok {
		return ""
	}
	value, ok := raw.(string)
	if !ok {
		return ""
	}
	return value
}
