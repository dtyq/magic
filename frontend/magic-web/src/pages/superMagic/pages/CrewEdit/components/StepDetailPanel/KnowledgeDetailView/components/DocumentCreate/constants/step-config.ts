import { DOCUMENT_TYPES, type DocumentType } from "./document-types"

/**
 * 步骤配置接口
 */
export interface StepConfig {
	number: number
	i18nKey: string
}

/**
 * 各文档类型的步骤配置
 */
export const STEP_CONFIGS: Record<DocumentType, StepConfig[]> = {
	[DOCUMENT_TYPES.LOCAL]: [
		{
			number: 1,
			i18nKey: "documentCreate.localDocuments.step1",
		},
		{
			number: 2,
			i18nKey: "documentCreate.localDocuments.step2",
		},
		{
			number: 3,
			i18nKey: "documentCreate.localDocuments.step3",
		},
		{
			number: 4,
			i18nKey: "documentCreate.localDocuments.step4",
		},
	],
	[DOCUMENT_TYPES.CUSTOM]: [
		{
			number: 1,
			i18nKey: "documentCreate.customContent.step1",
		},
		{
			number: 2,
			i18nKey: "documentCreate.customContent.step2",
		},
		{
			number: 3,
			i18nKey: "documentCreate.customContent.step3",
		},
	],
	[DOCUMENT_TYPES.PROJECT]: [
		{
			number: 1,
			i18nKey: "documentCreate.project.step1",
		},
		{
			number: 2,
			i18nKey: "documentCreate.project.step2",
		},
		{
			number: 3,
			i18nKey: "documentCreate.project.step3",
		},
	],
	[DOCUMENT_TYPES.WIKI]: [
		{
			number: 1,
			i18nKey: "documentCreate.enterpriseWiki.step1",
		},
		{
			number: 2,
			i18nKey: "documentCreate.enterpriseWiki.step2",
		},
		{
			number: 3,
			i18nKey: "documentCreate.enterpriseWiki.step3",
		},
	],
}

/**
 * 文件上传限制常量
 */
export const FILE_UPLOAD_LIMITS = {
	MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
	MAX_FILE_COUNT: 300,
	SUPPORTED_EXTENSIONS: [
		"txt",
		"md",
		"json",
		"xml",
		"html",
		"htm",
		"csv",
		"xlsx",
		"xlsm",
		"docx",
		"pptx",
		"pdf",
		"jpg",
		"jpeg",
		"png",
		"bmp",
	],
} as const

/**
 * 文档解析策略枚举
 */
export const PARSING_STRATEGIES = {
	QUICK: "quick",
	PRECISE: "precise",
} as const

export type ParsingStrategy = (typeof PARSING_STRATEGIES)[keyof typeof PARSING_STRATEGIES]

/**
 * 分块策略方法枚举
 */
export const CHUNKING_STRATEGIES = {
	AUTO: "auto",
	CUSTOM: "custom",
	HIERARCHICAL: "hierarchical",
} as const

export type ChunkingStrategy = (typeof CHUNKING_STRATEGIES)[keyof typeof CHUNKING_STRATEGIES]

/**
 * 分块分隔符枚举
 */
export const CHUNK_SEPARATORS = {
	LINE_BREAK: "lineBreak",
	PARAGRAPH: "paragraph",
	CUSTOM: "custom",
} as const

export type ChunkSeparator = (typeof CHUNK_SEPARATORS)[keyof typeof CHUNK_SEPARATORS]

/**
 * 文本预处理规则枚举
 */
export const PREPROCESSING_RULES = {
	REPLACE_WHITESPACE: "replaceWhitespace",
	REMOVE_URLS: "removeUrls",
} as const

export type PreprocessingRule = (typeof PREPROCESSING_RULES)[keyof typeof PREPROCESSING_RULES]

/**
 * 分块策略i18n key
 */
export const CHUNKING_STRATEGY_I18N_KEYS: Record<ChunkingStrategy, string> = {
	[CHUNKING_STRATEGIES.AUTO]: "documentCreate.strategy.autoChunkClean",
	[CHUNKING_STRATEGIES.CUSTOM]: "documentCreate.strategy.customChunking",
	[CHUNKING_STRATEGIES.HIERARCHICAL]: "documentCreate.strategy.hierarchical",
}

/**
 * 默认策略配置
 */
export const DEFAULT_STRATEGY_CONFIG = {
	parsingStrategy: PARSING_STRATEGIES.PRECISE as ParsingStrategy,
	enablePreciseParsing: true,
	extractImages: true,
	extractOCR: true,
	extractTables: true,
	chunkingStrategy: CHUNKING_STRATEGIES.AUTO as ChunkingStrategy,
	enableChunkingConfig: true,
	chunkSeparator: CHUNK_SEPARATORS.LINE_BREAK as ChunkSeparator,
	maxChunkLength: 800,
	chunkOverlap: 10,
	chunkHierarchy: 3,
	preserveHierarchy: true,
	preprocessingRules: [PREPROCESSING_RULES.REPLACE_WHITESPACE] as PreprocessingRule[],
} as const
