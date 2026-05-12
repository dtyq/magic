import { makeAutoObservable } from "mobx"
import type { StrategyConfig } from "./local-document-store"
import { DEFAULT_STRATEGY_CONFIG } from "../constants"
import type { KnowledgeSyncStatus, KnowledgeSyncProgress } from "@/types/source-binding"
import { CrewKnowledge } from "@/types/crew-knowledge"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

/**
 * 单个项目的选择信息
 */
export interface ProjectSelection {
	projectId: string
	projectName: string
	workspaceId: string
	isWholeProjectSelected: boolean
	selectedFileIds: string[]
	fileNodesMap: Map<string, AttachmentItem>
}

/**
 * Project Documents专用Store
 */
export class ProjectDocumentStore {
	// 第1步：选择工作区和项目（支持多项目）
	selectedWorkspaceId: string | null = null
	selectedWorkspaceName: string | null = null
	selectedProjects: ProjectSelection[] = [] // 改为项目数组
	isConfigUpdateMode = false // 编辑现有文档配置时，无需重新选择项目/文件
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

	// 第3步：处理进度
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
	 * 兼容性 getter：获取第一个项目ID（保持向后兼容）
	 */
	get selectedProjectId(): string | null {
		return this.selectedProjects.length > 0 ? this.selectedProjects[0].projectId : null
	}

	/**
	 * 兼容性 getter：获取第一个项目名称
	 */
	get selectedProjectName(): string | null {
		return this.selectedProjects.length > 0 ? this.selectedProjects[0].projectName : null
	}

	/**
	 * 兼容性 getter：获取第一个项目的文件选择
	 */
	get selectedFileIds(): string[] {
		return this.selectedProjects.length > 0 ? this.selectedProjects[0].selectedFileIds : []
	}

	/**
	 * 兼容性 getter：获取第一个项目是否选择整个项目
	 */
	get isWholeProjectSelected(): boolean {
		return this.selectedProjects.length > 0
			? this.selectedProjects[0].isWholeProjectSelected
			: false
	}

	/**
	 * 兼容性 getter：获取第一个项目的文件节点缓存
	 */
	get fileNodesMap(): Map<string, AttachmentItem> {
		return this.selectedProjects.length > 0 ? this.selectedProjects[0].fileNodesMap : new Map()
	}

	/**
	 * 设置选中的工作区
	 * @param workspaceId 工作区ID
	 * @param workspaceName 工作区名称
	 * @param clearProjects 是否清空已选择的项目（默认false，支持跨工作区选择）
	 */
	setSelectedWorkspace(
		workspaceId: string | null,
		workspaceName?: string | null,
		clearProjects = false,
	) {
		this.selectedWorkspaceId = workspaceId
		this.selectedWorkspaceName = workspaceName || null
		// 只有在明确要求时才清空项目选择
		if (clearProjects) {
			this.selectedProjects = []
		}
	}

	/**
	 * 添加或更新项目选择
	 */
	setSelectedProject(projectId: string | null, isWhole: boolean, projectName?: string | null) {
		if (!projectId) {
			return
		}

		// 查找是否已存在该项目
		const existingIndex = this.selectedProjects.findIndex((p) => p.projectId === projectId)

		if (existingIndex >= 0) {
			// 更新已存在的项目
			this.selectedProjects[existingIndex] = {
				...this.selectedProjects[existingIndex],
				projectName: projectName || this.selectedProjects[existingIndex].projectName,
				isWholeProjectSelected: isWhole,
				selectedFileIds: isWhole
					? []
					: this.selectedProjects[existingIndex].selectedFileIds,
				fileNodesMap: isWhole
					? new Map()
					: this.selectedProjects[existingIndex].fileNodesMap,
			}
		} else {
			// 添加新项目
			this.selectedProjects.push({
				projectId,
				projectName: projectName || "",
				workspaceId: this.selectedWorkspaceId || "",
				isWholeProjectSelected: isWhole,
				selectedFileIds: [],
				fileNodesMap: new Map(),
			})
		}
	}

	/**
	 * 移除项目
	 */
	removeProject(projectId: string) {
		this.selectedProjects = this.selectedProjects.filter((p) => p.projectId !== projectId)
	}

	/**
	 * 设置选中的文件（针对指定项目）
	 */
	setSelectedFiles(fileIds: string[], projectId?: string) {
		if (this.selectedProjects.length === 0) return

		// 如果指定了 projectId，找到对应的项目
		const targetIndex = projectId
			? this.selectedProjects.findIndex((p) => p.projectId === projectId)
			: 0

		if (targetIndex === -1) return

		this.selectedProjects[targetIndex] = {
			...this.selectedProjects[targetIndex],
			selectedFileIds: fileIds,
			isWholeProjectSelected:
				fileIds.length === 0
					? false
					: this.selectedProjects[targetIndex].isWholeProjectSelected,
		}
	}

	/**
	 * 缓存文件/文件夹节点信息（针对指定项目）
	 */
	cacheFileNodes(nodes: AttachmentItem[], projectId?: string) {
		if (this.selectedProjects.length === 0) return

		// 如果指定了 projectId，找到对应的项目
		const targetIndex = projectId
			? this.selectedProjects.findIndex((p) => p.projectId === projectId)
			: 0

		if (targetIndex === -1) return

		nodes.forEach((node) => {
			const fileId = node.file_id || node.filename
			if (fileId) {
				this.selectedProjects[targetIndex].fileNodesMap.set(fileId, node)
			}
		})
	}

	/**
	 * 获取选中文件的完整节点信息（针对当前第一个项目）
	 */
	getSelectedFileNodes(): AttachmentItem[] {
		if (this.selectedProjects.length === 0) return []

		return this.selectedProjects[0].selectedFileIds
			.map((id) => this.selectedProjects[0].fileNodesMap.get(id))
			.filter((node): node is AttachmentItem => node !== undefined)
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
	 * 构建 source_bindings 配置对象（支持多项目）
	 * 根据 AttachmentItem.is_directory 字段区分文件和文件夹类型
	 */
	buildSourceBindings(): CrewKnowledge.SourceBinding[] {
		return this.selectedProjects.map((project) => ({
			provider: CrewKnowledge.SourceProvider.PROJECT,
			root_type: CrewKnowledge.RootNodeType.PROJECT,
			root_ref: project.projectId,
			workspace_id: this.selectedWorkspaceId || undefined,
			workspace_type:
				this.selectedWorkspaceId === "shared" ? ("shared" as const) : ("normal" as const),
			sync_mode: this.enableRealtimeUpdates
				? CrewKnowledge.SyncMode.REALTIME
				: CrewKnowledge.SyncMode.MANUAL,
			enabled: true,
			sync_config: {},
			targets: project.isWholeProjectSelected
				? []
				: Array.from(project.fileNodesMap.values())
						.filter((node) =>
							project.selectedFileIds.includes(node.file_id || node.filename || ""),
						)
						.map((node) => ({
							target_type: node.is_directory
								? CrewKnowledge.TargetType.FOLDER
								: CrewKnowledge.TargetType.FILE,
							target_ref: node.file_id || node.filename || "",
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
					this.selectedWorkspaceId !== null &&
					this.selectedProjects.length > 0 &&
					this.selectedProjects.some(
						(p) => p.isWholeProjectSelected || p.selectedFileIds.length > 0,
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
		this.selectedWorkspaceId = null
		this.selectedWorkspaceName = null
		this.selectedProjects = []
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
