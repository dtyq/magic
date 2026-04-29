package config

import (
	"maps"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

const (
	knowledgeBaseTypeFlowVector      = "flow_vector"
	knowledgeBaseTypeDigitalEmployee = "digital_employee"
)

// StrategyConfigDTOToMetadataValue 将顶层 strategy_config DTO 归一化为持久化 metadata 值。
func StrategyConfigDTOToMetadataValue(cfg *StrategyConfigDTO) map[string]any {
	if cfg == nil {
		return nil
	}
	return documentdomain.BuildParseStrategyConfigValue(StrategyConfigDTOToParseOptions(cfg))
}

// StrategyConfigDTOToMetadataValueForKnowledgeBaseType 将顶层 strategy_config 按产品线归一化为 metadata 值。
func StrategyConfigDTOToMetadataValueForKnowledgeBaseType(
	knowledgeBaseType string,
	cfg *StrategyConfigDTO,
) map[string]any {
	if cfg == nil {
		return nil
	}
	return documentdomain.BuildParseStrategyConfigValue(
		StrategyConfigDTOToParseOptionsForKnowledgeBaseType(knowledgeBaseType, cfg),
	)
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

// StrategyConfigDTOFromMetadataForKnowledgeBaseType 从 metadata 提取并按产品线投影顶层 strategy_config。
func StrategyConfigDTOFromMetadataForKnowledgeBaseType(
	_ string,
	metadata map[string]any,
) *StrategyConfigDTO {
	options := documentdomain.ResolveDocumentParseOptionsFromMetadata(metadata)
	return strategyConfigDTOFromParseOptions(options)
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

// StrategyConfigDTOToParseOptionsForKnowledgeBaseType 将顶层 strategy_config 按产品线归一化为文档解析选项。
func StrategyConfigDTOToParseOptionsForKnowledgeBaseType(
	knowledgeBaseType string,
	cfg *StrategyConfigDTO,
) documentdomain.ParseOptions {
	if !isDigitalEmployeeKnowledgeBaseType(knowledgeBaseType) {
		return StrategyConfigDTOToParseOptions(cfg)
	}

	options := documentdomain.DefaultParseOptions()
	if cfg == nil {
		return options
	}

	if isDigitalEmployeeQuickStrategy(cfg) {
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

// ApplyStrategyConfigToMetadataForKnowledgeBaseType 将 strategy_config 按产品线应用到文档 metadata。
func ApplyStrategyConfigToMetadataForKnowledgeBaseType(
	base map[string]any,
	knowledgeBaseType string,
	strategy *StrategyConfigDTO,
) map[string]any {
	next := cloneMetadata(base)
	delete(next, documentdomain.ParseStrategyConfigKey)

	if strategyValue := StrategyConfigDTOToMetadataValueForKnowledgeBaseType(knowledgeBaseType, strategy); len(strategyValue) > 0 {
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

func strategyConfigDTOFromParseOptions(options documentdomain.ParseOptions) *StrategyConfigDTO {
	return &StrategyConfigDTO{
		ParsingType:     options.ParsingType,
		ImageExtraction: options.ImageExtraction,
		TableExtraction: options.TableExtraction,
		ImageOCR:        options.ImageOCR,
	}
}

func isDigitalEmployeeQuickStrategy(cfg *StrategyConfigDTO) bool {
	if cfg == nil {
		return false
	}

	switch cfg.ParsingType {
	case 0:
		return true
	default:
		return false
	}
}

func isDigitalEmployeeKnowledgeBaseType(knowledgeBaseType string) bool {
	return strings.EqualFold(strings.TrimSpace(knowledgeBaseType), knowledgeBaseTypeDigitalEmployee)
}
