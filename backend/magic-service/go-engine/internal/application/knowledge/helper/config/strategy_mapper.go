package config

import (
	"maps"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

// StrategyConfigDTOToMetadataValue 将顶层 strategy_config DTO 归一化为持久化 metadata 值。
func StrategyConfigDTOToMetadataValue(cfg *StrategyConfigDTO) map[string]any {
	if cfg == nil {
		return nil
	}
	return documentdomain.BuildParseStrategyConfigValue(StrategyConfigDTOToParseOptions(cfg))
}

// StrategyConfigDTOFromMetadata 从文档 metadata 中提取并标准化顶层 strategy_config DTO。
func StrategyConfigDTOFromMetadata(metadata map[string]any) *StrategyConfigDTO {
	options := documentdomain.ResolveDocumentParseOptionsFromMetadata(metadata)
	return &StrategyConfigDTO{
		ParsingType:     options.ParsingType,
		ImageExtraction: options.ImageExtraction,
		TableExtraction: options.TableExtraction,
		ImageOCR:        options.ImageOCR,
	}
}

// StrategyConfigDTOToParseOptions 将顶层 strategy_config DTO 归一化为文档解析选项。
func StrategyConfigDTOToParseOptions(cfg *StrategyConfigDTO) documentdomain.ParseOptions {
	options := documentdomain.DefaultParseOptions()
	if cfg == nil {
		return options
	}
	if cfg.ParsingType == documentdomain.ParsingTypeQuick {
		options.ParsingType = documentdomain.ParsingTypeQuick
		options.ImageExtraction = false
		options.TableExtraction = false
		options.ImageOCR = false
		return options
	}
	options.ParsingType = documentdomain.ParsingTypePrecise
	options.ImageExtraction = cfg.ImageExtraction
	options.TableExtraction = cfg.TableExtraction
	options.ImageOCR = cfg.ImageOCR
	return options
}

// ApplyStrategyConfigToMetadata 将顶层 strategy_config 应用到文档 metadata 中。
func ApplyStrategyConfigToMetadata(base map[string]any, strategy *StrategyConfigDTO) map[string]any {
	next := cloneMetadata(base)
	delete(next, documentdomain.ParseStrategyConfigKey)

	if strategyValue := StrategyConfigDTOToMetadataValue(strategy); len(strategyValue) > 0 {
		next[documentdomain.ParseStrategyConfigKey] = strategyValue
	}

	if len(next) == 0 {
		return nil
	}
	return next
}

func cloneMetadata(src map[string]any) map[string]any {
	if len(src) == 0 {
		return map[string]any{}
	}
	cloned := make(map[string]any, len(src))
	maps.Copy(cloned, src)
	return cloned
}
