import { CrewKnowledge } from "@/types/crew-knowledge"
import {
	CHUNKING_STRATEGIES,
	CHUNK_SEPARATORS,
	PARSING_STRATEGIES,
	PREPROCESSING_RULES,
	type ChunkingStrategy,
	type ChunkSeparator,
	type PreprocessingRule,
} from "../constants/step-config"
import type { StrategyConfig } from "../store/local-document-store"

/**
 * 策略配置接口（通用）
 */
export interface StrategyConfigParams {
	chunkingStrategy: ChunkingStrategy
	chunkSeparator: ChunkSeparator
	maxChunkLength: number
	chunkOverlap: number
	chunkHierarchy: number
	preserveHierarchy: boolean
	preprocessingRules: PreprocessingRule[]
}

/**
 * 分隔符映射：前端UI值 → API值
 */
const SEPARATOR_MAP: Record<ChunkSeparator, string> = {
	[CHUNK_SEPARATORS.LINE_BREAK]: "\\n",
	[CHUNK_SEPARATORS.PARAGRAPH]: "\\n\\n",
	[CHUNK_SEPARATORS.CUSTOM]: "\\n\\n", // 自定义默认用段落分隔
}

/**
 * 预处理规则映射：前端UI值 → API枚举
 */
const PREPROCESSING_RULE_MAP: Record<PreprocessingRule, CrewKnowledge.TextPreprocessingRules> = {
	[PREPROCESSING_RULES.REPLACE_WHITESPACE]: CrewKnowledge.TextPreprocessingRules.REPLACE_SPACES,
	[PREPROCESSING_RULES.REMOVE_URLS]: CrewKnowledge.TextPreprocessingRules.REMOVE_URLS,
}

/**
 * 将前端策略配置转换为API所需的FragmentConfig
 *
 * 转换规则参考：@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/docs/分段策略配置说明.md
 */
export function buildFragmentConfig(
	strategyConfig: StrategyConfigParams,
): CrewKnowledge.FragmentConfig {
	// 构建文本预处理规则数组
	const textPreprocessRules = strategyConfig.preprocessingRules.map(
		(rule) => PREPROCESSING_RULE_MAP[rule],
	)

	// 根据分块策略返回不同配置
	switch (strategyConfig.chunkingStrategy) {
		case CHUNKING_STRATEGIES.AUTO:
			// 自动分段模式：只需要 mode
			return {
				mode: CrewKnowledge.SegmentationMode.AUTO,
			}

		case CHUNKING_STRATEGIES.HIERARCHICAL:
			// 层级分段模式：使用 hierarchy 配置
			return {
				mode: CrewKnowledge.SegmentationMode.HIERARCHY,
				hierarchy: {
					max_level: strategyConfig.chunkHierarchy,
					keep_hierarchy_info: strategyConfig.preserveHierarchy,
					text_preprocess_rule: [], // 层级模式暂不支持预处理规则
				},
			}

		case CHUNKING_STRATEGIES.CUSTOM:
		default:
			// 自定义分段模式：使用 normal 配置
			return {
				mode: CrewKnowledge.SegmentationMode.CUSTOM,
				normal: {
					text_preprocess_rule: textPreprocessRules,
					segment_rule: {
						separator: SEPARATOR_MAP[strategyConfig.chunkSeparator] || "\\n\\n",
						chunk_size: strategyConfig.maxChunkLength,
						chunk_overlap: strategyConfig.chunkOverlap,
					},
				},
			}
	}
}

/**
 * 从 FragmentConfig 反向解析出前端策略类型
 * 用于编辑时回显
 */
/**
 * 与本地文档 `revectorizeDocument` 一致：将 UI 策略转为 Crew 更新文档 API 的 strategy_config
 */
export function buildCrewStrategyConfigForApi(
	strategyConfig: StrategyConfig,
): CrewKnowledge.StrategyConfig {
	const isPreciseParsing =
		strategyConfig.parsingStrategy === PARSING_STRATEGIES.PRECISE &&
		strategyConfig.enablePreciseParsing

	return {
		parsing_type: isPreciseParsing ? 1 : 0,
		image_extraction: isPreciseParsing ? strategyConfig.extractImages : false,
		table_extraction: isPreciseParsing ? strategyConfig.extractTables : false,
		image_ocr: isPreciseParsing ? strategyConfig.extractOCR : false,
	}
}

export function getChunkingStrategyFromFragmentConfig(
	config?: CrewKnowledge.FragmentConfig,
): ChunkingStrategy {
	if (!config) return CHUNKING_STRATEGIES.AUTO

	const mode = config.mode

	switch (mode) {
		case CrewKnowledge.SegmentationMode.CUSTOM:
			return CHUNKING_STRATEGIES.CUSTOM
		case CrewKnowledge.SegmentationMode.AUTO:
			return CHUNKING_STRATEGIES.AUTO
		case CrewKnowledge.SegmentationMode.HIERARCHY:
			return CHUNKING_STRATEGIES.HIERARCHICAL
		default:
			return CHUNKING_STRATEGIES.AUTO
	}
}
