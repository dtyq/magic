import { makeAutoObservable } from "mobx"
// import { makePersistable } from "mobx-persist-store"
import { CrewKnowledge } from "@/types/crew-knowledge"
import {
	UPLOAD_STATUS,
	type UploadStatus,
	type ParsingStrategy,
	type ChunkingStrategy,
	type ChunkSeparator,
	type PreprocessingRule,
	DEFAULT_STRATEGY_CONFIG,
} from "../constants"
import type { ContentNode } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/types/content-node"

/**
 * 上传文件项接口
 */
export interface UploadFileItem {
	uid: string
	name: string
	file: File
	status: UploadStatus
	progress: number
	path?: string
	key?: string // 文件在对象存储中的key
	size: number
	error?: string // 错误信息（验证失败或上传失败的原因）
}

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
 * Local Documents专用Store
 */
export class LocalDocumentStore {
	// 第1步：文件上传
	uploadedFiles: UploadFileItem[] = []

	// 第2步:策略配置
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

	// 第3步：预览数据
	previewData: ContentNode[] = []
	previewLoading = false

	// 层级检测：文档是否包含层级结构（用于显示层级分块推荐）
	hasHierarchy = false

	// 第4步：处理进度/文档创建
	createdDocuments: DocumentCreationItem[] = []
	isCreating = false

	// 编辑模式：预填充的原始文件内容（用于预览）
	editModeOriginalContent: string | null = null

	// 知识库code，用于API调用和持久化key
	readonly knowledgeCode: string

	constructor(knowledgeCode: string) {
		this.knowledgeCode = knowledgeCode

		makeAutoObservable(this, {}, { autoBind: true })

		// 配置持久化 - 持久化上传文件和策略配置
		// makePersistable(this, {
		// 	name: `LocalDocumentStore_${knowledgeCode}`,
		// 	properties: ["uploadedFiles", "strategyConfig"],
		// 	storage: window.sessionStorage,
		// })
	}

	/**
	 * 添加文件到上传队列
	 */
	addFiles(files: File[]) {
		const newFiles: UploadFileItem[] = files.map((file) => ({
			uid: `${file.name}-${Date.now()}-${Math.random()}`,
			name: file.name,
			file,
			status: UPLOAD_STATUS.UPLOADING,
			progress: 0,
			size: file.size,
		}))

		this.uploadedFiles = [...this.uploadedFiles, ...newFiles]
	}

	/**
	 * 更新文件上传进度
	 */
	updateFileProgress(uid: string, progress: number) {
		this.uploadedFiles = this.uploadedFiles.map((item) =>
			item.uid === uid ? { ...item, progress } : item,
		)
	}

	/**
	 * 更新文件状态
	 */
	updateFileStatus(uid: string, status: UploadStatus, path?: string, error?: string) {
		this.uploadedFiles = this.uploadedFiles.map((item) =>
			item.uid === uid ? { ...item, status, path, key: path, progress: 100, error } : item,
		)
	}

	/**
	 * 移除文件
	 */
	removeFile(uid: string) {
		this.uploadedFiles = this.uploadedFiles.filter((item) => item.uid !== uid)
	}

	/**
	 * 更新策略配置
	 */
	updateStrategyConfig(config: Partial<StrategyConfig>) {
		this.strategyConfig = { ...this.strategyConfig, ...config }
	}

	/**
	 * 设置预览数据
	 */
	setPreviewData(data: ContentNode[]) {
		this.previewData = data
	}

	/**
	 * 设置预览加载状态
	 */
	setPreviewLoading(loading: boolean) {
		this.previewLoading = loading
	}

	/**
	 * 设置文档层级检测结果
	 */
	setHasHierarchy(hasHierarchy: boolean) {
		this.hasHierarchy = hasHierarchy
	}

	/**
	 * 设置编辑模式的原始内容
	 */
	setEditModeOriginalContent(content: string | null) {
		this.editModeOriginalContent = content
	}

	/**
	 * 初始化文档创建列表
	 */
	initCreatedDocuments() {
		this.createdDocuments = this.uploadedFiles
			.filter((f) => f.status === UPLOAD_STATUS.DONE && f.key)
			.map((f) => ({
				fileId: f.uid,
				fileName: f.name,
				status: "pending" as const,
				progress: 0,
			}))
	}

	/**
	 * 更新文档创建状态
	 */
	updateDocumentCreationStatus(
		fileId: string,
		updates: Partial<
			Pick<
				DocumentCreationItem,
				"status" | "progress" | "documentCode" | "syncStatus" | "error"
			>
		>,
	) {
		this.createdDocuments = this.createdDocuments.map((item) =>
			item.fileId === fileId ? { ...item, ...updates } : item,
		)
	}

	/**
	 * 设置创建状态
	 */
	setIsCreating(isCreating: boolean) {
		this.isCreating = isCreating
	}

	/**
	 * 获取处理完成状态
	 */
	get processingComplete(): boolean {
		if (this.createdDocuments.length === 0) return false
		// 所有文档都处于最终状态（成功或失败）
		return this.createdDocuments.every(
			(doc) => doc.status === "success" || doc.status === "error",
		)
	}

	/**
	 * 检查是否可以进入下一步
	 */
	canGoNext(step: number): boolean {
		switch (step) {
			case 1:
				// 必须有文件，且至少有一个文件上传成功，且没有正在上传中的文件
				return (
					this.uploadedFiles.length > 0 &&
					this.uploadedFiles.some((f) => f.status === UPLOAD_STATUS.DONE) &&
					!this.uploadedFiles.some((f) => f.status === UPLOAD_STATUS.UPLOADING)
				)
			case 2:
				return true // 策略配置有默认值
			case 3:
				return this.previewData.length > 0
			case 4:
				// 数据处理 - 仅在向量化进入最终态后允许完成
				return this.processingComplete
			default:
				return false
		}
	}

	/**
	 * 重置Store
	 */
	reset() {
		this.uploadedFiles = []
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
		this.createdDocuments = []
		this.isCreating = false
		this.editModeOriginalContent = null
	}
}
