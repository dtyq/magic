import { makeAutoObservable } from "mobx"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { calculateProgressFromSyncStatus } from "../../../constants/document-constants"
import {
	DEFAULT_STRATEGY_CONFIG,
	type ParsingStrategy,
	type ChunkingStrategy,
	type ChunkSeparator,
	type PreprocessingRule,
} from "../constants"

/**
 * 文档创建状态
 */
export interface DocumentCreationItem {
	fileId: string
	fileName: string
	status: "pending" | "creating" | "success" | "error"
	progress: number
	documentCode?: string
	syncStatus?: CrewKnowledge.DocumentSyncStatus
	error?: string
}

/**
 * 策略配置接口
 */
export interface StrategyConfig {
	// 文档解析策略
	parsingStrategy: ParsingStrategy
	enablePreciseParsing: boolean
	extractImages: boolean
	extractOCR: boolean
	extractTables: boolean
	// 分块策略
	chunkingStrategy: ChunkingStrategy
	enableChunkingConfig: boolean
	chunkSeparator: ChunkSeparator
	maxChunkLength: number
	chunkOverlap: number
	chunkHierarchy: number
	preserveHierarchy: boolean
	preprocessingRules: PreprocessingRule[]
}

/**
 * Custom Content专用Store
 */
export class CustomContentStore {
	// 第1步：文档内容
	documentName = ""
	documentContent = ""

	// 第2步：数据处理/文档创建
	createdDocument: DocumentCreationItem | null = null
	isCreating = false
	createError: string | null = null

	// 第3步：分块策略配置
	strategyConfig: StrategyConfig = {
		parsingStrategy: DEFAULT_STRATEGY_CONFIG.parsingStrategy,
		enablePreciseParsing: DEFAULT_STRATEGY_CONFIG.enablePreciseParsing,
		extractImages: DEFAULT_STRATEGY_CONFIG.extractImages,
		extractOCR: DEFAULT_STRATEGY_CONFIG.extractOCR,
		extractTables: DEFAULT_STRATEGY_CONFIG.extractTables,
		chunkingStrategy: DEFAULT_STRATEGY_CONFIG.chunkingStrategy,
		enableChunkingConfig: DEFAULT_STRATEGY_CONFIG.enableChunkingConfig,
		chunkSeparator: DEFAULT_STRATEGY_CONFIG.chunkSeparator,
		maxChunkLength: DEFAULT_STRATEGY_CONFIG.maxChunkLength,
		chunkOverlap: DEFAULT_STRATEGY_CONFIG.chunkOverlap,
		chunkHierarchy: DEFAULT_STRATEGY_CONFIG.chunkHierarchy,
		preserveHierarchy: DEFAULT_STRATEGY_CONFIG.preserveHierarchy,
		preprocessingRules: [...DEFAULT_STRATEGY_CONFIG.preprocessingRules],
	}

	// 预览数据
	previewData: any[] = []
	previewLoading = false

	// 知识库code，用于API调用
	readonly knowledgeCode: string

	constructor(knowledgeCode: string) {
		this.knowledgeCode = knowledgeCode
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 设置文档名称
	 */
	setDocumentName(name: string) {
		this.documentName = name
	}

	/**
	 * 设置文档内容
	 */
	setDocumentContent(content: string) {
		this.documentContent = content
	}

	/**
	 * 更新策略配置
	 */
	updateStrategyConfig(config: Partial<StrategyConfig>) {
		this.strategyConfig = { ...this.strategyConfig, ...config }
	}

	/**
	 * 设置创建的文档
	 */
	setCreatedDocument(doc: DocumentCreationItem | null) {
		this.createdDocument = doc
	}

	/**
	 * 更新创建中文档的上传进度
	 */
	updateCreatedDocumentProgress(progress: number) {
		if (!this.createdDocument) return

		this.createdDocument = {
			...this.createdDocument,
			progress: Math.max(this.createdDocument.progress, progress),
		}
	}

	/**
	 * 设置创建状态
	 */
	setIsCreating(isCreating: boolean) {
		this.isCreating = isCreating
	}

	/**
	 * 设置创建错误
	 */
	setCreateError(error: string | null) {
		this.createError = error
	}

	/**
	 * 更新文档同步状态
	 */
	updateDocumentSyncStatus(syncStatus: CrewKnowledge.DocumentSyncStatus) {
		if (this.createdDocument) {
			this.createdDocument = {
				...this.createdDocument,
				syncStatus,
				progress: calculateProgressFromSyncStatus(syncStatus),
			}
		}
	}

	/**
	 * 获取处理完成状态
	 */
	get processingComplete(): boolean {
		return (
			this.createdDocument?.syncStatus === CrewKnowledge.DocumentSyncStatus.SYNCED ||
			this.createdDocument?.syncStatus === CrewKnowledge.DocumentSyncStatus.SYNC_FAILED
		)
	}

	/**
	 * 设置预览数据
	 */
	setPreviewData(data: any[]) {
		this.previewData = data
	}

	/**
	 * 设置预览加载状态
	 */
	setPreviewLoading(loading: boolean) {
		this.previewLoading = loading
	}

	/**
	 * 检查是否可以进入下一步
	 */
	canGoNext(step: number): boolean {
		switch (step) {
			case 1:
				// 第1步：输入文本 - 检查文档名称和内容
				return this.documentName.trim() !== "" && this.documentContent.trim() !== ""
			case 2:
				// 第2步：分块策略配置 - 总是可以进入下一步
				return true
			case 3:
				// 第3步：数据处理 - 仅在向量化进入最终态后允许完成
				return this.processingComplete
			default:
				return false
		}
	}

	/**
	 * 重置Store
	 */
	reset() {
		this.documentName = ""
		this.documentContent = ""
		this.createdDocument = null
		this.isCreating = false
		this.createError = null
		this.strategyConfig = {
			parsingStrategy: DEFAULT_STRATEGY_CONFIG.parsingStrategy,
			enablePreciseParsing: DEFAULT_STRATEGY_CONFIG.enablePreciseParsing,
			extractImages: DEFAULT_STRATEGY_CONFIG.extractImages,
			extractOCR: DEFAULT_STRATEGY_CONFIG.extractOCR,
			extractTables: DEFAULT_STRATEGY_CONFIG.extractTables,
			chunkingStrategy: DEFAULT_STRATEGY_CONFIG.chunkingStrategy,
			enableChunkingConfig: DEFAULT_STRATEGY_CONFIG.enableChunkingConfig,
			chunkSeparator: DEFAULT_STRATEGY_CONFIG.chunkSeparator,
			maxChunkLength: DEFAULT_STRATEGY_CONFIG.maxChunkLength,
			chunkOverlap: DEFAULT_STRATEGY_CONFIG.chunkOverlap,
			chunkHierarchy: DEFAULT_STRATEGY_CONFIG.chunkHierarchy,
			preserveHierarchy: DEFAULT_STRATEGY_CONFIG.preserveHierarchy,
			preprocessingRules: [...DEFAULT_STRATEGY_CONFIG.preprocessingRules],
		}
		this.previewData = []
		this.previewLoading = false
	}
}
