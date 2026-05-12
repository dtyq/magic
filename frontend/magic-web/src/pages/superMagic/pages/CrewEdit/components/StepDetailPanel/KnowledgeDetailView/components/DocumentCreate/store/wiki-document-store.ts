import { makeAutoObservable } from "mobx"
import type { StrategyConfig } from "./local-document-store"
import { DEFAULT_STRATEGY_CONFIG } from "../constants"
import type {
	SourceBindingNode,
	KnowledgeSyncStatus,
	KnowledgeSyncProgress,
} from "@/types/source-binding"
import { CrewKnowledge } from "@/types/crew-knowledge"

/**
 * 单个知识库的选择信息
 */
export interface WikiSelection {
	wikiId: string
	wikiName: string
	isWholeWikiSelected: boolean
	selectedFileIds: string[]
	fileNodesMap: Map<string, SourceBindingNode>
}

/**
 * Enterprise Wiki专用Store
 */
export class WikiDocumentStore {
	// 第1步：选择企业知识库（支持多知识库）
	selectedWikis: WikiSelection[] = [] // 改为知识库数组
	isConfigUpdateMode = false // 编辑现有文档配置时，无需重新选择知识库
	enableRealtimeUpdates = true // 实时更新开关

	// 第2步：策略配置
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

	// 第3步:处理进度
	processingFiles: Array<{
		fileId: string
		fileName: string
		progress: number
		status?: "uploading" | "done" | "error"
		documentSyncStatus?: CrewKnowledge.DocumentSyncStatus
	}> = []
	processingComplete = false
	syncStatus: KnowledgeSyncStatus | null = null
	syncProgress: KnowledgeSyncProgress | null = null

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 兼容性 getter：获取第一个知识库ID
	 */
	get selectedWikiId(): string | null {
		return this.selectedWikis.length > 0 ? this.selectedWikis[0].wikiId : null
	}

	/**
	 * 兼容性 getter：获取第一个知识库名称
	 */
	get selectedWikiName(): string | null {
		return this.selectedWikis.length > 0 ? this.selectedWikis[0].wikiName : null
	}

	/**
	 * 兼容性 getter：获取第一个知识库的文件选择
	 */
	get selectedFileIds(): string[] {
		return this.selectedWikis.length > 0 ? this.selectedWikis[0].selectedFileIds : []
	}

	/**
	 * 兼容性 getter：获取第一个知识库是否选择整个知识库
	 */
	get isWholeWikiSelected(): boolean {
		return this.selectedWikis.length > 0 ? this.selectedWikis[0].isWholeWikiSelected : false
	}

	/**
	 * 兼容性 getter：获取第一个知识库的文件节点缓存
	 */
	get fileNodesMap(): Map<string, SourceBindingNode> {
		return this.selectedWikis.length > 0 ? this.selectedWikis[0].fileNodesMap : new Map()
	}

	/**
	 * 添加或更新知识库选择
	 */
	setSelectedWiki(wikiId: string | null, isWhole: boolean, wikiName?: string | null) {
		if (!wikiId) {
			return
		}

		// 查找是否已存在该知识库
		const existingIndex = this.selectedWikis.findIndex((w) => w.wikiId === wikiId)

		if (existingIndex >= 0) {
			// 更新已存在的知识库
			this.selectedWikis[existingIndex] = {
				...this.selectedWikis[existingIndex],
				wikiName: wikiName || this.selectedWikis[existingIndex].wikiName,
				isWholeWikiSelected: isWhole,
				selectedFileIds: isWhole ? [] : this.selectedWikis[existingIndex].selectedFileIds,
				fileNodesMap: isWhole ? new Map() : this.selectedWikis[existingIndex].fileNodesMap,
			}
		} else {
			// 添加新知识库
			this.selectedWikis.push({
				wikiId,
				wikiName: wikiName || "",
				isWholeWikiSelected: isWhole,
				selectedFileIds: [],
				fileNodesMap: new Map(),
			})
		}
	}

	/**
	 * 移除知识库
	 */
	removeWiki(wikiId: string) {
		this.selectedWikis = this.selectedWikis.filter((w) => w.wikiId !== wikiId)
	}

	/**
	 * 设置选中的文件（针对当前第一个知识库）
	 */
	/**
	 * 设置选中的文件（针对指定知识库）
	 */
	setSelectedFiles(fileIds: string[], wikiId?: string) {
		if (this.selectedWikis.length === 0) return

		// 如果指定了 wikiId，找到对应的知识库
		const targetIndex = wikiId ? this.selectedWikis.findIndex((w) => w.wikiId === wikiId) : 0

		if (targetIndex === -1) return

		this.selectedWikis[targetIndex] = {
			...this.selectedWikis[targetIndex],
			selectedFileIds: fileIds,
			isWholeWikiSelected:
				fileIds.length === 0 ? false : this.selectedWikis[targetIndex].isWholeWikiSelected,
		}
	}

	/**
	 * 缓存文件/文件夹节点信息（针对指定知识库）
	 */
	cacheFileNodes(nodes: SourceBindingNode[], wikiId?: string) {
		if (this.selectedWikis.length === 0) return

		// 如果指定了 wikiId，找到对应的知识库
		const targetIndex = wikiId ? this.selectedWikis.findIndex((w) => w.wikiId === wikiId) : 0

		if (targetIndex === -1) return

		nodes.forEach((node) => {
			this.selectedWikis[targetIndex].fileNodesMap.set(node.node_ref, node)
		})
	}

	/**
	 * 获取选中文件的完整节点信息（针对当前第一个知识库）
	 */
	getSelectedFileNodes(): SourceBindingNode[] {
		if (this.selectedWikis.length === 0) return []

		return this.selectedWikis[0].selectedFileIds
			.map((id) => this.selectedWikis[0].fileNodesMap.get(id))
			.filter((node): node is SourceBindingNode => node !== undefined)
	}

	/**
	 * 设置实时更新开关
	 */
	setEnableRealtimeUpdates(enabled: boolean) {
		this.enableRealtimeUpdates = enabled
	}

	/**
	 * 设置配置更新模式
	 */
	setConfigUpdateMode(enabled: boolean) {
		this.isConfigUpdateMode = enabled
	}

	/**
	 * 更新策略配置
	 */
	updateStrategyConfig(config: Partial<StrategyConfig>) {
		this.strategyConfig = { ...this.strategyConfig, ...config }
	}

	/**
	 * 初始化处理文件列表
	 */
	initProcessingFiles(files: Array<{ fileId: string; fileName: string }>) {
		this.processingFiles = files.map((f) => ({ ...f, progress: 0 }))
		this.processingComplete = false
	}

	/**
	 * 更新处理进度
	 */
	updateProcessingProgress(
		fileId: string,
		progress: number,
		status?: "uploading" | "done" | "error",
		documentSyncStatus?: CrewKnowledge.DocumentSyncStatus,
	) {
		this.processingFiles = this.processingFiles.map((item) =>
			item.fileId === fileId
				? {
						...item,
						progress,
						status,
						...(documentSyncStatus !== undefined ? { documentSyncStatus } : {}),
					}
				: item,
		)

		// 检查是否全部完成
		if (this.processingFiles.every((f) => f.progress === 100)) {
			this.processingComplete = true
		}
	}

	/**
	 * 更新同步进度
	 */
	updateSyncProgress(progress: KnowledgeSyncProgress) {
		this.syncStatus = progress.sync_status
		this.syncProgress = progress
	}

	/**
	 * 构建 source_bindings 配置对象（支持多知识库）
	 */
	buildSourceBindings(): CrewKnowledge.SourceBinding[] {
		return this.selectedWikis.map((wiki) => ({
			provider: CrewKnowledge.SourceProvider.TEAMSHARE,
			root_type: CrewKnowledge.RootNodeType.KNOWLEDGE_BASE,
			root_ref: wiki.wikiId,
			sync_mode: this.enableRealtimeUpdates
				? CrewKnowledge.SyncMode.REALTIME
				: CrewKnowledge.SyncMode.MANUAL,
			enabled: true,
			sync_config: {},
			targets: wiki.isWholeWikiSelected
				? []
				: Array.from(wiki.fileNodesMap.values())
						.filter((node) => wiki.selectedFileIds.includes(node.node_ref))
						.map((node) => ({
							target_type:
								node.node_type === "file"
									? CrewKnowledge.TargetType.FILE
									: CrewKnowledge.TargetType.FOLDER,
							target_ref: node.node_ref,
						})),
		}))
	}

	/**
	 * 检查是否可以进入下一步
	 */
	canGoNext(step: number): boolean {
		switch (step) {
			case 1:
				if (this.isConfigUpdateMode) return true
				return (
					this.selectedWikis.length > 0 &&
					this.selectedWikis.some(
						(w) => w.isWholeWikiSelected || w.selectedFileIds.length > 0,
					)
				)
			case 2:
				return true // 策略配置有默认值
			case 3:
				// 与 DataProcessingStep「完成」按钮一致：文档已建立即可（有处理行即表示已提交）；不等待向量同步终态
				return this.processingFiles.length > 0
			default:
				return false
		}
	}

	/**
	 * 重置Store
	 */
	reset() {
		this.selectedWikis = []
		this.isConfigUpdateMode = false
		this.enableRealtimeUpdates = true
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
		this.processingFiles = []
		this.processingComplete = false
		this.syncStatus = null
		this.syncProgress = null
	}
}
